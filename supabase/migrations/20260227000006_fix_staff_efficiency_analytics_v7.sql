-- Migration: 20260227000006_fix_staff_efficiency_analytics_v7
-- Description: Count individual work units (Services/Tasks) instead of distinct Work Orders

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
    WITH raw_completed_work AS (
        -- Source 1: Granular tasks (Highest priority for counting)
        SELECT 
            t.assigned_employee_id as employee_id, 
            t.id as unit_id,
            COALESCE(t.completed_at, t.updated_at) as finished_at,
            GREATEST(1, EXTRACT(EPOCH FROM (COALESCE(t.completed_at, t.updated_at) - t.created_at)) / 60) as duration_minutes
        FROM public.work_order_tasks t
        WHERE t.completed = true 
          AND t.assigned_employee_id IS NOT NULL
          AND (COALESCE(t.completed_at, t.updated_at) BETWEEN p_start_date AND p_end_date OR COALESCE(t.completed_at, t.updated_at) IS NULL)

        UNION ALL

        -- Source 2: Service assignments that DO NOT have granular tasks assigned to the same employee
        -- This prevents double counting the service and its constituent tasks
        SELECT 
            sae.employee_id, 
            sae.id as unit_id,
            COALESCE(sae.completed_at, sae.updated_at) as finished_at,
            GREATEST(1, EXTRACT(EPOCH FROM (COALESCE(sae.completed_at, sae.updated_at) - COALESCE(sae.accepted_at, sae.assigned_at, sae.created_at))) / 60) as duration_minutes
        FROM public.work_order_service_employees sae
        JOIN public.work_order_services s ON s.id = sae.service_id
        WHERE (LOWER(sae.status) IN ('completed', 'approved', 'pending_approval') 
           OR LOWER(s.status) IN ('completed', 'approved', 'pending approval'))
          AND (COALESCE(sae.completed_at, sae.updated_at) BETWEEN p_start_date AND p_end_date OR COALESCE(sae.completed_at, sae.updated_at) IS NULL)
          AND NOT EXISTS (
              SELECT 1 FROM public.work_order_tasks t 
              WHERE t.service_id = sae.service_id 
              AND t.assigned_employee_id = sae.employee_id
              AND t.completed = true
          )

        UNION ALL

        -- Source 3: Legacy Assignments
        SELECT 
            woa.employee_id, 
            woa.id as unit_id,
            COALESCE(woa.completed_at, woa.updated_at) as finished_at,
            GREATEST(1, EXTRACT(EPOCH FROM (COALESCE(woa.completed_at, woa.updated_at) - COALESCE(woa.accepted_at, woa.assigned_at, woa.created_at))) / 60) as duration_minutes
        FROM public.work_order_assignments woa
        WHERE (LOWER(woa.status) = 'completed' OR woa.completed_at IS NOT NULL)
          AND (COALESCE(woa.completed_at, woa.updated_at) BETWEEN p_start_date AND p_end_date OR COALESCE(woa.completed_at, woa.updated_at) IS NULL)
    ),
    summarized_metrics AS (
        SELECT 
            employee_id,
            COUNT(*) as completed_count,
            AVG(duration_minutes) as avg_minutes 
        FROM raw_completed_work
        GROUP BY employee_id
    ),
    acceptance_stats AS (
        SELECT 
            sae.employee_id,
            (COUNT(*) FILTER (WHERE LOWER(status) NOT IN ('assigned', 'rejected'))::numeric / NULLIF(COUNT(*), 0)) * 100 as rate
        FROM public.work_order_service_employees sae
        WHERE (assigned_at BETWEEN p_start_date AND p_end_date OR assigned_at IS NULL)
        GROUP BY employee_id
    )
    SELECT 
        e.name as employee_name,
        COALESCE(p.department, 'General') as department,
        COALESCE(sm.completed_count, 0)::bigint as completed_tasks,
        COALESCE(sm.avg_minutes, 0) as avg_task_completion_minutes,
        COALESCE(asig.rate, 100) as acceptance_rate
    FROM public.employees e
    LEFT JOIN public.positions p ON e.position_id = p.id
    LEFT JOIN summarized_metrics sm ON sm.employee_id = e.id
    LEFT JOIN acceptance_stats asig ON asig.employee_id = e.id
    GROUP BY e.id, e.name, p.department, sm.completed_count, sm.avg_minutes, asig.rate
    ORDER BY completed_tasks DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_employee_analytics(timestamptz, timestamptz) TO authenticated;

-- Refresh schema
NOTIFY pgrst, 'reload schema';
