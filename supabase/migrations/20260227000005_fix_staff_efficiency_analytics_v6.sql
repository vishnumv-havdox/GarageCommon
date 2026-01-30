-- Migration: 20260227000005_fix_staff_efficiency_analytics_v6
-- Description: Clean up durations and add a safety floor to prevent infinite efficiency

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
        -- Source 1: Legacy Assignments
        SELECT 
            woa.employee_id, 
            woa.work_order_id, 
            COALESCE(woa.completed_at, wo.updated_at) as finished_at,
            GREATEST(1, EXTRACT(EPOCH FROM (COALESCE(woa.completed_at, woa.updated_at) - COALESCE(woa.accepted_at, woa.assigned_at, woa.created_at))) / 60) as duration_minutes
        FROM public.work_order_assignments woa
        JOIN public.work_orders wo ON wo.id = woa.work_order_id
        WHERE (LOWER(wo.status) = 'completed' OR wo.completed_at IS NOT NULL OR LOWER(woa.status) = 'completed')
          AND (COALESCE(woa.completed_at, wo.updated_at) BETWEEN p_start_date AND p_end_date OR COALESCE(woa.completed_at, wo.updated_at) IS NULL)

        UNION ALL

        -- Source 2: Multi-service assignments
        SELECT 
            sae.employee_id, 
            s.work_order_id, 
            COALESCE(sae.completed_at, s.completed_at, wo.updated_at) as finished_at,
            GREATEST(1, EXTRACT(EPOCH FROM (COALESCE(sae.completed_at, sae.updated_at) - COALESCE(sae.accepted_at, sae.assigned_at, sae.created_at))) / 60) as duration_minutes
        FROM public.work_order_service_employees sae
        JOIN public.work_order_services s ON s.id = sae.service_id
        JOIN public.work_orders wo ON wo.id = s.work_order_id
        WHERE (LOWER(sae.status) IN ('completed', 'approved', 'pending_approval') 
           OR LOWER(s.status) IN ('completed', 'approved', 'pending approval')
           OR LOWER(wo.status) = 'completed')
          AND (COALESCE(sae.completed_at, s.completed_at, wo.updated_at) BETWEEN p_start_date AND p_end_date OR COALESCE(sae.completed_at, s.completed_at, wo.updated_at) IS NULL)

        UNION ALL

        -- Source 3: Granular tasks
        SELECT 
            t.assigned_employee_id as employee_id, 
            t.work_order_id, 
            COALESCE(t.completed_at, t.updated_at) as finished_at,
            GREATEST(1, EXTRACT(EPOCH FROM (COALESCE(t.completed_at, t.updated_at) - t.created_at)) / 60) as duration_minutes
        FROM public.work_order_tasks t
        WHERE t.completed = true 
          AND t.assigned_employee_id IS NOT NULL
          AND (COALESCE(t.completed_at, t.updated_at) BETWEEN p_start_date AND p_end_date OR COALESCE(t.completed_at, t.updated_at) IS NULL)
    ),
    summarized_metrics AS (
        SELECT 
            employee_id,
            COUNT(DISTINCT work_order_id) as completed_count,
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
