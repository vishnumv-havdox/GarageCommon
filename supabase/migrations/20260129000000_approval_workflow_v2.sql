-- Description: Add approval workflow statuses and helper functions for staff dashboard
-- Note: This migration drops and recreates functions to fix parameter names

SET session_replication_role = 'replica';

-- =============================================================================
-- 1. ADD NEW STATUS VALUES TO EXISTING TABLES
-- =============================================================================

-- Add check constraints for new status values if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'work_order_service_employees_status_check_v2') THEN
        ALTER TABLE public.work_order_service_employees 
        ADD CONSTRAINT work_order_service_employees_status_check_v2 
        CHECK (status IN ('Assigned', 'Accepted', 'In Progress', 'Pending Approval', 'Approved', 'Rejected', 'pending_acceptance', 'pending_approval'));
    END IF;
END$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'work_order_services_status_check_v2') THEN
        ALTER TABLE public.work_order_services 
        ADD CONSTRAINT work_order_services_status_check_v2 
        CHECK (status IN ('Pending', 'In Progress', 'Pending Approval', 'Approved', 'Rejected', 'Completed', 'Cancelled'));
    END IF;
END$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'work_order_assignments_status_check_v2') THEN
        ALTER TABLE public.work_order_assignments 
        ADD CONSTRAINT work_order_assignments_status_check_v2 
        CHECK (status IN ('assigned', 'accepted', 'in_progress', 'pending_approval', 'approved', 'rejected', 'completed', 'pending_acceptance'));
    END IF;
END$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'work_orders_status_check_v2') THEN
        ALTER TABLE public.work_orders 
        ADD CONSTRAINT work_orders_status_check_v2 
        CHECK (status IN ('Pending', 'In Progress', 'Pending Approval', 'Approved', 'Completed', 'Cancelled', 'Rejected'));
    END IF;
END$$;

-- =============================================================================
-- 2. HELPER FUNCTIONS FOR STATUS TRANSITIONS
-- =============================================================================

-- Drop existing functions first (to fix parameter names)
DROP FUNCTION IF EXISTS public.accept_work_assignment(uuid, uuid);
DROP FUNCTION IF EXISTS public.complete_task(uuid, uuid);
DROP FUNCTION IF EXISTS public.reopen_task(uuid, uuid);
DROP FUNCTION IF EXISTS public.approve_work(uuid, uuid, text);
DROP FUNCTION IF EXISTS public.request_changes(uuid, uuid, text);

-- Function to accept a work assignment
CREATE OR REPLACE FUNCTION public.accept_work_assignment(
    p_assignment_id uuid,
    p_employee_id uuid
) RETURNS void AS $$
BEGIN
    UPDATE public.work_order_service_employees 
    SET status = 'Accepted', accepted_at = now(), updated_at = now()
    WHERE id = p_assignment_id AND employee_id = p_employee_id;

    UPDATE public.work_order_services 
    SET status = 'In Progress', started_at = now(), updated_at = now()
    WHERE id = (SELECT service_id FROM public.work_order_service_employees WHERE id = p_assignment_id);

    UPDATE public.work_orders 
    SET status = 'In Progress', accepted_at = now(), updated_at = now()
    WHERE id = (SELECT work_order_id FROM public.work_order_services WHERE id = (SELECT service_id FROM public.work_order_service_employees WHERE id = p_assignment_id))
    AND status = 'Pending';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to complete a task
CREATE OR REPLACE FUNCTION public.complete_task(
    p_task_id uuid,
    p_employee_id uuid
) RETURNS void AS $$
DECLARE
    v_service_id uuid;
    v_all_completed boolean;
BEGIN
    SELECT service_id INTO v_service_id 
    FROM public.work_order_service_tasks 
    WHERE id = p_task_id;

    UPDATE public.work_order_service_tasks 
    SET status = 'Completed', completed_at = now(), updated_at = now()
    WHERE id = p_task_id;

    SELECT INTO v_all_completed 
    NOT EXISTS (
        SELECT 1 FROM public.work_order_service_tasks 
        WHERE service_id = v_service_id AND status != 'Completed'
    );

    IF v_all_completed THEN
        UPDATE public.work_order_services 
        SET status = 'Pending Approval', updated_at = now()
        WHERE id = v_service_id;

        UPDATE public.work_orders 
        SET status = 'Pending Approval', updated_at = now()
        WHERE id = (SELECT work_order_id FROM public.work_order_services WHERE id = v_service_id)
        AND status != 'Completed';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to reopen a task
CREATE OR REPLACE FUNCTION public.reopen_task(
    p_task_id uuid,
    p_employee_id uuid
) RETURNS void AS $$
DECLARE
    v_service_id uuid;
    v_any_pending boolean;
