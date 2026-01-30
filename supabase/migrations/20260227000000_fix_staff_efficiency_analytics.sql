-- Migration: 20260227000000_fix_staff_efficiency_analytics (Restored & Corrected)
-- Description: Update get_employee_analytics to use work_order_tasks and include service completions

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
        SELECT 
            assigned_employee_id as employee_id,
            COUNT(*) as completed_count,
            AVG(EXTRACT(EPOCH FROM (COALESCE(completed_at, updated_at) - created_at)) / 60.0) as avg_minutes
        FROM public.work_order_tasks
        WHERE completed = true 
        AND COALESCE(completed_at, updated_at) BETWEEN p_start_date AND p_end_date
        AND assigned_employee_id IS NOT NULL
        GROUP BY assigned_employee_id
    ),
    service_stats AS (
        SELECT 
            employee_id,
            COUNT(*) as completed_count
        FROM public.work_order_service_employees
        WHERE status IN ('Completed', 'Approved', 'pending_approval')
        AND completed_at BETWEEN p_start_date AND p_end_date
        GROUP BY employee_id
    ),
    acceptance_stats AS (
        SELECT 
            employee_id,
            (COUNT(*) FILTER (WHERE status NOT IN ('Assigned', 'Rejected'))::numeric / NULLIF(COUNT(*), 0)) * 100 as rate
        FROM public.work_order_service_employees
        WHERE assigned_at BETWEEN p_start_date AND p_end_date
        GROUP BY employee_id
    )
    SELECT 
        e.name as employee_name,
        COALESCE(p.department, 'General') as department,
        (COALESCE(ts.completed_count, 0) + COALESCE(ss.completed_count, 0))::bigint as completed_tasks,
        COALESCE(ts.avg_minutes, 0) as avg_task_completion_minutes,
        COALESCE(asig.rate, 100) as acceptance_rate
    FROM public.employees e
    LEFT JOIN public.positions p ON e.position_id = p.id
    LEFT JOIN task_stats ts ON ts.employee_id = e.id
    LEFT JOIN service_stats ss ON ss.employee_id = e.id
    LEFT JOIN acceptance_stats asig ON asig.employee_id = e.id
    GROUP BY e.id, e.name, p.department, ts.completed_count, ts.avg_minutes, ss.completed_count, asig.rate
    ORDER BY completed_tasks DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_employee_analytics(timestamptz, timestamptz) TO authenticated;

-- Refresh schema
NOTIFY pgrst, 'reload schema';
