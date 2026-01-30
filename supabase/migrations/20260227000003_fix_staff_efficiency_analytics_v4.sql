-- Migration: 20260227000003_fix_staff_efficiency_analytics_v4
-- Description: Unify all sources for efficiency duration calculation

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
    WITH all_finished_work AS (
        -- Source 1: Legacy Assignments
        SELECT woa.employee_id, woa.work_order_id, COALESCE(woa.completed_at, wo.updated_at) as finished_at
        FROM public.work_order_assignments woa
        JOIN public.work_orders wo ON wo.id = woa.work_order_id
        WHERE wo.status = 'Completed'

        UNION

        -- Source 2: Multi-service assignments
        SELECT sae.employee_id, s.work_order_id, COALESCE(sae.completed_at, s.completed_at, wo.updated_at) as finished_at
        FROM public.work_order_service_employees sae
        JOIN public.work_order_services s ON s.id = sae.service_id
        JOIN public.work_orders wo ON wo.id = s.work_order_id
        WHERE sae.status IN ('Completed', 'Approved', 'pending_approval') 

        UNION

        -- Source 3: Granular tasks
        SELECT t.assigned_employee_id as employee_id, t.work_order_id, COALESCE(t.completed_at, t.updated_at) as finished_at
        FROM public.work_order_tasks t
        WHERE t.completed = true AND t.assigned_employee_id IS NOT NULL
    ),
    summarized_jobs AS (
        SELECT 
            employee_id,
            COUNT(DISTINCT work_order_id) as completed_count
        FROM all_finished_work
        GROUP BY employee_id
    ),
    task_durations AS (
        -- Unified Duration Sources
        
        -- 1. Granular Tasks
        SELECT 
            t.assigned_employee_id as employee_id,
            EXTRACT(EPOCH FROM (COALESCE(t.completed_at, t.updated_at) - t.created_at)) / 60 as duration_minutes
        FROM public.work_order_tasks t
        WHERE t.completed = true AND t.assigned_employee_id IS NOT NULL

        UNION ALL

        -- 2. Service Assignments
        SELECT 
            sae.employee_id,
            EXTRACT(EPOCH FROM (COALESCE(sae.completed_at, sae.updated_at) - COALESCE(sae.accepted_at, sae.assigned_at, sae.created_at))) / 60 as duration_minutes
        FROM public.work_order_service_employees sae
        WHERE sae.status IN ('Completed', 'Approved', 'pending_approval')

        UNION ALL

        -- 3. Legacy Assignments
        SELECT 
            woa.employee_id,
            EXTRACT(EPOCH FROM (COALESCE(woa.completed_at, woa.updated_at) - COALESCE(woa.accepted_at, woa.assigned_at, woa.created_at))) / 60 as duration_minutes
        FROM public.work_order_assignments woa
        WHERE woa.status = 'completed' OR woa.completed_at IS NOT NULL
    ),
    task_efficiency AS (
        SELECT 
            employee_id,
            AVG(duration_minutes) as avg_minutes
        FROM task_durations
        WHERE duration_minutes > 0 -- Ignore invalid/instant durations
        GROUP BY employee_id
    ),
    acceptance_stats AS (
        SELECT 
            employee_id,
            (COUNT(*) FILTER (WHERE status NOT IN ('Assigned', 'Rejected'))::numeric / NULLIF(COUNT(*), 0)) * 100 as rate
        FROM public.work_order_service_employees
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

-- Refresh schema
NOTIFY pgrst, 'reload schema';
