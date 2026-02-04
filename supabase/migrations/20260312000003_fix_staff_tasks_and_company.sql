-- Fix get_staff_assigned_work to:
-- 1. Only show tasks for the specific assigned service (not all work order tasks)
-- 2. Add company_name to the output

-- Drop the existing function first (required when changing return type)
DROP FUNCTION IF EXISTS public.get_staff_assigned_work(uuid);

CREATE OR REPLACE FUNCTION public.get_staff_assigned_work(p_user_id uuid)
RETURNS TABLE (
    assignment_id uuid,
    employee_id uuid,
    assignment_status text,
    assigned_at timestamptz,
    accepted_at timestamptz,
    completed_at timestamptz,
    queue_position integer,
    service_id uuid,
    work_order_id uuid,
    service_type text,
    service_status text,
    description text,
    priority text,
    current_stage text,
    estimated_cost numeric,
    created_at timestamptz,
    vehicle_number text,
    vehicle_model text,
    customer_name text,
    company_name text, -- Added
    work_order_status text,
    inspection_status text,
    repair_status text,
    review_status text,
    customer_visible boolean,
    is_reopened boolean,
    reopen_reason text,
    tasks json
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        sae.id as assignment_id,
        sae.employee_id,
        sae.status as assignment_status,
        sae.assigned_at,
        sae.accepted_at,
        sae.completed_at,
        sae.queue_position,
        s.id as service_id,
        s.work_order_id,
        s.service_type,
        s.status as service_status,
        wo.description,
        wo.priority,
        wo.current_stage,
        wo.estimated_cost,
        wo.created_at,
        v.vehicle_number,
        v.model,
        c.name as customer_name,
        c.company_name, -- Added
        wo.status as work_order_status,
        wo.inspection_status,
        wo.repair_status,
        wo.review_status,
        wo.customer_visible,
        wo.is_reopened,
        wo.reopen_reason,
        (
            SELECT json_agg(
                json_build_object(
                    'id', t.id,
                    'task_name', t.task_name,
                    'task_type', t.task_type,
                    'service_id', t.service_id,
                    'is_completed', t.completed,
                    'completed_at', t.completed_at,
                    'is_rejected', t.is_rejected,
                    'rejection_reason', t.rejection_reason
                ) ORDER BY t.sequence_order
            )
            FROM public.work_order_tasks t
            WHERE t.service_id = s.id -- FIXED: Filter by service_id instead of work_order_id
            AND (t.assigned_employee_id = sae.employee_id OR t.assigned_employee_id IS NULL)
        ) as tasks
    FROM public.work_order_service_employees sae
    JOIN public.employees e ON e.id = sae.employee_id
    JOIN public.work_order_services s ON s.id = sae.service_id
    JOIN public.work_orders wo ON wo.id = s.work_order_id
    LEFT JOIN public.vehicles v ON v.id = wo.vehicle_id
    LEFT JOIN public.customers c ON c.id = v.customer_id
    WHERE e.user_id = p_user_id
    AND sae.status IN ('Accepted', 'pending_acceptance', 'completed') -- Only show released assignments
    AND sae.status NOT IN ('Assigned') -- Exclude assignments pending admin approval
    ORDER BY 
        sae.queue_position ASC,
        CASE wo.priority 
            WHEN 'Urgent' THEN 1 
            WHEN 'High' THEN 2 
            WHEN 'Medium' THEN 3 
            WHEN 'Low' THEN 4 
            ELSE 5 
        END,
        wo.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Refresh schema
NOTIFY pgrst, 'reload schema';
