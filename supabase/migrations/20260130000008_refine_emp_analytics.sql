-- Migration: Refine Employee Analytics
-- Date: 2026-01-30
-- Description: Handles null values to prevent NaN in frontend

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
        COUNT(rt.id) FILTER (WHERE rt.status = 'completed') as completed_tasks,
        COALESCE(AVG(EXTRACT(EPOCH FROM (rt.completed_at - rt.created_at)) / 60) FILTER (WHERE rt.status = 'completed'), 0) as avg_task_completion_minutes,
        COALESCE(
            (COUNT(sae.id) FILTER (WHERE sae.status = 'Accepted')::numeric / NULLIF(COUNT(sae.id), 0)) * 100,
            100 -- Default to 100% if no assignments (clean record)
        ) as acceptance_rate
    FROM public.employees e
    LEFT JOIN public.positions p ON e.position_id = p.id
    LEFT JOIN public.repair_tasks rt ON rt.completed_by = e.id AND rt.completed_at BETWEEN p_start_date AND p_end_date
    LEFT JOIN public.work_order_service_employees sae ON sae.employee_id = e.id AND sae.assigned_at BETWEEN p_start_date AND p_end_date
    GROUP BY e.id, e.name, p.department;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_employee_analytics(timestamptz, timestamptz) TO authenticated;

NOTIFY pgrst, 'reload schema';
