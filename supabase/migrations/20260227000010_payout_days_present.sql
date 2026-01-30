-- Migration: 20260227000010_payout_days_present
-- Description: Add days_present to payouts and update calculation

-- 1. Add days_present column
ALTER TABLE public.employee_payouts ADD COLUMN IF NOT EXISTS days_present NUMERIC(4,1) DEFAULT 0;

-- 2. Update RPC to populate it
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
    v_total_amount NUMERIC(12,2);
    v_absence_count INTEGER;
    v_present_days NUMERIC(4,1);
    v_unit_count INTEGER;
    v_ot_hours NUMERIC(6,2);
    v_generated_count INTEGER := 0;
BEGIN
    FOR r_config IN (
        SELECT esc.*, e.name 
        FROM public.employee_salary_configs esc
        JOIN public.employees e ON e.id = esc.employee_id
        WHERE esc.is_active = true
    ) LOOP
        v_generated_count := v_generated_count + 1;

        -- 1. Calculate Base and Attendance Adjustments
        -- Get presence count regardless of pay type for reporting
        SELECT 
            SUM(CASE WHEN status = 'present' THEN 1 WHEN status = 'half-day' THEN 0.5 ELSE 0 END)
        INTO v_present_days
        FROM public.attendance 
        WHERE employee_id = r_config.employee_id 
          AND date >= _period_start AND date <= _period_end
          AND status IN ('present', 'half-day');

        IF r_config.pay_type = 'daily' THEN
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
                v_attendance_adj := -(v_base_calc / 30 * v_absence_count);
            ELSIF r_config.pay_type = 'weekly' THEN
                v_base_calc := r_config.base_amount; 
                v_attendance_adj := -(v_base_calc / 7 * v_absence_count);
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
              AND NOT EXISTS (
                  SELECT 1 FROM public.work_order_tasks t 
                  WHERE t.service_id = sae.service_id 
                  AND t.assigned_employee_id = sae.employee_id
                  AND t.completed = true
              )

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

        -- 4. Calculate Final Total
        v_total_amount := v_base_calc + v_attendance_adj + v_job_incentives + v_overtime_pay + r_config.allowances;

        -- 5. Insert/Update Payout
        INSERT INTO public.employee_payouts (
            employee_id,
            period_start,
            period_end,
            base_calc,
            attendance_adj,
            job_incentives,
            overtime_pay,
            days_present,
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
            COALESCE(v_present_days, 0),
            v_total_amount,
            'draft',
            CASE 
                WHEN r_config.pay_type = 'daily' THEN 'Daily wage for ' || COALESCE(v_present_days, 0) || ' days present.'
                ELSE 'Auto-generated based on attendance and ' || v_unit_count || ' completed units.'
            END
        )
        ON CONFLICT (employee_id, period_start, period_end)
        DO UPDATE SET
            base_calc = EXCLUDED.base_calc,
            attendance_adj = EXCLUDED.attendance_adj,
            job_incentives = EXCLUDED.job_incentives,
            overtime_pay = EXCLUDED.overtime_pay,
            days_present = EXCLUDED.days_present,
            total_amount = EXCLUDED.total_amount,
            notes = EXCLUDED.notes,
            updated_at = now();
            
    END LOOP;
    
    RETURN v_generated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.calculate_employee_payouts(DATE, DATE, UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
