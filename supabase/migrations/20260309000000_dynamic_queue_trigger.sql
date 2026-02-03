-- Migration: Dynamic Queue Reordering
-- Description: Trigger to automatically shift queue positions when a task is completed/removed

CREATE OR REPLACE FUNCTION public.handle_queue_reorder()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if we need to reorder
    -- Case 1: Assignment completed/cancelled/rejected
    -- Case 2: Assignment deleted
    
    IF (TG_OP = 'UPDATE' AND NEW.status IN ('Completed', 'Rejected', 'Cancelled', 'Delivered') AND OLD.status IN ('Assigned', 'Pending', 'In Progress')) 
       OR (TG_OP = 'DELETE' AND OLD.status IN ('Assigned', 'Pending', 'In Progress')) THEN
        
        -- Shift up all active items that were below this one
        UPDATE public.work_order_service_employees
        SET queue_position = queue_position - 1
        WHERE employee_id = OLD.employee_id
        AND status IN ('Assigned', 'Pending', 'In Progress')
        AND queue_position > OLD.queue_position;
        
    END IF;
    
    -- Maintain correct return value for triggers
    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists to avoid duplication errors on repeated runs
DROP TRIGGER IF EXISTS trigger_reorder_queue ON public.work_order_service_employees;

CREATE TRIGGER trigger_reorder_queue
AFTER UPDATE OR DELETE ON public.work_order_service_employees
FOR EACH ROW
EXECUTE FUNCTION public.handle_queue_reorder();

-- Notify schema reload
NOTIFY pgrst, 'reload schema';
