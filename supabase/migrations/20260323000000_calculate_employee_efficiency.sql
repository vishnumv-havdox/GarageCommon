-- Migration: calculate_employee_efficiency
-- Description: RPC to calculate employee efficiency based on attendance vs benchmarked task completion times

-- 1. Helper Function: Get Global Service Averages
-- This calculates the baseline duration for each service type across the entire company
CREATE OR REPLACE FUNCTION public.get_global_service_averages()
RETURNS TABLE (service_type TEXT, avg_hours NUMERIC) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.service_type,
        COALESCE(AVG(EXTRACT(EPOCH FROM (sae.completed_at - sae.accepted_at))/3600)::NUMERIC, 1.0) as avg_hours
    FROM public.work_order_service_employees sae
    JOIN public.work_order_services s ON s.id = sae.service_id
    WHERE sae.status = 'Completed' 
      AND sae.accepted_at IS NOT NULL 
      AND sae.completed_at IS NOT NULL
    GROUP BY s.service_type;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Main RPC: Calculate Employee Efficiency
CREATE OR REPLACE FUNCTION public.calculate_employee_efficiency(
    p_employee_id UUID,
    p_start_date DATE,
    p_end_date DATE
)
RETURNS JSONB AS $$
DECLARE
    v_total_worked_hours NUMERIC := 0;
    v_total_earned_hours NUMERIC := 0;
    v_total_tasks_completed INTEGER := 0;
    v_days_present INTEGER := 0;
    v_total_period_days INTEGER;
    v_efficiency_score NUMERIC := 0;
    v_availability_score NUMERIC := 0;
    v_result JSONB;
BEGIN
    -- A. Calculate Total Worked Hours and Attendance Days
    SELECT 
        COALESCE(SUM(total_hours), 0),
        COUNT(*) FILTER (WHERE status = 'present' OR status = 'overtime' OR status = 'half-day')
    INTO v_total_worked_hours, v_days_present
    FROM public.attendance
    WHERE employee_id = p_employee_id
      AND date >= p_start_date
      AND date <= p_end_date;

    -- B. Calculate Earned Hours (Benchmarks)
    -- Joins employee's completed tasks with the global averages for those service types
    SELECT 
        COALESCE(SUM(COALESCE(avg_data.avg_hours, 1.0)), 0), -- Default to 1 hour if no benchmark available
        COUNT(*)
    INTO v_total_earned_hours, v_total_tasks_completed
    FROM public.work_order_service_employees sae
    JOIN public.work_order_services s ON s.id = sae.service_id
    LEFT JOIN (SELECT * FROM public.get_global_service_averages()) avg_data ON s.service_type = avg_data.service_type
    WHERE sae.employee_id = p_employee_id
      AND sae.status IN ('Completed', 'Approved')
      AND COALESCE(sae.completed_at, sae.updated_at)::DATE >= p_start_date
      AND COALESCE(sae.completed_at, sae.updated_at)::DATE <= p_end_date;

    -- C. Calculate Ratios
    v_total_period_days := (p_end_date - p_start_date) + 1;
    
    IF v_total_worked_hours > 0 THEN
        v_efficiency_score := (v_total_earned_hours / v_total_worked_hours) * 100;
    END IF;

    IF v_total_period_days > 0 THEN
        v_availability_score := (v_days_present::NUMERIC / v_total_period_days::NUMERIC) * 100;
    END IF;

    -- D. Build Result
    v_result := jsonb_build_object(
        'efficiency_score', ROUND(v_efficiency_score, 1),
        'availability_score', ROUND(v_availability_score, 1),
        'total_hours_worked', ROUND(v_total_worked_hours, 1),
        'earned_hours', ROUND(v_total_earned_hours, 1),
        'tasks_completed', v_total_tasks_completed,
        'days_present', v_days_present,
        'period_days', v_total_period_days,
        'explanation', CASE 
            WHEN v_total_worked_hours = 0 THEN 'No attendance recorded in this period.'
            WHEN v_total_earned_hours = 0 THEN 'No tasks completed in this period to benchmark efficiency.'
            ELSE format('Based on %s completed tasks (avg. benchmark: %s hrs) vs %s actual worked hours.', 
                        v_total_tasks_completed, v_total_earned_hours, v_total_worked_hours)
        END
    );

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.get_global_service_averages() TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_employee_efficiency(UUID, DATE, DATE) TO authenticated;

-- Refresh PostgREST
NOTIFY pgrst, 'reload schema';
