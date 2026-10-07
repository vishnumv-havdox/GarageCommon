-- =============================================================================
-- Migration: 20261006000000_vehicle_service_tracking
-- Description: Complete Vehicle Service Tracking, Multiple Company Contacts,
--              Service Due Reminders, and Employee Document Management
-- =============================================================================

-- 1. Create customer_contacts table
CREATE TABLE IF NOT EXISTS public.customer_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    designation TEXT, -- e.g. Owner, Manager, Service Coordinator, Accounts
    phone TEXT NOT NULL,
    alternate_phone TEXT,
    email TEXT,
    notes TEXT,
    preferred_contact_method TEXT DEFAULT 'phone', -- 'phone', 'whatsapp', 'email'
    is_primary BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customer_contacts_customer_id ON public.customer_contacts(customer_id);

-- Enable RLS for customer_contacts
ALTER TABLE public.customer_contacts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'customer_contacts' AND policyname = 'Authenticated full access on customer_contacts') THEN
        CREATE POLICY "Authenticated full access on customer_contacts"
            ON public.customer_contacts FOR ALL
            TO authenticated
            USING (true)
            WITH CHECK (true);
    END IF;
END $$;


-- 2. Link primary_contact_id to vehicles
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'vehicles' AND column_name = 'primary_contact_id'
    ) THEN
        ALTER TABLE public.vehicles ADD COLUMN primary_contact_id UUID REFERENCES public.customer_contacts(id) ON DELETE SET NULL;
    END IF;
END $$;


-- 3. Link contact_id to work_orders
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'work_orders' AND column_name = 'contact_id'
    ) THEN
        ALTER TABLE public.work_orders ADD COLUMN contact_id UUID REFERENCES public.customer_contacts(id) ON DELETE SET NULL;
    END IF;
END $$;


-- 4. Enhance service_history table with tracking columns
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'service_history' AND column_name = 'odometer_reading'
    ) THEN
        ALTER TABLE public.service_history ADD COLUMN odometer_reading INTEGER;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'service_history' AND column_name = 'next_service_km'
    ) THEN
        ALTER TABLE public.service_history ADD COLUMN next_service_km INTEGER;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'service_history' AND column_name = 'next_service_date'
    ) THEN
        ALTER TABLE public.service_history ADD COLUMN next_service_date DATE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'service_history' AND column_name = 'contact_id'
    ) THEN
        ALTER TABLE public.service_history ADD COLUMN contact_id UUID REFERENCES public.customer_contacts(id) ON DELETE SET NULL;
    END IF;
END $$;


-- 5. Create service_reminders table (with "Informed / Okay" confirmation status)
CREATE TABLE IF NOT EXISTS public.service_reminders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
    work_order_id UUID REFERENCES public.work_orders(id) ON DELETE SET NULL,
    due_date DATE,
    due_km INTEGER,
    service_type TEXT,
    service_description TEXT,
    trigger_type TEXT DEFAULT 'date', -- 'date', 'kilometer', 'manual'
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'informed', 'scheduled', 'dismissed'
    informed_at TIMESTAMPTZ,
    informed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_service_reminders_vehicle ON public.service_reminders(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_service_reminders_status ON public.service_reminders(status);
CREATE INDEX IF NOT EXISTS idx_service_reminders_due_date ON public.service_reminders(due_date);

ALTER TABLE public.service_reminders ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'service_reminders' AND policyname = 'Authenticated full access on service_reminders') THEN
        CREATE POLICY "Authenticated full access on service_reminders"
            ON public.service_reminders FOR ALL
            TO authenticated
            USING (true)
            WITH CHECK (true);
    END IF;
END $$;


-- 6. Create employee_documents table
CREATE TABLE IF NOT EXISTS public.employee_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    document_type TEXT NOT NULL, -- 'Aadhaar', 'PAN', 'Driving Licence', 'Passport', 'Employee ID', 'Address Proof', 'Other'
    document_name TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_type TEXT,
    file_size INTEGER,
    upload_date TIMESTAMPTZ DEFAULT now(),
    expiry_date DATE,
    notes TEXT,
    status TEXT DEFAULT 'Active', -- 'Active', 'Expiring Soon', 'Expired', 'Archived'
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_employee_documents_employee_id ON public.employee_documents(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_documents_expiry_date ON public.employee_documents(expiry_date);

ALTER TABLE public.employee_documents ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'employee_documents' AND policyname = 'Authenticated full access on employee_documents') THEN
        CREATE POLICY "Authenticated full access on employee_documents"
            ON public.employee_documents FOR ALL
            TO authenticated
            USING (true)
            WITH CHECK (true);
    END IF;
END $$;


-- 7. Update service history trigger to sync vehicle odometer & next service
CREATE OR REPLACE FUNCTION auto_create_service_history_v2()
RETURNS TRIGGER AS $$
DECLARE 
    v_task_summary TEXT;
    v_service RECORD;
BEGIN
    -- Only create history record when work order is delivered/completed/approved
    IF NEW.status IN ('Delivered', 'Completed', 'Approved') 
       AND (OLD.status IS NULL OR OLD.status NOT IN ('Delivered', 'Completed', 'Approved')) THEN
        
        -- Sync next service targets to vehicle record
        IF NEW.vehicle_id IS NOT NULL THEN
            UPDATE public.vehicles
            SET 
                kilometers_driven = COALESCE(NEW.odometer_reading, kilometers_driven),
                next_service_km = COALESCE(NEW.next_service_due_km, next_service_km),
                next_service_date = COALESCE(NEW.next_service_due_date, next_service_date),
                updated_at = NOW()
            WHERE id = NEW.vehicle_id;
        END IF;

        -- Check if there are work_order_services
        IF EXISTS (SELECT 1 FROM work_order_services WHERE work_order_id = NEW.id) THEN
            FOR v_service IN SELECT * FROM work_order_services WHERE work_order_id = NEW.id LOOP
                SELECT string_agg(task_name, ', ') INTO v_task_summary
                FROM work_order_service_tasks WHERE service_id = v_service.id;
                
                INSERT INTO service_history (
                    vehicle_id, work_order_id, service_type, service_description,
                    work_summary, status, service_date, delivery_date, approved_by,
                    odometer_reading, next_service_km, next_service_date, contact_id
                ) VALUES (
                    NEW.vehicle_id, NEW.id, v_service.service_type,
                    v_service.service_type || ' service',
                    COALESCE(v_task_summary, v_service.service_type || ' completed'),
                    NEW.status,
                    COALESCE(v_service.started_at, NEW.created_at),
                    v_service.completed_at,
                    NEW.approved_by,
                    NEW.odometer_reading,
                    NEW.next_service_due_km,
                    NEW.next_service_due_date,
                    NEW.contact_id
                );
            END LOOP;
        ELSE
            -- Single service work order
            SELECT string_agg(task_name, ', ') INTO v_task_summary
            FROM repair_tasks WHERE work_order_id = NEW.id;
            
            INSERT INTO service_history (
                vehicle_id, work_order_id, service_type, service_description,
                work_summary, status, service_date, delivery_date, approved_by,
                odometer_reading, next_service_km, next_service_date, contact_id
            ) VALUES (
                NEW.vehicle_id, NEW.id, NEW.service_type, NEW.description,
                COALESCE(v_task_summary, NEW.description),
                NEW.status,
                COALESCE(NEW.started_at, NEW.created_at),
                NOW(),
                NEW.approved_by,
                NEW.odometer_reading,
                NEW.next_service_due_km,
                NEW.next_service_due_date,
                NEW.contact_id
            );
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
