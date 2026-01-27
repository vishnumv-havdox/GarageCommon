-- Create 'payment-proofs' bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-proofs', 'payment-proofs', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Create 'qr-codes' bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('qr-codes', 'qr-codes', true)
ON CONFLICT (id) DO UPDATE SET public = true;


-- Ensure policies exist (re-applying just in case, though handled in previous steps, specific to storage now)

-- POLICY: Customers can upload to payment-proofs
DROP POLICY IF EXISTS "Customers can upload payment proofs" ON storage.objects;
CREATE POLICY "Customers can upload payment proofs" ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK ( bucket_id = 'payment-proofs' );

-- POLICY: Everyone can view payment proofs (since public bucket)
-- We restrict listing/viewing at app level, but for getPublicUrl to work without signed tokens, public=true bucket is key.
-- Row level security on objects still applies? Yes.
-- If bucket is public, anyone with the name can download.
-- Let's enable read for valid users.

DROP POLICY IF EXISTS "Authenticated users can read payment proofs" ON storage.objects;
CREATE POLICY "Authenticated users can read payment proofs" ON storage.objects
    FOR SELECT
    TO authenticated
    USING ( bucket_id = 'payment-proofs' );


-- POLICY: Admins can upload QR codes
DROP POLICY IF EXISTS "Admins can upload QR codes" ON storage.objects;
CREATE POLICY "Admins can upload QR codes" ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'qr-codes' AND
        EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'manager'))
    );

-- POLICY: Everyone can read QR codes
DROP POLICY IF EXISTS "Anyone can read QR codes" ON storage.objects;
CREATE POLICY "Anyone can read QR codes" ON storage.objects
    FOR SELECT
    USING ( bucket_id = 'qr-codes' );
