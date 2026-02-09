-- Migration: 20260313000000_payment_deductions_multi_bill.sql
-- Description: Supports payment deductions and linking a single payment to multiple invoices.

-- 1. Add deduction fields to payments table
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS deduction_amount numeric(10,2) DEFAULT 0;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS deduction_reason text;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS is_final_settlement boolean DEFAULT false;

-- 2. Add total_deductions to invoices table
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS total_deductions numeric(10,2) DEFAULT 0;

-- 3. Make invoice_id optional in payments table (for multi-bill)
ALTER TABLE public.payments ALTER COLUMN invoice_id DROP NOT NULL;

-- 4. Create payment_links table (Many-to-Many between payments and invoices)
CREATE TABLE IF NOT EXISTS public.payment_links (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    payment_id uuid NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
    invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
    amount_applied numeric(10,2) NOT NULL DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    UNIQUE(payment_id, invoice_id)
);

-- 5. Enable RLS on payment_links
ALTER TABLE public.payment_links ENABLE ROW LEVEL SECURITY;

-- 6. Policies for payment_links
CREATE POLICY "Admins and Staff can view all payment_links" ON public.payment_links
    FOR SELECT
    USING (
        EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'manager', 'staff'))
    );

CREATE POLICY "Customers can view their own payment_links" ON public.payment_links
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.invoices i
            JOIN public.customers c ON i.customer_id = c.id
            WHERE i.id = payment_links.invoice_id
            AND c.user_id = auth.uid()
        )
    );

-- 7. Update Policies for payments table to support multi-bill visibility
-- We need to DROP existing policies first to replace them
DROP POLICY IF EXISTS "Customers can view their own payments" ON public.payments;
DROP POLICY IF EXISTS "Customers can insert payments" ON public.payments;
DROP POLICY IF EXISTS "Customers can insert payments for their invoices" ON public.payments;
DROP POLICY IF EXISTS "Customers can insert their own payments" ON public.payments;

CREATE POLICY "Customers can view their own payments" ON public.payments
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.invoices i
            JOIN public.customers c ON i.customer_id = c.id
            WHERE (i.id = payments.invoice_id OR i.id IN (SELECT invoice_id FROM public.payment_links WHERE payment_id = payments.id))
            AND c.user_id = auth.uid()
        )
    );

CREATE POLICY "Customers can insert payments" ON public.payments
    FOR INSERT
    WITH CHECK (
        auth.role() = 'authenticated'
    );

-- 8. Add index for performance
CREATE INDEX IF NOT EXISTS idx_payment_links_payment_id ON public.payment_links(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_links_invoice_id ON public.payment_links(invoice_id);
