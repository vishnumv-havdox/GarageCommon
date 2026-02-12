-- Fix garage metrics RPC to properly count work orders
-- The previous version was correct, but let's make it more robust

CREATE OR REPLACE FUNCTION public.get_garage_metrics(
    target_date DATE DEFAULT CURRENT_DATE
) RETURNS JSON AS $$
DECLARE
    metrics JSON;
    wo_placed INTEGER;
    wo_working INTEGER;
    wo_completed INTEGER;
    wo_delivered INTEGER;
    wo_total INTEGER;
BEGIN
    -- Count work orders placed (all active statuses)
    SELECT COUNT(*) INTO wo_placed
    FROM public.work_orders
    WHERE status IN ('Pending', 'In Progress', 'Quality Check', 'Ready for Delivery', 'Reopened');
    
    -- Count working vehicles (actively being worked on)
    SELECT COUNT(DISTINCT vehicle_id) INTO wo_working
    FROM public.work_orders
    WHERE status = 'In Progress';
    
    -- Count completed but not delivered
    SELECT COUNT(DISTINCT vehicle_id) INTO wo_completed
    FROM public.work_orders
    WHERE status IN ('Quality Check', 'Ready for Delivery');
    
    -- Count today's deliveries
    SELECT COUNT(DISTINCT vehicle_id) INTO wo_delivered
    FROM public.work_orders
    WHERE status = 'Delivered'
    AND DATE(completed_at) = target_date;
    
    -- Count total vehicles in garage
    SELECT COUNT(DISTINCT vehicle_id) INTO wo_total
    FROM public.work_orders
    WHERE status IN ('Pending', 'In Progress', 'Quality Check', 'Ready for Delivery', 'Reopened');
    
    -- Build result
    SELECT JSON_BUILD_OBJECT(
        'work_orders_placed', COALESCE(wo_placed, 0),
        'working_vehicles', COALESCE(wo_working, 0),
        'completed_not_delivered', COALESCE(wo_completed, 0),
        'todays_deliveries', COALESCE(wo_delivered, 0),
        'total_vehicles_in_garage', COALESCE(wo_total, 0)
    ) INTO metrics;
    
    RETURN metrics;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
