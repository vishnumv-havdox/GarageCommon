-- Migration: Add vehicle model details, photos, and specifications
ALTER TABLE public.vehicle_models
ADD COLUMN IF NOT EXISTS image_url TEXT,
ADD COLUMN IF NOT EXISTS fuel_type TEXT,
ADD COLUMN IF NOT EXISTS engine_specs TEXT,
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS year_introduced INTEGER;

-- Ensure RLS allows authenticated users to read and insert/update
DROP POLICY IF EXISTS "Allow view vehicle_models" ON public.vehicle_models;
CREATE POLICY "Allow view vehicle_models" ON public.vehicle_models 
FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow manage vehicle_models" ON public.vehicle_models;
CREATE POLICY "Allow manage vehicle_models" ON public.vehicle_models 
FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Update some standard default images for common commercial vehicles if they don't have images
UPDATE public.vehicle_models
SET image_url = 'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/46/Tata_trucks.jpg/400px-Tata_trucks.jpg',
    fuel_type = 'Diesel',
    engine_specs = '2956 cc 4SP CR Turbo'
WHERE name ILIKE '%407%' AND image_url IS NULL;

UPDATE public.vehicle_models
SET image_url = 'https://thumb.wikimedia.org/wikipedia/commons/thumb/7/7f/Tata_Super_Ace_Front_Left.JPG/400px-Tata_Super_Ace_Front_Left.JPG',
    fuel_type = 'Diesel',
    engine_specs = '1405 cc Dicor Diesel'
WHERE name ILIKE '%Ace%' AND image_url IS NULL;

UPDATE public.vehicle_models
SET image_url = 'https://thumb.wikimedia.org/wikipedia/commons/thumb/d/d7/Mahindra_Bolero_ZLX.jpg/400px-Mahindra_Bolero_ZLX.jpg',
    fuel_type = 'Diesel',
    engine_specs = '2523 cc m2DiCR Turbo'
WHERE name ILIKE '%Bolero%' AND image_url IS NULL;
