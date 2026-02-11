-- Fix inconsistent state for already reopened work orders
-- Users who reopened work orders before the code fix will still have customer_notified = true
-- This migration resets that flag for any currently open (not completed) reopened work orders

UPDATE public.work_orders
SET customer_notified = false
WHERE is_reopened = true 
  AND customer_notified = true
  AND status NOT IN ('Completed', 'Delivered', 'Cancelled', 'Rejected');
