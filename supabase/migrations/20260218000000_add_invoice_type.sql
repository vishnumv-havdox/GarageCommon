-- Add type column to invoices table
ALTER TABLE public.invoices 
ADD COLUMN IF NOT EXISTS type text DEFAULT 'invoice' CHECK (type IN ('invoice', 'quotation'));

-- Add comment
COMMENT ON COLUMN public.invoices.type IS 'Distinguishes between Tax Invoice and Quotation';
