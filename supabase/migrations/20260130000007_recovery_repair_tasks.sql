-- Migration: Ensure repair_tasks tables exist
-- Date: 2026-01-30
-- Description: Recovery migration for tables defined in later migrations but missing in current state

-- Create repair_tasks table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.repair_tasks (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    work_order_id uuid NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
    task_name text NOT NULL,
    task_description text,
    task_category text DEFAULT 'General',
    status text DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'reopened')),
    priority text DEFAULT 'Medium' CHECK (priority IN ('Low', 'Medium', 'High', 'Urgent')),
    sequence_order integer DEFAULT 0,
    notes text,
    completed_at timestamptz,
    completed_by uuid,
    reopened_at timestamptz,
    reopened_by uuid,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Create repair_task_history table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.repair_task_history (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    task_id uuid NOT NULL REFERENCES public.repair_tasks(id) ON DELETE CASCADE,
    action text NOT NULL CHECK (action IN ('created', 'started', 'completed', 'reopened', 'updated')),
    performed_by uuid,
    notes text,
    created_at timestamptz DEFAULT now()
);

-- Ensure RLS is enabled
ALTER TABLE public.repair_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repair_task_history ENABLE ROW LEVEL SECURITY;

-- Simple policies if missing (safe to run)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'repair_tasks' AND policyname = 'Anyone can view repair tasks') THEN
        CREATE POLICY "Anyone can view repair tasks" ON public.repair_tasks FOR SELECT TO authenticated USING (true);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'repair_task_history' AND policyname = 'Anyone can view repair task history') THEN
        CREATE POLICY "Anyone can view repair task history" ON public.repair_task_history FOR SELECT TO authenticated USING (true);
    END IF;
END$$;

NOTIFY pgrst, 'reload schema';
