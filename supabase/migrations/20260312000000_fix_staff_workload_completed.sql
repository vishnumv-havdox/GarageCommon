-- Fix get_employee_active_workload to exclude completed work orders
-- This ensures staff members don't show jobs that are already finished

CREATE OR REPLACE FUNCTION public.get_employee_active_workload(p_employee_id uuid)
RETURNS TABLE (
    assignment_id uuid,
    work_order_id uuid,
    service_id uuid,
    service_type text,
    vehicle_number text,
    vehicle_model text,
    customer_name text,
    status text,
    queue_position integer,
    total_tasks bigint,
    completed_tasks bigint,
    progress_percentage numeric,
    assigned_at timestamptz,
    is_reopened boolean
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        sae.id as assignment_id,
        wo.id as work_order_id,
        s.id as service_id,
        s.service_type,
        v.vehicle_number,
        v.model as vehicle_model,
        c.name as customer_name,
        sae.status as status,
        sae.queue_position,
        COUNT(t.id) as total_tasks,
        COUNT(CASE WHEN t.completed THEN 1 END) as completed_tasks,
        CASE 
            WHEN COUNT(t.id) > 0 THEN (COUNT(CASE WHEN t.completed THEN 1 END) * 100.0 / COUNT(t.id))::numeric(5,2)
            ELSE 0 
        END as progress_percentage,
        sae.assigned_at,
        wo.is_reopened
    FROM public.work_order_service_employees sae
    JOIN public.work_order_services s ON s.id = sae.service_id
    JOIN public.work_orders wo ON wo.id = s.work_order_id
    LEFT JOIN public.vehicles v ON v.id = wo.vehicle_id
    LEFT JOIN public.customers c ON c.id = v.customer_id
    LEFT JOIN public.work_order_tasks t ON t.work_order_id = wo.id 
        AND (t.assigned_employee_id = sae.employee_id OR t.assigned_employee_id IS NULL)
    WHERE sae.employee_id = p_employee_id
    AND sae.status NOT IN ('completed', 'cancelled')
    AND wo.status NOT IN ('Completed', 'Approved', 'Delivered', 'Finalized') -- Filter out completed work orders
    GROUP BY sae.id, wo.id, s.id, s.service_type, v.vehicle_number, v.model, c.name, sae.status, sae.queue_position, sae.assigned_at, wo.is_reopened
    ORDER BY sae.queue_position ASC, sae.assigned_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Refresh schema
NOTIFY pgrst, 'reload schema';
