-- Create belonging_templates table
CREATE TABLE IF NOT EXISTS public.belonging_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.belonging_templates ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Enable read access for all users" ON public.belonging_templates
    FOR SELECT USING (true);

CREATE POLICY "Enable all access for admins" ON public.belonging_templates
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_id = auth.uid() AND (role = 'admin' OR role = 'superadmin')
        )
    );

-- Populate initial templates
INSERT INTO public.belonging_templates (name, description) VALUES
('Toolkit', 'Standard vehicle tool kit'),
('Spare Tire', 'Stepney / Spare wheel'),
('Jack & Handle', 'Vehicle lifting jack'),
('Stereo/Infotainment', 'Built-in or after-market stereo'),
('Dashcam', 'Front/Rear dashboard camera'),
('First Aid Kit', 'Standard medical kit'),
('Fragrances/Air Freshener', 'Hanging or vent air fresheners'),
('Documents Folder', 'RC, Insurance, Pollution papers'),
('Keyring/Keys', 'Spare keys or decorative keychains'),
('Electronics/Laptop', 'Items left in cabin'),
('Cables/Chargers', 'USB or AUX cables'),
('Umbrella', 'Large or small umbrella'),
('Baby Seat', 'Child safety seat')
ON CONFLICT (name) DO NOTHING;

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_belonging_templates_name ON public.belonging_templates(name);
