-- Migration: 20260204150000_automate_approval_workflow
-- Description: Update approve_repairs to auto-complete Repair stage and advance workflow

SET session_replication_role = 'replica';

-- =============================================================================
-- Update approve_repairs to handle stage transitions
-- =============================================================================
CREATE OR REPLACE FUNCTION public.approve_repairs(
    p_work_order_id uuid,
    p_approver_id uuid
) RETURNS void AS $$
DECLARE
    v_next_stage text;
    v_employee_id uuid;
BEGIN
    -- Resolve approver to employee_id
    v_employee_id := public.get_employee_id_from_user(p_approver_id);

    -- 1. Mark repairs as approved in work_orders
    UPDATE public.work_orders SET
        repairs_approved = true,
        repairs_approved_at = now(),
        repairs_approved_by = v_employee_id,
        customer_visible = true,
        portal_updated_at = now(),
        updated_at = now()
    WHERE id = p_work_order_id;

    -- 2. Mark "Repair" stage as completed
    UPDATE public.work_order_stages 
    SET status = 'completed', 
        completed_at = now(), 
        completed_by = v_employee_id,
        updated_at = now()
    WHERE work_order_id = p_work_order_id AND stage = 'Repair';

    -- 3. Advance to next stage (Review or Quality Check)
    SELECT stage INTO v_next_stage
    FROM public.work_order_stages
    WHERE work_order_id = p_work_order_id AND status = 'pending'
    ORDER BY created_at
    LIMIT 1;

    IF v_next_stage IS NOT NULL THEN
        -- Update Work Order Current Stage
        UPDATE public.work_orders 
        SET current_stage = v_next_stage, 
            status = 'In Progress', -- Ensure status is In Progress, not Completed (unless it's the very last stage)
            updated_at = now()
        WHERE id = p_work_order_id;

        -- Start the next stage
        UPDATE public.work_order_stages 
        SET status = 'in_progress', started_at = now(), updated_at = now()
        WHERE work_order_id = p_work_order_id AND stage = v_next_stage;
    ELSE
        -- If no more stages, THEN mark as Completed
        UPDATE public.work_orders 
        SET status = 'Completed', 
            updated_at = now()
        WHERE id = p_work_order_id;
    END IF;

    -- 4. Update all services
    UPDATE public.work_order_services 
    SET status = 'Approved',
        updated_at = now()
    WHERE work_order_id = p_work_order_id;

    -- 5. Update all service assignments
    UPDATE public.work_order_service_employees 
    SET status = 'Approved',
        updated_at = now()
    WHERE service_id IN (SELECT id FROM public.work_order_services WHERE work_order_id = p_work_order_id);

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

NOTIFY pgrst, 'reload schema';

RESET session_replication_role;
