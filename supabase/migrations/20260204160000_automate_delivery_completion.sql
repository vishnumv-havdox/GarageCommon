-- Migration: 20260204160000_automate_delivery_completion
-- Description: Update update_work_order_stage to handle Delivery completion by finalizing the work order

SET session_replication_role = 'replica';

-- =============================================================================
-- Update update_work_order_stage to handle Delivery completion
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

    -- Special handling: If 'Delivery' stage is completed, finalize the Work Order
    IF 'Delivery' = ANY(p_completed_stages) THEN
        UPDATE public.work_orders 
        SET status = 'Completed',
            current_stage = 'Delivery', -- Ensure it stays on Delivery as the final stage
            updated_at = now()
        WHERE id = p_work_order_id;
        
        -- Also mark all other stages as completed just in case (safety net)
        UPDATE public.work_order_stages 
        SET status = 'completed', 
            completed_at = COALESCE(completed_at, now()), 
            updated_at = now()
        WHERE work_order_id = p_work_order_id AND status != 'completed';
        
        RETURN; -- Exit early since we are done
    END IF;

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
        -- All stages completed (Fallback if valid next stage not found)
        UPDATE public.work_orders 
        SET current_stage = 'Delivery', updated_at = now()
        WHERE id = p_work_order_id;
        
        -- Do not set status to Completed here automatically unless Delivery is explicitly checked
        -- Use the explicit check above for final completion
    END IF;

    -- Make work order visible to customer (if not already)
    UPDATE public.work_orders 
    SET customer_visible = true, portal_updated_at = now(), updated_at = now()
    WHERE id = p_work_order_id;
    
    -- Update all services to be customer visible
    UPDATE public.work_order_services 
    SET customer_visible = true, portal_updated_at = now(), updated_at = now()
    WHERE work_order_id = p_work_order_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

NOTIFY pgrst, 'reload schema';

RESET session_replication_role;
