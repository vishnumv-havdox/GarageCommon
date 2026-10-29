-- Migration: 20261028000001_make_payment_proof_url_optional.sql
-- Fixes:
-- 1. Error 23502: "null value in column \"proof_url\" of relation \"payments\" violates not-null constraint"
--    Makes proof_url optional for offline counter payments, cash, and bank settlements.
-- 2. Error 22P02: "invalid input syntax for type uuid: \"init-exp-4\""
--    Ensures garage_expenses table exists and supports TEXT id so mock/prefixed/seeded IDs ('init-exp-4') 
--    and custom identifiers don't fail PostgreSQL UUID type validation.

-- ==============================================================================
-- 1. PAYMENTS TABLE FIXES (proof_url NOT NULL + payment_method check constraint)
-- ==============================================================================
DO $$
BEGIN
    -- Drop NOT NULL constraint on proof_url if present
    ALTER TABLE public.payments ALTER COLUMN proof_url DROP NOT NULL;

    -- Update payment_method check constraint to support all common payment modes
    ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_payment_method_check;
    ALTER TABLE public.payments ADD CONSTRAINT payments_payment_method_check 
        CHECK (payment_method IN ('UPI', 'Bank Transfer', 'Cash', 'Cheque', 'Card'));
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Payments constraint update note: %', SQLERRM;
END $$;

-- ==============================================================================
-- 2. GARAGE EXPENSES FIXES (invalid input syntax for type uuid: "init-exp-4")
-- ==============================================================================

-- Create garage_expenses table if it does not exist yet (with TEXT id to accept both UUIDs and string IDs)
CREATE TABLE IF NOT EXISTS public.garage_expenses (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    expense_number TEXT,
    category TEXT NOT NULL DEFAULT 'miscellaneous',
    title TEXT NOT NULL,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
    payment_mode TEXT NOT NULL DEFAULT 'cash',
    vendor_name TEXT,
    expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
    receipt_url TEXT,
    receipt_name TEXT,
    receipt_type TEXT,
    work_order_id UUID REFERENCES public.work_orders(id) ON DELETE SET NULL,
    
    -- Staff / Employee spending details
    spent_by_type TEXT NOT NULL DEFAULT 'garage',
    employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
    employee_name TEXT,
    employee_phone TEXT,
    is_reimbursed BOOLEAN NOT NULL DEFAULT true,
    reimbursed_at TIMESTAMPTZ,

    notes TEXT,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- If garage_expenses table was previously created with id of type UUID, alter column id to TEXT
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'garage_expenses' 
          AND column_name = 'id' 
          AND data_type = 'uuid'
    ) THEN
        ALTER TABLE public.garage_expenses ALTER COLUMN id TYPE TEXT USING id::text;
        ALTER TABLE public.garage_expenses ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Garage expenses id alter note: %', SQLERRM;
END $$;

-- Sequence and auto-number trigger for EXP-YYYY-XXXX (if not already present)
CREATE SEQUENCE IF NOT EXISTS garage_expense_seq START 1;

CREATE OR REPLACE FUNCTION set_garage_expense_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.expense_number IS NULL OR NEW.expense_number = '' THEN
        NEW.expense_number := 'EXP-' || to_char(CURRENT_DATE, 'YYYY') || '-' || lpad(nextval('garage_expense_seq')::text, 4, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_garage_expense_number ON public.garage_expenses;
CREATE TRIGGER trigger_set_garage_expense_number
BEFORE INSERT ON public.garage_expenses
FOR EACH ROW
EXECUTE FUNCTION set_garage_expense_number();

-- Enable RLS & Policies
ALTER TABLE public.garage_expenses ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'garage_expenses' AND policyname = 'Enable all operations for authenticated users'
    ) THEN
        CREATE POLICY "Enable all operations for authenticated users" 
            ON public.garage_expenses FOR ALL 
            TO authenticated 
            USING (true) 
            WITH CHECK (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'garage_expenses' AND policyname = 'Enable read for anon'
    ) THEN
        CREATE POLICY "Enable read for anon" 
            ON public.garage_expenses FOR SELECT 
            TO anon 
            USING (true);
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        NULL;
END $$;
