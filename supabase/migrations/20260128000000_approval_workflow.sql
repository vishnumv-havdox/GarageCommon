-- Migration: 20260128000000_approval_workflow.sql
-- Description: Add approval workflow fields to support status transitions
-- Status flow: Assigned → Accepted → In Progress → Pending Approval → Completed

SET session_replication_role = 'replica';

-- =============================================================================
-- 1. Add approval fields to work_order_assignments
-- =============================================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'work_order_assignments' AND column_name = 'approved_by') THEN
        ALTER TABLE public.work_order_assignments ADD COLUMN approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
    END IF;
END$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'work_order_assignments' AND column_name = 'approved_at') THEN
        ALTER TABLE public.work_order_assignments ADD COLUMN approved_at timestamptz;
    END IF;
END$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'work_order_assignments' AND column_name = 'approval_notes') THEN
        ALTER TABLE public.work_order_assignments ADD COLUMN approval_notes text;
    END IF;
END$$;

-- Update status check constraint to include pending_approval
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'work_order_assignments_status_check') THEN
        ALTER TABLE public.work_order_assignments DROP CONSTRAINT work_order_assignments_status_check;
    END IF;
END$$;

ALTER TABLE public.work_order_assignments ADD CONSTRAINT work_order_assignments_status_check 
    CHECK (status IN ('assigned', 'accepted', 'in_progress', 'pending_approval', 'completed', 'rejected'));

-- =============================================================================
-- 2. Add approval fields to work_order_service_employees
-- =============================================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'work_order_service_employees' AND column_name = 'approved_by') THEN
        ALTER TABLE public.work_order_service_employees ADD COLUMN approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
    END IF;
END$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'work_order_service_employees' AND column_name = 'approved_at') THEN
        ALTER TABLE public.work_order_service_employees ADD COLUMN approved_at timestamptz;
    END IF;
END$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'work_order_service_employees' AND column_name = 'approval_notes') THEN
        ALTER TABLE public.work_order_service_employees ADD COLUMN approval_notes text;
    END IF;
END$$;

-- Update status check constraint to include pending_approval
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_status') THEN
        CREATE TYPE task_status AS ENUM ('assigned', 'accepted', 'in_progress', 'pending_approval', 'completed', 'rejected');
    END IF;
END$$;

-- The work_order_service_employees table doesn't have a status check constraint, 
-- but we should ensure data consistency through the application

-- =============================================================================
-- 3. Add approval fields to work_order_services
-- =============================================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'work_order_services' AND column_name = 'approved_by') THEN
        ALTER TABLE public.work_order_services ADD COLUMN approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
    END IF;
END$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'work_order_services' AND column_name = 'approved_at') THEN
        ALTER TABLE public.work_order_services ADD COLUMN approved_at timestamptz;
    END IF;
END$$;

-- =============================================================================
-- 4. Ensure customer_visible exists on work_orders
-- =============================================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'work_orders' AND column_name = 'customer_visible') THEN
        ALTER TABLE public.work_orders ADD COLUMN customer_visible boolean DEFAULT false;
    END IF;
END$$;

-- =============================================================================
-- 5. Create function to handle task approval
-- =============================================================================
CREATE OR REPLACE FUNCTION public.approve_task(
    _assignment_id uuid,
    _assignment_type text, -- 'legacy' or 'service'
    _approver_id uuid,
    _notes text DEFAULT null
) RETURNS void AS $$
BEGIN
    IF _assignment_type = 'legacy' THEN
        -- Update legacy assignment
        UPDATE public.work_order_assignments 
        SET status = 'completed', 
            approved_by = _approver_id, 
            approved_at = now(), 
            approval_notes = _notes,
            updated_at = now()
        WHERE id = _assignment_id;
        
        -- Update main work order to completed if all assignments are approved
        UPDATE public.work_orders 
        SET status = 'Completed', 
            customer_visible = true,
            approved_by = _approver_id,
            approved_at = now(),
            updated_at = now()
        WHERE id = (SELECT work_order_id FROM public.work_order_assignments WHERE id = _assignment_id)
        AND NOT EXISTS (
            SELECT 1 FROM public.work_order_assignments 
            WHERE work_order_id = (SELECT work_order_id FROM public.work_order_assignments WHERE id = _assignment_id)
            AND status NOT IN ('completed', 'rejected')
        );
    ELSE
        -- Update service employee
        UPDATE public.work_order_service_employees 
        SET status = 'Completed', 
            approved_by = _approver_id, 
            approved_at = now(), 
            approval_notes = _notes,
            updated_at = now()
        WHERE id = _assignment_id;
        
        -- Update service status
        UPDATE public.work_order_services 
        SET status = 'Completed', 
            approved_by = _approver_id,
            approved_at = now(),
            updated_at = now()
        WHERE id = (SELECT service_id FROM public.work_order_service_employees WHERE id = _assignment_id);
        
        -- Update main work order if all services are completed
        UPDATE public.work_orders 
        SET status = 'Completed', 
            customer_visible = true,
            approved_by = _approver_id,
            approved_at = now(),
            updated_at = now()
        WHERE id = (SELECT work_order_id FROM public.work_order_service_employees WHERE id = _assignment_id)
        AND NOT EXISTS (
            SELECT 1 FROM public.work_order_service_employees 
            WHERE service_id IN (SELECT id FROM public.work_order_services WHERE work_order_id = (SELECT work_order_id FROM public.work_order_service_employees WHERE id = _assignment_id))
            AND status NOT IN ('Completed', 'rejected')
        );
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 6. Create function to reject task (send back to in_progress)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.reject_task(
    _assignment_id uuid,
    _assignment_type text,
    _rejector_id uuid,
    _notes text DEFAULT null
) RETURNS void AS $$
BEGIN
    IF _assignment_type = 'legacy' THEN
        UPDATE public.work_order_assignments 
        SET status = 'in_progress', 
            approved_by = null,
            approved_at = null,
            approval_notes = _notes,
            updated_at = now()
        WHERE id = _assignment_id;
        
        -- Update work order back to in progress
        UPDATE public.work_orders 
        SET status = 'In Progress',
            customer_visible = false,
            updated_at = now()
        WHERE id = (SELECT work_order_id FROM public.work_order_assignments WHERE id = _assignment_id);
    ELSE
        UPDATE public.work_order_service_employees 
        SET status = 'in_progress', 
            approved_by = null,
            approved_at = null,
            approval_notes = _notes,
            updated_at = now()
        WHERE id = _assignment_id;
        
        -- Update service back to in progress
        UPDATE public.work_order_services 
        SET status = 'In Progress',
            approved_by = null,
            approved_at = null,
            updated_at = now()
        WHERE id = (SELECT service_id FROM public.work_order_service_employees WHERE id = _assignment_id);
        
        -- Update work order back to in progress
        UPDATE public.work_orders 
        SET status = 'In Progress',
            customer_visible = false,
            updated_at = now()
        WHERE id = (SELECT work_order_id FROM public.work_order_service_employees WHERE id = _assignment_id);
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 7. RLS Policies for approval fields
-- =============================================================================
-- Admins and managers can approve/reject
CREATE POLICY "Admins can approve work_order_assignments" ON public.work_order_assignments
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'manager'))
    );

CREATE POLICY "Admins can approve work_order_service_employees" ON public.work_order_service_employees
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'manager'))
    );

-- =============================================================================
-- 8. Refresh PostgREST schema
-- =============================================================================
NOTIFY pgrst, 'reload schema';

RESET session_replication_role;

-- =============================================================================
-- END OF MIGRATION
-- =============================================================================

