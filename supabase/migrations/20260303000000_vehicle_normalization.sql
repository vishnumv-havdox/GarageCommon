-- Migration: 20260303000000_vehicle_normalization
-- Description: Normalizes vehicle data into Manufacturers, Categories, Types, and Models

-- 1. Create Lookup Tables
CREATE TABLE public.vehicle_manufacturers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.vehicle_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL, -- e.g., 'Truck', 'Bus', 'Pickup'
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.vehicle_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL, -- e.g., 'HCV', 'MCV', 'LCV', 'Passenger Van'
    category_id UUID REFERENCES public.vehicle_categories(id) ON DELETE CASCADE,
    base_workload_multiplier NUMERIC(10,2) DEFAULT 1.0,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.vehicle_models (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    manufacturer_id UUID REFERENCES public.vehicle_manufacturers(id) ON DELETE CASCADE,
    vehicle_type_id UUID REFERENCES public.vehicle_types(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(name, manufacturer_id, vehicle_type_id)
);

-- 2. Add foreign key to vehicles
ALTER TABLE public.vehicles ADD COLUMN model_id UUID REFERENCES public.vehicle_models(id) ON DELETE SET NULL;

-- 3. Seed Initial Data (Common in Indian context/Amma local use case)
INSERT INTO public.vehicle_manufacturers (name) VALUES 
('TATA'), ('ASHOK LEYLAND'), ('EICHER'), ('MAHINDRA'), ('BHARATBENZ'), ('FORCE'), ('SML ISUZU');

INSERT INTO public.vehicle_categories (name) VALUES 
('Truck'), ('Bus'), ('Pickup'), ('Van'), ('Utility');

-- Seed Vehicle Types with multipliers
INSERT INTO public.vehicle_types (name, category_id, base_workload_multiplier) 
SELECT 'HCV', id, 1.5 FROM public.vehicle_categories WHERE name = 'Truck';
INSERT INTO public.vehicle_types (name, category_id, base_workload_multiplier) 
SELECT 'MCV', id, 1.2 FROM public.vehicle_categories WHERE name = 'Truck';
INSERT INTO public.vehicle_types (name, category_id, base_workload_multiplier) 
SELECT 'LCV', id, 1.0 FROM public.vehicle_categories WHERE name = 'Truck';
INSERT INTO public.vehicle_types (name, category_id, base_workload_multiplier) 
SELECT 'Small Commercial', id, 0.8 FROM public.vehicle_categories WHERE name = 'Truck';

INSERT INTO public.vehicle_types (name, category_id, base_workload_multiplier) 
SELECT 'Large Bus', id, 1.4 FROM public.vehicle_categories WHERE name = 'Bus';
INSERT INTO public.vehicle_types (name, category_id, base_workload_multiplier) 
SELECT 'Mini Bus', id, 1.1 FROM public.vehicle_categories WHERE name = 'Bus';

-- 4. Enable RLS
ALTER TABLE public.vehicle_manufacturers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_models ENABLE ROW LEVEL SECURITY;

-- 5. Create basic policies (Authenticated users can view)
CREATE POLICY "Allow view manufacturers" ON public.vehicle_manufacturers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow view categories" ON public.vehicle_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow view types" ON public.vehicle_types FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow view models" ON public.vehicle_models FOR SELECT TO authenticated USING (true);

-- Admin management policies
CREATE POLICY "Allow admin manage manufacturers" ON public.vehicle_manufacturers FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Allow admin manage categories" ON public.vehicle_categories FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Allow admin manage types" ON public.vehicle_types FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Allow admin manage models" ON public.vehicle_models FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- Notify schema reload
NOTIFY pgrst, 'reload schema';
