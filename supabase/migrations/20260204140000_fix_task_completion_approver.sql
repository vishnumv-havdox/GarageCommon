-- Migration: 20260204140000_fix_task_completion_approver
-- Description: Update complete_repair_task to resolve employee_id from user_id

SET session_replication_role = 'replica';

-- =============================================================================
-- Update complete_repair_task
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
    -- Resolve approver to employee_id
    v_employee_id := public.get_employee_id_from_user(p_completed_by);

    -- Get work order id
    SELECT work_order_id INTO v_work_order_id FROM public.repair_tasks WHERE id = p_task_id;

    -- Update task
    UPDATE public.repair_tasks SET
        status = 'completed',
        completed_at = now(),
        completed_by = v_employee_id, -- Use resolved employee_id
        updated_at = now()
    WHERE id = p_task_id;

    -- Add to history
    INSERT INTO public.repair_task_history (task_id, action, performed_by, notes)
    VALUES (p_task_id, 'completed', v_employee_id, 'Task completed');

    -- Check if all tasks are completed
    SELECT COUNT(*), SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END)
    INTO v_task_count, v_completed_count
    FROM public.repair_tasks
    WHERE work_order_id = v_work_order_id;

    -- If all completed, update work order status
    IF v_task_count = v_completed_count AND v_task_count > 0 THEN
        UPDATE public.work_orders SET
            status = 'Pending Approval',
            updated_at = now()
        WHERE id = v_work_order_id;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Also update start_repair_task for consistency
CREATE OR REPLACE FUNCTION public.start_repair_task(
    p_task_id uuid,
    p_started_by uuid
) RETURNS void AS $$
DECLARE
    v_employee_id uuid;
BEGIN
    -- Resolve to employee_id
    v_employee_id := public.get_employee_id_from_user(p_started_by);

    UPDATE public.repair_tasks SET
        status = 'in_progress',
        updated_at = now()
    WHERE id = p_task_id;

    INSERT INTO public.repair_task_history (task_id, action, performed_by, notes)
    VALUES (p_task_id, 'started', v_employee_id, 'Task started');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

NOTIFY pgrst, 'reload schema';

RESET session_replication_role;
