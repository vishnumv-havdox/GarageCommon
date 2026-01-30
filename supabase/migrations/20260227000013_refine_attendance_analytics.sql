-- Migration: 20260227000013_refine_attendance_analytics
-- Description: Update performance view to accurately reflect attendance records

-- 1. Drop and recreation is needed due to column type change (bigint -> numeric)
DROP VIEW IF EXISTS public.employee_performance_metrics;

CREATE VIEW public.employee_performance_metrics AS
SELECT 
    e.id as employee_id,
    e.name as employee_name,
    COUNT(DISTINCT woa.work_order_id) FILTER (WHERE wo.status = 'delivered') as total_jobs_completed,
    COALESCE(AVG(EXTRACT(EPOCH FROM (wo.updated_at - wo.created_at))/3600) FILTER (WHERE wo.status = 'delivered'), 0) as avg_completion_hours,
    COUNT(DISTINCT pr.id) as total_parts_requested,
    COUNT(DISTINCT ir.id) as total_parts_returned,
    (SELECT SUM(CASE WHEN a.status IN ('present', 'overtime') THEN 1 WHEN a.status = 'half-day' THEN 0.5 ELSE 0 END) 
     FROM public.attendance a WHERE a.employee_id = e.id AND a.date >= (CURRENT_DATE - INTERVAL '30 days')) as days_present_30d,
    (SELECT SUM(overtime_hours) FROM public.attendance a WHERE a.employee_id = e.id AND a.date >= (CURRENT_DATE - INTERVAL '30 days')) as overtime_hours_30d
FROM public.employees e
LEFT JOIN public.work_order_assignments woa ON woa.employee_id = e.id
LEFT JOIN public.work_orders wo ON wo.id = woa.work_order_id
LEFT JOIN public.part_requests pr ON pr.requested_by = e.id
LEFT JOIN public.inventory_returns ir ON ir.requested_by = e.id
GROUP BY e.id, e.name;

-- 2. Restore permissions
GRANT SELECT ON public.employee_performance_metrics TO authenticated;

NOTIFY pgrst, 'reload schema';
