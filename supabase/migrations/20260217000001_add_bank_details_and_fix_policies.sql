-- Add bank_details to company_profiles
ALTER TABLE company_profiles 
ADD COLUMN IF NOT EXISTS bank_details JSONB DEFAULT '{}'::jsonb;

-- Ensure RLS is enabled on payments
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts/ensure correctness
DROP POLICY IF EXISTS "Admins can view all payments" ON payments;
DROP POLICY IF EXISTS "Customers can view their own payments" ON payments;
DROP POLICY IF EXISTS "Customers can insert their own payments" ON payments;
DROP POLICY IF EXISTS "Admins can update payments" ON payments;

-- Re-create Policies

-- 1. Admins/Staff can view all payments
CREATE POLICY "Admins can view all payments"
ON payments FOR SELECT
TO authenticated
USING (
  exists (
    select 1 from user_roles
    where user_roles.user_id = auth.uid()
    and user_roles.role in ('admin', 'manager', 'staff')
  )
);

-- 2. Customers can view their own payments
CREATE POLICY "Customers can view their own payments"
ON payments FOR SELECT
TO authenticated
USING (
  exists (
    select 1 from invoices
    join customers on customers.id = invoices.customer_id
    where invoices.id = payments.invoice_id
    and customers.user_id = auth.uid()
  )
);

-- 3. Customers can insert payments
CREATE POLICY "Customers can insert payments"
ON payments FOR INSERT
TO authenticated
WITH CHECK (
  exists (
    select 1 from invoices
    join customers on customers.id = invoices.customer_id
    where invoices.id = payments.invoice_id
    and customers.user_id = auth.uid()
  )
);

-- 4. Admins/Managers can update payments
CREATE POLICY "Admins can update payments"
ON payments FOR UPDATE
TO authenticated
USING (
  exists (
    select 1 from user_roles
    where user_roles.user_id = auth.uid()
    and user_roles.role in ('admin', 'manager')
  )
);
