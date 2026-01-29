-- Migration: 20260217000000_quotation_numbers.sql
-- Description: Adds separate numbering sequence for Quotations and manages assignment via trigger.

-- 1. Create Sequence for Quotation Numbers
CREATE SEQUENCE IF NOT EXISTS public.quotation_number_seq
    START WITH 1
    INCREMENT BY 1;

-- 2. Add quotation_number column to invoices
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'invoices' AND column_name = 'quotation_number') THEN
        ALTER TABLE public.invoices ADD COLUMN quotation_number bigint;
        ALTER TABLE public.invoices ADD CONSTRAINT invoices_quotation_number_key UNIQUE (quotation_number);
    END IF;
END$$;

-- 3. Create Trigger Function to handle Finalization Logic
CREATE OR REPLACE FUNCTION public.handle_invoice_finalization()
RETURNS trigger AS $$
BEGIN
    -- Logic triggers when an invoice is moved from 'Draft' to a Finalized status
    -- Finalized statuses: 'Sent', 'Unpaid', 'Paid', 'Pending Payment', 'Payment Verification Pending', 'Overdue'
    -- We assume 'Draft' is the only non-final state.
    
    IF (OLD.status = 'Draft' AND NEW.status != 'Draft') THEN
        
        -- CASE A: It is a QUOTATION
        IF (NEW.type = 'quotation') THEN
            -- Assign Quotation Number if not present
            IF (NEW.quotation_number IS NULL) THEN
                 NEW.quotation_number := nextval('public.quotation_number_seq');
            END IF;
            
            -- Prevent Bill Number assignment (Tax Invoice compliance)
            -- If the row has a bill_number (e.g. from default), we nullify it to avoid consuming the sequence or confusing the system.
            -- However, be careful if the logic relies on bill_number. 
            -- Given the requirement "separate bill no", we ensure it has its OWN number.
            NEW.bill_number := NULL; 
        
        -- CASE B: It is a TAX INVOICE (type 'invoice' or null)
        ELSIF (NEW.type = 'invoice' OR NEW.type IS NULL) THEN
            -- Assign Bill Number if not present
            IF (NEW.bill_number IS NULL) THEN
                NEW.bill_number := nextval('public.invoice_bill_number_seq');
            END IF;
            
            -- Ensure it doesn't have a quotation number
            NEW.quotation_number := NULL; 
        END IF;
        
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Attach Trigger
DROP TRIGGER IF EXISTS on_invoice_finalization ON public.invoices;
CREATE TRIGGER on_invoice_finalization
    BEFORE UPDATE ON public.invoices
    FOR EACH ROW
    EXECUTE FUNCTION handle_invoice_finalization();
