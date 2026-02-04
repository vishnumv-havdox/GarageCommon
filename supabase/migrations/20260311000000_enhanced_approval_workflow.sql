-- Migration: 20260311000000_enhanced_approval_workflow
-- Description: Adds tracking for rejected tasks and reopened work orders

SET session_replication_role = 'replica';

-- 1. Update work_orders table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'is_reopened') THEN
        ALTER TABLE public.work_orders ADD COLUMN is_reopened boolean DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'reopen_reason') THEN
        ALTER TABLE public.work_orders ADD COLUMN reopen_reason text;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'reopened_at') THEN
        ALTER TABLE public.work_orders ADD COLUMN reopened_at timestamptz;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'reopened_by') THEN
        ALTER TABLE public.work_orders ADD COLUMN reopened_by uuid REFERENCES auth.users(id);
    END IF;
END$$;

-- 2. Update work_order_tasks table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_order_tasks' AND column_name = 'is_rejected') THEN
        ALTER TABLE public.work_order_tasks ADD COLUMN is_rejected boolean DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_order_tasks' AND column_name = 'rejection_reason') THEN
        ALTER TABLE public.work_order_tasks ADD COLUMN rejection_reason text;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_order_tasks' AND column_name = 'rejected_at') THEN
        ALTER TABLE public.work_order_tasks ADD COLUMN rejected_at timestamptz;
    END IF;
END$$;

-- 3. Function to reject specific tasks
CREATE OR REPLACE FUNCTION public.reject_work_tasks(
    p_work_order_id uuid,
    p_task_ids uuid[],
    p_reason text,
    p_approver_id uuid
) RETURNS void AS $$
BEGIN
    -- 1. Update rejected tasks
    UPDATE public.work_order_tasks 
    SET is_rejected = true,
        rejection_reason = p_reason,
        rejected_at = now(),
        completed = false,
        completed_at = NULL,
        updated_at = now()
    WHERE id = ANY(p_task_ids) AND work_order_id = p_work_order_id;

    -- 2. Revert work order status to In Progress
    UPDATE public.work_orders 
    SET status = 'In Progress',
        repair_status = 'in_progress',
        updated_at = now()
    WHERE id = p_work_order_id;

    -- 3. Revert service statuses to In Progress
    UPDATE public.work_order_services 
    SET status = 'In Progress',
        updated_at = now()
    WHERE work_order_id = p_work_order_id;

    -- 4. Revert employee assignment statuses to Accepted (so they see it again)
    UPDATE public.work_order_service_employees 
    SET status = 'Accepted',
        updated_at = now()
    WHERE service_id IN (SELECT id FROM public.work_order_services WHERE work_order_id = p_work_order_id);

    -- 5. Add internal note about rejection
    INSERT INTO public.work_order_service_notes (service_id, note_type, note_content, is_internal, created_by)
    SELECT DISTINCT s.id, 'Issue', 'Tasks rejected: ' || p_reason, true, p_approver_id
    FROM public.work_order_services s
    WHERE s.work_order_id = p_work_order_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Function to reopen a work order
CREATE OR REPLACE FUNCTION public.reopen_work_order(
    p_work_order_id uuid,
    p_reason text,
    p_admin_id uuid
) RETURNS void AS $$
BEGIN
    -- 1. Update work order status
    UPDATE public.work_orders 
    SET status = 'In Progress',
        is_reopened = true,
        reopen_reason = p_reason,
        reopened_at = now(),
        reopened_by = p_admin_id,
        completed_at = NULL,
        approved_at = NULL,
        approved_by = NULL,
        repair_status = 'in_progress',
        updated_at = now()
    WHERE id = p_work_order_id;

    -- 2. Revert service statuses
    UPDATE public.work_order_services 
    SET status = 'In Progress',
        completed_at = NULL,
        updated_at = now()
    WHERE work_order_id = p_work_order_id;

    -- 3. Revert employee assignment statuses
    UPDATE public.work_order_service_employees 
    SET status = 'Accepted',
        completed_at = NULL,
        updated_at = now()
    WHERE service_id IN (SELECT id FROM public.work_order_services WHERE work_order_id = p_work_order_id);

    -- 4. Revert specific tasks if needed? 
    -- For now, keep them as completed but allow editing. 
    -- If user rejected all, they would use reject_work_tasks.

    -- 5. Add internal note about reopening
    INSERT INTO public.work_order_service_notes (service_id, note_type, note_content, is_internal, created_by)
    SELECT DISTINCT s.id, 'Information', 'Work Order Reopened: ' || p_reason, true, p_admin_id
    FROM public.work_order_services s
    WHERE s.work_order_id = p_work_order_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Permissions
GRANT EXECUTE ON FUNCTION public.reject_work_tasks(uuid, uuid[], text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reopen_work_order(uuid, text, uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
RESET session_replication_role;
