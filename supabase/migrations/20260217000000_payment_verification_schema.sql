-- Migration: 20260217000000_payment_verification_schema.sql

-- 1. Add payment_qr_code_url to company_profiles
ALTER TABLE public.company_profiles ADD COLUMN IF NOT EXISTS payment_qr_code_url text;

-- 2. Create payments table
CREATE TABLE IF NOT EXISTS public.payments (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
    amount numeric(10,2) NOT NULL,
    payment_method text NOT NULL CHECK (payment_method IN ('UPI', 'Bank Transfer', 'Cash')),
    transaction_reference text,
    proof_url text NOT NULL,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    admin_remarks text,
    verified_by uuid REFERENCES auth.users(id),
    verified_at timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 3. Enable RLS
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- 4. Policies for payments table

-- Admin/Staff can view all payments
CREATE POLICY "Admins and Staff can view all payments" ON public.payments
    FOR SELECT
    USING (
        EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'manager', 'staff'))
    );

-- Admin/Managers can update payments (verify/reject)
CREATE POLICY "Admins and Managers can update payments" ON public.payments
    FOR UPDATE
    USING (
        EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'manager'))
    );

-- Customers can view their own payments via invoice linkage
CREATE POLICY "Customers can view their own payments" ON public.payments
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.invoices i
            JOIN public.customers c ON i.customer_id = c.id
            WHERE i.id = payments.invoice_id
            AND c.user_id = auth.uid()
        )
    );

-- Customers can insert payments for their own invoices
CREATE POLICY "Customers can insert payments for their invoices" ON public.payments
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.invoices i
            JOIN public.customers c ON i.customer_id = c.id
            WHERE i.id = payments.invoice_id
            AND c.user_id = auth.uid()
        )
    );

-- 5. Trigger for updated_at
CREATE TRIGGER update_payments_updated_at
    BEFORE UPDATE ON public.payments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 6. Storage Bucket Setup (Attempt to create if not exists - dependent on privileges)
-- We'll assume the 'payment-proofs' and 'qr-codes' buckets need to act like public/authenticated buckets
-- For simplicity, let's just ensure RLS on storage.objects if buckets exist, or user might need to create them.
-- We will create a policy for storage.objects for these specific buckets.

-- Policy for 'payment-proofs' bucket
-- Customers can upload
CREATE POLICY "Customers can upload payment proofs" ON storage.objects
    FOR INSERT
    WITH CHECK (
        bucket_id = 'payment-proofs' AND
        auth.role() = 'authenticated'
    );

-- Customers can read their own proofs (simplify to authenticated read for now, or public if we want easiest image loading)
-- Let's make it authenticated read.
CREATE POLICY "Authenticated users can read payment proofs" ON storage.objects
    FOR SELECT
    USING (
        bucket_id = 'payment-proofs' AND
        auth.role() = 'authenticated'
    );

-- Policy for 'qr-codes' bucket
-- Admins can upload
CREATE POLICY "Admins can upload QR codes" ON storage.objects
    FOR INSERT
    WITH CHECK (
        bucket_id = 'qr-codes' AND
        EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'manager'))
    );

-- Everyone can read QR codes (public)
CREATE POLICY "Anyone can read QR codes" ON storage.objects
    FOR SELECT
    USING ( bucket_id = 'qr-codes' );
