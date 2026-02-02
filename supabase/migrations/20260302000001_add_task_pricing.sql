-- Migration: 20260302000001_add_task_pricing.sql
-- Description: Add pricing support for tasks and task templates

-- 1. Add price column to task_templates
ALTER TABLE public.task_templates ADD COLUMN IF NOT EXISTS price numeric(10,2) DEFAULT 0;

-- 2. Add price column to work_order_tasks
ALTER TABLE public.work_order_tasks ADD COLUMN IF NOT EXISTS price numeric(10,2) DEFAULT 0;

-- 3. Add audit columns to task_templates (if missing)
ALTER TABLE public.task_templates ADD COLUMN IF NOT EXISTS last_updated_by uuid REFERENCES auth.users(id);

-- 4. Seed initial prices for default task templates (optional but helpful)
UPDATE public.task_templates SET price = 500 WHERE name ILIKE '%Oil Change%';
UPDATE public.task_templates SET price = 1000 WHERE name ILIKE '%Brake Pads%';
UPDATE public.task_templates SET price = 1500 WHERE name ILIKE '%Panel%';
UPDATE public.task_templates SET price = 2000 WHERE name ILIKE '%Paint%';

-- 5. Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
