-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create booking_catalog table
CREATE TABLE IF NOT EXISTS public.booking_catalog (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    display_name TEXT NOT NULL,
    description TEXT,
    estimated_cost NUMERIC(10, 2) DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    service_type_id UUID REFERENCES public.service_types(id) ON DELETE SET NULL,
    vehicle_category_id UUID REFERENCES public.vehicle_categories(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.booking_catalog ENABLE ROW LEVEL SECURITY;

-- Policies
-- Everyone can read active items
CREATE POLICY "Public read access" ON public.booking_catalog
    FOR SELECT USING (true);

-- Only admins/managers can insert/update/delete
CREATE POLICY "Admin full access" ON public.booking_catalog
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_roles.user_id = auth.uid()
            AND user_roles.role IN ('admin', 'staff')
        )
    );

-- Triggers for updated_at
CREATE TRIGGER update_booking_catalog_modtime
    BEFORE UPDATE ON public.booking_catalog
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();
