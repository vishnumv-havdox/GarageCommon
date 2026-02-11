-- Migration: 20260211000000_fix_inbox_approval_fk
-- Description: Ensure all stage updates use resolved employee_id to avoid FK violations when admins approve work.

SET session_replication_role = 'replica';

-- 1. Ensure get_employee_id_from_user is extremely robust
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
    -- This prevents foreign key violations on tables referencing public.employees(id)
    RETURN v_employee_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Redefine approve_work to use the resolver for completed_by
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
        completed_by = v_employee_id -- Use resolved employee_id (NULL-safe)
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

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';

RESET session_replication_role;
