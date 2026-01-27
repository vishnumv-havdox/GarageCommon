-- Backfill missing 'Delivery' stage completion for work orders that are already marked as 'Completed'
-- This ensures that historical data reflects 100% progress AND correct current_stage

DO $$
DECLARE
    wo RECORD;
BEGIN
    FOR wo IN 
        SELECT id, completed_at, updated_at 
        FROM work_orders 
        WHERE status = 'Completed'
    LOOP
        -- 1. Upsert the Delivery stage as completed in work_order_stages
        INSERT INTO work_order_stages (work_order_id, stage, status, completed_at, updated_at)
        VALUES (
            wo.id, 
            'Delivery', 
            'completed', 
            COALESCE(wo.completed_at, wo.updated_at, now()), 
            now()
        )
        ON CONFLICT (work_order_id, stage) 
        DO UPDATE SET 
            status = 'completed',
            completed_at = EXCLUDED.completed_at,
            updated_at = now()
        WHERE work_order_stages.status != 'completed';

        -- 2. Update the main work_orders table current_stage to 'Delivery'
        UPDATE work_orders
        SET current_stage = 'Delivery',
            updated_at = now()
        WHERE id = wo.id AND current_stage != 'Delivery';
        
    END LOOP;
END $$;
