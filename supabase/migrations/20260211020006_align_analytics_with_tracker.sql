-- Migration: Align Analytics with Employee Tracker
-- Date: 2026-01-30
-- Description: Unifies "Completed Tasks" metric to match "Jobs Done" from the Employee Tracker

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
    WITH all_completed_work AS (
        -- Source 1: Legacy Assignments where WO is completed
        SELECT woa.employee_id, woa.work_order_id, COALESCE(woa.completed_at, wo.updated_at) as finished_at
        FROM public.work_order_assignments woa
        JOIN public.work_orders wo ON wo.id = woa.work_order_id
        WHERE wo.status = 'Completed'

        UNION

        -- Source 2: Multi-service assignments where service or WO is completed
        SELECT sae.employee_id, s.work_order_id, COALESCE(sae.completed_at, s.completed_at, wo.updated_at) as finished_at
        FROM public.work_order_service_employees sae
        JOIN public.work_order_services s ON s.id = sae.service_id
        JOIN public.work_orders wo ON wo.id = s.work_order_id
        WHERE sae.status IN ('Completed', 'Approved', 'pending_approval') 
           OR s.status IN ('Completed', 'Approved', 'Pending Approval')
           OR wo.status = 'Completed'

        UNION

        -- Source 3: Granular tasks (keep these for completeness)
        SELECT e.id as employee_id, t.work_order_id, t.completed_at as finished_at
        FROM public.work_order_tasks t
        JOIN public.employees e ON (t.assigned_employee_id = e.id OR t.completed_by = e.user_id)
        WHERE t.completed = true
    ),
    summarized_jobs AS (
        SELECT 
            employee_id,
            COUNT(DISTINCT work_order_id) as completed_count
        FROM all_completed_work
        WHERE finished_at BETWEEN p_start_date AND p_end_date 
           OR finished_at IS NULL -- Fallback for legacy data
        GROUP BY employee_id
    ),
    task_efficiency AS (
        -- Efficiency still comes from the most granular level available
        SELECT 
            e.id as employee_id,
            AVG(EXTRACT(EPOCH FROM (COALESCE(t.completed_at, t.updated_at) - t.created_at)) / 60) as avg_minutes
        FROM public.work_order_tasks t
        JOIN public.employees e ON (t.assigned_employee_id = e.id OR t.completed_by = e.user_id)
        WHERE t.completed = true 
        AND COALESCE(t.completed_at, t.updated_at) BETWEEN p_start_date AND p_end_date
        GROUP BY e.id
    ),
    acceptance_stats AS (
        SELECT 
            employee_id,
            (COUNT(*) FILTER (WHERE status IN ('Accepted', 'Completed', 'Approved', 'pending_approval'))::numeric / NULLIF(COUNT(*), 0)) * 100 as rate
        FROM public.work_order_service_employees
        WHERE assigned_at BETWEEN p_start_date AND p_end_date
        GROUP BY employee_id
    )
    SELECT 
        e.name as employee_name,
        COALESCE(p.department, 'General') as department,
        COALESCE(sj.completed_count, 0)::bigint as completed_tasks,
        COALESCE(te.avg_minutes, 0) as avg_task_completion_minutes,
        COALESCE(asig.rate, 100) as acceptance_rate
    FROM public.employees e
    LEFT JOIN public.positions p ON e.position_id = p.id
    LEFT JOIN summarized_jobs sj ON sj.employee_id = e.id
    LEFT JOIN task_efficiency te ON te.employee_id = e.id
    LEFT JOIN acceptance_stats asig ON asig.employee_id = e.id
    GROUP BY e.id, e.name, p.department, sj.completed_count, te.avg_minutes, asig.rate
    ORDER BY completed_tasks DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_employee_analytics(timestamptz, timestamptz) TO authenticated;

NOTIFY pgrst, 'reload schema';
