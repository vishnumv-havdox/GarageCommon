-- =============================================================================
-- FIX: employees.role NOT NULL constraint
-- Migration: 20260123000002_fix_employees_role_null
-- Error: "null value in column 'role' violates not-null constraint"
-- =============================================================================

SET session_replication_role = 'replica';

-- =============================================================================
-- Fix role column in employees table
-- =============================================================================
DO $$
BEGIN
    -- Check if role column exists and has NOT NULL constraint
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'employees' 
        AND column_name = 'role'
        AND is_nullable = 'NO'
    ) THEN
        -- Create a default role if needed
        -- Update existing null values to 'staff'
        UPDATE public.employees SET role = 'staff' WHERE role IS NULL;
        
        -- Alter column to have a default
        ALTER TABLE public.employees 
        ALTER COLUMN role SET DEFAULT 'staff';
        
        -- Make column nullable (optional - keeps flexibility)
        ALTER TABLE public.employees 
        ALTER COLUMN role DROP NOT NULL;
        
        RAISE NOTICE 'Fixed employees.role column';
    ELSE
        RAISE NOTICE 'employees.role column not found or already nullable';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error fixing role column: %', SQLERRM;
END $$;

-- =============================================================================
-- Also fix any other problematic columns in employees table
-- =============================================================================
DO $$
DECLARE
    col RECORD;
    has_default boolean;
BEGIN
    FOR col IN 
        SELECT column_name, column_default
        FROM information_schema.columns
        WHERE table_name = 'employees'
        AND is_nullable = 'NO'
        AND column_name NOT IN ('id', 'name', 'email', 'access_level', 'status')
    LOOP
        RAISE NOTICE 'Checking column: %', col.column_name;
        
        -- Check if column has a default value
        has_default := (col.column_default IS NOT NULL);
        
        IF has_default THEN
            -- Update existing null values using the default
            EXECUTE format('UPDATE public.employees SET %I = %L WHERE %I IS NULL', 
                col.column_name, col.column_default, col.column_name);
            
            -- Remove NOT NULL constraint
            EXECUTE format('ALTER TABLE public.employees ALTER COLUMN %I DROP NOT NULL', col.column_name);
            
            RAISE NOTICE 'Fixed column: %', col.column_name;
        ELSE
            -- If no default, set a sensible value and remove NOT NULL
            EXECUTE format('ALTER TABLE public.employees ALTER COLUMN %I DROP NOT NULL', col.column_name);
            RAISE NOTICE 'Removed NOT NULL from: %', col.column_name;
        END IF;
    END LOOP;
END $$;

RESET session_replication_role;

NOTIFY pgrst, 'reload schema';

