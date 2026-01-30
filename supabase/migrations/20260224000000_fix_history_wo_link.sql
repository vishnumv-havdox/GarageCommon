-- Migration: Fix Work Order linkage in Lifecycle History
-- Date: 2026-02-24
-- Description: Updates the inventory_lifecycle_history view to show Work Orders for 'adjustment' types (rejections/releases)

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
-- Allow adjustments (like release/reject) to link back to the work order via part_requests
LEFT JOIN public.part_requests pr ON pr.id = it.reference_id AND it.type IN ('reservation', 'issue', 'adjustment')
LEFT JOIN public.inventory_returns ir ON ir.id = it.reference_id AND it.type = 'return'
LEFT JOIN public.work_orders wo ON wo.id = COALESCE(pr.work_order_id, ir.work_order_id)
LEFT JOIN public.vehicles v ON v.id = wo.vehicle_id
LEFT JOIN public.customers c ON c.id = v.customer_id;

-- Refresh schema
NOTIFY pgrst, 'reload schema';
