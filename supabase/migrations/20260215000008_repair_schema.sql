-- =============================================================================
-- Migration: Repair Schema
-- Description: Safely adds missing columns and tables for service tracking and FC
--              using IF NOT EXISTS checks to handle partial migration states.
-- =============================================================================

DO $$
BEGIN
    -- 1. REPAIR VEHICLES TABLE
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vehicles' AND column_name = 'kilometers_driven') THEN
        ALTER TABLE public.vehicles ADD COLUMN kilometers_driven integer DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vehicles' AND column_name = 'next_service_km') THEN
        ALTER TABLE public.vehicles ADD COLUMN next_service_km integer;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vehicles' AND column_name = 'next_service_date') THEN
        ALTER TABLE public.vehicles ADD COLUMN next_service_date date;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vehicles' AND column_name = 'fc_number') THEN
        ALTER TABLE public.vehicles ADD COLUMN fc_number text;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vehicles' AND column_name = 'fc_expiry_date') THEN
        ALTER TABLE public.vehicles ADD COLUMN fc_expiry_date date;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vehicles' AND column_name = 'last_fc_date') THEN
        ALTER TABLE public.vehicles ADD COLUMN last_fc_date date;
    END IF;

    -- 2. REPAIR WORK_ORDERS TABLE
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'odometer_reading') THEN
        ALTER TABLE public.work_orders ADD COLUMN odometer_reading integer;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'next_service_due_km') THEN
        ALTER TABLE public.work_orders ADD COLUMN next_service_due_km integer;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'next_service_due_date') THEN
        ALTER TABLE public.work_orders ADD COLUMN next_service_due_date date;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'is_fc_renewal') THEN
        ALTER TABLE public.work_orders ADD COLUMN is_fc_renewal boolean DEFAULT false;
    END IF;

END $$;

-- 3. REPAIR TABLES
CREATE TABLE IF NOT EXISTS public.vehicle_fc_history (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
    fc_number text,
    issue_date date,
    expiry_date date,
    notes text,
    created_at timestamptz DEFAULT now(),
    created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

-- 4. ENABLE RLS
ALTER TABLE public.vehicle_fc_history ENABLE ROW LEVEL SECURITY;

-- 5. REPAIR POLICIES
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'vehicle_fc_history' AND policyname = 'Staff+ can view fc history') THEN
        CREATE POLICY "Staff+ can view fc history" ON public.vehicle_fc_history
            FOR SELECT USING (
                EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'manager', 'staff'))
            );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'vehicle_fc_history' AND policyname = 'Staff+ can manage fc history') THEN
        CREATE POLICY "Staff+ can manage fc history" ON public.vehicle_fc_history
            FOR ALL USING (
                EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'manager', 'staff'))
            );
    END IF;
END $$;

-- 6. REPAIR FUNCTION AND TRIGGER
CREATE OR REPLACE FUNCTION public.sync_work_order_to_vehicle()
RETURNS TRIGGER AS $$
BEGIN
    -- Only run if status changed to 'Completed' or 'Delivered'
    IF (NEW.status IN ('Completed', 'Delivered')) AND (OLD.status NOT IN ('Completed', 'Delivered')) THEN
        
        -- Update Vehicle Odometer if meaningful value provided
        IF NEW.odometer_reading IS NOT NULL AND NEW.odometer_reading > 0 THEN
             UPDATE public.vehicles 
             SET kilometers_driven = NEW.odometer_reading
             WHERE id = NEW.vehicle_id;
        END IF;

        -- Update Next Service Due info
        IF NEW.next_service_due_km IS NOT NULL OR NEW.next_service_due_date IS NOT NULL THEN
             UPDATE public.vehicles 
             SET next_service_km = COALESCE(NEW.next_service_due_km, next_service_km),
                 next_service_date = COALESCE(NEW.next_service_due_date, next_service_date)
             WHERE id = NEW.vehicle_id;
        END IF;

    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger definition is idempotent (DROP IF EXISTS)
DROP TRIGGER IF EXISTS trigger_sync_work_order_to_vehicle ON public.work_orders;
CREATE TRIGGER trigger_sync_work_order_to_vehicle
    AFTER UPDATE ON public.work_orders
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_work_order_to_vehicle();

-- Force schema reload
NOTIFY pgrst, 'reload schema';
