-- Migration: 20260201100000_align_schema_with_dump
-- Description: Aligns schema with user requirements by adding missing columns to employees and work order assignments

SET session_replication_role = 'replica';

-- =============================================================================
-- 1. EMPLOYEES: Add legacy/redundant text columns if they don't exist
-- =============================================================================
DO $$
BEGIN
    -- Add position (text) if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'employees' AND column_name = 'position') THEN
        ALTER TABLE public.employees ADD COLUMN position text DEFAULT 'Staff';
    END IF;

    -- Add role (text) if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'employees' AND column_name = 'role') THEN
        ALTER TABLE public.employees ADD COLUMN role text DEFAULT 'staff';
    END IF;
END $$;

-- =============================================================================
-- 2. WORK ORDER ASSIGNMENTS: Add approval tracking
-- =============================================================================
DO $$
BEGIN
    -- approved_by
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_order_assignments' AND column_name = 'approved_by') THEN
        ALTER TABLE public.work_order_assignments ADD COLUMN approved_by uuid REFERENCES auth.users(id);
    END IF;

    -- approved_at
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_order_assignments' AND column_name = 'approved_at') THEN
        ALTER TABLE public.work_order_assignments ADD COLUMN approved_at timestamptz;
    END IF;

    -- approval_notes
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_order_assignments' AND column_name = 'approval_notes') THEN
        ALTER TABLE public.work_order_assignments ADD COLUMN approval_notes text;
    END IF;
END $$;

-- =============================================================================
-- 3. WORK ORDER SERVICE EMPLOYEES: Add approval tracking
-- =============================================================================
DO $$
BEGIN
    -- approved_by
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_order_service_employees' AND column_name = 'approved_by') THEN
        ALTER TABLE public.work_order_service_employees ADD COLUMN approved_by uuid REFERENCES auth.users(id);
    END IF;

    -- approved_at
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_order_service_employees' AND column_name = 'approved_at') THEN
        ALTER TABLE public.work_order_service_employees ADD COLUMN approved_at timestamptz;
    END IF;

    -- approval_notes
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_order_service_employees' AND column_name = 'approval_notes') THEN
        ALTER TABLE public.work_order_service_employees ADD COLUMN approval_notes text;
    END IF;
END $$;

RESET session_replication_role;

NOTIFY pgrst, 'reload schema';
