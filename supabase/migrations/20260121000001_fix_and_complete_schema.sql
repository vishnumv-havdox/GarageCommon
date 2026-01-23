-- =============================================================================
-- AMMA AUTO - FIXED COMPLETE DATABASE SCHEMA MIGRATION
-- Migration: 20260121000001_fix_and_complete_schema
-- Description: Fixes existing tables and creates missing ones
-- =============================================================================

-- Disable triggers during migration
SET session_replication_role = 'replica';

-- =============================================================================
-- 1. ACCESS LEVEL ENUM (Create if not exists)
-- =============================================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'access_level_enum') THEN
        CREATE TYPE access_level_enum AS ENUM ('admin', 'manager', 'staff');
    END IF;
END$$;

-- =============================================================================
-- 2. PROFILES TABLE (Create if not exists with all columns)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email text NOT NULL,
    full_name text NOT NULL,
    phone text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Add missing columns if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'profiles' AND column_name = 'updated_at') THEN
        ALTER TABLE public.profiles ADD COLUMN updated_at timestamptz DEFAULT now();
    END IF;
END$$;

-- =============================================================================
-- 3. POSITIONS TABLE - Update with full schema
-- =============================================================================
-- Add missing columns to positions table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'positions' AND column_name = 'department') THEN
        ALTER TABLE public.positions ADD COLUMN department text NOT NULL DEFAULT 'Service';
    END IF;
END$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'positions' AND column_name = 'access_level') THEN
        ALTER TABLE public.positions ADD COLUMN access_level access_level_enum NOT NULL DEFAULT 'staff';
    END IF;
END$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'positions' AND column_name = 'base_salary') THEN
        ALTER TABLE public.positions ADD COLUMN base_salary numeric(10,2);
    END IF;
END$$;

-- =============================================================================
-- 4. EMPLOYEES TABLE - Update with full schema
-- =============================================================================
-- Add missing columns to employees table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'employees' AND column_name = 'user_id') THEN
        ALTER TABLE public.employees ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
    END IF;
END$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'employees' AND column_name = 'email') THEN
        ALTER TABLE public.employees ADD COLUMN email text NOT NULL DEFAULT '';
    END IF;
END$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'employees' AND column_name = 'phone') THEN
        ALTER TABLE public.employees ADD COLUMN phone text;
    END IF;
END$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'employees' AND column_name = 'position_id') THEN
        ALTER TABLE public.employees ADD COLUMN position_id uuid REFERENCES public.positions(id) ON DELETE SET NULL;
    END IF;
END$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'employees' AND column_name = 'access_level') THEN
        ALTER TABLE public.employees ADD COLUMN access_level access_level_enum DEFAULT 'staff';
    END IF;
END$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'employees' AND column_name = 'salary') THEN
        ALTER TABLE public.employees ADD COLUMN salary numeric(10,2);
    END IF;
END$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'employees' AND column_name = 'status') THEN
        ALTER TABLE public.employees ADD COLUMN status text DEFAULT 'active';
    END IF;
END$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'employees' AND column_name = 'hire_date') THEN
        ALTER TABLE public.employees ADD COLUMN hire_date date;
    END IF;
END$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'employees' AND column_name = 'emergency_contact') THEN
        ALTER TABLE public.employees ADD COLUMN emergency_contact text;
    END IF;
END$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'employees' AND column_name = 'emergency_phone') THEN
        ALTER TABLE public.employees ADD COLUMN emergency_phone text;
    END IF;
END$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'employees' AND column_name = 'address') THEN
        ALTER TABLE public.employees ADD COLUMN address text;
    END IF;
END$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'employees' AND column_name = 'notes') THEN
        ALTER TABLE public.employees ADD COLUMN notes text;
    END IF;
END$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'employees' AND column_name = 'updated_at') THEN
        ALTER TABLE public.employees ADD COLUMN updated_at timestamptz DEFAULT now();
    END IF;
END$$;

-- Ensure employees has primary key
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'employees_pkey') THEN
        ALTER TABLE public.employees ADD CONSTRAINT employees_pkey PRIMARY KEY (id);
    END IF;
END$$;

-- Ensure employees_position_fk constraint exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'employees_position_fk') THEN
        ALTER TABLE public.employees ADD CONSTRAINT employees_position_fk 
            FOREIGN KEY (position_id) REFERENCES public.positions(id) ON DELETE SET NULL;
    END IF;
