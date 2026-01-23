-- Migration: 20260205020000_sync_assignments_on_delivery
-- Description: Sync work_order_service_employees status when work order is completed/delivered

SET session_replication_role = 'replica';

-- =============================================================================
-- 1. Update update_work_order_stage to sync assignments
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
        
        -- CRITICAL COMPONENT: Sync all assignments for this work order to 'completed'
        UPDATE public.work_order_service_employees
        SET status = 'completed', 
            completed_at = now(), 
            updated_at = now()
        WHERE service_id IN (SELECT id FROM public.work_order_services WHERE work_order_id = p_work_order_id)
        AND status != 'completed';
        
        -- Also sync service statuses
        UPDATE public.work_order_services
        SET status = 'Completed',
            updated_at = now()
        WHERE work_order_id = p_work_order_id
        AND status != 'Completed';
    END IF;

    -- Make work order visible to customer
    UPDATE public.work_orders 
    SET customer_visible = true, portal_updated_at = now(), updated_at = now()
    WHERE id = p_work_order_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 2. Update toggle_task_status for work_order_service_tasks (if applicable)
-- =============================================================================
-- Just in case there's another sync point needed.

NOTIFY pgrst, 'reload schema';
RESET session_replication_role;
