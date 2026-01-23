-- Migration: 20260204000000_dynamic_workflow_support
-- Description: Add inspection → repair → approval → customer visibility workflow

SET session_replication_role = 'replica';

-- =============================================================================
-- 1. Add workflow columns to work_orders
-- =============================================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'work_orders' AND column_name = 'inspection_status') THEN
        ALTER TABLE public.work_orders ADD COLUMN inspection_status text DEFAULT 'pending';
    END IF;
END$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'work_orders' AND column_name = 'inspection_notes') THEN
        ALTER TABLE public.work_orders ADD COLUMN inspection_notes text;
    END IF;
END$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'work_orders' AND column_name = 'inspection_completed_at') THEN
        ALTER TABLE public.work_orders ADD COLUMN inspection_completed_at timestamptz;
    END IF;
END$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'work_orders' AND column_name = 'inspection_completed_by') THEN
        ALTER TABLE public.work_orders ADD COLUMN inspection_completed_by uuid;
    END IF;
END$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'work_orders' AND column_name = 'repairs_visible') THEN
        ALTER TABLE public.work_orders ADD COLUMN repairs_visible boolean DEFAULT false;
    END IF;
END$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'work_orders' AND column_name = 'repairs_approved') THEN
        ALTER TABLE public.work_orders ADD COLUMN repairs_approved boolean DEFAULT false;
    END IF;
END$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'work_orders' AND column_name = 'repairs_approved_at') THEN
        ALTER TABLE public.work_orders ADD COLUMN repairs_approved_at timestamptz;
    END IF;
END$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'work_orders' AND column_name = 'repairs_approved_by') THEN
        ALTER TABLE public.work_orders ADD COLUMN repairs_approved_by uuid;
    END IF;
END$$;

-- =============================================================================
-- 2. Create repair tasks table (for individual repair item tracking)
-- =============================================================================
DROP TABLE IF EXISTS public.repair_tasks CASCADE;

CREATE TABLE public.repair_tasks (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    work_order_id uuid NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
    task_name text NOT NULL,
    task_description text,
    task_category text DEFAULT 'General',
    status text DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'reopened')),
    priority text DEFAULT 'Medium' CHECK (priority IN ('Low', 'Medium', 'High', 'Urgent')),
    sequence_order integer DEFAULT 0,
    notes text,
    completed_at timestamptz,
    completed_by uuid,
    reopened_at timestamptz,
    reopened_by uuid,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- =============================================================================
-- 3. Create repair task completions table for audit trail
-- =============================================================================
DROP TABLE IF EXISTS public.repair_task_history CASCADE;

CREATE TABLE public.repair_task_history (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    task_id uuid NOT NULL REFERENCES public.repair_tasks(id) ON DELETE CASCADE,
    action text NOT NULL CHECK (action IN ('created', 'started', 'completed', 'reopened', 'updated')),
    performed_by uuid,
    notes text,
    created_at timestamptz DEFAULT now()
);

-- =============================================================================
-- 4. Create workflow functions
-- =============================================================================

-- Approve inspection and make repairs visible
CREATE OR REPLACE FUNCTION public.approve_inspection(
    p_work_order_id uuid,
    p_inspector_id uuid,
    p_notes text DEFAULT null
) RETURNS void AS $$
BEGIN
    -- Update work order
    UPDATE public.work_orders SET
        inspection_status = 'approved',
        inspection_notes = p_notes,
        inspection_completed_at = now(),
        inspection_completed_by = p_inspector_id,
        repairs_visible = true,
        repairs_approved = false,
        updated_at = now()
    WHERE id = p_work_order_id;

    -- If repair tasks don't exist, create default ones
    IF NOT EXISTS (SELECT 1 FROM public.repair_tasks WHERE work_order_id = p_work_order_id) THEN
        INSERT INTO public.repair_tasks (work_order_id, task_name, task_description, task_category, priority, sequence_order)
        VALUES 
            (p_work_order_id, 'Initial Assessment', 'Conduct thorough vehicle inspection and document all findings', 'Inspection', 'High', 1),
            (p_work_order_id, 'Parts Replacement', 'Replace worn or damaged parts as needed', 'Repair', 'High', 2),
            (p_work_order_id, 'System Testing', 'Test all repaired systems for proper functionality', 'Testing', 'High', 3),
            (p_work_order_id, 'Quality Check', 'Perform quality assurance verification', 'Quality', 'Medium', 4),
            (p_work_order_id, 'Final Documentation', 'Complete all documentation and paperwork', 'Documentation', 'Low', 5);
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Reject inspection (go back to pending)
CREATE OR REPLACE FUNCTION public.reject_inspection(
    p_work_order_id uuid,
    p_inspector_id uuid,
    p_notes text
) RETURNS void AS $$
BEGIN
    UPDATE public.work_orders SET
        inspection_status = 'rejected',
        inspection_notes = p_notes,
        repairs_visible = false,
        updated_at = now()
    WHERE id = p_work_order_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Complete a single repair task