END$$;

-- =============================================================================
-- 5. CUSTOMERS TABLE - Update with full schema
-- =============================================================================
-- Add missing columns to customers table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'customers' AND column_name = 'user_id') THEN
        ALTER TABLE public.customers ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
    END IF;
END$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'customers' AND column_name = 'company_name') THEN
        ALTER TABLE public.customers ADD COLUMN company_name text;
    END IF;
END$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'customers' AND column_name = 'updated_at') THEN
        ALTER TABLE public.customers ADD COLUMN updated_at timestamptz DEFAULT now();
    END IF;
END$$;

-- Ensure customers has primary key
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'customers_pkey') THEN
        ALTER TABLE public.customers ADD CONSTRAINT customers_pkey PRIMARY KEY (id);
    END IF;
END$$;

-- =============================================================================
-- 6. VEHICLES TABLE - Update with full schema
-- =============================================================================
-- Add missing columns to vehicles table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'vehicles' AND column_name = 'vehicle_type') THEN
        ALTER TABLE public.vehicles ADD COLUMN vehicle_type text NOT NULL DEFAULT '';
    END IF;
END$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'vehicles' AND column_name = 'model') THEN
        ALTER TABLE public.vehicles ADD COLUMN model text;
    END IF;
END$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'vehicles' AND column_name = 'year') THEN
        ALTER TABLE public.vehicles ADD COLUMN year integer;
    END IF;
END$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'vehicles' AND column_name = 'status') THEN
        ALTER TABLE public.vehicles ADD COLUMN status text DEFAULT 'Inspection';
    END IF;
END$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'vehicles' AND column_name = 'notes') THEN
        ALTER TABLE public.vehicles ADD COLUMN notes text;
    END IF;
END$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'vehicles' AND column_name = 'entry_date') THEN
        ALTER TABLE public.vehicles ADD COLUMN entry_date timestamptz;
    END IF;
END$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'vehicles' AND column_name = 'updated_at') THEN
        ALTER TABLE public.vehicles ADD COLUMN updated_at timestamptz DEFAULT now();
    END IF;
END$$;

-- Ensure vehicles has primary key
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vehicles_pkey') THEN
        ALTER TABLE public.vehicles ADD CONSTRAINT vehicles_pkey PRIMARY KEY (id);
    END IF;
END$$;

-- Ensure vehicles_customer_id_fkey constraint exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vehicles_customer_id_fkey') THEN
        ALTER TABLE public.vehicles ADD CONSTRAINT vehicles_customer_id_fkey 
            FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;
    END IF;
END$$;

-- =============================================================================
-- 7. WORK ORDERS TABLE - Create or Update
-- =============================================================================
-- Create work_orders table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.work_orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    vehicle_id uuid NOT NULL,
    assigned_to uuid,
    service_type text NOT NULL,
    description text NOT NULL,
    status text DEFAULT 'Pending',
    priority text DEFAULT 'Medium',
    estimated_cost numeric(10,2),
    actual_cost numeric(10,2),
    started_at timestamptz,
    completed_at timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Add primary key constraint if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'work_orders_pkey') THEN
        ALTER TABLE public.work_orders ADD CONSTRAINT work_orders_pkey PRIMARY KEY (id);
    END IF;
END$$;

-- Add foreign key constraints if not exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'work_orders_vehicle_id_fkey') THEN
        ALTER TABLE public.work_orders ADD CONSTRAINT work_orders_vehicle_id_fkey 
            FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id) ON DELETE CASCADE;
    END IF;
END$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'work_orders_assigned_to_fkey') THEN
        ALTER TABLE public.work_orders ADD CONSTRAINT work_orders_assigned_to_fkey 
            FOREIGN KEY (assigned_to) REFERENCES public.employees(id) ON DELETE SET NULL;
    END IF;
END$$;

-- Add CHECK constraints for status and priority if not exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'work_orders_status_check') THEN
        ALTER TABLE public.work_orders ADD CONSTRAINT work_orders_status_check 
            CHECK (status IN ('Pending', 'In Progress', 'Completed', 'Cancelled'));
    END IF;
