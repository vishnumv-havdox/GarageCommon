-- Migration: 20260206000000_comprehensive_analytics
-- Description: Comprehensive analytics functions for Admin Dashboard

SET session_replication_role = 'replica';

-- =============================================================================
-- 1. Comprehensive Operational Analytics
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_comprehensive_operational_analytics(
    p_start_date timestamptz DEFAULT (now() - interval '30 days'),
    p_end_date timestamptz DEFAULT now(),
    p_service_type text DEFAULT NULL,
    p_department text DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    v_result JSON;
    v_total_serviced integer;
    v_daily_serviced json;
    v_weekly_serviced json;
    v_monthly_serviced json;
    v_status_counts json;
    v_stage_counts json;
    v_avg_turnaround interval;
    v_avg_turnaround_hours numeric;
    v_bottleneck_stages json;
    v_rework_rate numeric;
    v_reopened_count integer;
    v_overdue_count integer;
    v_urgent_count integer;
BEGIN
    -- Total vehicles serviced
    SELECT count(*) INTO v_total_serviced
    FROM public.work_orders
    WHERE (status IN ('Completed', 'Approved', 'Delivered'))
    AND created_at BETWEEN p_start_date AND p_end_date
    AND (p_service_type IS NULL OR service_type = p_service_type);

    -- Daily serviced count
    SELECT json_object_agg(date_key, count) INTO v_daily_serviced
    FROM (
        SELECT to_char(created_at::date, 'YYYY-MM-DD') as date_key, count(*) as count
        FROM public.work_orders
        WHERE status IN ('Completed', 'Approved', 'Delivered')
        AND created_at BETWEEN p_start_date AND p_end_date
        AND (p_service_type IS NULL OR service_type = p_service_type)
        GROUP BY created_at::date
        ORDER BY created_at::date
    ) d;

    -- Weekly serviced count
    SELECT json_object_agg(week_key, count) INTO v_weekly_serviced
    FROM (
        SELECT to_char(created_at, 'YYYY-WW') as week_key, count(*) as count
        FROM public.work_orders
        WHERE status IN ('Completed', 'Approved', 'Delivered')
        AND created_at BETWEEN p_start_date AND p_end_date
        AND (p_service_type IS NULL OR service_type = p_service_type)
        GROUP BY to_char(created_at, 'YYYY-WW')
    ) w;

    -- Monthly serviced count
    SELECT json_object_agg(month_key, count) INTO v_monthly_serviced
    FROM (
        SELECT to_char(created_at, 'YYYY-MM') as month_key, count(*) as count
        FROM public.work_orders
        WHERE status IN ('Completed', 'Approved', 'Delivered')
        AND created_at BETWEEN p_start_date AND p_end_date
        AND (p_service_type IS NULL OR service_type = p_service_type)
        GROUP BY to_char(created_at, 'YYYY-MM')
    ) m;

    -- Work orders by status
    SELECT json_object_agg(status, count) INTO v_status_counts
    FROM (
        SELECT status, count(*) as count
        FROM public.work_orders
        WHERE created_at BETWEEN p_start_date AND p_end_date
        AND (p_service_type IS NULL OR service_type = p_service_type)
        GROUP BY status
    ) s;

    -- Work orders by stage (using work_order_stages)
    SELECT json_object_agg(stage, count) INTO v_stage_counts
    FROM (
        SELECT stage, count(*) as count
        FROM public.work_order_stages
        WHERE created_at BETWEEN p_start_date AND p_end_date
        GROUP BY stage
    ) st;

    -- Average turnaround time
    SELECT avg(completed_at - created_at) INTO v_avg_turnaround
    FROM public.work_orders
    WHERE status = 'Completed' 
    AND completed_at IS NOT NULL
    AND created_at BETWEEN p_start_date AND p_end_date;
    
    v_avg_turnaround_hours := COALESCE(extract(epoch from v_avg_turnaround) / 3600, 0);

    -- Bottleneck detection (longest stage delays)
    WITH stage_delays AS (
        SELECT 
            ws.stage,
            avg(COALESCE(ws.completed_at, now()) - ws.started_at) as avg_duration
        FROM public.work_order_stages ws
        JOIN public.work_orders wo ON wo.id = ws.work_order_id
        WHERE wo.created_at BETWEEN p_start_date AND p_end_date
        AND ws.started_at IS NOT NULL
        GROUP BY ws.stage
    )
    SELECT json_object_agg(stage, avg_duration) INTO v_bottleneck_stages
    FROM stage_delays
    ORDER BY avg_duration DESC;

    -- Rework rate
    SELECT count(DISTINCT work_order_id) INTO v_reopened_count
    FROM public.repair_tasks
    WHERE status = 'reopened'
    AND updated_at BETWEEN p_start_date AND p_end_date;
    
    v_rework_rate := CASE 
        WHEN v_total_serviced > 0 THEN (v_reopened_count::numeric / v_total_serviced) * 100 
        ELSE 0 
    END;

    -- Overdue work orders (older than 7 days and not completed)
    SELECT count(*) INTO v_overdue_count
    FROM public.work_orders
    WHERE status NOT IN ('Completed', 'Delivered', 'Cancelled')
    AND created_at < (now() - interval '7 days')
    AND created_at BETWEEN p_start_date AND p_end_date;

    -- Urgent/High priority jobs
    SELECT count(*) INTO v_urgent_count
    FROM public.work_orders
    WHERE priority IN ('Urgent', 'High')
    AND status NOT IN ('Completed', 'Delivered', 'Cancelled')
    AND created_at BETWEEN p_start_date AND p_end_date;

    v_result := json_build_object(
        'total_serviced', v_total_serviced,
        'daily_serviced', v_daily_serviced,
        'weekly_serviced', v_weekly_serviced,
        'monthly_serviced', v_monthly_serviced,
        'status_counts', v_status_counts,
        'stage_counts', v_stage_counts,
        'avg_turnaround_hours', v_avg_turnaround_hours,
        'bottleneck_stages', v_bottleneck_stages,
        'rework_rate', ROUND(v_rework_rate, 2),
        'reopened_count', v_reopened_count,
        'overdue_count', v_overdue_count,
        'urgent_count', v_urgent_count
    );

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 2. Employee Performance Metrics
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_employee_performance_metrics(
    p_start_date timestamptz DEFAULT (now() - interval '30 days'),
    p_end_date timestamptz DEFAULT now(),
    p_employee_id uuid DEFAULT NULL,
    p_department text DEFAULT NULL
)
RETURNS TABLE (
    employee_id uuid,
    employee_name text,
    department text,
    work_orders_handled bigint,
    repair_tasks_completed bigint,
    avg_task_completion_minutes numeric,
    acceptance_count bigint,
    rejection_count bigint,
    acceptance_rate numeric,
    productivity_score numeric,
    idle_time_minutes numeric,
    active_work_minutes numeric
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        e.id as employee_id,
        e.name as employee_name,
        COALESCE(p.department, 'General') as department,
        COUNT(DISTINCT wo.id) as work_orders_handled,
        COUNT(DISTINCT rt.id) filter (where rt.status = 'completed') as repair_tasks_completed,
        COALESCE(AVG(EXTRACT(EPOCH FROM (rt.completed_at - rt.created_at)) / 60.0) FILTER (WHERE rt.status = 'completed'), 0) as avg_task_completion_minutes,
        COUNT(DISTINCT sae.id) filter (where sae.status = 'Accepted') as acceptance_count,
        COUNT(DISTINCT sae.id) filter (where sae.status = 'Rejected') as rejection_count,
        CASE 
            WHEN COUNT(DISTINCT sae.id) > 0 
            THEN (COUNT(DISTINCT sae.id) filter (where sae.status = 'Accepted')::numeric / COUNT(DISTINCT sae.id)) * 100
            ELSE 100 
        END as acceptance_rate,
        CASE 
            WHEN COUNT(DISTINCT sae.id) > 0 
            THEN ((COUNT(DISTINCT rt.id) filter (where rt.status = 'completed'))::numeric / NULLIF(COUNT(DISTINCT sae.id), 0)) * 100
            ELSE 0 
        END as productivity_score,
        0 as idle_time_minutes,
        COALESCE(SUM(EXTRACT(EPOCH FROM (rt.completed_at - rt.created_at)) / 60.0) FILTER (WHERE rt.status = 'completed'), 0) as active_work_minutes
    FROM public.employees e
    LEFT JOIN public.positions p ON e.position_id = p.id
    LEFT JOIN public.work_order_service_employees sae ON sae.employee_id = e.id 
        AND sae.assigned_at BETWEEN p_start_date AND p_end_date
    LEFT JOIN public.work_order_services wos ON wos.id = sae.service_id
    LEFT JOIN public.work_orders wo ON wo.id = wos.work_order_id
    LEFT JOIN public.repair_tasks rt ON rt.completed_by = e.id 
        AND rt.completed_at BETWEEN p_start_date AND p_end_date
    WHERE (p_employee_id IS NULL OR e.id = p_employee_id)
    AND (p_department IS NULL OR p.department = p_department)
    GROUP BY e.id, e.name, p.department;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 3. Service & Department Metrics
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_service_department_metrics(
    p_start_date timestamptz DEFAULT (now() - interval '30 days'),
    p_end_date timestamptz DEFAULT now()
)
RETURNS JSON AS $$
DECLARE
    v_result JSON;
    v_service_types json;
    v_repair_vs_maintenance json;
    v_department_workload json;
    v_service_efficiency json;
    v_repeat_repair_freq json;
BEGIN
    -- Most requested service types
    SELECT json_object_agg(service_type, count) INTO v_service_types
    FROM (
        SELECT service_type, count(*) as count
        FROM public.work_orders
        WHERE created_at BETWEEN p_start_date AND p_end_date
        GROUP BY service_type
        ORDER BY count DESC
        LIMIT 10
    ) s;

    -- Repair vs Maintenance ratio
    WITH service_categories AS (
        SELECT 
            CASE 
                WHEN LOWER(service_type) LIKE '%repair%' OR LOWER(service_type) LIKE '%overhaul%' OR LOWER(service_type) LIKE '%fix%' THEN 'Repair'
                WHEN LOWER(service_type) LIKE '%service%' OR LOWER(service_type) LIKE '%maintenance%' OR LOWER(service_type) LIKE '%check%' THEN 'Maintenance'
                ELSE 'Other'
            END as category,
            count(*) as count
        FROM public.work_orders
        WHERE created_at BETWEEN p_start_date AND p_end_date
        GROUP BY 1
    )
    SELECT json_object_agg(category, count) INTO v_repair_vs_maintenance
    FROM service_categories;

    -- Department-wise workload distribution
    SELECT json_object_agg(department, workload) INTO v_department_workload
    FROM (
        SELECT 
            COALESCE(p.department, 'Unassigned') as department,
            count(DISTINCT sae.id) as workload
        FROM public.positions p
        JOIN public.employees e ON e.position_id = p.id
        LEFT JOIN public.work_order_service_employees sae ON sae.employee_id = e.id
            AND sae.assigned_at BETWEEN p_start_date AND p_end_date
        GROUP BY p.department
    ) d;

    -- Completion efficiency by department
    SELECT json_object_agg(department, efficiency) INTO v_service_efficiency
    FROM (
        SELECT 
            COALESCE(p.department, 'Unknown') as department,
            CASE 
                WHEN COUNT(sae.id) > 0 
                THEN (COUNT(*) filter (where wos.status = 'completed')::numeric / COUNT(sae.id)) * 100
                ELSE 0
            END as efficiency
        FROM public.positions p
        JOIN public.employees e ON e.position_id = p.id
        LEFT JOIN public.work_order_service_employees sae ON sae.employee_id = e.id
        LEFT JOIN public.work_order_services wos ON wos.id = sae.service_id
        WHERE sae.assigned_at BETWEEN p_start_date AND p_end_date
        GROUP BY p.department
    ) eff;

    -- Repeat repair frequency per service type
    SELECT json_object_agg(service_type, repeat_count) INTO v_repeat_repair_freq
    FROM (
        SELECT 
            wo.service_type,
            count(DISTINCT wo.vehicle_id) filter (
                WHERE wo.id IN (
                    SELECT work_order_id FROM public.repair_tasks WHERE status = 'reopened'
                )
            ) as repeat_count
        FROM public.work_orders wo
        WHERE wo.created_at BETWEEN p_start_date AND p_end_date
        GROUP BY wo.service_type
    ) rr;

    v_result := json_build_object(
        'service_types', v_service_types,
        'repair_vs_maintenance', v_repair_vs_maintenance,
        'department_workload', v_department_workload,
        'service_efficiency', v_service_efficiency,
        'repeat_repair_frequency', v_repeat_repair_freq
    );

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 4. Financial Analytics V2
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_financial_analytics_v2(
    p_start_date timestamptz DEFAULT (now() - interval '30 days'),
    p_end_date timestamptz DEFAULT now(),
    p_service_type text DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    v_result JSON;
    v_total_revenue numeric;
    v_daily_revenue json;
    v_monthly_revenue json;
    v_yearly_revenue json;
    v_revenue_by_service json;
    v_avg_invoice numeric;
    v_pending_payments numeric;
    v_collected_payments numeric;
    v_discount_impact numeric;
    v_cancelled_impact numeric;
BEGIN
    -- Total Revenue
    SELECT 
        COALESCE(SUM(wo.estimated_cost), 0),
        COALESCE(AVG(wo.estimated_cost), 0)
    INTO v_total_revenue, v_avg_invoice
    FROM public.work_orders wo
    WHERE wo.status IN ('Completed', 'Approved', 'Delivered')
    AND wo.created_at BETWEEN p_start_date AND p_end_date
    AND (p_service_type IS NULL OR wo.service_type = p_service_type);

    -- Daily Revenue
    SELECT json_object_agg(date_key, amount) INTO v_daily_revenue
    FROM (
        SELECT to_char(created_at::date, 'YYYY-MM-DD') as date_key, SUM(estimated_cost) as amount
        FROM public.work_orders
        WHERE status IN ('Completed', 'Approved', 'Delivered')
        AND created_at BETWEEN p_start_date AND p_end_date
        AND (p_service_type IS NULL OR service_type = p_service_type)
        GROUP BY created_at::date
        ORDER BY created_at::date
    ) d;

    -- Monthly Revenue
    SELECT json_object_agg(month_key, amount) INTO v_monthly_revenue
    FROM (
        SELECT to_char(created_at, 'YYYY-MM') as month_key, SUM(estimated_cost) as amount
        FROM public.work_orders
        WHERE status IN ('Completed', 'Approved', 'Delivered')
        AND created_at BETWEEN p_start_date AND p_end_date
        AND (p_service_type IS NULL OR service_type = p_service_type)
        GROUP BY to_char(created_at, 'YYYY-MM')
    ) m;

    -- Yearly Revenue
    SELECT json_object_agg(year_key, amount) INTO v_yearly_revenue
    FROM (
        SELECT to_char(created_at, 'YYYY') as year_key, SUM(estimated_cost) as amount
        FROM public.work_orders
        WHERE status IN ('Completed', 'Approved', 'Delivered')
        AND created_at BETWEEN p_start_date AND p_end_date
        AND (p_service_type IS NULL OR service_type = p_service_type)
        GROUP BY to_char(created_at, 'YYYY')
    ) y;

    -- Revenue by Service Type
    SELECT json_object_agg(service_type, total) INTO v_revenue_by_service
    FROM (
        SELECT service_type, SUM(estimated_cost) as total
        FROM public.work_orders
        WHERE status IN ('Completed', 'Approved', 'Delivered')
        AND created_at BETWEEN p_start_date AND p_end_date
        AND (p_service_type IS NULL OR service_type = p_service_type)
        GROUP BY service_type
    ) ss;

    -- Pending vs Collected Payments (from invoices)
    SELECT 
        COALESCE(SUM(CASE WHEN status = 'Sent' OR status = 'Overdue' THEN total ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN status = 'Paid' THEN total ELSE 0 END), 0)
    INTO v_pending_payments, v_collected_payments
    FROM public.invoices
    WHERE created_at BETWEEN p_start_date AND p_end_date;

    v_result := json_build_object(
        'total_revenue', ROUND(v_total_revenue, 2),
        'daily_revenue', v_daily_revenue,
        'monthly_revenue', v_monthly_revenue,
        'yearly_revenue', v_yearly_revenue,
        'revenue_by_service', v_revenue_by_service,
        'avg_invoice_value', ROUND(v_avg_invoice, 2),
        'pending_payments', ROUND(v_pending_payments, 2),
        'collected_payments', ROUND(v_collected_payments, 2),
        'total_outstanding', ROUND(v_pending_payments, 2)
    );

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 5. Customer Insights
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_customer_insights(
    p_start_date timestamptz DEFAULT (now() - interval '30 days'),
    p_end_date timestamptz DEFAULT now()
)
RETURNS JSON AS $$
DECLARE
    v_result JSON;
    v_new_customers integer;
    v_returning_customers integer;
    v_avg_wait_time interval;
    v_avg_wait_time_minutes numeric;
    v_vehicles_per_customer numeric;
    v_repeat_service_freq json;
    v_delayed_delivery_count integer;
BEGIN
    -- New vs Returning Customers
    SELECT 
        COUNT(DISTINCT CASE WHEN created_at >= p_start_date THEN customer_id END),
        COUNT(DISTINCT CASE WHEN created_at < p_start_date THEN customer_id END)
    INTO v_new_customers, v_returning_customers
    FROM public.work_orders
    WHERE created_at BETWEEN p_start_date AND p_end_date;

    -- Average wait time (from created_at to first stage start)
    SELECT avg(first_stage_started - created_at) INTO v_avg_wait_time
    FROM (
        SELECT 
            wo.created_at,
            MIN(ws.started_at) as first_stage_started
        FROM public.work_orders wo
        LEFT JOIN public.work_order_stages ws ON ws.work_order_id = wo.id
        WHERE wo.created_at BETWEEN p_start_date AND p_end_date
        GROUP BY wo.id, wo.created_at
    ) t;

    v_avg_wait_time_minutes := COALESCE(extract(epoch from v_avg_wait_time) / 60, 0);

    -- Average vehicles per customer
    SELECT 
        AVG(vehicle_count) INTO v_vehicles_per_customer
    FROM (
        SELECT customer_id, COUNT(DISTINCT vehicle_id) as vehicle_count
        FROM public.work_orders
        WHERE created_at BETWEEN p_start_date AND p_end_date
        GROUP BY customer_id
    ) vc;

    -- Repeat service frequency
    SELECT json_object_agg(service_type, repeat_count) INTO v_repeat_service_freq
    FROM (
        SELECT 
            service_type,
            COUNT(*) filter (
                WHERE vehicle_id IN (
                    SELECT vehicle_id 
                    FROM public.work_orders wo2 
                    WHERE wo2.created_at < p_start_date
                )
            ) as repeat_count
        FROM public.work_orders wo1
        WHERE wo1.created_at BETWEEN p_start_date AND p_end_date
        GROUP BY service_type
    ) rs;

    -- Delayed delivery count (completed but not delivered within 24h)
    SELECT count(*) INTO v_delayed_delivery_count
    FROM public.work_orders
    WHERE status = 'Completed'
    AND completed_at < (now() - interval '24 hours')
    AND created_at BETWEEN p_start_date AND p_end_date;

    v_result := json_build_object(
        'new_customers', v_new_customers,
        'returning_customers', v_returning_customers,
        'total_customers_served', v_new_customers + v_returning_customers,
        'avg_wait_time_minutes', ROUND(v_avg_wait_time_minutes, 2),
        'avg_vehicles_per_customer', ROUND(v_vehicles_per_customer, 2),
        'repeat_service_frequency', v_repeat_service_freq,
        'delayed_delivery_count', v_delayed_delivery_count
    );

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 6. Real-Time Status Indicators
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_realtime_status_indicators()
RETURNS JSON AS $$
DECLARE
    v_result JSON;
    v_stage_counts json;
    v_urgent_jobs integer;
    v_overdue_work_orders integer;
    v_sla_breaches integer;
BEGIN
    -- Live vehicle count in each stage
    SELECT json_object_agg(stage, count) INTO v_stage_counts
    FROM (
        SELECT 
            COALESCE(current_stage, 'Unknown') as stage,
            count(*) as count
        FROM public.work_orders
        WHERE status NOT IN ('Completed', 'Delivered', 'Cancelled')
        GROUP BY current_stage
    ) s;

    -- Urgent/High priority active jobs
    SELECT count(*) INTO v_urgent_jobs
    FROM public.work_orders
    WHERE priority IN ('Urgent', 'High')
    AND status NOT IN ('Completed', 'Delivered', 'Cancelled');

    -- Overdue work orders (created more than 7 days ago, not completed)
    SELECT count(*) INTO v_overdue_work_orders
    FROM public.work_orders
    WHERE status NOT IN ('Completed', 'Delivered', 'Cancelled')
    AND created_at < (now() - interval '7 days');

    -- SLA breach alerts (estimated completion exceeded)
    SELECT count(*) INTO v_sla_breaches
    FROM public.work_orders
    WHERE status NOT IN ('Completed', 'Delivered', 'Cancelled')
    AND estimated_cost > 0
    AND created_at < (now() - interval '3 days');

    v_result := json_build_object(
        'stage_counts', v_stage_counts,
        'urgent_jobs', v_urgent_jobs,
        'overdue_work_orders', v_overdue_work_orders,
        'sla_breaches', v_sla_breaches,
        'active_total', (
            SELECT count(*) 
            FROM public.work_orders 
            WHERE status NOT IN ('Completed', 'Delivered', 'Cancelled')
        )
    );

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 7. Bottleneck Detection
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_bottleneck_analysis(
    p_start_date timestamptz DEFAULT (now() - interval '30 days'),
    p_end_date timestamptz DEFAULT now()
)
RETURNS JSON AS $$
DECLARE
    v_result JSON;
BEGIN
    SELECT json_agg(
        json_build_object(
            'stage', stage_name,
            'avg_duration_hours', ROUND(avg_duration_hours, 2),
            'max_duration_hours', ROUND(max_duration_hours, 2),
            'order_count', order_count,
            'bottleneck_score', bottleneck_score
        )
    ) INTO v_result
    FROM (
        SELECT 
            ws.stage as stage_name,
            AVG(EXTRACT(EPOCH FROM (COALESCE(ws.completed_at, now()) - ws.started_at)) / 3600) as avg_duration_hours,
            MAX(EXTRACT(EPOCH FROM (COALESCE(ws.completed_at, now()) - ws.started_at)) / 3600) as max_duration_hours,
            COUNT(*) as order_count,
            -- Bottleneck score based on duration relative to average
            (AVG(EXTRACT(EPOCH FROM (COALESCE(ws.completed_at, now()) - ws.started_at)) / 3600) / 
             NULLIF((SELECT AVG(EXTRACT(EPOCH FROM (COALESCE(completed_at, now()) - started_at)) / 3600) 
                     FROM public.work_order_stages WHERE started_at IS NOT NULL), 0)) * 100 as bottleneck_score
        FROM public.work_order_stages ws
        JOIN public.work_orders wo ON wo.id = ws.work_order_id
        WHERE wo.created_at BETWEEN p_start_date AND p_end_date
        AND ws.started_at IS NOT NULL
        GROUP BY ws.stage
        ORDER BY avg_duration_hours DESC
        LIMIT 5
    ) bottlenecks;

    RETURN COALESCE(v_result, '[]'::json);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 8. Dashboard Summary (all-in-one for initial load)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_dashboard_summary(
    p_start_date timestamptz DEFAULT (now() - interval '30 days'),
    p_end_date timestamptz DEFAULT now()
)
RETURNS JSON AS $$
DECLARE
    v_operational json;
    v_financial json;
    v_customer json;
    v_realtime json;
    v_bottlenecks json;
BEGIN
    v_operational := public.get_comprehensive_operational_analytics(p_start_date, p_end_date);
    v_financial := public.get_financial_analytics_v2(p_start_date, p_end_date);
    v_customer := public.get_customer_insights(p_start_date, p_end_date);
    v_realtime := public.get_realtime_status_indicators();
    v_bottlenecks := public.get_bottleneck_analysis(p_start_date, p_end_date);

    RETURN json_build_object(
        'operational', v_operational,
        'financial', v_financial,
        'customer', v_customer,
        'realtime', v_realtime,
        'bottlenecks', v_bottlenecks,
        'generated_at', now()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- Grant Permissions
-- =============================================================================
GRANT EXECUTE ON FUNCTION public.get_comprehensive_operational_analytics(timestamptz, timestamptz, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_employee_performance_metrics(timestamptz, timestamptz, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_service_department_metrics(timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_financial_analytics_v2(timestamptz, timestamptz, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_customer_insights(timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_realtime_status_indicators() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_bottleneck_analysis(timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_dashboard_summary(timestamptz, timestamptz) TO authenticated;

NOTIFY pgrst, 'reload schema';
RESET session_replication_role;

