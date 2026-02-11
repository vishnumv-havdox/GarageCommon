-- Migration: 20260313000016_fix_approve_work_rpc
-- Description: Redefine approve_work RPC to be robust, use consistent parameters, and handle all related tables.

SET session_replication_role = 'replica';

-- Drop potentially conflicting function signatures
DROP FUNCTION IF EXISTS public.approve_work(uuid, uuid, text);

-- Redefine approve_work with p_ naming convention (matching what we fixed in frontend)
CREATE OR REPLACE FUNCTION public.approve_work(
    p_work_order_id uuid,
    p_approver_id uuid,
    p_notes text DEFAULT null
) RETURNS void AS $$
DECLARE
    v_employee_id uuid;
BEGIN
    -- Resolve approver to employee_id for work_order_stages
    v_employee_id := public.get_employee_id_from_user(p_approver_id);

    -- 1. Update work_orders
    -- Set status to 'In Progress' (moves it out of 'Pending Approval' inbox)
    -- Set repair_status to 'approved'
    -- Set current_stage to 'Review' (Next step in sequence)
    UPDATE public.work_orders 
    SET status = 'In Progress', 
        repair_status = 'approved',
        approved_by = p_approver_id, 
        approved_at = now(),
        customer_visible = true,
        current_stage = 'Review',
        updated_at = now()
    WHERE id = p_work_order_id;

    -- 2. Update work_order_services
    -- Ensure all services are marked as Approved to clear section level pending states
    UPDATE public.work_order_services 
    SET status = 'Approved', 
        approved_by = p_approver_id,
        approved_at = now(),
        updated_at = now()
    WHERE work_order_id = p_work_order_id;

    -- 3. Update work_order_service_employees
    -- Ensure all assignments are Approved
    UPDATE public.work_order_service_employees 
    SET status = 'Approved', 
        updated_at = now()
    WHERE service_id IN (SELECT id FROM public.work_order_services WHERE work_order_id = p_work_order_id);

    -- 4. Update work_order_tasks (Safety Net)
    -- Ensure all tasks are marked Completed
    UPDATE public.work_order_tasks
    SET completed = true,
        completed_at = COALESCE(completed_at, now()),
        updated_at = now()
    WHERE work_order_id = p_work_order_id 
      AND (completed = false OR completed IS NULL);

    -- 5. Add Note
    IF p_notes IS NOT NULL THEN
        INSERT INTO public.work_order_service_notes (service_id, note_type, note_content, is_internal, created_by)
        SELECT DISTINCT s.id, 'Approval', p_notes, false, p_approver_id
        FROM public.work_order_services s
        WHERE s.work_order_id = p_work_order_id;
    END IF;
    
    -- 6. Update Stage history to ensure flow is recorded
    -- Mark 'Repair' stage as completed
    UPDATE public.work_order_stages
    SET status = 'completed',
        completed_at = now(),
        completed_by = v_employee_id
    WHERE work_order_id = p_work_order_id 
      AND stage = 'Repair';
      
    -- Mark 'Review' stage as pending (it will be shown as next in line)
    -- Or if we want it to be 'in_progress', we can set it here
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

ALTER FUNCTION public.approve_work(uuid, uuid, text) OWNER TO postgres;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';

RESET session_replication_role;