END$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'work_orders_priority_check') THEN
        ALTER TABLE public.work_orders ADD CONSTRAINT work_orders_priority_check 
            CHECK (priority IN ('Low', 'Medium', 'High', 'Urgent'));
    END IF;
END$$;

-- =============================================================================
-- 8. INVENTORY TABLE - Create or Update
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.inventory (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    item_name text NOT NULL,
    category text NOT NULL,
    quantity integer NOT NULL DEFAULT 0,
    unit_price numeric(10,2) NOT NULL,
    reorder_level integer DEFAULT 10,
    supplier text,
    location text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Add primary key constraint if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inventory_pkey') THEN
        ALTER TABLE public.inventory ADD CONSTRAINT inventory_pkey PRIMARY KEY (id);
    END IF;
END$$;

-- =============================================================================
-- 9. INVOICES TABLE - Create or Update
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.invoices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    invoice_number text NOT NULL UNIQUE,
    customer_id uuid NOT NULL,
    work_order_id uuid,
    subtotal numeric(10,2) NOT NULL,
    tax numeric(10,2) NOT NULL DEFAULT 0,
    total numeric(10,2) NOT NULL,
    status text DEFAULT 'Draft',
    due_date date,
    paid_at timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Add primary key constraint if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoices_pkey') THEN
        ALTER TABLE public.invoices ADD CONSTRAINT invoices_pkey PRIMARY KEY (id);
    END IF;
END$$;

-- Add foreign key constraints if not exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoices_customer_id_fkey') THEN
        ALTER TABLE public.invoices ADD CONSTRAINT invoices_customer_id_fkey 
            FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;
    END IF;
END$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoices_work_order_id_fkey') THEN
        ALTER TABLE public.invoices ADD CONSTRAINT invoices_work_order_id_fkey 
            FOREIGN KEY (work_order_id) REFERENCES public.work_orders(id) ON DELETE SET NULL;
    END IF;
END$$;

-- Add CHECK constraint for status if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoices_status_check') THEN
        ALTER TABLE public.invoices ADD CONSTRAINT invoices_status_check 
            CHECK (status IN ('Draft', 'Sent', 'Paid', 'Overdue', 'Cancelled'));
    END IF;
END$$;

-- =============================================================================
-- 10. EMPLOYEE_DETAILS VIEW - Create or Replace
-- =============================================================================
CREATE OR REPLACE VIEW public.employee_details AS
SELECT 
    e.id,
    e.name,
    e.email,
    e.phone,
    e.salary,
    e.status,
    e.hire_date,
    p.name AS position_name,
    p.department,
    p.access_level AS position_access_level,
    e.created_at
FROM public.employees e
LEFT JOIN public.positions p ON e.position_id = p.id;

-- =============================================================================
-- 11. FUNCTIONS
-- =============================================================================
CREATE OR REPLACE FUNCTION public.has_role(
    _user_id uuid,
    _role text
) RETURNS boolean AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = _user_id AND role = _role
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 12. TRIGGERS FOR AUTO-UPDATE TIMESTAMPS
-- =============================================================================
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_customers_updated_at ON public.customers;
CREATE TRIGGER update_customers_updated_at
    BEFORE UPDATE ON public.customers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_vehicles_updated_at ON public.vehicles;
CREATE TRIGGER update_vehicles_updated_at
    BEFORE UPDATE ON public.vehicles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_work_orders_updated_at ON public.work_orders;
CREATE TRIGGER update_work_orders_updated_at
    BEFORE UPDATE ON public.work_orders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_inventory_updated_at ON public.inventory;
CREATE TRIGGER update_inventory_updated_at
    BEFORE UPDATE ON public.inventory
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_invoices_updated_at ON public.invoices;
CREATE TRIGGER update_invoices_updated_at
    BEFORE UPDATE ON public.invoices
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_employees_updated_at ON public.employees;
CREATE TRIGGER update_employees_updated_at
    BEFORE UPDATE ON public.employees
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- 13. ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================================================
ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.work_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.invoices ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (PostgreSQL doesn't support CREATE POLICY IF NOT EXISTS)
DO $$
DECLARE
    pol_name text;
    pol_table text;
BEGIN
    -- Drop policies for profiles
    FOR pol_name IN SELECT polname FROM pg_policy WHERE polrelid = 'public.profiles'::regclass LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(pol_name) || ' ON public.profiles';
    END LOOP;
    
    -- Drop policies for user_roles
    FOR pol_name IN SELECT polname FROM pg_policy WHERE polrelid = 'public.user_roles'::regclass LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(pol_name) || ' ON public.user_roles';
    END LOOP;
    
    -- Drop policies for positions
    FOR pol_name IN SELECT polname FROM pg_policy WHERE polrelid = 'public.positions'::regclass LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(pol_name) || ' ON public.positions';
    END LOOP;
    
    -- Drop policies for employees
    FOR pol_name IN SELECT polname FROM pg_policy WHERE polrelid = 'public.employees'::regclass LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(pol_name) || ' ON public.employees';
    END LOOP;
    
    -- Drop policies for customers
    FOR pol_name IN SELECT polname FROM pg_policy WHERE polrelid = 'public.customers'::regclass LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(pol_name) || ' ON public.customers';
    END LOOP;
    
    -- Drop policies for vehicles
    FOR pol_name IN SELECT polname FROM pg_policy WHERE polrelid = 'public.vehicles'::regclass LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(pol_name) || ' ON public.vehicles';
    END LOOP;
    
    -- Drop policies for work_orders
    FOR pol_name IN SELECT polname FROM pg_policy WHERE polrelid = 'public.work_orders'::regclass LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(pol_name) || ' ON public.work_orders';
    END LOOP;
    
    -- Drop policies for inventory
    FOR pol_name IN SELECT polname FROM pg_policy WHERE polrelid = 'public.inventory'::regclass LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(pol_name) || ' ON public.inventory';
    END LOOP;
    
    -- Drop policies for invoices
    FOR pol_name IN SELECT polname FROM pg_policy WHERE polrelid = 'public.invoices'::regclass LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(pol_name) || ' ON public.invoices';
    END LOOP;
END $$;

-- Basic RLS policies for profiles
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles
    FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

-- Basic RLS policies for user_roles
CREATE POLICY "Admins can manage user roles" ON public.user_roles
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
    );

-- Basic RLS policies for positions
CREATE POLICY "Authenticated users can read positions" ON public.positions
    FOR SELECT USING (auth.role() IN ('authenticated', 'admin'));

CREATE POLICY "Admins can manage positions" ON public.positions
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
    );

