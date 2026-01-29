-- Migration: Inventory Management Enhancements
-- Date: 2026-02-20
-- Description: Enhances inventory table and adds part requests system

-- 1. Enhance inventory table
ALTER TABLE public.inventory 
ADD COLUMN IF NOT EXISTS sku TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS available_qty INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS reserved_qty INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS qr_code TEXT;

-- Initial sync: Set available_qty to existing quantity
UPDATE public.inventory 
SET available_qty = quantity 
WHERE available_qty = 0 AND quantity > 0;

-- 2. Create part_requests table
CREATE TABLE IF NOT EXISTS public.part_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    work_order_id UUID NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES public.inventory(id) ON DELETE CASCADE,
    requested_by UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    requested_qty INTEGER NOT NULL DEFAULT 1,
    approved_qty INTEGER DEFAULT 0,
    issued_qty INTEGER DEFAULT 0,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'issued', 'rejected')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Inventory Transactions (Audit Log)
CREATE TABLE IF NOT EXISTS public.inventory_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID NOT NULL REFERENCES public.inventory(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('restock', 'issue', 'adjustment', 'reservation')),
    quantity INTEGER NOT NULL,
    reference_id UUID, -- Could be part_request_id or work_order_id
    performed_by UUID REFERENCES public.employees(id),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. RLS Policies

ALTER TABLE public.part_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_transactions ENABLE ROW LEVEL SECURITY;

-- Part Requests Policies
DROP POLICY IF EXISTS "Employees can view their own requests" ON public.part_requests;
CREATE POLICY "Employees can view their own requests"
    ON public.part_requests FOR SELECT
    USING (requested_by IN (SELECT id FROM public.employees WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Staff+ can view all requests" ON public.part_requests;
CREATE POLICY "Staff+ can view all requests"
    ON public.part_requests FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'manager', 'staff')));

DROP POLICY IF EXISTS "Employees can create requests" ON public.part_requests;
CREATE POLICY "Employees can create requests"
    ON public.part_requests FOR INSERT
    WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'manager', 'staff')));

DROP POLICY IF EXISTS "Admins can manage requests" ON public.part_requests;
CREATE POLICY "Admins can manage requests"
    ON public.part_requests FOR ALL
    USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'manager')));

-- Transactions Policies
DROP POLICY IF EXISTS "Staff+ can view transactions" ON public.inventory_transactions;
CREATE POLICY "Staff+ can view transactions"
    ON public.inventory_transactions FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'manager', 'staff')));

DROP POLICY IF EXISTS "Admins can create transactions" ON public.inventory_transactions;
CREATE POLICY "Admins can create transactions"
    ON public.inventory_transactions FOR INSERT
    WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'manager')));

-- 5. Functions & Triggers

-- Function to handle part approval and Qty reservation
CREATE OR REPLACE FUNCTION public.approve_part_request(
    _request_id UUID,
    _approved_qty INTEGER,
    _admin_id UUID
) RETURNS void AS $$
DECLARE
    v_item_id UUID;
    v_available INTEGER;
BEGIN
    SELECT item_id INTO v_item_id FROM public.part_requests WHERE id = _request_id;
    SELECT available_qty INTO v_available FROM public.inventory WHERE id = v_item_id;

    IF v_available < _approved_qty THEN
        RAISE EXCEPTION 'Insufficient stock available';
    END IF;

    -- Update request
    UPDATE public.part_requests 
    SET approved_qty = _approved_qty, 
        status = 'approved',
        updated_at = now()
    WHERE id = _request_id;

    -- Reserve stock
    UPDATE public.inventory 
    SET available_qty = available_qty - _approved_qty,
        reserved_qty = reserved_qty + _approved_qty,
        updated_at = now()
    WHERE id = v_item_id;

    -- Log transaction
    INSERT INTO public.inventory_transactions (item_id, type, quantity, reference_id, performed_by, notes)
    VALUES (v_item_id, 'reservation', _approved_qty, _request_id, _admin_id, 'Part request approved and reserved');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to handle part issuance (scanning)
CREATE OR REPLACE FUNCTION public.issue_part_request(
    _request_id UUID,
    _issued_qty INTEGER,
    _employee_id UUID
) RETURNS void AS $$
DECLARE
    v_item_id UUID;
    v_reserved INTEGER;
    v_wo_id UUID;
    v_unit_price NUMERIC;
    v_item_name TEXT;
BEGIN
    SELECT item_id, work_order_id INTO v_item_id, v_wo_id FROM public.part_requests WHERE id = _request_id;
    SELECT reserved_qty, unit_price, item_name INTO v_reserved, v_unit_price, v_item_name FROM public.inventory WHERE id = v_item_id;

    IF _issued_qty > v_reserved THEN
        RAISE EXCEPTION 'Cannot issue more than reserved quantity';
    END IF;

    -- Update request
    UPDATE public.part_requests 
    SET issued_qty = issued_qty + _issued_qty,
        status = 'issued',
        updated_at = now()
    WHERE id = _request_id;

    -- Deduct from physical stock (was already removed from available during reservation)
    UPDATE public.inventory 
    SET reserved_qty = reserved_qty - _issued_qty,
        quantity = quantity - _issued_qty,
        updated_at = now()
    WHERE id = v_item_id;

    -- Add to work_order_parts for invoicing
    INSERT INTO public.work_order_parts (work_order_id, inventory_id, part_name, quantity, unit_price, added_by)
    VALUES (v_wo_id, v_item_id, v_item_name, _issued_qty, v_unit_price, _employee_id);

    -- Log transaction
    INSERT INTO public.inventory_transactions (item_id, type, quantity, reference_id, performed_by, notes)
    VALUES (v_item_id, 'issue', _issued_qty, _request_id, _employee_id, 'Part scanned and issued to work order');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.approve_part_request(UUID, INTEGER, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.issue_part_request(UUID, INTEGER, UUID) TO authenticated;

-- Refresh schema
NOTIFY pgrst, 'reload schema';
