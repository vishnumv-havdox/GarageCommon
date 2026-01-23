-- =============================================================================
-- FIX: vehicles column name mismatch (vehicle_no vs vehicle_number)
-- Migration: 20260123000004_fix_vehicle_no_column
-- Error: "null value in column 'vehicle_no' violates not-null constraint"
-- =============================================================================

SET session_replication_role = 'replica';

-- =============================================================================
-- Check actual column names in vehicles table
-- =============================================================================
DO $$
BEGIN
    -- Check if vehicle_no column exists (as per the error)
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'vehicles' 
        AND column_name = 'vehicle_no'
        AND is_nullable = 'NO'
    ) THEN
        -- Create a default value for existing rows
        UPDATE public.vehicles SET vehicle_no = '' WHERE vehicle_no IS NULL;
        
        -- Set a default for future inserts
        ALTER TABLE public.vehicles 
        ALTER COLUMN vehicle_no SET DEFAULT '';
        
        -- Remove NOT NULL constraint
        ALTER TABLE public.vehicles 
        ALTER COLUMN vehicle_no DROP NOT NULL;
        
        RAISE NOTICE 'Fixed vehicle_no column - removed NOT NULL constraint';
    END IF;

    -- Check if vehicle_number column exists (from our migration)
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'vehicles' 
        AND column_name = 'vehicle_number'
    ) THEN
        RAISE NOTICE 'vehicle_number column exists';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error: %', SQLERRM;
END $$;

-- =============================================================================
-- Alternative: Rename vehicle_no to vehicle_number if preferred
-- =============================================================================
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'vehicles' 
        AND column_name = 'vehicle_no'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'vehicles' 
        AND column_name = 'vehicle_number'
    ) THEN
        -- Rename the column
        ALTER TABLE public.vehicles RENAME COLUMN vehicle_no TO vehicle_number;
        RAISE NOTICE 'Renamed vehicle_no to vehicle_number';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error renaming column: %', SQLERRM;
END $$;

-- =============================================================================
-- Ensure all vehicle columns have proper defaults
-- =============================================================================
DO $$
DECLARE
    col RECORD;
BEGIN
    FOR col IN 
        SELECT column_name, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = 'vehicles'
        AND is_nullable = 'NO'
        AND column_name NOT IN ('id', 'customer_id', 'vehicle_type')
    LOOP
        RAISE NOTICE 'Fixing column: %', col.column_name;
        
        -- Set default value
        EXECUTE format('ALTER TABLE public.vehicles ALTER COLUMN %I SET DEFAULT ''''', col.column_name);
        
        -- Update null values
        EXECUTE format('UPDATE public.vehicles SET %I = '''' WHERE %I IS NULL', col.column_name, col.column_name);
        
        -- Remove NOT NULL
        EXECUTE format('ALTER TABLE public.vehicles ALTER COLUMN %I DROP NOT NULL', col.column_name);
        
        RAISE NOTICE 'Fixed: %', col.column_name;
    END LOOP;
END $$;

RESET session_replication_role;

NOTIFY pgrst, 'reload schema';