-- Basic RLS policies for employees
CREATE POLICY "Staff+ can read employees" ON public.employees
    FOR SELECT USING (
        auth.role() = 'authenticated' OR
        EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'manager', 'staff'))
    );

CREATE POLICY "Admins can manage employees" ON public.employees
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
    );

-- Basic RLS policies for customers
CREATE POLICY "Staff+ can read customers" ON public.customers
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'manager', 'staff'))
    );

CREATE POLICY "Admins can manage customers" ON public.customers
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
    );

-- Basic RLS policies for vehicles
CREATE POLICY "Staff+ can read vehicles" ON public.vehicles
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'manager', 'staff'))
    );

CREATE POLICY "Admins can manage vehicles" ON public.vehicles
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
    );

-- Basic RLS policies for work_orders
CREATE POLICY "Staff+ can read work orders" ON public.work_orders
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'manager', 'staff'))
    );

CREATE POLICY "Staff+ can create work orders" ON public.work_orders
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'manager', 'staff'))
    );

CREATE POLICY "Assigned staff can update work orders" ON public.work_orders
    FOR UPDATE USING (
        assigned_to = auth.uid() OR
        EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'manager'))
    );

CREATE POLICY "Admins can manage all work orders" ON public.work_orders
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
    );

-- Basic RLS policies for inventory
CREATE POLICY "Staff+ can read inventory" ON public.inventory
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'manager', 'staff'))
    );

CREATE POLICY "Admins can manage inventory" ON public.inventory
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
    );

-- Basic RLS policies for invoices
CREATE POLICY "Staff+ can read invoices" ON public.invoices
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'manager', 'staff'))
    );

CREATE POLICY "Admins can manage invoices" ON public.invoices
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
    );

-- =============================================================================
-- 14. REENABLE TRIGGERS
-- =============================================================================
RESET session_replication_role;

-- =============================================================================
-- 15. REFRESH PostgREST SCHEMA
-- =============================================================================
NOTIFY pgrst, 'reload schema';

-- =============================================================================
-- END OF MIGRATION
-- =============================================================================

