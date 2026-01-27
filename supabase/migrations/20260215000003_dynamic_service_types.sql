-- Create service_types table for dynamic service management
CREATE TABLE IF NOT EXISTS public.service_types (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL UNIQUE,
    created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.service_types ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Enable read access for authenticated users" ON public.service_types
    FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "Enable insert access for staff and admins" ON public.service_types
    FOR INSERT
    WITH CHECK (
        public.has_role(auth.uid(), 'staff') OR 
        public.has_role(auth.uid(), 'admin') OR
        public.has_role(auth.uid(), 'manager')
    );

-- Seed initial data from existing config
INSERT INTO public.service_types (name) VALUES
    ('Mechanical Repair'),
    ('Body Building'),
    ('Painting'),
    ('Electrical Work'),
    ('Tinker Work'),
    ('Engine Overhaul'),
    ('Transmission Repair'),
    ('Brake System'),
    ('Suspension Work'),
    ('Air Conditioning'),
    ('Custom Modification')
ON CONFLICT (name) DO NOTHING;

