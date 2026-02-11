-- Fix current_stage for reopened work orders
-- Sets current_stage to 'Repair' if the work order is reopened and still marked as 'Delivery' or 'Completed' in the current_stage column (while status is active)

UPDATE public.work_orders
SET current_stage = 'Repair'
WHERE is_reopened = true 
  AND current_stage IN ('Delivery')
  AND status NOT IN ('Completed', 'Delivered', 'Cancelled', 'Rejected');
