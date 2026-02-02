-- Migration: 20260302000000_enhance_services_master
-- Description: Enhance service_types and task_templates for centralized service management

-- 1. Enhance service_types table
ALTER TABLE public.service_types ADD COLUMN IF NOT EXISTS category text DEFAULT 'General';
ALTER TABLE public.service_types ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.service_types ADD COLUMN IF NOT EXISTS base_price numeric DEFAULT 0;
ALTER TABLE public.service_types ADD COLUMN IF NOT EXISTS estimated_duration text;
ALTER TABLE public.service_types ADD COLUMN IF NOT EXISTS tax_applicable boolean DEFAULT true;
ALTER TABLE public.service_types ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
ALTER TABLE public.service_types ADD COLUMN IF NOT EXISTS required_fields text[] DEFAULT '{}';
ALTER TABLE public.service_types ADD COLUMN IF NOT EXISTS inventory_categories text[] DEFAULT '{}';
ALTER TABLE public.service_types ADD COLUMN IF NOT EXISTS last_updated_by uuid REFERENCES auth.users(id);
ALTER TABLE public.service_types ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- 2. Enhance task_templates table
ALTER TABLE public.task_templates ADD COLUMN IF NOT EXISTS last_updated_by uuid REFERENCES auth.users(id);
ALTER TABLE public.task_templates ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- 3. Add trigger for updated_at on service_types if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_service_types_updated_at') THEN
        CREATE TRIGGER update_service_types_updated_at
            BEFORE UPDATE ON public.service_types
            FOR EACH ROW
            EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
END$$;

-- 4. Add trigger for updated_at on task_templates if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_task_templates_updated_at') THEN
        CREATE TRIGGER update_task_templates_updated_at
            BEFORE UPDATE ON public.task_templates
            FOR EACH ROW
            EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
END$$;

-- 5. Seed enhanced data for existing services (based on serviceTypeConfig.ts)
-- Mechanical Repair
UPDATE public.service_types SET 
    category = 'Mechanical',
    description = 'Standard mechanical repairs and diagnostics',
    base_price = 1500,
    estimated_duration = '2-4 hours',
    required_fields = ARRAY['vehicle_id', 'service_type', 'description', 'estimated_cost'],
    inventory_categories = ARRAY['Mechanical Parts', 'Filters', 'Fluids', 'Bearings', 'Seals']
WHERE name = 'Mechanical Repair';

-- Body Building
UPDATE public.service_types SET 
    category = 'Bodywork',
    description = 'Major body modifications and frame work',
    base_price = 5000,
    estimated_duration = '3-7 days',
    required_fields = ARRAY['vehicle_id', 'service_type', 'description', 'estimated_cost'],
    inventory_categories = ARRAY['Body Parts', 'Sheet Metal', 'Paint Supplies', 'Welding Consumables']
WHERE name = 'Body Building';

-- Painting
UPDATE public.service_types SET 
    category = 'Bodywork',
    description = 'Full body or partial painting services',
    base_price = 3000,
    estimated_duration = '2-5 days',
    required_fields = ARRAY['vehicle_id', 'service_type', 'description', 'color_code', 'estimated_cost'],
    inventory_categories = ARRAY['Paint Supplies', 'Clear Coat', 'Primers', 'Sandpaper', 'Masking']
WHERE name = 'Painting';

-- Electrical Work
UPDATE public.service_types SET 
    category = 'Electrical',
    description = 'A/C, wiring, and electronic system repairs',
    base_price = 1200,
    estimated_duration = '1-4 hours',
    required_fields = ARRAY['vehicle_id', 'service_type', 'description', 'estimated_cost'],
    inventory_categories = ARRAY['Electrical Parts', 'Wiring', 'Fuses', 'Relays', 'Sensors']
WHERE name = 'Electrical Work';

-- Seed tasks for Mechanical Repair if they don't exist
DO $$
DECLARE
    v_service_id uuid;
BEGIN
    SELECT id INTO v_service_id FROM public.service_types WHERE name = 'Mechanical Repair';
    IF v_service_id IS NOT NULL THEN
        INSERT INTO public.task_templates (service_type_id, name)
        VALUES 
            (v_service_id, 'Oil Change'),
            (v_service_id, 'Filter Replacement'),
            (v_service_id, 'Spark Plug Replacement'),
            (v_service_id, 'General Inspection'),
            (v_service_id, 'Fluid Top-up')
        ON CONFLICT DO NOTHING;
    END IF;
END$$;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_types TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_templates TO authenticated;
