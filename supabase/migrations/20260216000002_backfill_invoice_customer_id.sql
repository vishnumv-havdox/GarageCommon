-- Backfill customer_id on invoices where it is missing
-- This ensures that invoices created before the customer_id column was populated are visible in the portal

UPDATE invoices
SET customer_id = v.customer_id
FROM work_orders wo
JOIN vehicles v ON wo.vehicle_id = v.id
WHERE invoices.work_order_id = wo.id
  AND invoices.customer_id IS NULL;
