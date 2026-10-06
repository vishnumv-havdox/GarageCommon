-- Migration: 20260303000001_create_vehicle_master_tables
-- Description: Creates vehicle categories, manufacturers, types, and models master tables with RLS

CREATE TABLE IF NOT EXISTS public.vehicle_categories (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL UNIQUE,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.vehicle_manufacturers (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL UNIQUE,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.vehicle_types (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL UNIQUE,
    category_id uuid REFERENCES public.vehicle_categories(id) ON DELETE SET NULL,
    base_workload_multiplier numeric(10,2) DEFAULT 1.0,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.vehicle_models (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    manufacturer_id uuid REFERENCES public.vehicle_manufacturers(id) ON DELETE CASCADE,
    vehicle_type_id uuid REFERENCES public.vehicle_types(id) ON DELETE SET NULL,
    created_at timestamptz DEFAULT now(),
    UNIQUE(name, manufacturer_id, vehicle_type_id)
);

ALTER TABLE public.vehicle_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_manufacturers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_models ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow view vehicle_categories" ON public.vehicle_categories;
CREATE POLICY "Allow view vehicle_categories" ON public.vehicle_categories FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow admin manage vehicle_categories" ON public.vehicle_categories;
CREATE POLICY "Allow admin manage vehicle_categories" ON public.vehicle_categories FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'manager'))
);

DROP POLICY IF EXISTS "Allow view vehicle_manufacturers" ON public.vehicle_manufacturers;
CREATE POLICY "Allow view vehicle_manufacturers" ON public.vehicle_manufacturers FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow admin manage vehicle_manufacturers" ON public.vehicle_manufacturers;
CREATE POLICY "Allow admin manage vehicle_manufacturers" ON public.vehicle_manufacturers FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'manager'))
);

DROP POLICY IF EXISTS "Allow view vehicle_types" ON public.vehicle_types;
CREATE POLICY "Allow view vehicle_types" ON public.vehicle_types FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow admin manage vehicle_types" ON public.vehicle_types;
CREATE POLICY "Allow admin manage vehicle_types" ON public.vehicle_types FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'manager'))
);

DROP POLICY IF EXISTS "Allow view vehicle_models" ON public.vehicle_models;
CREATE POLICY "Allow view vehicle_models" ON public.vehicle_models FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow admin manage vehicle_models" ON public.vehicle_models;
CREATE POLICY "Allow admin manage vehicle_models" ON public.vehicle_models FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'manager'))
);

NOTIFY pgrst, 'reload schema';
