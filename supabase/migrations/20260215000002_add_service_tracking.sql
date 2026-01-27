-- =============================================================================
-- Migration: Add service tracking columns to vehicles table
-- Description: Adds kilometers_driven, next_service_km, and next_service_date columns
-- =============================================================================

DO $$
BEGIN
    -- Add kilometers_driven if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'vehicles' AND column_name = 'kilometers_driven'
    ) THEN
        ALTER TABLE public.vehicles ADD COLUMN kilometers_driven integer DEFAULT 0;
        RAISE NOTICE 'Added kilometers_driven column';
    END IF;

    -- Add next_service_km if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'vehicles' AND column_name = 'next_service_km'
    ) THEN
        ALTER TABLE public.vehicles ADD COLUMN next_service_km integer;
        RAISE NOTICE 'Added next_service_km column';
    END IF;

    -- Add next_service_date if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'vehicles' AND column_name = 'next_service_date'
    ) THEN
        ALTER TABLE public.vehicles ADD COLUMN next_service_date date;
        RAISE NOTICE 'Added next_service_date column';
    END IF;

END $$;

-- Force schema reload
NOTIFY pgrst, 'reload schema';
