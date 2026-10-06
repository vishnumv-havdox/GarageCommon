-- Migration: Fix assigned_mechanic RPC error in calculate_employee_payouts
-- Date: 2026-08-04

CREATE OR REPLACE FUNCTION public.calculate_employee_payouts(
    _period_start DATE,
    _period_end DATE,
    _admin_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    r_config RECORD;
    v_total_days NUMERIC;
    v_present_days NUMERIC;
    v_base_pay NUMERIC;
    v_overtime_pay NUMERIC;
    v_incentive_pay NUMERIC;
    v_total_payout NUMERIC;
    v_payout_id UUID;
    v_count INTEGER := 0;
    v_job_rate NUMERIC;
    v_completed_jobs INTEGER;
    v_overtime_rate NUMERIC;
    v_overtime_hours NUMERIC;
    v_deductions NUMERIC := 0;
    v_absence_count INTEGER;
    v_daily_rate NUMERIC;
    v_session_1_weight DECIMAL;
    v_session_2_weight DECIMAL;
    v_payout_exists UUID;
BEGIN
    -- Get Session Weights
    SELECT session_1_weight, session_2_weight 
    INTO v_session_1_weight, v_session_2_weight
    FROM public.workforce_settings 
    WHERE is_active = TRUE 
    LIMIT 1;

    -- Default if not set
    v_session_1_weight := COALESCE(v_session_1_weight, 0.5);
    v_session_2_weight := COALESCE(v_session_2_weight, 0.5);

    FOR r_config IN 
        SELECT * FROM public.employee_salary_configs WHERE is_active = TRUE
    LOOP
        -- Check if payout already exists for this period
        SELECT id INTO v_payout_exists FROM public.employee_payouts
        WHERE employee_id = r_config.employee_id 
        AND period_start = _period_start 
        AND period_end = _period_end;
        
        IF v_payout_exists IS NOT NULL THEN
            CONTINUE; -- Skip if already generated
        END IF;

        -- 1. Calculate Attendance (Session Based)
        SELECT 
            SUM(
                CASE 
                    WHEN status = 'paid-holiday' THEN 1.0 
                    WHEN status = 'present' OR status = 'overtime' THEN 
                        (CASE WHEN session_1 IS TRUE THEN v_session_1_weight ELSE 0 END) +
                        (CASE WHEN session_2 IS TRUE THEN v_session_2_weight ELSE 0 END)
                    WHEN status = 'half-day' THEN 
                         (CASE WHEN session_1 IS TRUE THEN v_session_1_weight ELSE 0 END) +
                         (CASE WHEN session_2 IS TRUE THEN v_session_2_weight ELSE 0 END)
                    ELSE 
                         (CASE WHEN session_1 IS TRUE THEN v_session_1_weight ELSE 0 END) +
                         (CASE WHEN session_2 IS TRUE THEN v_session_2_weight ELSE 0 END)
                END
            )
        INTO v_present_days
        FROM public.attendance 
        WHERE employee_id = r_config.employee_id 
          AND date >= _period_start AND date <= _period_end;

        v_present_days := COALESCE(v_present_days, 0);

        -- 2. Base Pay Calculation
        IF r_config.pay_type = 'daily' THEN
            v_base_pay := v_present_days * r_config.base_amount;
        ELSE 
            v_total_days := (_period_end - _period_start) + 1;
            v_daily_rate := r_config.base_amount / 26; 
            v_base_pay := (r_config.base_amount / 26) * v_present_days; 
        END IF;

        -- 3. Overtime
        SELECT COALESCE(SUM(overtime_hours), 0) INTO v_overtime_hours
        FROM public.attendance
        WHERE employee_id = r_config.employee_id
            AND date BETWEEN _period_start AND _period_end;
            
        v_overtime_pay := v_overtime_hours * r_config.overtime_rate;

        -- 4. Job Incentives
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
        SELECT COUNT(*) INTO v_completed_jobs FROM raw_completed_work;
          
        v_incentive_pay := v_completed_jobs * r_config.job_incentive_rate;

        -- Total
        v_total_payout := v_base_pay + v_overtime_pay + v_incentive_pay - v_deductions;

        -- Insert Payout Record with Payment Details
        INSERT INTO public.employee_payouts (
            employee_id, period_start, period_end, 
            base_calc, attendance_adj, job_incentives, overtime_pay, 
            deductions, total_amount, status, notes,
            payment_method, bank_name, account_number, ifsc_code, upi_id
        ) VALUES (
            r_config.employee_id, _period_start, _period_end,
            v_base_pay, 0, v_incentive_pay, v_overtime_pay,
            v_deductions, v_total_payout, 'draft', 
            'Generated via RPC. Days: ' || v_present_days,
            r_config.payment_method, r_config.bank_name, r_config.account_number, r_config.ifsc_code, r_config.upi_id
        );
        
        v_count := v_count + 1;
    END LOOP;

    RETURN v_count;
END;
$$;
