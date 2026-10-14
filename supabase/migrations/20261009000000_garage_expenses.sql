-- Migration: 20261009000000_garage_expenses.sql
-- Description: Create garage_expenses table with staff spending, reimbursements, and receipt attachments

CREATE TABLE IF NOT EXISTS public.garage_expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
    spent_by_type TEXT NOT NULL DEFAULT 'garage', -- 'garage', 'employee', 'custom'
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

-- Indexes for lightning fast analytics aggregation
CREATE INDEX IF NOT EXISTS idx_garage_expenses_date ON public.garage_expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_garage_expenses_category ON public.garage_expenses(category);
CREATE INDEX IF NOT EXISTS idx_garage_expenses_payment_mode ON public.garage_expenses(payment_mode);
CREATE INDEX IF NOT EXISTS idx_garage_expenses_work_order ON public.garage_expenses(work_order_id);
CREATE INDEX IF NOT EXISTS idx_garage_expenses_employee ON public.garage_expenses(employee_id);
CREATE INDEX IF NOT EXISTS idx_garage_expenses_reimbursed ON public.garage_expenses(is_reimbursed);

-- Sequence or auto-number trigger for EXP-YYYY-XXXX
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

-- Enable RLS
ALTER TABLE public.garage_expenses ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view and manage expenses
CREATE POLICY "Allow authenticated users to read garage expenses"
    ON public.garage_expenses FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Allow authenticated users to insert garage expenses"
    ON public.garage_expenses FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update garage expenses"
    ON public.garage_expenses FOR UPDATE
    TO authenticated
    USING (true);

CREATE POLICY "Allow authenticated users to delete garage expenses"
    ON public.garage_expenses FOR DELETE
    TO authenticated
    USING (true);

-- Allow public read/write if anon key is used in development
CREATE POLICY "Allow anon access for development"
    ON public.garage_expenses FOR ALL
    TO anon
    USING (true);
