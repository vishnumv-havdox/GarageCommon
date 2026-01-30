-- Migration: Fix operational analytics performed_at error
-- Date: 2026-01-30
-- Description: Fixes invalid column reference in get_operational_analytics

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
    -- FIX: Changed performed_at to created_at
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

GRANT EXECUTE ON FUNCTION public.get_operational_analytics(timestamptz, timestamptz) TO authenticated;

NOTIFY pgrst, 'reload schema';