BEGIN
    SELECT service_id INTO v_service_id 
    FROM public.work_order_service_tasks 
    WHERE id = p_task_id;

    UPDATE public.work_order_service_tasks 
    SET status = 'Pending', completed_at = null, updated_at = now()
    WHERE id = p_task_id;

    SELECT INTO v_any_pending 
    EXISTS (
        SELECT 1 FROM public.work_order_service_tasks 
        WHERE service_id = v_service_id AND status != 'Completed'
    );

    IF v_any_pending THEN
        UPDATE public.work_order_services 
        SET status = 'In Progress', updated_at = now()
        WHERE id = v_service_id;

        UPDATE public.work_orders 
        SET status = 'In Progress', updated_at = now()
        WHERE id = (SELECT work_order_id FROM public.work_order_services WHERE id = v_service_id);
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to approve completed work (Admin action)
CREATE OR REPLACE FUNCTION public.approve_work(
    p_work_order_id uuid,
    p_approver_id uuid,
    p_notes text DEFAULT null
) RETURNS void AS $$
BEGIN
    UPDATE public.work_orders 
    SET status = 'Approved', 
        approved_by = p_approver_id, 
        approved_at = now(),
        completed_at = now(),
        customer_visible = true,
        updated_at = now()
    WHERE id = p_work_order_id;

    UPDATE public.work_order_services 
    SET status = 'Approved', updated_at = now()
    WHERE work_order_id = p_work_order_id;

    UPDATE public.work_order_service_employees 
    SET status = 'Approved', updated_at = now()
    WHERE service_id IN (SELECT id FROM public.work_order_services WHERE work_order_id = p_work_order_id);

    IF p_notes IS NOT NULL THEN
        INSERT INTO public.work_order_service_notes (service_id, note_type, note_content, is_internal, created_by)
        SELECT DISTINCT s.id, 'Approval', p_notes, false, p_approver_id
        FROM public.work_order_services s
        WHERE s.work_order_id = p_work_order_id;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to request changes on work (Admin action)
CREATE OR REPLACE FUNCTION public.request_changes(
    p_work_order_id uuid,
    p_approver_id uuid,
    p_notes text
) RETURNS void AS $$
BEGIN
    UPDATE public.work_orders 
    SET status = 'In Progress', updated_at = now()
    WHERE id = p_work_order_id;

    UPDATE public.work_order_services 
    SET status = 'In Progress', updated_at = now()
    WHERE work_order_id = p_work_order_id;

    UPDATE public.work_order_service_employees 
    SET status = 'Accepted', updated_at = now()
    WHERE service_id IN (SELECT id FROM public.work_order_services WHERE work_order_id = p_work_order_id);

    INSERT INTO public.work_order_service_notes (service_id, note_type, note_content, is_internal, created_by)
    SELECT DISTINCT s.id, 'Issue', p_notes, true, p_approver_id
    FROM public.work_order_services s
    WHERE s.work_order_id = p_work_order_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 3. VIEWS FOR STAFF AND ADMIN
-- =============================================================================

-- View for staff dashboard - shows assigned work with tasks
DROP VIEW IF EXISTS public.staff_work_view;
CREATE VIEW public.staff_work_view AS
SELECT 
    sae.id as assignment_id,
    sae.employee_id,
    sae.status as assignment_status,
    sae.assigned_at,
    sae.accepted_at,
    sae.completed_at as assignment_completed_at,
    s.id as service_id,
    s.work_order_id,
    s.service_type,
    s.status as service_status,
    s.estimated_cost,
    wo.description as work_description,
    wo.priority,
    wo.current_stage,
    wo.vehicle_id,
    v.vehicle_number,
    v.model,
    c.name as customer_name,
    wo.created_at as work_created_at,
    (
        SELECT json_agg(
            json_build_object(
                'id', t.id,
                'task_name', t.task_name,
                'status', t.status,
                'is_completed', t.status = 'Completed',
                'completed_at', t.completed_at
            ) ORDER BY t.sequence_order
        )
        FROM public.work_order_service_tasks t
        WHERE t.service_id = s.id
    ) as tasks
FROM public.work_order_service_employees sae
JOIN public.work_order_services s ON s.id = sae.service_id
JOIN public.work_orders wo ON wo.id = s.work_order_id
LEFT JOIN public.vehicles v ON v.id = wo.vehicle_id
LEFT JOIN public.customers c ON c.id = v.customer_id;

-- View for admin - shows all work with staff actions
DROP VIEW IF EXISTS public.admin_work_view;
CREATE VIEW public.admin_work_view AS
SELECT 
    wo.id as work_order_id,
    wo.status as work_status,
    wo.priority,
    wo.current_stage,
    wo.created_at,
    wo.accepted_at,
    wo.completed_at,
    wo.approved_at,
    wo.estimated_cost,
    wo.actual_cost,
    wo.customer_visible,
    v.vehicle_number,
    v.model,
    c.name as customer_name,
    c.phone as customer_phone,
    (
        SELECT json_agg(
            json_build_object(
                'service_type', s.service_type,
                'status', s.status,
                'started_at', s.started_at,
                'completed_at', s.completed_at,
                'employees', (
                    SELECT json_agg(
                        json_build_object(
                            'name', e.name,
                            'status', sae.status,
                            'assigned_at', sae.assigned_at,
                            'accepted_at', sae.accepted_at,
                            'completed_at', sae.completed_at
                        )
                    )
                    FROM public.work_order_service_employees sae
                    JOIN public.employees e ON e.id = sae.employee_id
                    WHERE sae.service_id = s.id
                ),
                'tasks', (
                    SELECT json_agg(
                        json_build_object(
                            'task_name', t.task_name,
                            'status', t.status,
                            'completed_at', t.completed_at
                        )
                    )
                    FROM public.work_order_service_tasks t
                    WHERE t.service_id = s.id
                )
            )
        )
        FROM public.work_order_services s
        WHERE s.work_order_id = wo.id
    ) as services
FROM public.work_orders wo
LEFT JOIN public.vehicles v ON v.id = wo.vehicle_id
LEFT JOIN public.customers c ON c.id = v.customer_id;

-- =============================================================================
-- 4. REFRESH PostgREST SCHEMA
-- =============================================================================
NOTIFY pgrst, 'reload schema';

RESET session_replication_role;

-- =============================================================================
-- END OF MIGRATION
-- =============================================================================
