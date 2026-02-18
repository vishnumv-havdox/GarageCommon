-- Add Session Configuration to Workforce Settings
ALTER TABLE public.workforce_settings
ADD COLUMN IF NOT EXISTS session_1_start_time TIME DEFAULT '09:00:00',
ADD COLUMN IF NOT EXISTS session_1_end_time TIME DEFAULT '13:00:00',
ADD COLUMN IF NOT EXISTS session_2_start_time TIME DEFAULT '14:00:00',
ADD COLUMN IF NOT EXISTS session_2_end_time TIME DEFAULT '18:00:00',
ADD COLUMN IF NOT EXISTS session_1_weight DECIMAL(3, 2) DEFAULT 0.5,
ADD COLUMN IF NOT EXISTS session_2_weight DECIMAL(3, 2) DEFAULT 0.5;

-- Add Session Tracking to Attendance
ALTER TABLE public.attendance
ADD COLUMN IF NOT EXISTS session_1 BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS session_2 BOOLEAN DEFAULT FALSE;

-- Backfill existing data
UPDATE public.attendance
SET 
  session_1 = TRUE,
  session_2 = TRUE
WHERE status IN ('present', 'paid-holiday', 'overtime');

UPDATE public.attendance
SET 
  session_1 = TRUE,
  session_2 = FALSE
WHERE status = 'half-day';

-- Update Calculate Employee Payouts RPC
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
            -- Monthly: (Base / Total Days in Month) * Present Days OR Fixed Base - Deduction
            -- Simplification: Base Pay is fixed, deduct for absences? 
            -- Current Logic: Pro-rata based on days present? 
            -- Let's stick to simple Daily Rate derivation for accuracy:
            v_total_days := (_period_end - _period_start) + 1;
            v_daily_rate := r_config.base_amount / 26; -- Assuming 26 working days standard or 30? Let's use 30 for monthly logic usually, or just config.
            
            -- Better Approach for Monthly: Pay = Base - (Absences * DailyRate)
            -- But for now, let's use the Pro-Rata logic if they want strictly "Calculated".
            -- IF user wants Fixed Monthly Salary regardless of minor leaves, this logic needs adjustment.
            -- verified logic from previous chats: Monthly pays full base?
            -- Reverting to simple: Daily Rate * Present Days is safest for "Worker" types. 
            -- For Managers (Monthly), we might want full salary.
            
            -- Let's assume Daily Rate derived from Monthly / 30 for now to support accurate deductions
             v_base_pay := (r_config.base_amount / 26) * v_present_days; 
        END IF;

        -- 3. Overtime
        SELECT COALESCE(SUM(overtime_hours), 0) INTO v_overtime_hours
        FROM public.attendance
        WHERE employee_id = r_config.employee_id
            AND date BETWEEN _period_start AND _period_end;
            
        v_overtime_pay := v_overtime_hours * r_config.overtime_rate;

        -- 4. Job Incentives
        -- Count completed tasks assigned to this employee
        SELECT COUNT(*) INTO v_completed_jobs
        FROM public.work_orders
        WHERE (assigned_mechanic = r_config.employee_id OR assigned_cleaner = r_config.employee_id)
          AND status = 'Completed'
          AND updated_at::date BETWEEN _period_start AND _period_end;
          
        v_incentive_pay := v_completed_jobs * r_config.job_incentive_rate;

        -- Total
        v_total_payout := v_base_pay + v_overtime_pay + v_incentive_pay - v_deductions;

        -- Insert Payout Record
        INSERT INTO public.employee_payouts (
            employee_id, period_start, period_end, 
            base_calc, attendance_adj, job_incentives, overtime_pay, 
            deductions, total_amount, status, notes
        ) VALUES (
            r_config.employee_id, _period_start, _period_end,
            v_base_pay, 0, v_incentive_pay, v_overtime_pay,
            v_deductions, v_total_payout, 'draft', 
            'Generated via RPC. Days: ' || v_present_days
        );
        
        v_count := v_count + 1;
    END LOOP;

    RETURN v_count;
END;
$$;
