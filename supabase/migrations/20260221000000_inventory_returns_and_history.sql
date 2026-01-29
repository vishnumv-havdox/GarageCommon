-- Migration: Inventory Returns and Lifecycle History
-- Date: 2026-01-30
-- Description: Adds return tracking and consolidated history for inventory items

-- 1. Create inventory_returns table
CREATE TABLE IF NOT EXISTS public.inventory_returns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    work_order_id UUID NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
    inventory_id UUID NOT NULL REFERENCES public.inventory(id) ON DELETE CASCADE,
    requested_by UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 1,
    reason TEXT,
    condition TEXT CHECK (condition IN ('unused', 'opened', 'damaged')),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    approved_by UUID REFERENCES public.employees(id),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Update inventory_transactions type check
ALTER TABLE public.inventory_transactions DROP CONSTRAINT IF EXISTS inventory_transactions_type_check;
ALTER TABLE public.inventory_transactions ADD CONSTRAINT inventory_transactions_type_check 
    CHECK (type IN ('restock', 'issue', 'adjustment', 'reservation', 'return'));

-- 3. Create consolidated view for Lifecycle History
CREATE OR REPLACE VIEW public.inventory_lifecycle_history AS
SELECT 
    it.id as transaction_id,
    i.id as item_id,
    i.item_name,
    i.sku,
    i.qr_code,
    it.type as transaction_type,
    it.quantity,
    it.created_at as transaction_date,
    it.notes as transaction_notes,
    e.name as performed_by_name,
    wo.id as work_order_id,
    v.vehicle_number,
    c.name as customer_name,
    pr.status as request_status,
    ir.status as return_status,
    ir.condition as return_condition
FROM public.inventory_transactions it
JOIN public.inventory i ON i.id = it.item_id
LEFT JOIN public.employees e ON e.id = it.performed_by
LEFT JOIN public.part_requests pr ON pr.id = it.reference_id AND it.type IN ('reservation', 'issue')
LEFT JOIN public.inventory_returns ir ON ir.id = it.reference_id AND it.type = 'return'
LEFT JOIN public.work_orders wo ON wo.id = COALESCE(pr.work_order_id, ir.work_order_id)
LEFT JOIN public.vehicles v ON v.id = wo.vehicle_id
LEFT JOIN public.customers c ON c.id = v.customer_id;

-- 4. RLS for returns
ALTER TABLE public.inventory_returns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employees can view their own return requests"
    ON public.inventory_returns FOR SELECT
    USING (requested_by IN (SELECT id FROM public.employees WHERE user_id = auth.uid()));

CREATE POLICY "Staff+ can view all return requests"
    ON public.inventory_returns FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'manager', 'staff')));

CREATE POLICY "Employees can create return requests"
    ON public.inventory_returns FOR INSERT
    WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'manager', 'staff')));

CREATE POLICY "Admins can manage return requests"
    ON public.inventory_returns FOR ALL
    USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'manager')));

-- 5. Functions for return handling

-- Function to request a return
CREATE OR REPLACE FUNCTION public.request_part_return(
    _work_order_id UUID,
    _inventory_id UUID,
    _quantity INTEGER,
    _reason TEXT,
    _condition TEXT,
    _employee_id UUID
) RETURNS UUID AS $$
DECLARE
    v_return_id UUID;
BEGIN
    INSERT INTO public.inventory_returns (work_order_id, inventory_id, requested_by, quantity, reason, condition)
    VALUES (_work_order_id, _inventory_id, _employee_id, _quantity, _reason, _condition)
    RETURNING id INTO v_return_id;
    
    RETURN v_return_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to process return (Approve/Reject)
CREATE OR REPLACE FUNCTION public.process_part_return(
    _return_id UUID,
    _status TEXT,
    _admin_id UUID,
    _notes TEXT DEFAULT NULL
) RETURNS void AS $$
DECLARE
    v_item_id UUID;
    v_qty INTEGER;
    v_condition TEXT;
    v_wo_id UUID;
BEGIN
    IF _status NOT IN ('approved', 'rejected') THEN
        RAISE EXCEPTION 'Invalid status. Must be approved or rejected.';
    END IF;

    SELECT inventory_id, quantity, condition, work_order_id 
    INTO v_item_id, v_qty, v_condition, v_wo_id 
    FROM public.inventory_returns 
    WHERE id = _return_id;

    -- Update return request status
    UPDATE public.inventory_returns 
    SET status = _status,
        approved_by = _admin_id,
        notes = _notes,
        updated_at = now()
    WHERE id = _return_id;

    IF _status = 'approved' THEN
        -- 1. Restore inventory stock counts
        -- Total quantity is always restored since it's a physical return
        UPDATE public.inventory 
        SET quantity = quantity + v_qty,
            -- available_qty only increased if not damaged
            available_qty = CASE WHEN v_condition != 'damaged' THEN available_qty + v_qty ELSE available_qty END,
            updated_at = now()
        WHERE id = v_item_id;

        -- 2. Deduct from work_order_parts
        UPDATE public.work_order_parts 
        SET quantity = quantity - v_qty
        WHERE work_order_id = v_wo_id AND inventory_id = v_item_id;
        
        -- Delete if quantity hits 0
        DELETE FROM public.work_order_parts 
        WHERE work_order_id = v_wo_id AND inventory_id = v_item_id AND quantity <= 0;

        -- 3. Log transaction
        INSERT INTO public.inventory_transactions (item_id, type, quantity, reference_id, performed_by, notes)
        VALUES (v_item_id, 'return', v_qty, _return_id, _admin_id, 'Part return approved. Condition: ' || v_condition);

        -- 4. Update invoice_items if they exist and are in 'Draft' status
        -- We match by description and work_order_id
        UPDATE public.invoice_items ii
        SET quantity = ii.quantity - v_qty,
            taxable_value = (ii.quantity - v_qty) * ii.unit_price,
            cgst_amount = ((ii.quantity - v_qty) * ii.unit_price) * (COALESCE(ii.cgst_rate, 9.0) / 100),
            sgst_amount = ((ii.quantity - v_qty) * ii.unit_price) * (COALESCE(ii.sgst_rate, 9.0) / 100),
            total = (ii.quantity - v_qty) * ii.unit_price + 
                    (((ii.quantity - v_qty) * ii.unit_price) * (COALESCE(ii.cgst_rate, 9.0) / 100)) +
                    (((ii.quantity - v_qty) * ii.unit_price) * (COALESCE(ii.sgst_rate, 9.0) / 100))
        FROM public.invoices i
        WHERE ii.invoice_id = i.id 
          AND i.work_order_id = v_wo_id 
          AND i.status = 'Draft'
          AND ii.description = (SELECT item_name FROM public.inventory WHERE id = v_item_id)
          AND ii.type = 'part';

        -- Delete invoice items if quantity hits 0
        DELETE FROM public.invoice_items ii
        USING public.invoices i
        WHERE ii.invoice_id = i.id 
          AND i.work_order_id = v_wo_id 
          AND i.status = 'Draft'
          AND ii.quantity <= 0
          AND ii.description = (SELECT item_name FROM public.inventory WHERE id = v_item_id)
          AND ii.type = 'part';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Permissions
GRANT EXECUTE ON FUNCTION public.request_part_return(UUID, UUID, INTEGER, TEXT, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_part_return(UUID, TEXT, UUID, TEXT) TO authenticated;

-- Refresh schema
NOTIFY pgrst, 'reload schema';
