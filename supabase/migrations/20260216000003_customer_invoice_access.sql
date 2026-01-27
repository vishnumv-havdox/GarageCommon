-- Add RLS policies for customers to view their invoices and invoice items

-- 1. Policies for 'invoices' table
-- Check if policy exists first to avoid errors (or just use CREATE POLICY IF NOT EXISTS syntax if supported, but standard PG doesn't support IF NOT EXISTS for policies directly in all versions, so we use DROP IF EXISTS)

DROP POLICY IF EXISTS "Customers can view their own invoices" ON public.invoices;
CREATE POLICY "Customers can view their own invoices" ON public.invoices
    FOR SELECT
    USING (
        auth.uid() IN (
            SELECT user_id FROM public.customers WHERE id = invoices.customer_id
        )
    );

-- 2. Policies for 'invoice_items' table
-- Customers should see items if they can see the parent invoice

DROP POLICY IF EXISTS "Customers can view their own invoice items" ON public.invoice_items;
CREATE POLICY "Customers can view their own invoice items" ON public.invoice_items
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.invoices i
            JOIN public.customers c ON i.customer_id = c.id
            WHERE i.id = invoice_items.invoice_id
            AND c.user_id = auth.uid()
        )
    );
