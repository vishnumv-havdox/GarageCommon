-- Migration: 20260227000014_attendance_arrears_mechanism
-- Description: Track attendance corrections for paid periods and carry forward as arrears

-- 1. Add arrears column to payouts
ALTER TABLE public.employee_payouts ADD COLUMN IF NOT EXISTS arrears_adj NUMERIC(12,2) DEFAULT 0;

-- 2. Create adjustments tracking table
CREATE TABLE IF NOT EXISTS public.payout_adjustments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    payout_id UUID REFERENCES public.employee_payouts(id) ON DELETE CASCADE, -- the paid payout where correction happened
    attendance_id UUID REFERENCES public.attendance(id) ON DELETE CASCADE,
    amount NUMERIC(12,2) NOT NULL,
    description TEXT,
    is_processed BOOLEAN DEFAULT false,
    processed_payout_id UUID REFERENCES public.employee_payouts(id) ON DELETE SET NULL, -- the new payout including this adjustment
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Trigger Function to capture corrections
CREATE OR REPLACE FUNCTION public.fn_capture_attendance_correction()
RETURNS TRIGGER AS $$
DECLARE
    v_payout RECORD;
    v_salary_config RECORD;
    v_old_val NUMERIC;
    v_new_val NUMERIC;
    v_delta_days NUMERIC;
    v_adj_amount NUMERIC := 0;
    v_daily_rate NUMERIC;
