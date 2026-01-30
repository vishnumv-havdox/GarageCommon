-- Create 'public-assets' bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('public-assets', 'public-assets', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- POLICY: Admins can manage public-assets
DROP POLICY IF EXISTS "Admins can manage public assets" ON storage.objects;
CREATE POLICY "Admins can manage public assets" ON storage.objects
    FOR ALL
    TO authenticated
    USING (
        bucket_id = 'public-assets' AND
        EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'manager'))
    )
    WITH CHECK (
        bucket_id = 'public-assets' AND
        EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'manager'))
    );

-- POLICY: Everyone can read public-assets
DROP POLICY IF EXISTS "Anyone can read public assets" ON storage.objects;
CREATE POLICY "Anyone can read public assets" ON storage.objects
    FOR SELECT
    USING ( bucket_id = 'public-assets' );

-- Update qr-codes policy to allow management (not just insert)
DROP POLICY IF EXISTS "Admins can manage QR codes" ON storage.objects;
CREATE POLICY "Admins can manage QR codes" ON storage.objects
    FOR ALL
    TO authenticated
    USING (
        bucket_id = 'qr-codes' AND
        EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'manager'))
    )
    WITH CHECK (
        bucket_id = 'qr-codes' AND
        EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'manager'))
    );
