-- Migration: 20260126140000_link_employees_by_email.sql
-- Description: Automatically link employees and customers to auth.users based on email address.
-- This fixes the issue where users are created but their domain records (employees/customers) don't have the user_id set.

DO $$
DECLARE
    r RECORD;
BEGIN
    -- 1. Link Employees
    FOR r IN SELECT id, email FROM auth.users LOOP
        -- Update employee if email matches and user_id is null
        UPDATE public.employees
        SET user_id = r.id
        WHERE email = r.email AND user_id IS NULL;
        
        -- Update customer if email matches and user_id is null
        UPDATE public.customers
        SET user_id = r.id
        WHERE email = r.email AND user_id IS NULL;
    END LOOP;
END $$;
