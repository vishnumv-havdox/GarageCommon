-- Migration: 20260201000000_live_tracking_support
-- Description: Add customer portal tracking and stage control features

SET session_replication_role = 'replica';

-- =============================================================================
-- 1. Add customer portal tracking columns to work_orders
-- =============================================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'work_orders' AND column_name = 'customer_visible') THEN
        ALTER TABLE public.work_orders ADD COLUMN customer_visible boolean DEFAULT false;
    END IF;
END$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'work_orders' AND column_name = 'portal_updated_at') THEN
        ALTER TABLE public.work_orders ADD COLUMN portal_updated_at timestamptz;
    END IF;
END$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'work_orders' AND column_name = 'repair_completed_at') THEN
        ALTER TABLE public.work_orders ADD COLUMN repair_completed_at timestamptz;
    END IF;
END$$;

-- =============================================================================
-- 2. Add customer portal tracking columns to work_order_services
-- =============================================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'work_order_services' AND column_name = 'customer_visible') THEN
        ALTER TABLE public.work_order_services ADD COLUMN customer_visible boolean DEFAULT false;
    END IF;
END$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'work_order_services' AND column_name = 'portal_updated_at') THEN
        ALTER TABLE public.work_order_services ADD COLUMN portal_updated_at timestamptz;
    END IF;
END$$;

-- =============================================================================
-- 3. Create function to update work order stages and customer portal
-- =============================================================================
DROP FUNCTION IF EXISTS public.update_work_order_stage(uuid, text[], uuid);

CREATE OR REPLACE FUNCTION public.update_work_order_stage(
    p_work_order_id uuid,
    p_completed_stages text[],
    p_approver_id uuid DEFAULT null
) RETURNS void AS $$
DECLARE
    v_current_stage text;
    v_next_stage text;
BEGIN
    -- Get current stage
    SELECT current_stage INTO v_current_stage 
    FROM public.work_orders 
    WHERE id = p_work_order_id;

    -- Update completed stages in work_order_stages table
    UPDATE public.work_order_stages 
    SET status = 'completed', 
        completed_at = now(), 
        completed_by = p_approver_id,
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
-- 4. Create function to update customer portal visibility
-- =============================================================================
DROP FUNCTION IF EXISTS public.update_customer_portal(uuid, boolean);

CREATE OR REPLACE FUNCTION public.update_customer_portal(
    p_work_order_id uuid,
    p_make_visible boolean DEFAULT true
) RETURNS void AS $$
BEGIN
    -- Update work order
    UPDATE public.work_orders 
    SET 
        customer_visible = p_make_visible,
        portal_updated_at = now(),
        updated_at = now()
    WHERE id = p_work_order_id;
    
    -- Update all services
    UPDATE public.work_order_services 
    SET 
        customer_visible = p_make_visible,
        portal_updated_at = now(),
        updated_at = now()
    WHERE work_order_id = p_work_order_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 5. Create function to mark repair complete and advance stage
-- =============================================================================
DROP FUNCTION IF EXISTS public.complete_repair_and_advance(uuid, uuid);

CREATE OR REPLACE FUNCTION public.complete_repair_and_advance(
    p_work_order_id uuid,
    p_approver_id uuid
) RETURNS void AS $$
DECLARE
    v_next_stage text;
BEGIN
    -- Mark repair as completed
    UPDATE public.work_orders 
    SET repair_completed_at = now(), updated_at = now()
    WHERE id = p_work_order_id;

    -- Mark Repair stage as completed
    UPDATE public.work_order_stages 
    SET status = 'completed', completed_at = now(), completed_by = p_approver_id, updated_at = now()
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

-- =============================================================================
-- 6. Grant execute permissions
-- =============================================================================
GRANT EXECUTE ON FUNCTION public.update_work_order_stage(uuid, text[], uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_customer_portal(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_repair_and_advance(uuid, uuid) TO authenticated;

-- =============================================================================
-- 7. Refresh PostgREST schema
-- =============================================================================
NOTIFY pgrst, 'reload schema';

RESET session_replication_role;

-- =============================================================================
-- END OF MIGRATION
-- =============================================================================

