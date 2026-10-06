-- Migration: Robust Employee Analytics
-- Date: 2026-01-30
-- Description: Ensures completed tasks are counted even without completed_at timestamp, and includes service completions.

CREATE OR REPLACE FUNCTION public.get_employee_analytics(
    p_start_date timestamptz DEFAULT (now() - interval '30 days'),
    p_end_date timestamptz DEFAULT now()
)
RETURNS TABLE (
    employee_name text,
    department text,
    completed_tasks bigint,
    avg_task_completion_minutes numeric,
    acceptance_rate numeric
) AS $$
BEGIN
    RETURN QUERY
    WITH task_stats AS (
        -- Count granular tasks from work_order_tasks
        SELECT 
            completed_by,
            COUNT(*) as completed_count,
            AVG(EXTRACT(EPOCH FROM (COALESCE(completed_at, updated_at) - created_at)) / 60) as avg_minutes
        FROM public.work_order_tasks
        WHERE completed = true 
        AND COALESCE(completed_at, updated_at) BETWEEN p_start_date AND p_end_date
        GROUP BY completed_by
    ),
    assignment_stats AS (
        -- Track acceptance rate and completed services
        SELECT 
            employee_id,
            COUNT(*) FILTER (WHERE status = 'Completed' OR status = 'Approved') as completed_services_count,
            (COUNT(*) FILTER (WHERE status = 'Accepted' OR status = 'Completed' OR status = 'Approved')::numeric / NULLIF(COUNT(*), 0)) * 100 as rate
        FROM public.work_order_service_employees
        WHERE (assigned_at BETWEEN p_start_date AND p_end_date OR completed_at BETWEEN p_start_date AND p_end_date)
        GROUP BY employee_id
    )
    SELECT 
        e.name as employee_name,
        COALESCE(p.department, 'General') as department,
        -- Sum both granular tasks and service-level completions to be safe, 
        -- but usually tasks are the better metric. 
        -- If user says "fixed more", maybe they are finishing services without tasks.
        (COALESCE(ts.completed_count, 0) + COALESCE(asig.completed_services_count, 0))::bigint as completed_tasks,
        COALESCE(ts.avg_minutes, 0) as avg_task_completion_minutes,
        COALESCE(asig.rate, 100) as acceptance_rate
    FROM public.employees e
    LEFT JOIN public.positions p ON e.position_id = p.id
    LEFT JOIN task_stats ts ON ts.completed_by = e.user_id
    LEFT JOIN assignment_stats asig ON asig.employee_id = e.id
    GROUP BY e.id, e.name, e.user_id, p.department, ts.completed_count, ts.avg_minutes, asig.completed_services_count, asig.rate
    ORDER BY completed_tasks DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_employee_analytics(timestamptz, timestamptz) TO authenticated;

NOTIFY pgrst, 'reload schema';
