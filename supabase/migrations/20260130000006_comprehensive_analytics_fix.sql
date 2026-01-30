-- Migration: Comprehensive Analytics Fix
-- Date: 2026-01-30
-- Description: Fixes column references and joins in analytics functions

-- 1. Fix Operational Analytics (performed_at -> created_at)
CREATE OR REPLACE FUNCTION public.get_operational_analytics(
    p_start_date timestamptz DEFAULT (now() - interval '30 days'),
    p_end_date timestamptz DEFAULT now()
)
RETURNS JSON AS $$
DECLARE
    v_total_serviced integer;
    v_status_counts json;
    v_avg_turnaround interval;
    v_rework_rate numeric;
BEGIN
    -- Total vehicles serviced (Completed/Delivered)
    SELECT count(*) INTO v_total_serviced
    FROM public.work_orders
    WHERE (status = 'Completed' OR status = 'Approved')
    AND created_at BETWEEN p_start_date AND p_end_date;

    -- Work orders by status
    SELECT json_object_agg(status, count) INTO v_status_counts
    FROM (
        SELECT status, count(*) as count
        FROM public.work_orders
        WHERE created_at BETWEEN p_start_date AND p_end_date
        GROUP BY status
    ) s;

    -- Average turnaround time (From created_at to completed_at)
    SELECT avg(completed_at - created_at) INTO v_avg_turnaround
    FROM public.work_orders
    WHERE status = 'Completed' AND completed_at IS NOT NULL
    AND created_at BETWEEN p_start_date AND p_end_date;

    -- Rework rate (Repairs reopened)
    SELECT (count(*)::numeric / NULLIF(v_total_serviced, 0)) * 100 INTO v_rework_rate
    FROM public.repair_task_history
    WHERE action = 'reopened'
    AND created_at BETWEEN p_start_date AND p_end_date;

    RETURN json_build_object(
        'total_serviced', v_total_serviced,
        'status_counts', v_status_counts,
        'avg_turnaround_hours', extract(epoch from v_avg_turnaround) / 3600,
        'rework_rate', COALESCE(v_rework_rate, 0)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Fix Employee Analytics (Missing department join)
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
    SELECT 
        e.name as employee_name,
        COALESCE(p.department, 'General') as department,
        count(rt.id) filter (where rt.status = 'completed') as completed_tasks,
        avg(extract(epoch from (rt.completed_at - rt.created_at)) / 60) filter (where rt.status = 'completed') as avg_task_completion_minutes,
        (count(sae.id) filter (where sae.status = 'Accepted')::numeric / NULLIF(count(sae.id), 0)) * 100 as acceptance_rate
    FROM public.employees e
    LEFT JOIN public.positions p ON e.position_id = p.id
    LEFT JOIN public.repair_tasks rt ON rt.completed_by = e.id AND rt.completed_at BETWEEN p_start_date AND p_end_date
    LEFT JOIN public.work_order_service_employees sae ON sae.employee_id = e.id AND sae.assigned_at BETWEEN p_start_date AND p_end_date
    GROUP BY e.id, e.name, p.department;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_operational_analytics(timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_employee_analytics(timestamptz, timestamptz) TO authenticated;

NOTIFY pgrst, 'reload schema';
