-- Migration: 20260313000009_refine_operational_analytics_fix
-- Description: Standardize status handling for perfect accuracy in dashboard metrics.

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
    -- Total vehicles serviced (Completed/Delivered/Approved)
    SELECT count(*) INTO v_total_serviced
    FROM public.work_orders
    WHERE lower(status) IN ('completed', 'approved', 'delivered')
    AND (
        (completed_at IS NOT NULL AND completed_at BETWEEN p_start_date AND p_end_date)
        OR 
        (completed_at IS NULL AND created_at BETWEEN p_start_date AND p_end_date)
    );

    -- Work orders by status
    SELECT json_object_agg(status_name, status_count) INTO v_status_counts
    FROM (
        SELECT s.status as status_name, count(*) as status_count
        FROM (
            -- Active Statuses (All active ones, regardless of date)
            SELECT status
            FROM public.work_orders
            WHERE lower(status) NOT IN ('completed', 'approved', 'delivered', 'cancelled', 'rejected')
            
            UNION ALL
            
            -- Terminal Statuses (Those finished in window)
            SELECT status
            FROM public.work_orders
            WHERE lower(status) IN ('completed', 'approved', 'delivered', 'cancelled', 'rejected')
            AND (
                (completed_at IS NOT NULL AND completed_at BETWEEN p_start_date AND p_end_date)
                OR 
                (completed_at IS NULL AND created_at BETWEEN p_start_date AND p_end_date)
            )
        ) s
        GROUP BY s.status
    ) final;

    -- Average turnaround time
    SELECT avg(completed_at - created_at) INTO v_avg_turnaround
    FROM public.work_orders
    WHERE lower(status) IN ('completed', 'approved', 'delivered')
    AND completed_at IS NOT NULL
    AND completed_at BETWEEN p_start_date AND p_end_date;

    -- Rework rate
    SELECT (count(*)::numeric / NULLIF(v_total_serviced, 0)) * 100 INTO v_rework_rate
    FROM public.repair_task_history
    WHERE lower(action) IN ('reopened', 'rework')
    AND performed_at BETWEEN p_start_date AND p_end_date;

    RETURN json_build_object(
        'total_serviced', v_total_serviced,
        'status_counts', COALESCE(v_status_counts, '{}'::json),
        'avg_turnaround_hours', COALESCE(extract(epoch from v_avg_turnaround) / 3600, 0),
        'rework_rate', COALESCE(v_rework_rate, 0)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
