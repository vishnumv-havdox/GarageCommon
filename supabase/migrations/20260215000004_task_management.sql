-- Create task_templates table
CREATE TABLE IF NOT EXISTS public.task_templates (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    service_type_id uuid REFERENCES public.service_types(id) ON DELETE CASCADE,
    name text NOT NULL,
    description text,
    priority text DEFAULT 'Medium',
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.task_templates ENABLE ROW LEVEL SECURITY;

-- Policies
-- Policies
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.task_templates;
CREATE POLICY "Enable read access for authenticated users" ON public.task_templates
    FOR SELECT
    USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Enable all access for staff and admins" ON public.task_templates;
CREATE POLICY "Enable all access for staff and admins" ON public.task_templates
    FOR ALL
    USING (
        public.has_role(auth.uid(), 'staff') OR 
        public.has_role(auth.uid(), 'admin') OR
        public.has_role(auth.uid(), 'manager')
    );

-- Seed Data using a DO block to look up service IDs
DO $$
DECLARE
    v_service_id uuid;
BEGIN
    -- Mechanical Repair
    SELECT id INTO v_service_id FROM public.service_types WHERE name = 'Mechanical Repair';
    IF v_service_id IS NOT NULL THEN
        INSERT INTO public.task_templates (service_type_id, name) VALUES
            (v_service_id, 'Oil Change'),
            (v_service_id, 'Filter Replacement'),
            (v_service_id, 'Spark Plug Replacement'),
            (v_service_id, 'General Inspection'),
            (v_service_id, 'Fluid Top-up');
    END IF;

    -- Body Building
    SELECT id INTO v_service_id FROM public.service_types WHERE name = 'Body Building';
    IF v_service_id IS NOT NULL THEN
        INSERT INTO public.task_templates (service_type_id, name) VALUES
            (v_service_id, 'Panel Beating'),
            (v_service_id, 'Dent Removal'),
            (v_service_id, 'Frame Straightening'),
            (v_service_id, 'Welding'),
            (v_service_id, 'Part Replacement');
    END IF;

    -- Painting
    SELECT id INTO v_service_id FROM public.service_types WHERE name = 'Painting';
    IF v_service_id IS NOT NULL THEN
        INSERT INTO public.task_templates (service_type_id, name) VALUES
            (v_service_id, 'Full Body Paint'),
            (v_service_id, 'Touch-up'),
            (v_service_id, 'Polishing'),
            (v_service_id, 'Sanding'),
            (v_service_id, 'Clear Coat Application');
    END IF;

    -- Electrical Work
    SELECT id INTO v_service_id FROM public.service_types WHERE name = 'Electrical Work';
    IF v_service_id IS NOT NULL THEN
        INSERT INTO public.task_templates (service_type_id, name) VALUES
            (v_service_id, 'Battery Check'),
            (v_service_id, 'Wiring Repair'),
            (v_service_id, 'Alternator Replacement'),
            (v_service_id, 'Fuse Replacement'),
            (v_service_id, 'Diagnostic Scan');
    END IF;

    -- Tinker Work
    SELECT id INTO v_service_id FROM public.service_types WHERE name = 'Tinker Work';
    IF v_service_id IS NOT NULL THEN
        INSERT INTO public.task_templates (service_type_id, name) VALUES
            (v_service_id, 'Lock Repair'),
            (v_service_id, 'Hinge Adjustment'),
            (v_service_id, 'Window Mechanism Repair'),
            (v_service_id, 'Handle Replacement');
    END IF;

    -- Engine Overhaul
    SELECT id INTO v_service_id FROM public.service_types WHERE name = 'Engine Overhaul';
    IF v_service_id IS NOT NULL THEN
        INSERT INTO public.task_templates (service_type_id, name) VALUES
            (v_service_id, 'Head Gasket Replacement'),
            (v_service_id, 'Piston Ring Replacement'),
            (v_service_id, 'Valve Clearance Adjustment'),
            (v_service_id, 'Timing Belt Replacement');
    END IF;

     -- Transmission Repair
    SELECT id INTO v_service_id FROM public.service_types WHERE name = 'Transmission Repair';
    IF v_service_id IS NOT NULL THEN
        INSERT INTO public.task_templates (service_type_id, name) VALUES
            (v_service_id, 'Clutch Replacement'),
            (v_service_id, 'Fluid Flush'),
            (v_service_id, 'Gear Replacement'),
            (v_service_id, 'Linkage Adjustment');
    END IF;

     -- Brake System
    SELECT id INTO v_service_id FROM public.service_types WHERE name = 'Brake System';
    IF v_service_id IS NOT NULL THEN
        INSERT INTO public.task_templates (service_type_id, name) VALUES
            (v_service_id, 'Pad Replacement'),
            (v_service_id, 'Rotor Resurfacing/Replacement'),
            (v_service_id, 'Bleeding'),
            (v_service_id, 'Caliper Service');
    END IF;

     -- Suspension Work
    SELECT id INTO v_service_id FROM public.service_types WHERE name = 'Suspension Work';
    IF v_service_id IS NOT NULL THEN
        INSERT INTO public.task_templates (service_type_id, name) VALUES
            (v_service_id, 'Shock Replacement'),
            (v_service_id, 'Alignment'),
            (v_service_id, 'Bushing Replacement'),
            (v_service_id, 'Ball Joint Replacement');
    END IF;

     -- Air Conditioning
    SELECT id INTO v_service_id FROM public.service_types WHERE name = 'Air Conditioning';
    IF v_service_id IS NOT NULL THEN
        INSERT INTO public.task_templates (service_type_id, name) VALUES
            (v_service_id, 'Gas Top-up'),
            (v_service_id, 'Leak Test'),
            (v_service_id, 'Compressor Service'),
            (v_service_id, 'Filter Replacement');
    END IF;

     -- Custom Modification
    SELECT id INTO v_service_id FROM public.service_types WHERE name = 'Custom Modification';
    IF v_service_id IS NOT NULL THEN
        INSERT INTO public.task_templates (service_type_id, name) VALUES
            (v_service_id, 'Installation'),
            (v_service_id, 'Wiring'),
            (v_service_id, 'Fabrication'),
            (v_service_id, 'Testing');
    END IF;

END $$;
