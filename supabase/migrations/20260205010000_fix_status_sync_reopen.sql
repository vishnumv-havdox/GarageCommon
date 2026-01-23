-- Migration: 20260205010000_fix_status_sync_reopen
-- Description: Final fixes for status synchronization and comprehensive Staff RPC update

SET session_replication_role = 'replica';

-- =============================================================================
-- 1. Update complete_repair_task to add status guards
-- =============================================================================
CREATE OR REPLACE FUNCTION public.complete_repair_task(
    p_task_id uuid,
    p_completed_by uuid
) RETURNS void AS $$
DECLARE
    v_work_order_id uuid;
    v_task_count integer;
    v_completed_count integer;
    v_employee_id uuid;
BEGIN
    -- Resolve completed_by to employee_id
    v_employee_id := public.get_employee_id_from_user(p_completed_by);

    -- Get work order id
    SELECT work_order_id INTO v_work_order_id FROM public.repair_tasks WHERE id = p_task_id;

    -- Update task
    UPDATE public.repair_tasks SET
        status = 'completed',
        completed_at = now(),
        completed_by = v_employee_id,
        updated_at = now()
    WHERE id = p_task_id;

    -- Add to history
    INSERT INTO public.repair_task_history (task_id, action, performed_by, notes)
    VALUES (p_task_id, 'completed', v_employee_id, 'Task completed');

    -- Check if all tasks for this work order are completed
    SELECT COUNT(*), SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END)
    INTO v_task_count, v_completed_count
    FROM public.repair_tasks
    WHERE work_order_id = v_work_order_id;

    -- If all completed, update work order status AND set Repair stage to in_progress or completed
    -- GUARD: ONLY update status to 'Pending Approval' if it's currently 'In Progress' or 'Pending'
    IF v_task_count = v_completed_count AND v_task_count > 0 THEN
        UPDATE public.work_orders SET
            status = 'Pending Approval',
            updated_at = now()
        WHERE id = v_work_order_id
        AND status IN ('Pending', 'In Progress');
        
        UPDATE public.work_order_stages 
        SET status = 'in_progress', 
            updated_at = now()
        WHERE work_order_id = v_work_order_id AND stage = 'Repair' AND status = 'pending';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 2. Update approve_repairs to add status guards
-- =============================================================================
CREATE OR REPLACE FUNCTION public.approve_repairs(
    p_work_order_id uuid,
    p_approver_id uuid
) RETURNS void AS $$
DECLARE
    v_employee_id uuid;
BEGIN
    v_employee_id := public.get_employee_id_from_user(p_approver_id);

    -- GUARD: ONLY approve if not already cancelled or rejected
    UPDATE public.work_orders SET
        repairs_approved = true,
        repairs_approved_at = now(),
        repairs_approved_by = v_employee_id,
        status = 'Completed',
        customer_visible = true,
        portal_updated_at = now(),
        updated_at = now()
    WHERE id = p_work_order_id
    AND status NOT IN ('Cancelled', 'Rejected');

    -- SYNC: Mark Repair stage as completed
    UPDATE public.work_order_stages 
    SET status = 'completed', 
        completed_at = now(), 
        completed_by = v_employee_id,
        updated_at = now()
    WHERE work_order_id = p_work_order_id AND stage = 'Repair';

    -- SYNC: Mark all tasks as completed
    UPDATE public.repair_tasks 
    SET status = 'completed',
        completed_at = now(),
        completed_by = v_employee_id,
        updated_at = now()
    WHERE work_order_id = p_work_order_id AND status != 'completed';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 3. Comprehensive update for get_staff_assigned_work
-- =============================================================================
DROP FUNCTION IF EXISTS public.get_staff_assigned_work(uuid);

CREATE OR REPLACE FUNCTION public.get_staff_assigned_work(p_user_id uuid)
RETURNS TABLE (
    assignment_id uuid,
    employee_id uuid,
    assignment_status text,
    assigned_at timestamptz,
    accepted_at timestamptz,
    completed_at timestamptz,
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
    work_order_status text,
    inspection_status text,
    repairs_visible boolean,
    repairs_approved boolean,
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
        wo.status as work_order_status,
        wo.inspection_status,
        wo.repairs_visible,
        wo.repairs_approved,
        (
            SELECT json_agg(
                json_build_object(
                    'id', t.id,
                    'task_name', t.task_name,
                    'task_description', t.task_description,
                    'task_category', t.task_category,
                    'priority', t.priority,
                    'status', t.status,
                    'is_completed', t.status = 'completed',
                    'completed_at', t.completed_at
                ) ORDER BY t.sequence_order
            )
            FROM public.repair_tasks t
            WHERE t.work_order_id = s.work_order_id
        ) as tasks
    FROM public.work_order_service_employees sae
    JOIN public.employees e ON e.id = sae.employee_id
    JOIN public.work_order_services s ON s.id = sae.service_id
    JOIN public.work_orders wo ON wo.id = s.work_order_id
    LEFT JOIN public.vehicles v ON v.id = wo.vehicle_id
    LEFT JOIN public.customers c ON c.id = v.customer_id
    WHERE e.user_id = p_user_id
    ORDER BY 
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

-- =============================================================================
-- 4. Update update_work_order_stage to enforce Title Case 'Completed'
-- =============================================================================
CREATE OR REPLACE FUNCTION public.update_work_order_stage(
    p_work_order_id uuid,
    p_completed_stages text[],
    p_approver_id uuid DEFAULT null
) RETURNS void AS $$
DECLARE
    v_current_stage text;
    v_next_stage text;
    v_employee_id uuid;
BEGIN
    -- Resolve approver to employee_id
    v_employee_id := public.get_employee_id_from_user(p_approver_id);

    -- Update completed stages in work_order_stages table
    UPDATE public.work_order_stages 
    SET status = 'completed', 
        completed_at = now(), 
        completed_by = v_employee_id,
        updated_at = now()
    WHERE work_order_id = p_work_order_id 
    AND stage = ANY(p_completed_stages);

    -- SYNC: If 'Repair' stage is completed, mark all repair_tasks as completed
    IF 'Repair' = ANY(p_completed_stages) THEN
        UPDATE public.repair_tasks 
        SET status = 'completed',
            completed_at = now(),
            completed_by = v_employee_id,
            updated_at = now()
        WHERE work_order_id = p_work_order_id 
        AND status != 'completed';

        UPDATE public.work_orders 
        SET repair_completed_at = now(), updated_at = now()
        WHERE id = p_work_order_id;
    END IF;

    -- Update work order current_stage to next uncompleted stage
    SELECT stage INTO v_next_stage
    FROM public.work_order_stages
    WHERE work_order_id = p_work_order_id AND status = 'pending'
    ORDER BY created_at
    LIMIT 1;

    IF v_next_stage IS NOT NULL THEN
        UPDATE public.work_orders 
        SET current_stage = v_next_stage, updated_at = now()
        WHERE id = p_work_order_id;

        -- Update the new current stage to in_progress
        UPDATE public.work_order_stages 
        SET status = 'in_progress', started_at = now(), updated_at = now()
        WHERE work_order_id = p_work_order_id AND stage = v_next_stage;
    ELSE
        -- All stages completed
        UPDATE public.work_orders 
        SET current_stage = 'Delivery', 
            status = 'Completed',
            updated_at = now()
        WHERE id = p_work_order_id;
    END IF;

    -- Make work order visible to customer
    UPDATE public.work_orders 
    SET customer_visible = true, portal_updated_at = now(), updated_at = now()
    WHERE id = p_work_order_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

NOTIFY pgrst, 'reload schema';
RESET session_replication_role;
