-- Migration: 20260309000001_fc_work_schema.sql
-- Description: Adds FC Work support via is_fc_exclusive column and seed data

-- 1. Add column to service_types
ALTER TABLE public.service_types 
ADD COLUMN IF NOT EXISTS is_fc_exclusive boolean DEFAULT false;

-- 2. Seed FC-Specific Services
-- Note: These are distinct from standard services and will filtered in the UI
INSERT INTO public.service_types (name, category, description, base_price, estimated_duration, is_fc_exclusive, is_active)
VALUES 
    ('FC - Full Painting', 'Bodywork', 'Complete body painting for FC renewal', 15000, '5-7 days', true, true),
    ('FC - Structural Inspection', 'Mechanical', 'Chassis and frame inspection for FC certification', 2500, '4 hours', true, true),
    ('FC - Brake Overhaul', 'Mechanical', 'Complete brake system overhaul for FC compliance', 4500, '1 day', true, true),
    ('FC - Electrical Wiring Check', 'Electrical', 'Full wiring harness inspection and tagging', 3500, '6 hours', true, true),
    ('FC - Tinker Work', 'Bodywork', 'Patchwork and dent removal for FC', 5000, '3-5 days', true, true)
ON CONFLICT (name) DO UPDATE 
SET is_fc_exclusive = true, category = EXCLUDED.category;

-- 3. Notify schema reload
NOTIFY pgrst, 'reload schema';
