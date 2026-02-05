-- Migration: Add approved_by to part_requests and update history view
-- Date: 2026-03-09
-- Description: Adds approved_by column to part_requests, updates approval RPC, and updates history view.

-- 1. Add approved_by column to part_requests
ALTER TABLE public.part_requests 
ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES public.employees(id);

-- 2. Backfill approved_by from inventory_transactions (reservation = approval event)
UPDATE public.part_requests pr
SET approved_by = it.performed_by
FROM public.inventory_transactions it
WHERE it.reference_id = pr.id 
  AND it.type = 'reservation' 
  AND pr.approved_by IS NULL;

-- 3. Update approve_part_request function to save approved_by
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

    -- Update request with approver
    UPDATE public.part_requests 
    SET approved_qty = _approved_qty, 
        status = 'approved',
        approved_by = _admin_id, -- Save the approver
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

-- 4. Update Inventory Lifecycle History View
DROP VIEW IF EXISTS public.inventory_lifecycle_history;

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
    
    -- Action By (The person who physically performed the transaction/logged it)
    e.name as performed_by_name,
    
    -- Requested By (The mechanic/employee who asked for it)
    req_emp.name as requested_by_name,
    
    -- Approved By (Combiner: Returns Approver OR Part Request Approver)
    COALESCE(app_emp.name, issue_app_emp.name) as approved_by_name,
    
    wo.id as work_order_id,
    v.vehicle_number,
    c.name as customer_name,
    c.company_name,
    pr.status as request_status,
    ir.status as return_status,
    ir.condition as return_condition
FROM public.inventory_transactions it
JOIN public.inventory i ON i.id = it.item_id
LEFT JOIN public.employees e ON e.id = it.performed_by

-- Allow adjustments to link back via part_requests or returns
LEFT JOIN public.part_requests pr ON pr.id = it.reference_id AND it.type IN ('reservation', 'issue', 'adjustment')
LEFT JOIN public.inventory_returns ir ON ir.id = it.reference_id AND it.type = 'return'

-- Join requester (Mechanic)
LEFT JOIN public.employees req_emp ON req_emp.id = COALESCE(pr.requested_by, ir.requested_by)

-- Join Approver for Returns
LEFT JOIN public.employees app_emp ON app_emp.id = ir.approved_by

-- Join Approver for Requests
LEFT JOIN public.employees issue_app_emp ON issue_app_emp.id = pr.approved_by

-- Join Work Order context
LEFT JOIN public.work_orders wo ON wo.id = COALESCE(pr.work_order_id, ir.work_order_id)
LEFT JOIN public.vehicles v ON v.id = wo.vehicle_id
LEFT JOIN public.customers c ON c.id = v.customer_id;

-- Refresh schema
NOTIFY pgrst, 'reload schema';