BEGIN
    -- Only trigger if status or overtime_hours changed
    IF (OLD.status IS NOT DISTINCT FROM NEW.status AND OLD.overtime_hours IS NOT DISTINCT FROM NEW.overtime_hours) THEN
        RETURN NEW;
    END IF;

    -- Check if there is a PAID payout for this date
    SELECT * INTO v_payout 
    FROM public.employee_payouts 
    WHERE employee_id = NEW.employee_id 
      AND period_start <= NEW.date AND period_end >= NEW.date
      AND status = 'paid'
    LIMIT 1;

    IF FOUND THEN
        -- Get salary config for the rate
        SELECT * INTO v_salary_config FROM public.employee_salary_configs WHERE employee_id = NEW.employee_id;
        
        IF NOT FOUND THEN RETURN NEW; END IF;

        -- Calculate values for status
        v_old_val := CASE WHEN OLD.status IN ('present', 'overtime') THEN 1.0 WHEN OLD.status = 'half-day' THEN 0.5 ELSE 0 END;
        v_new_val := CASE WHEN NEW.status IN ('present', 'overtime') THEN 1.0 WHEN NEW.status = 'half-day' THEN 0.5 ELSE 0 END;
        v_delta_days := v_new_val - v_old_val;

        IF v_salary_config.pay_type = 'monthly' THEN
            v_daily_rate := v_salary_config.base_amount / 30.0;
        ELSIF v_salary_config.pay_type = 'weekly' THEN
            v_daily_rate := v_salary_config.base_amount / 7.0;
        ELSIF v_salary_config.pay_type = 'daily' THEN
            v_daily_rate := v_salary_config.base_amount;
        ELSE
            v_daily_rate := 0;
        END IF;

        v_adj_amount := v_delta_days * v_daily_rate;

        -- Handle Overtime Hours change
        v_adj_amount := v_adj_amount + (COALESCE(NEW.overtime_hours, 0) - COALESCE(OLD.overtime_hours, 0)) * v_salary_config.overtime_rate;

        IF v_adj_amount != 0 THEN
            INSERT INTO public.payout_adjustments (
                employee_id,
                payout_id,
                attendance_id,
                amount,
                description
            ) VALUES (
                NEW.employee_id,
                v_payout.id,
                NEW.id,
                v_adj_amount,
                format('Correction for %s: %s -> %s', NEW.date, OLD.status, NEW.status)
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Apply Trigger
DROP TRIGGER IF EXISTS tr_capture_attendance_correction ON public.attendance;
CREATE TRIGGER tr_capture_attendance_correction
BEFORE UPDATE ON public.attendance
FOR EACH ROW EXECUTE FUNCTION public.fn_capture_attendance_correction();

-- 5. Update Payout RPC to include Arrears
DROP FUNCTION IF EXISTS public.calculate_employee_payouts(DATE, DATE, UUID);

CREATE OR REPLACE FUNCTION public.calculate_employee_payouts(
    _period_start DATE,
    _period_end DATE,
    _admin_id UUID
) RETURNS integer AS $$
DECLARE
    r_config RECORD;
    v_base_calc NUMERIC(12,2);
    v_attendance_adj NUMERIC(12,2) := 0;
    v_job_incentives NUMERIC(12,2) := 0;
    v_overtime_pay NUMERIC(12,2) := 0;
    v_arrears_adj NUMERIC(12,2) := 0;
    v_total_amount NUMERIC(12,2);
    v_absence_count INTEGER;
    v_present_days NUMERIC(4,1);
    v_unit_count INTEGER;
    v_ot_hours NUMERIC(6,2);
    v_generated_count INTEGER := 0;
    v_payout_id UUID;
BEGIN
    FOR r_config IN (
        SELECT esc.*, e.name 
        FROM public.employee_salary_configs esc
        JOIN public.employees e ON e.id = esc.employee_id
        WHERE esc.is_active = true
    ) LOOP
        v_generated_count := v_generated_count + 1;

        -- 1. Calculate Base and Attendance Adjustments
        IF r_config.pay_type = 'daily' THEN
            SELECT 
                SUM(CASE WHEN status = 'present' THEN 1 WHEN status = 'half-day' THEN 0.5 ELSE 0 END)
            INTO v_present_days
            FROM public.attendance 
            WHERE employee_id = r_config.employee_id 
              AND date >= _period_start AND date <= _period_end
              AND status IN ('present', 'half-day', 'overtime');
            
            v_base_calc := COALESCE(v_present_days, 0) * r_config.base_amount;
            v_attendance_adj := 0;
        ELSE
            SELECT COUNT(*) INTO v_absence_count 
            FROM public.attendance 
            WHERE employee_id = r_config.employee_id 
              AND date >= _period_start AND date <= _period_end
              AND status = 'absent';
            
            IF r_config.pay_type = 'monthly' THEN
                v_base_calc := r_config.base_amount;
                v_attendance_adj := -(v_base_calc / 30.0 * v_absence_count);
            ELSIF r_config.pay_type = 'weekly' THEN
                v_base_calc := r_config.base_amount; 
                v_attendance_adj := -(v_base_calc / 7.0 * v_absence_count);
            ELSE
                v_base_calc := 0;
            END IF;
        END IF;

        -- 2. Calculate Job Incentives
        WITH raw_completed_work AS (
            SELECT t.id FROM public.work_order_tasks t
            WHERE t.completed = true 
              AND t.assigned_employee_id = r_config.employee_id
              AND (COALESCE(t.completed_at, t.updated_at)::date BETWEEN _period_start AND _period_end)
            UNION ALL
            SELECT sae.id FROM public.work_order_service_employees sae
            JOIN public.work_order_services s ON s.id = sae.service_id
            WHERE (LOWER(sae.status) IN ('completed', 'approved', 'pending_approval') 
               OR LOWER(s.status) IN ('completed', 'approved', 'pending approval'))
              AND sae.employee_id = r_config.employee_id
              AND (COALESCE(sae.completed_at, sae.updated_at)::date BETWEEN _period_start AND _period_end)
            UNION ALL
            SELECT woa.id FROM public.work_order_assignments woa
            WHERE (LOWER(woa.status) = 'completed' OR woa.completed_at IS NOT NULL)
              AND woa.employee_id = r_config.employee_id
              AND (COALESCE(woa.completed_at, woa.updated_at)::date BETWEEN _period_start AND _period_end)
        )
        SELECT COUNT(*) INTO v_unit_count FROM raw_completed_work;
        v_job_incentives := v_unit_count * r_config.job_incentive_rate;

        -- 3. Calculate Overtime Pay
        SELECT SUM(overtime_hours) INTO v_ot_hours
        FROM public.attendance
        WHERE employee_id = r_config.employee_id
          AND date >= _period_start AND date <= _period_end;
        v_overtime_pay := COALESCE(v_ot_hours, 0) * r_config.overtime_rate;

        -- 4. Calculate Arrears (Gather unprocessed adjustments)
        SELECT COALESCE(SUM(amount), 0) INTO v_arrears_adj
        FROM public.payout_adjustments
        WHERE employee_id = r_config.employee_id AND is_processed = false;

        -- 5. Calculate Final Total
        v_total_amount := v_base_calc + v_attendance_adj + v_job_incentives + v_overtime_pay + r_config.allowances + v_arrears_adj;

        -- 6. Insert/Update Payout
        INSERT INTO public.employee_payouts (
            employee_id,
            period_start,
            period_end,
            base_calc,
            attendance_adj,
            job_incentives,
            overtime_pay,
            arrears_adj,
            total_amount,
            status,
            notes
        ) VALUES (
            r_config.employee_id,
            _period_start,
            _period_end,
            v_base_calc,
            v_attendance_adj,
            v_job_incentives,
            v_overtime_pay,
            v_arrears_adj,
            v_total_amount,
            'draft',
            CASE 
                WHEN v_arrears_adj != 0 THEN 'Includes ₹' || v_arrears_adj || ' in arrears from past corrections.'
                ELSE 'Regular payout period.'
            END
        )
        ON CONFLICT (employee_id, period_start, period_end)
        DO UPDATE SET
            base_calc = EXCLUDED.base_calc,
            attendance_adj = EXCLUDED.attendance_adj,
            job_incentives = EXCLUDED.job_incentives,
            overtime_pay = EXCLUDED.overtime_pay,
            arrears_adj = EXCLUDED.arrears_adj,
            total_amount = EXCLUDED.total_amount,
            notes = EXCLUDED.notes,
            updated_at = now()
        RETURNING id INTO v_payout_id;

        -- 7. Mark adjustments as processed for THIS payout
        UPDATE public.payout_adjustments 
        SET is_processed = true, processed_payout_id = v_payout_id
        WHERE employee_id = r_config.employee_id AND is_processed = false;
            
    END LOOP;
    
    RETURN v_generated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.calculate_employee_payouts(DATE, DATE, UUID) TO authenticated;

-- RLS for adjustments
ALTER TABLE public.payout_adjustments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins/Managers can manage adjustments" ON public.payout_adjustments
    FOR ALL USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'manager')));

NOTIFY pgrst, 'reload schema';
