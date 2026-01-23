-- Migration: 20260204130000_fix_stage_approver_resolution
-- Description: Update stage update functions to resolve employee_id from user_id to satisfy foreign key constraints

SET session_replication_role = 'replica';

-- =============================================================================
-- 1. Helper Function to Resolve Employee ID
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_employee_id_from_user(p_user_id uuid) 
RETURNS uuid AS $$
DECLARE
    v_employee_id uuid;
BEGIN
    -- 1. Try to find employee by user_id
    SELECT id INTO v_employee_id FROM public.employees WHERE user_id = p_user_id;
    
    -- 2. If not found, check if the input itself is an employee_id
    IF v_employee_id IS NULL THEN
        SELECT id INTO v_employee_id FROM public.employees WHERE id = p_user_id;
    END IF;
    
    RETURN v_employee_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 2. Update update_work_order_stage
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
        completed_by = v_employee_id, -- Use resolved employee_id
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
        SET current_stage = 'Delivery', updated_at = now()
        WHERE id = p_work_order_id;
    END IF;

    -- Make work order visible to customer
    UPDATE public.work_orders 
    SET customer_visible = true, portal_updated_at = now(), updated_at = now()
    WHERE id = p_work_order_id;
    
    -- Update all services to be customer visible
    UPDATE public.work_order_services 
    SET customer_visible = true, portal_updated_at = now(), updated_at = now()
    WHERE work_order_id = p_work_order_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 3. Update complete_repair_and_advance
-- =============================================================================
CREATE OR REPLACE FUNCTION public.complete_repair_and_advance(
    p_work_order_id uuid,
    p_approver_id uuid
) RETURNS void AS $$
DECLARE
    v_next_stage text;
    v_employee_id uuid;
BEGIN
    -- Resolve approver to employee_id
    v_employee_id := public.get_employee_id_from_user(p_approver_id);

    -- Mark repair as completed
    UPDATE public.work_orders 
    SET repair_completed_at = now(), updated_at = now()
    WHERE id = p_work_order_id;

    -- Mark Repair stage as completed
    UPDATE public.work_order_stages 
    SET status = 'completed', 
        completed_at = now(), 
        completed_by = v_employee_id, -- Use resolved employee_id
        updated_at = now()
    WHERE work_order_id = p_work_order_id AND stage = 'Repair';

    -- Advance to next stage (Quality Check)
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

    -- Update all service statuses to reflect progress
    UPDATE public.work_order_services 
    SET status = CASE 
        WHEN v_next_stage = 'Quality Check' THEN 'Pending Approval'
        ELSE status
    END,
    updated_at = now()
    WHERE work_order_id = p_work_order_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

NOTIFY pgrst, 'reload schema';

RESET session_replication_role;
