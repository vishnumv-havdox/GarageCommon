-- Migration: 20260205000000_sync_repair_tasks_and_stages
-- Description: Synchronize repair_tasks and work_order_stages to ensure consistency across portals

SET session_replication_role = 'replica';

-- =============================================================================
-- 1. Update update_work_order_stage to sync repair_tasks
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

    -- Get current stage
    SELECT current_stage INTO v_current_stage 
    FROM public.work_orders 
    WHERE id = p_work_order_id;

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

    -- SYNC: If 'Inspection' stage is completed, approve inspection if not already
    IF 'Inspection' = ANY(p_completed_stages) THEN
        UPDATE public.work_orders SET
            inspection_status = 'approved',
            inspection_completed_at = COALESCE(inspection_completed_at, now()),
            inspection_completed_by = COALESCE(inspection_completed_by, v_employee_id),
            repairs_visible = true,
            updated_at = now()
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
    
    -- Update all services to be customer visible
    UPDATE public.work_order_services 
    SET customer_visible = true, portal_updated_at = now(), updated_at = now()
    WHERE work_order_id = p_work_order_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 2. Update complete_repair_task to advance stages
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
    -- ONLY update status to 'Pending Approval' if it's currently 'In Progress' or 'Pending'
    IF v_task_count = v_completed_count AND v_task_count > 0 THEN
        UPDATE public.work_orders SET
            status = 'Pending Approval',
            updated_at = now()
        WHERE id = v_work_order_id
        AND status IN ('Pending', 'In Progress');
        
        -- We don't mark the stage as 'completed' automatically here because 
        -- it usually requires admin approval, but we ensure it's at least 'in_progress'
        UPDATE public.work_order_stages 
        SET status = 'in_progress', 
            updated_at = now()
        WHERE work_order_id = v_work_order_id AND stage = 'Repair' AND status = 'pending';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 3. Update reopen_repairs and approve_repairs
-- =============================================================================
CREATE OR REPLACE FUNCTION public.approve_repairs(
    p_work_order_id uuid,
    p_approver_id uuid
) RETURNS void AS $$
DECLARE
    v_employee_id uuid;
BEGIN
    v_employee_id := public.get_employee_id_from_user(p_approver_id);

    -- ONLY approve if not already cancelled or rejected
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

CREATE OR REPLACE FUNCTION public.reopen_repairs(
    p_work_order_id uuid,
    p_reopened_by uuid,
    p_reason text
) RETURNS void AS $$
DECLARE
    v_employee_id uuid;
BEGIN
    v_employee_id := public.get_employee_id_from_user(p_reopened_by);

    UPDATE public.work_orders SET
        repairs_approved = false,
        repairs_approved_at = null,
        repairs_approved_by = null,
        status = 'In Progress',
        updated_at = now()
    WHERE id = p_work_order_id;

    -- SYNC: Reset Repair stage to in_progress
    UPDATE public.work_order_stages 
    SET status = 'in_progress', 
        completed_at = null, 
        completed_by = null,
        updated_at = now()
    WHERE work_order_id = p_work_order_id AND stage = 'Repair';

    -- SYNC: Reopen all tasks
    UPDATE public.repair_tasks SET
        status = 'reopened',
        reopened_at = now(),
        reopened_by = v_employee_id,
        completed_at = null,
        completed_by = null,
        notes = COALESCE(notes, '') || ' | Reopened: ' || p_reason,
        updated_at = now()
    WHERE work_order_id = p_work_order_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

NOTIFY pgrst, 'reload schema';

RESET session_replication_role;
