-- Fix Delivery stage status for reopened work orders
-- Ensures that if a work order is NOT completed/delivered/cancelled, the 'Delivery' stage (and subsequent stages) are NOT marked as completed

UPDATE public.work_order_stages
SET status = 'pending', completed_at = null
WHERE stage IN ('Delivery', 'Quality Check', 'Review')
  AND work_order_id IN (
    SELECT id FROM public.work_orders 
    WHERE is_reopened = true 
      AND status NOT IN ('Completed', 'Delivered', 'Cancelled', 'Rejected')
  );
