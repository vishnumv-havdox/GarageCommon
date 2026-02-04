-- Create service_categories table
CREATE TABLE IF NOT EXISTS public.service_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.service_categories ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Enable read access for authenticated users" ON public.service_categories
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Enable insert access for authenticated users" ON public.service_categories
    FOR INSERT TO authenticated WITH CHECK (true);

-- Seed initial data (based on hardcoded values from ServicesMaster.tsx)
INSERT INTO public.service_categories (name) VALUES
    ('Mechanical'),
    ('Bodywork'),
    ('Electrical'),
    ('General'),
    ('Inspection'),
    ('Custom')
ON CONFLICT (name) DO NOTHING;

-- Grant permissions
GRANT SELECT, INSERT ON public.service_categories TO authenticated;
