-- Migration: 20260313000003_customer_payment_links_rls.sql
-- Description: Allows customers to insert into payment_links for their own invoices.

-- 1. Allow Customers to INSERT into payment_links
-- They can only link payments to invoices that belong to them.
CREATE POLICY "Customers can insert payment_links" ON public.payment_links
    FOR INSERT
    WITH CHECK (
        -- Check if the invoice belongs to the customer
        EXISTS (
            SELECT 1 FROM public.invoices i
            JOIN public.customers c ON i.customer_id = c.id
            WHERE i.id = payment_links.invoice_id
            AND c.user_id = auth.uid()
        )
    );

-- 2. Allow Customers to SELECT their own payment_links (already exists in 20260313000000, but ensuring no conflict)
-- The previous migration 20260313000000 had:
-- CREATE POLICY "Customers can view their own payment_links" ...
-- So we strictly need the INSERT policy.
