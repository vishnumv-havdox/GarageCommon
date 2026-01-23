-- =============================================================================
-- FIX: employees.position NOT NULL constraint
-- Migration: 20260123000001_fix_employees_position_null
-- Error: "null value in column 'position' violates not-null constraint"
-- =============================================================================

SET session_replication_role = 'replica';

-- =============================================================================
-- Add default value for position column in employees table
-- =============================================================================
DO $$
BEGIN
    -- Check if column exists and has NOT NULL constraint
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'employees' 
        AND column_name = 'position'
        AND is_nullable = 'NO'
    ) THEN
        -- Set a default value for existing rows first
        UPDATE public.employees SET position = 'Staff' WHERE position IS NULL;
        
        -- Alter column to have a default
        ALTER TABLE public.employees 
        ALTER COLUMN position SET DEFAULT 'Staff';
        
        -- Make column nullable if needed
        ALTER TABLE public.employees 
        ALTER COLUMN position DROP NOT NULL;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error fixing position column: %', SQLERRM;
END $$;

-- =============================================================================
-- Alternative: If column name is different (e.g., position_id)
-- =============================================================================
DO $$
BEGIN
    -- Check if position_id column needs fixing
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'employees' 
        AND column_name = 'position_id'
        AND is_nullable = 'NO'
    ) THEN
        -- Create a default 'Staff' position if it doesn't exist
        INSERT INTO public.positions (name, department, access_level)
        VALUES ('Staff', 'General', 'staff')
        ON CONFLICT (name) DO NOTHING;
        
        -- Get the default position_id
        DECLARE
            default_pos_id uuid;
        BEGIN
            SELECT id INTO default_pos_id 
            FROM public.positions 
            WHERE name = 'Staff' 
            LIMIT 1;
            
            -- Update existing null values
            UPDATE public.employees 
            SET position_id = default_pos_id 
            WHERE position_id IS NULL;
            
            -- Set default and remove NOT NULL constraint
            ALTER TABLE public.employees 
            ALTER COLUMN position_id SET DEFAULT default_pos_id;
            
            ALTER TABLE public.employees 
            ALTER COLUMN position_id DROP NOT NULL;
        END;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error fixing position_id column: %', SQLERRM;
END $$;

-- =============================================================================
-- Verify and fix any other NOT NULL issues in employees table
-- =============================================================================
DO $$
DECLARE
    col RECORD;
BEGIN
    FOR col IN 
        SELECT column_name, column_default, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'employees'
        AND is_nullable = 'NO'
        AND column_name NOT IN ('id', 'name', 'email')
    LOOP
        RAISE NOTICE 'Checking column: %', col.column_name;
        
        -- If column has a default, remove NOT NULL
        IF col.column_default IS NOT NULL THEN
            EXECUTE format('ALTER TABLE public.employees ALTER COLUMN %I DROP NOT NULL', col.column_name);
            RAISE NOTICE 'Removed NOT NULL from %', col.column_name;
        END IF;
    END LOOP;
END $$;

RESET session_replication_role;

NOTIFY pgrst, 'reload schema';

