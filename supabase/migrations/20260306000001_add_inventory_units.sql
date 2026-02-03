-- Migration: Unit-Level QR Tracking
-- Description: Adds inventory_units table for tracking individual items

CREATE TABLE IF NOT EXISTS public.inventory_units (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inventory_id UUID NOT NULL REFERENCES public.inventory(id) ON DELETE CASCADE,
    qr_code TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'withdrawn', 'lost', 'issued')),
    batch_number TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for faster QR lookups
CREATE INDEX IF NOT EXISTS idx_inventory_units_qr ON public.inventory_units(qr_code);
CREATE INDEX IF NOT EXISTS idx_inventory_units_inv_id ON public.inventory_units(inventory_id);

-- RLS Policies
ALTER TABLE public.inventory_units ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff+ can view units" ON public.inventory_units;
CREATE POLICY "Staff+ can view units"
    ON public.inventory_units FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'manager', 'staff')));

DROP POLICY IF EXISTS "Admins can manage units" ON public.inventory_units;
CREATE POLICY "Admins can manage units"
    ON public.inventory_units FOR ALL
    USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'manager')));

-- Function to Generate Units for new Inventory
CREATE OR REPLACE FUNCTION public.generate_inventory_units(
    _inventory_id UUID,
    _quantity INTEGER,
    _sku TEXT
) RETURNS void AS $$
DECLARE
    i INTEGER;
    v_qr TEXT;
BEGIN
    FOR i IN 1.._quantity LOOP
        -- Generate strict unique QR: SKU-TIMESTAMP-RANDOM
        -- Example: OIL-5W40-17385678-AF3
        v_qr := _sku || '-' || floor(extract(epoch from now())) || '-' || substring(md5(random()::text) from 1 for 4);
        
        INSERT INTO public.inventory_units (inventory_id, qr_code, status)
        VALUES (_inventory_id, v_qr, 'available');
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
