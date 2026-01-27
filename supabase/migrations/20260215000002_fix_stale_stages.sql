-- Fix stale 'current_stage' text for completed work orders
-- This ensures the UI displays 'Delivery' instead of 'Inspection' for completed orders

DO $$
DECLARE
    wo RECORD;
BEGIN
    FOR wo IN 
        SELECT id
        FROM work_orders 
        WHERE status = 'Completed' AND current_stage != 'Delivery'
    LOOP
        -- Update the main work_orders table current_stage to 'Delivery'
        UPDATE work_orders
        SET current_stage = 'Delivery',
            updated_at = now()
        WHERE id = wo.id;
        
    END LOOP;
END $$;
