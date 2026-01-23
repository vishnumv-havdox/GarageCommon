-- Migration: 20260203000000_create_missing_work_order_stages
-- Description: Create missing work_order_stages for work orders that don't have them

SET session_replication_role = 'replica';

-- =============================================================================
-- 1. Create a function to generate stages for a work order
-- =============================================================================
CREATE OR REPLACE FUNCTION public.create_work_order_stages(p_work_order_id uuid)
RETURNS void AS $$
DECLARE
    v_count integer;
BEGIN
    -- Check if stages already exist
    SELECT COUNT(*) INTO v_count FROM public.work_order_stages 
    WHERE work_order_id = p_work_order_id;
    
    IF v_count > 0 THEN
        RETURN;
    END IF;
    
    -- Insert all 5 stages for the work order
    INSERT INTO public.work_order_stages (work_order_id, stage, status, created_at, updated_at)
    VALUES 
        (p_work_order_id, 'Inspection', 'pending', now(), now()),
        (p_work_order_id, 'Repair', 'pending', now(), now()),
        (p_work_order_id, 'Review', 'pending', now(), now()),
        (p_work_order_id, 'Quality Check', 'pending', now(), now()),
        (p_work_order_id, 'Delivery', 'pending', now(), now());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 2. Create a function to auto-generate stages for all work orders that don't have them
-- =============================================================================
CREATE OR REPLACE FUNCTION public.populate_missing_work_order_stages()
RETURNS integer AS $$
DECLARE
    v_created_count integer := 0;
    v_wo RECORD;
BEGIN
    -- Loop through all work orders that don't have stages
    FOR v_wo IN 
        SELECT wo.id 
        FROM public.work_orders wo
        LEFT JOIN public.work_order_stages wos ON wo.id = wos.work_order_id
        WHERE wos.id IS NULL
    LOOP
        PERFORM public.create_work_order_stages(v_wo.id);
        v_created_count := v_created_count + 1;
    END LOOP;
    
    RETURN v_created_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 3. Execute for all existing work orders that need stages
-- =============================================================================
SELECT public.populate_missing_work_order_stages();

-- =============================================================================
-- 4. Grant permissions
-- =============================================================================
GRANT EXECUTE ON FUNCTION public.create_work_order_stages(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.populate_missing_work_order_stages() TO authenticated;

-- =============================================================================
-- 5. Create a trigger to automatically create stages when a work order is created
-- =============================================================================
DROP TRIGGER IF EXISTS auto_create_work_order_stages ON public.work_orders;
DROP FUNCTION IF EXISTS public.handle_new_work_order();

CREATE OR REPLACE FUNCTION public.handle_new_work_order()
RETURNS trigger AS $$
BEGIN
    PERFORM public.create_work_order_stages(new.id);
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER auto_create_work_order_stages
    AFTER INSERT ON public.work_orders
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_work_order();

-- =============================================================================
-- 6. Refresh PostgREST schema
-- =============================================================================
NOTIFY pgrst, 'reload schema';

RESET session_replication_role;

-- =============================================================================
-- END OF MIGRATION
-- =============================================================================

