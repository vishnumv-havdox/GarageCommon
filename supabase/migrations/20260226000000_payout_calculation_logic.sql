-- Migration: Employee Payout Calculation Logic
-- Date: 2026-01-30
-- Description: Function to automatically calculate payouts based on attendance and performance

CREATE OR REPLACE FUNCTION public.calculate_employee_payouts(
    _period_start DATE,
    _period_end DATE,
    _admin_id UUID
) RETURNS void AS $$
DECLARE
    r_config RECORD;
    v_base_calc NUMERIC(12,2);
    v_attendance_adj NUMERIC(12,2) := 0;
    v_job_incentives NUMERIC(12,2) := 0;
    v_overtime_pay NUMERIC(12,2) := 0;
    v_total_amount NUMERIC(12,2);
    v_absence_count INTEGER;
    v_job_count INTEGER;
    v_ot_hours NUMERIC(6,2);
BEGIN
    -- Loop through all active salary configurations
    FOR r_config IN (
        SELECT esc.*, e.name 
        FROM public.employee_salary_configs esc
        JOIN public.employees e ON e.id = esc.employee_id
        WHERE esc.is_active = true
    ) LOOP
        -- 1. Calculate Attendance Adjustments (Deductions for Absence)
        -- For simplicity: Monthly salary / 30 * absence days
        SELECT COUNT(*) INTO v_absence_count 
        FROM public.attendance 
        WHERE employee_id = r_config.employee_id 
          AND date >= _period_start AND date <= _period_end
          AND status = 'absent';
        
        IF r_config.pay_type = 'monthly' THEN
            v_base_calc := r_config.base_amount;
            v_attendance_adj := -(v_base_calc / 30 * v_absence_count);
        ELSIF r_config.pay_type = 'weekly' THEN
            v_base_calc := r_config.base_amount; -- assuming base is set for the period
            v_attendance_adj := -(v_base_calc / 7 * v_absence_count);
        ELSE
            v_base_calc := 0; -- per-job doesn't have base
        END IF;

        -- 2. Calculate Job Incentives
        -- Count work ordersdelivered in this period where this employee was assigned
        SELECT COUNT(DISTINCT wo.id) INTO v_job_count
        FROM public.work_orders wo
        JOIN public.work_order_assignments woa ON woa.work_order_id = wo.id
        WHERE woa.employee_id = r_config.employee_id
          AND wo.status = 'delivered'
          AND wo.updated_at::date >= _period_start AND wo.updated_at::date <= _period_end;
        
        v_job_incentives := v_job_count * r_config.job_incentive_rate;

        -- 3. Calculate Overtime Pay
        SELECT SUM(overtime_hours) INTO v_ot_hours
        FROM public.attendance
        WHERE employee_id = r_config.employee_id
          AND date >= _period_start AND date <= _period_end;
        
        v_overtime_pay := COALESCE(v_ot_hours, 0) * r_config.overtime_rate;

        -- 4. Calculate Final Total
        v_total_amount := v_base_calc + v_attendance_adj + v_job_incentives + v_overtime_pay + r_config.allowances;

        -- 5. Insert or Update Payout record (Draft)
        INSERT INTO public.employee_payouts (
            employee_id,
            period_start,
            period_end,
            base_calc,
            attendance_adj,
            job_incentives,
            overtime_pay,
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
            v_total_amount,
            'draft',
            'Auto-generated payout based on attendance and performance.'
        )
        ON CONFLICT (employee_id, period_start, period_end) -- Add unique constraint first
        DO UPDATE SET
            base_calc = EXCLUDED.base_calc,
            attendance_adj = EXCLUDED.attendance_adj,
            job_incentives = EXCLUDED.job_incentives,
            overtime_pay = EXCLUDED.overtime_pay,
            total_amount = EXCLUDED.total_amount,
            updated_at = now();
            
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add unique constraint to avoid duplicate payouts for same period
ALTER TABLE public.employee_payouts ADD CONSTRAINT employee_payouts_period_unique UNIQUE (employee_id, period_start, period_end);

GRANT EXECUTE ON FUNCTION public.calculate_employee_payouts(DATE, DATE, UUID) TO authenticated;
