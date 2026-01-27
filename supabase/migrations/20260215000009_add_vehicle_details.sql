-- =============================================================================
-- Migration: Add Missing Vehicle Details
-- Description: Adds color, vin, and engine_number columns to vehicles table
-- =============================================================================

DO $$
BEGIN
    -- Add color if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vehicles' AND column_name = 'color') THEN
        ALTER TABLE public.vehicles ADD COLUMN color text;
    END IF;

    -- Add vin if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vehicles' AND column_name = 'vin') THEN
        ALTER TABLE public.vehicles ADD COLUMN vin text;
    END IF;

    -- Add engine_number if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vehicles' AND column_name = 'engine_number') THEN
        ALTER TABLE public.vehicles ADD COLUMN engine_number text;
    END IF;

END $$;

-- Force schema reload
NOTIFY pgrst, 'reload schema';
