-- Migration: 20260313000017_fix_all_completed_by_resolutions
-- Description: Comprehensive fix for foreign key violations by ensuring all assignments to completed_by/performed_by use a resolved employee_id.

SET session_replication_role = 'replica';

-- =============================================================================
-- 1. Redefine get_employee_id_from_user to be extremely robust
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_employee_id_from_user(p_user_id uuid) 
RETURNS uuid AS $$
DECLARE
    v_employee_id uuid;
BEGIN
    -- Return NULL immediately if input is NULL
    IF p_user_id IS NULL THEN
        RETURN NULL;
    END IF;

    -- 1. Try to find employee by user_id
    SELECT id INTO v_employee_id FROM public.employees WHERE user_id = p_user_id;
    
    -- 2. If not found, check if the input itself is an employee_id
    IF v_employee_id IS NULL THEN
        SELECT id INTO v_employee_id FROM public.employees WHERE id = p_user_id;
    END IF;
    
    -- Final safety: Return NULL if still not found, never return a non-employee ID
    RETURN v_employee_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 2. Update advance_work_order_stage (Fixing DIRECT assignment)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.advance_work_order_stage(
    _work_order_id uuid, 
    _stage text, 
    _employee_id uuid
) RETURNS void AS $$
DECLARE
    _current_stage text;
    v_resolved_employee_id uuid;
BEGIN
    -- Resolve employee_id
    v_resolved_employee_id := public.get_employee_id_from_user(_employee_id);

    SELECT current_stage INTO _current_stage FROM public.work_orders WHERE id = _work_order_id;
    
    -- Mark current stage as completed
    UPDATE public.work_order_stages 
    SET status = 'completed', 
        completed_at = now(), 
        completed_by = v_resolved_employee_id, 
        updated_at = now()
    WHERE work_order_id = _work_order_id AND stage = _current_stage;
    
    -- Update new stage to in_progress
    UPDATE public.work_order_stages 
    SET status = 'in_progress', started_at = now(), updated_at = now()
    WHERE work_order_id = _work_order_id AND stage = _stage;
    
    -- Update work order current_stage
    UPDATE public.work_orders 
    SET current_stage = _stage, updated_at = now()
    WHERE id = _work_order_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 3. Update update_work_order_stage (Ensuring resolution)
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

    -- Mark 'Repair' stage as completed if it's in the completed list
    IF 'Repair' = ANY(p_completed_stages) THEN
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

-- =============================================================================
-- 4. Redefine approve_work (Final Version)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.approve_work(
    p_work_order_id uuid,
    p_approver_id uuid,
    p_notes text DEFAULT null
) RETURNS void AS $$
DECLARE
    v_employee_id uuid;
BEGIN
    -- Resolve approver to employee_id
    v_employee_id := public.get_employee_id_from_user(p_approver_id);

    -- 1. Update work_orders
    UPDATE public.work_orders 
    SET status = 'In Progress', 
        repair_status = 'approved',
        approved_by = p_approver_id, -- Keep user_id here as per schema (FK to auth.users)
        approved_at = now(),
        customer_visible = true,
        current_stage = 'Review',
        updated_at = now()
    WHERE id = p_work_order_id;

    -- 2. Update work_order_services to Approved
    UPDATE public.work_order_services 
    SET status = 'Approved', 
        approved_by = p_approver_id,
        approved_at = now(),
        updated_at = now()
    WHERE work_order_id = p_work_order_id;

    -- 3. Update assignments to Approved
    UPDATE public.work_order_service_employees 
    SET status = 'Approved', 
        updated_at = now()
    WHERE service_id IN (SELECT id FROM public.work_order_services WHERE work_order_id = p_work_order_id);

    -- 4. Add Note
    IF p_notes IS NOT NULL THEN
        INSERT INTO public.work_order_service_notes (service_id, note_type, note_content, is_internal, created_by)
        SELECT DISTINCT s.id, 'Approval', p_notes, false, p_approver_id
        FROM public.work_order_services s
        WHERE s.work_order_id = p_work_order_id;
    END IF;
    
    -- 5. Update Stages
    -- Mark 'Repair' as completed
    UPDATE public.work_order_stages
    SET status = 'completed',
        completed_at = now(),
        completed_by = v_employee_id
    WHERE work_order_id = p_work_order_id 
      AND stage = 'Repair';
      
    -- Mark 'Review' as pending
    UPDATE public.work_order_stages
    SET status = 'pending',
        started_at = null,
        completed_at = null,
        completed_by = null
    WHERE work_order_id = p_work_order_id 
      AND stage = 'Review'
      AND status != 'completed';

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 5. Update complete_repair_and_advance (Ensuring resolution)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.complete_repair_and_advance(
    p_work_order_id uuid,
    p_approver_id uuid
) RETURNS void AS $$
DECLARE
    v_next_stage text;
    v_employee_id uuid;
BEGIN
    -- Resolve to employee_id
    v_employee_id := public.get_employee_id_from_user(p_approver_id);

    -- Mark repair as completed
    UPDATE public.work_orders 
    SET repair_completed_at = now(), updated_at = now()
    WHERE id = p_work_order_id;

    -- Mark Repair stage as completed
    UPDATE public.work_order_stages 
    SET status = 'completed', 
        completed_at = now(), 
        completed_by = v_employee_id, 
        updated_at = now()
    WHERE work_order_id = p_work_order_id AND stage = 'Repair';

    -- Advance to next stage
    SELECT stage INTO v_next_stage
    FROM public.work_order_stages
    WHERE work_order_id = p_work_order_id AND status = 'pending'
    ORDER BY created_at
    LIMIT 1;

    IF v_next_stage IS NOT NULL THEN
        UPDATE public.work_orders 
        SET current_stage = v_next_stage, updated_at = now()
        WHERE id = p_work_order_id;

        UPDATE public.work_order_stages 
        SET status = 'in_progress', started_at = now(), updated_at = now()
        WHERE work_order_id = p_work_order_id AND stage = v_next_stage;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 6. Update complete_repair_task (Ensuring resolution)
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
    -- Resolve to employee_id
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

    -- Check if all completed
    SELECT COUNT(*), SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END)
    INTO v_task_count, v_completed_count
    FROM public.repair_tasks
    WHERE work_order_id = v_work_order_id;

    IF v_task_count = v_completed_count AND v_task_count > 0 THEN
        UPDATE public.work_orders SET
            status = 'Pending Approval',
            updated_at = now()
        WHERE id = v_work_order_id
        AND status IN ('Pending', 'In Progress');
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Reset permissions
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- Reload schema
NOTIFY pgrst, 'reload schema';

RESET session_replication_role;
