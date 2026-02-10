-- Migration: 20260313000010_refine_operational_analytics_final
-- Description: Final robust version of operational analytics with lowercase normalization and logic fixes.

DROP FUNCTION IF EXISTS public.get_operational_analytics(timestamptz, timestamptz);

CREATE OR REPLACE FUNCTION public.get_operational_analytics(
    p_start_date timestamptz DEFAULT (now() - interval '30 days'),
    p_end_date timestamptz DEFAULT now()
)
RETURNS JSON AS $$
DECLARE
    v_total_serviced integer;
    v_status_counts json;
    v_avg_turnaround_hours numeric;
    v_rework_rate numeric;
BEGIN
    -- 1. Total vehicles serviced in window (Completed/Delivered/Approved)
    SELECT count(*) INTO v_total_serviced
    FROM public.work_orders
    WHERE lower(status) IN ('completed', 'approved', 'delivered')
    AND (
        COALESCE(completed_at, updated_at, created_at) BETWEEN p_start_date AND p_end_date
    );

    -- 2. Aggregate Status Counts (Normalized to lowercase keys)
    SELECT json_object_agg(grp_status, grp_count) INTO v_status_counts
    FROM (
        SELECT lower(status) as grp_status, count(*) as grp_count
        FROM public.work_orders
        WHERE 
            -- Case A: Any active order (Always count)
            lower(status) NOT IN ('completed', 'approved', 'delivered', 'cancelled', 'rejected')
            OR
            -- Case B: Finished orders (Count only if in window)
            (
                lower(status) IN ('completed', 'approved', 'delivered', 'cancelled', 'rejected')
                AND (COALESCE(completed_at, updated_at, created_at) BETWEEN p_start_date AND p_end_date)
            )
        GROUP BY lower(status)
    ) s;

    -- 3. Calculate Average Turnaround
    SELECT COALESCE(extract(epoch from avg(completed_at - created_at)) / 3600, 0)
    INTO v_avg_turnaround_hours
    FROM public.work_orders
    WHERE lower(status) IN ('completed', 'approved', 'delivered')
    AND completed_at IS NOT NULL
    AND completed_at BETWEEN p_start_date AND p_end_date;

    -- 4. Calculate Rework Rate
    BEGIN
        SELECT (count(*)::numeric / NULLIF(v_total_serviced, 0)) * 100 INTO v_rework_rate
        FROM public.repair_task_history
        WHERE lower(action) IN ('reopened', 'rework')
        AND performed_at BETWEEN p_start_date AND p_end_date;
    EXCEPTION WHEN OTHERS THEN
        v_rework_rate := 0;
    END;

    RETURN json_build_object(
        'total_serviced', COALESCE(v_total_serviced, 0),
        'status_counts', COALESCE(v_status_counts, '{}'::json),
        'avg_turnaround_hours', COALESCE(v_avg_turnaround_hours, 0),
        'rework_rate', COALESCE(v_rework_rate, 0)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
