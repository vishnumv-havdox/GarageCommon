-- Migration: Fix Employee Performance Metrics View
-- Date: 2026-01-30
-- Description: Updates the status filter from 'delivered' to 'Completed' to match actual work order statuses

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'part_requests') 
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'inventory_returns') THEN
        EXECUTE $sql$
        CREATE OR REPLACE VIEW public.employee_performance_metrics AS
        SELECT 
            e.id as employee_id,
            e.name as employee_name,
            COUNT(DISTINCT woa.work_order_id) FILTER (WHERE wo.status = 'Completed') as total_jobs_completed,
            COALESCE(AVG(EXTRACT(EPOCH FROM (wo.updated_at - wo.created_at))/3600) FILTER (WHERE wo.status = 'Completed'), 0) as avg_completion_hours,
            COUNT(DISTINCT pr.id) as total_parts_requested,
            COUNT(DISTINCT ir.id) as total_parts_returned,
            (SELECT COUNT(*) FROM public.attendance a WHERE a.employee_id = e.id AND a.status = 'present' AND a.date >= now() - interval '30 days') as days_present_30d,
            (SELECT SUM(overtime_hours) FROM public.attendance a WHERE a.employee_id = e.id AND a.date >= now() - interval '30 days') as overtime_hours_30d
        FROM public.employees e
        LEFT JOIN public.work_order_assignments woa ON woa.employee_id = e.id
        LEFT JOIN public.work_orders wo ON wo.id = woa.work_order_id
        LEFT JOIN public.part_requests pr ON pr.requested_by = e.id
        LEFT JOIN public.inventory_returns ir ON ir.requested_by = e.id
        GROUP BY e.id, e.name;
        $sql$;
    END IF;
END $$;

NOTIFY pgrst, 'reload schema';
