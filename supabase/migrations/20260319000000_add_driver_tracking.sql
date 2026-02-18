-- =============================================================================
-- DRIVER TRACKING SYSTEM
-- Migration: 20260319000000_add_driver_tracking
-- Description: Adds driver tracking for work orders with company association
-- =============================================================================

-- =============================================================================
-- 1. CREATE DRIVERS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.drivers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    contact_number TEXT,
    driver_position TEXT, -- Driver, Fleet Supervisor, Transport Manager, etc. (renamed from 'position')
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    -- Prevent exact duplicates per company
    UNIQUE(company_id, name, contact_number)
);

-- =============================================================================
-- 2. ADD DRIVER_ID TO WORK_ORDERS
-- =============================================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'work_orders' AND column_name = 'driver_id'
    ) THEN
        ALTER TABLE public.work_orders 
        ADD COLUMN driver_id UUID REFERENCES public.drivers(id) ON DELETE SET NULL;
    END IF;
END$$;

-- =============================================================================
-- 3. CREATE INDEXES
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_drivers_company_id ON public.drivers(company_id);
CREATE INDEX IF NOT EXISTS idx_drivers_is_active ON public.drivers(is_active);
CREATE INDEX IF NOT EXISTS idx_drivers_name ON public.drivers(name);
CREATE INDEX IF NOT EXISTS idx_work_orders_driver_id ON public.work_orders(driver_id);

-- =============================================================================
-- 4. CREATE SUGGEST_DRIVERS RPC FUNCTION
-- =============================================================================
CREATE OR REPLACE FUNCTION public.suggest_drivers(
    company_id_param UUID,
    search_term TEXT DEFAULT ''
)
RETURNS TABLE (
    id UUID,
    name TEXT,
    contact_number TEXT,
    driver_position TEXT,
    work_order_count BIGINT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        d.id,
        d.name,
        d.contact_number,
        d.driver_position,
        COUNT(wo.id) as work_order_count
    FROM public.drivers d
    LEFT JOIN public.work_orders wo ON wo.driver_id = d.id
    WHERE d.company_id = company_id_param
        AND d.is_active = true
        AND (search_term = '' OR d.name ILIKE '%' || search_term || '%')
    GROUP BY d.id, d.name, d.contact_number, d.driver_position
    ORDER BY work_order_count DESC, d.name;
END;
$$;

-- =============================================================================
-- 5. CREATE TRIGGERS
-- =============================================================================
DROP TRIGGER IF EXISTS update_drivers_updated_at ON public.drivers;
CREATE TRIGGER update_drivers_updated_at
    BEFORE UPDATE ON public.drivers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- 6. RLS POLICIES
-- =============================================================================
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;

-- Staff+ can view all drivers
DROP POLICY IF EXISTS "Staff can view drivers" ON public.drivers;
CREATE POLICY "Staff can view drivers" ON public.drivers
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.user_roles 
            WHERE user_id = auth.uid() 
            AND role IN ('admin', 'manager', 'staff')
        )
    );

-- Admins can manage drivers
DROP POLICY IF EXISTS "Admins can manage drivers" ON public.drivers;
CREATE POLICY "Admins can manage drivers" ON public.drivers
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.user_roles 
            WHERE user_id = auth.uid() 
            AND role = 'admin'
        )
    );

-- Customers can view their own company drivers
DROP POLICY IF EXISTS "Customers can view own company drivers" ON public.drivers;
CREATE POLICY "Customers can view own company drivers" ON public.drivers
    FOR SELECT USING (
        company_id IN (
            SELECT id FROM public.customers 
            WHERE user_id = auth.uid()
        )
    );

-- =============================================================================
-- 7. GRANT PERMISSIONS
-- =============================================================================
GRANT SELECT ON public.drivers TO authenticated;
GRANT ALL ON public.drivers TO service_role;

-- =============================================================================
-- 8. REFRESH SCHEMA
-- =============================================================================
NOTIFY pgrst, 'reload schema';

-- =============================================================================
-- END OF MIGRATION
-- =============================================================================
