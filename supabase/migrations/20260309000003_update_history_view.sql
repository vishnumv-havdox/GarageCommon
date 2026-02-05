-- Migration: Update Lifecycle History View to Split Action and Approval
-- Date: 2026-03-09
-- Description: Adds approved_by_name to separate from performed_by_name (action by)

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
    
    -- Approved By (Specifically for Returns or Approvals)
    app_emp.name as approved_by_name,
    
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

-- Join Approver (For Returns, it's explicitly tracked. For others, it might be null or same as actioner depending on workflow)
LEFT JOIN public.employees app_emp ON app_emp.id = ir.approved_by

-- Join Work Order context
LEFT JOIN public.work_orders wo ON wo.id = COALESCE(pr.work_order_id, ir.work_order_id)
LEFT JOIN public.vehicles v ON v.id = wo.vehicle_id
LEFT JOIN public.customers c ON c.id = v.customer_id;

-- Refresh schema
NOTIFY pgrst, 'reload schema';