CREATE OR REPLACE FUNCTION public.complete_repair_task(
    p_task_id uuid,
    p_completed_by uuid
) RETURNS void AS $$
DECLARE
    v_work_order_id uuid;
    v_task_count integer;
    v_completed_count integer;
BEGIN
    -- Get work order id
    SELECT work_order_id INTO v_work_order_id FROM public.repair_tasks WHERE id = p_task_id;

    -- Update task
    UPDATE public.repair_tasks SET
        status = 'completed',
        completed_at = now(),
        completed_by = p_completed_by,
        updated_at = now()
    WHERE id = p_task_id;

    -- Add to history
    INSERT INTO public.repair_task_history (task_id, action, performed_by, notes)
    VALUES (p_task_id, 'completed', p_completed_by, 'Task completed');

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

-- Reopen a completed task
CREATE OR REPLACE FUNCTION public.reopen_repair_task(
    p_task_id uuid,
    p_reopened_by uuid,
    p_reason text DEFAULT null
) RETURNS void AS $$
BEGIN
    UPDATE public.repair_tasks SET
        status = 'reopened',
        reopened_at = now(),
        reopened_by = p_reopened_by,
        completed_at = null,
        completed_by = null,
        notes = COALESCE(p_reason, notes) || ' | Reopened: ' || now()::text,
        updated_at = now()
    WHERE id = p_task_id;

    INSERT INTO public.repair_task_history (task_id, action, performed_by, notes)
    VALUES (p_task_id, 'reopened', p_reopened_by, p_reason);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Approve all repairs (customer visibility enabled)
CREATE OR REPLACE FUNCTION public.approve_repairs(
    p_work_order_id uuid,
    p_approver_id uuid
) RETURNS void AS $$
BEGIN
    UPDATE public.work_orders SET
        repairs_approved = true,
        repairs_approved_at = now(),
        repairs_approved_by = p_approver_id,
        status = 'Completed',
        customer_visible = true,
        portal_updated_at = now(),
        updated_at = now()
    WHERE id = p_work_order_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Reopen repairs for editing
CREATE OR REPLACE FUNCTION public.reopen_repairs(
    p_work_order_id uuid,
    p_reopened_by uuid,
    p_reason text
) RETURNS void AS $$
BEGIN
    UPDATE public.work_orders SET
        repairs_approved = false,
        repairs_approved_at = null,
        repairs_approved_by = null,
        status = 'In Progress',
        updated_at = now()
    WHERE id = p_work_order_id;

    -- Reopen all completed tasks
    UPDATE public.repair_tasks SET
        status = 'reopened',
        reopened_at = now(),
        reopened_by = p_reopened_by,
        completed_at = null,
        completed_by = null,
        notes = COALESCE(notes, '') || ' | Reopened by admin: ' || p_reason,
        updated_at = now()
    WHERE work_order_id = p_work_order_id AND status = 'completed';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Start repair task
CREATE OR REPLACE FUNCTION public.start_repair_task(
    p_task_id uuid,
    p_started_by uuid
) RETURNS void AS $$
BEGIN
    UPDATE public.repair_tasks SET
        status = 'in_progress',
        updated_at = now()
    WHERE id = p_task_id;

    INSERT INTO public.repair_task_history (task_id, action, performed_by, notes)
    VALUES (p_task_id, 'started', p_started_by, 'Task started');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 5. Create trigger to auto-update updated_at
-- =============================================================================
DROP TRIGGER IF EXISTS update_repair_tasks_updated_at ON public.repair_tasks;
CREATE TRIGGER update_repair_tasks_updated_at
    BEFORE UPDATE ON public.repair_tasks
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================================================
-- 6. Grant permissions
-- =============================================================================
GRANT EXECUTE ON FUNCTION public.approve_inspection(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_inspection(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_repair_task(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reopen_repair_task(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_repairs(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reopen_repairs(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_repair_task(uuid, uuid) TO authenticated;

-- =============================================================================
-- 7. Refresh PostgREST schema
-- =============================================================================
NOTIFY pgrst, 'reload schema';

RESET session_replication_role;

-- =============================================================================
-- END OF MIGRATION
-- =============================================================================

