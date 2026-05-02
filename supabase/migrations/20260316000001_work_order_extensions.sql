-- Migration: Extending Work Order Module
-- Description: Adds tables for vehicle photos and belongings, and creates a storage bucket.

-- 1. Create work_order_photos table
CREATE TABLE IF NOT EXISTS public.work_order_photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    work_order_id UUID NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
    vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
    company_id UUID REFERENCES public.company_profiles(id) ON DELETE SET NULL,
    photo_url TEXT NOT NULL,
    photo_type TEXT NOT NULL CHECK (photo_type IN ('arrival', 'issue_area')),
    description TEXT,
    uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Create work_order_belongings table
CREATE TABLE IF NOT EXISTS public.work_order_belongings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    work_order_id UUID NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
    item_name TEXT NOT NULL,
    description TEXT,
    photo_url TEXT NOT NULL,
    confirmed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    confirmed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Add triggers for updated_at
CREATE TRIGGER update_work_order_photos_updated_at
    BEFORE UPDATE ON public.work_order_photos
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_work_order_belongings_updated_at
    BEFORE UPDATE ON public.work_order_belongings
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Set up storage bucket (Note: storage commands are usually handled via Supabase API or specific SQL functions)
-- We'll assume the bucket exists or create it via code. If SQL is needed:
INSERT INTO storage.buckets (id, name, public) 
VALUES ('work-order-assets', 'work-order-assets', true)
ON CONFLICT (id) DO NOTHING;

-- 5. RLS Policies for tables

-- work_order_photos
ALTER TABLE public.work_order_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view work order photos" ON public.work_order_photos
    FOR SELECT USING (auth.role() IN ('authenticated', 'anon')); -- Allow customer portal too

CREATE POLICY "Admin and staff can manage work order photos" ON public.work_order_photos
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.employees 
            WHERE user_id = auth.uid() 
            AND status = 'active'
        )
    );

-- work_order_belongings
ALTER TABLE public.work_order_belongings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view belongings" ON public.work_order_belongings
    FOR SELECT USING (auth.role() IN ('authenticated', 'anon'));

CREATE POLICY "Admin and staff can manage belongings" ON public.work_order_belongings
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.employees 
            WHERE user_id = auth.uid() 
            AND status = 'active'
        )
    );

-- 6. Storage Policies (Supabase specific)
-- Note: These might need to be applied in a way that the storage schema understands
-- Typical policy for publicly readable assets:
CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'work-order-assets');
CREATE POLICY "Authenticated Upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'work-order-assets' AND auth.role() = 'authenticated');
CREATE POLICY "Authenticated Update" ON storage.objects FOR UPDATE USING (bucket_id = 'work-order-assets' AND auth.role() = 'authenticated');
CREATE POLICY "Authenticated Delete" ON storage.objects FOR DELETE USING (bucket_id = 'work-order-assets' AND auth.role() = 'authenticated');

-- 7. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_work_order_photos_wo_id ON public.work_order_photos(work_order_id);
CREATE INDEX IF NOT EXISTS idx_work_order_photos_vehicle_id ON public.work_order_photos(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_work_order_belongings_wo_id ON public.work_order_belongings(work_order_id);
