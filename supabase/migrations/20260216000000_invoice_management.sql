-- Migration: 20260216000000_invoice_management.sql
-- Description: Adds support for editable invoices, sequential bill numbers, and line items.

-- 1. Create Sequence for Bill Numbers
-- Starts at 1. We essentially reserve 0 or null for drafts if needed, 
-- but the requirement says "unique auto-generated bill number starting from 1".
CREATE SEQUENCE IF NOT EXISTS public.invoice_bill_number_seq
    START WITH 1
    INCREMENT BY 1;

-- 2. Update Invoices Table
-- Add bill_number and notes
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'invoices' AND column_name = 'bill_number') THEN
        ALTER TABLE public.invoices ADD COLUMN bill_number bigint DEFAULT nextval('invoice_bill_number_seq');
        ALTER TABLE public.invoices ADD CONSTRAINT invoices_bill_number_key UNIQUE (bill_number);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'invoices' AND column_name = 'notes') THEN
        ALTER TABLE public.invoices ADD COLUMN notes text;
    END IF;
END$$;

-- 3. Create Invoice Items Table
-- Tracks the individual line items for an invoice.
-- Can be synced from work_order_services or added manually.
CREATE TABLE IF NOT EXISTS public.invoice_items (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
    work_order_service_id uuid REFERENCES public.work_order_services(id) ON DELETE SET NULL, -- Link to original service if applicable
    description text NOT NULL,
    quantity numeric(10,2) NOT NULL DEFAULT 1,
    unit_price numeric(10,2) NOT NULL DEFAULT 0,
    total numeric(10,2) NOT NULL DEFAULT 0, -- Store calculated total to ensure historic accuracy
    type text CHECK (type IN ('service', 'part', 'labor', 'adjustment', 'tax', 'discount')) DEFAULT 'service',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Trigger for updated_at on invoice_items
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_invoice_items_updated_at ON public.invoice_items;
CREATE TRIGGER update_invoice_items_updated_at
    BEFORE UPDATE ON public.invoice_items
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- RLS for invoice_items
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff+ can read invoice_items" ON public.invoice_items
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'manager', 'staff'))
    );

CREATE POLICY "Admins/Managers can manage invoice_items" ON public.invoice_items
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'manager'))
    );
