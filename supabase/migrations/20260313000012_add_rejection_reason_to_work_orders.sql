-- Migration: 20260313000000_add_rejection_reason_to_work_orders
-- Description: Adds rejection_reason column to work_orders table to fix missing column error

SET session_replication_role = 'replica';

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'rejection_reason') THEN
        ALTER TABLE public.work_orders ADD COLUMN rejection_reason text;
    END IF;
    
    -- Also add rejected_at and rejected_by just in case they are needed later for work_orders level rejection
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'rejected_at') THEN
        ALTER TABLE public.work_orders ADD COLUMN rejected_at timestamptz;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'rejected_by') THEN
        ALTER TABLE public.work_orders ADD COLUMN rejected_by uuid REFERENCES auth.users(id);
    END IF;
END$$;

NOTIFY pgrst, 'reload schema';
RESET session_replication_role;
