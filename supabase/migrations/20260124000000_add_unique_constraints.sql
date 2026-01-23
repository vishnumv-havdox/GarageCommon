-- Add unique constraints for upsert operations
-- This enables ON CONFLICT handling in user creation

-- Drop existing unique constraints if they exist (to recreate with proper names)
DROP INDEX IF EXISTS idx_user_roles_user_id;
DROP INDEX IF EXISTS idx_employees_user_id;
DROP INDEX IF EXISTS idx_customers_user_id;

-- Add unique constraint on user_roles.user_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles (user_id);

-- Add unique constraint on employees.user_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_user_id ON public.employees (user_id);

-- Add unique constraint on customers.user_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_user_id ON public.customers (user_id);

-- Also ensure profiles.id has unique constraint (should already exist as primary key)

