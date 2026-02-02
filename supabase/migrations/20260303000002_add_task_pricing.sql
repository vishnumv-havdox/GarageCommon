-- Migration: 20260303000002_add_task_pricing
-- Description: Adds task_template_id to pricing_rules to support task-level variable pricing

-- 1. Add task_template_id to pricing_rules
ALTER TABLE public.pricing_rules
    ADD COLUMN task_template_id UUID REFERENCES public.task_templates(id) ON DELETE CASCADE;

-- 2. Add comment/description
COMMENT ON COLUMN public.pricing_rules.task_template_id IS 'If set, this rule applies specifically to this task template within the service.';

-- 3. Notify schema reload
NOTIFY pgrst, 'reload schema';
