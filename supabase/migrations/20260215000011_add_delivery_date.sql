-- =============================================================================
-- Migration: Add Estimated Delivery Date
-- Description: Adds estimated_delivery_date column to work_orders table
-- =============================================================================

DO $$
BEGIN
    -- Add estimated_delivery_date if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'estimated_delivery_date') THEN
        ALTER TABLE public.work_orders ADD COLUMN estimated_delivery_date timestamptz;
    END IF;

END $$;

-- Force schema reload
NOTIFY pgrst, 'reload schema';
