-- Migration: 20260303000001_pricing_and_applicability
-- Description: Creates service_vehicle_applicability and pricing_rules tables

-- 1. Service Vehicle Applicability Mapping
CREATE TABLE public.service_vehicle_applicability (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_type_id UUID NOT NULL REFERENCES public.service_types(id) ON DELETE CASCADE,
    vehicle_category_id UUID REFERENCES public.vehicle_categories(id) ON DELETE CASCADE,
    vehicle_type_id UUID REFERENCES public.vehicle_types(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    -- Ensure priority logic: specific type mapping or category mapping
    UNIQUE(service_type_id, vehicle_category_id, vehicle_type_id)
);

-- 2. Pricing Rules Table
CREATE TABLE public.pricing_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    service_type_id UUID NOT NULL REFERENCES public.service_types(id) ON DELETE CASCADE,
    vehicle_category_id UUID REFERENCES public.vehicle_categories(id) ON DELETE CASCADE,
    vehicle_type_id UUID REFERENCES public.vehicle_types(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
    modifier_type TEXT NOT NULL CHECK (modifier_type IN ('fixed', 'percentage', 'override')),
    modifier_value NUMERIC(10,2) NOT NULL,
    priority INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Update work_order_services with pricing snapshot columns
ALTER TABLE public.work_order_services 
    ADD COLUMN calculated_price NUMERIC(10,2),
    ADD COLUMN base_price_snapshot NUMERIC(10,2), -- Snapshot of master base_price at time of creation
    ADD COLUMN billing_price NUMERIC(10,2),      -- Final price after overrides
    ADD COLUMN override_reason TEXT,
    ADD COLUMN price_approved_by UUID REFERENCES public.profiles(id),
    ADD COLUMN price_approved_at TIMESTAMPTZ;

-- 4. Enable RLS
ALTER TABLE public.service_vehicle_applicability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_rules ENABLE ROW LEVEL SECURITY;

-- 5. Create basic policies
CREATE POLICY "Allow view applicability" ON public.service_vehicle_applicability FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow view pricing rules" ON public.pricing_rules FOR SELECT TO authenticated USING (true);

-- Admin manage policies
CREATE POLICY "Allow admin manage applicability" ON public.service_vehicle_applicability FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Allow admin manage pricing rules" ON public.pricing_rules FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- Notify schema reload
NOTIFY pgrst, 'reload schema';
