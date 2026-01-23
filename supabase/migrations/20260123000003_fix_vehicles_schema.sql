-- =============================================================================
-- FIX: vehicles table schema - ensure vehicle_number column exists
-- Migration: 20260123000003_fix_vehicles_schema
-- Error: "Could not find the 'vehicle_number' column of 'vehicles'"
-- =============================================================================

SET session_replication_role = 'replica';

-- =============================================================================
-- Check and add vehicle_number column if missing
-- =============================================================================
DO $$
BEGIN
    -- Check if vehicles table exists
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'vehicles'
        AND table_schema = 'public'
    ) THEN
        -- Check if vehicle_number column exists
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'vehicles' 
            AND column_name = 'vehicle_number'
        ) THEN
            ALTER TABLE public.vehicles ADD COLUMN vehicle_number text NOT NULL DEFAULT '';
            RAISE NOTICE 'Added vehicle_number column to vehicles table';
        ELSE
            -- Check if it has NOT NULL constraint
            IF EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'vehicles' 
                AND column_name = 'vehicle_number'
                AND is_nullable = 'NO'
            ) THEN
                -- Ensure it has a default value
                ALTER TABLE public.vehicles 
                ALTER COLUMN vehicle_number SET DEFAULT '';
                
                -- Update existing rows if needed
                UPDATE public.vehicles 
                SET vehicle_number = '' 
                WHERE vehicle_number IS NULL;
                
                RAISE NOTICE 'vehicle_number column already exists, ensured default value';
            END IF;
        END IF;
    ELSE
        RAISE NOTICE 'vehicles table does not exist yet';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error fixing vehicles table: %', SQLERRM;
END $$;

-- =============================================================================
-- Also ensure other common columns exist in vehicles
-- =============================================================================
DO $$
DECLARE
    col_name text;
    col_type text;
BEGIN
    -- List of expected columns for vehicles table
    FOR col_name, col_type IN 
        VALUES 
            ('id', 'uuid'),
            ('customer_id', 'uuid'),
            ('vehicle_number', 'text'),
            ('vehicle_type', 'text'),
            ('model', 'text'),
            ('year', 'integer'),
            ('status', 'text'),
            ('notes', 'text'),
            ('entry_date', 'timestamp with time zone'),
            ('created_at', 'timestamp with time zone'),
            ('updated_at', 'timestamp with time zone')
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'vehicles' 
            AND column_name = col_name
        ) THEN
            EXECUTE format('ALTER TABLE public.vehicles ADD COLUMN %I %s', col_name, col_type);
            RAISE NOTICE 'Added column: % %', col_name, col_type;
        END IF;
    END LOOP;
END $$;

-- =============================================================================
-- Add primary key if missing
-- =============================================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'vehicles_pkey'
    ) THEN
        ALTER TABLE public.vehicles ADD CONSTRAINT vehicles_pkey PRIMARY KEY (id);
        RAISE NOTICE 'Added vehicles_pkey primary key';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error adding primary key: %', SQLERRM;
END $$;

-- =============================================================================
-- Add foreign key if missing
-- =============================================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'vehicles_customer_id_fkey'
    ) THEN
        ALTER TABLE public.vehicles ADD CONSTRAINT vehicles_customer_id_fkey 
            FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;
        RAISE NOTICE 'Added vehicles_customer_id_fkey foreign key';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error adding foreign key: %', SQLERRM;
END $$;

-- =============================================================================
-- Re-enable triggers
-- =============================================================================
RESET session_replication_role;

-- =============================================================================
-- Force PostgREST to reload schema cache
-- =============================================================================
NOTIFY pgrst, 'reload schema';

