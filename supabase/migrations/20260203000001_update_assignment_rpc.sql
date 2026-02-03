-- Migration: 20260203000001_update_assignment_rpc
-- Description: Update insert_work_order_service_employee to support queue_position

-- Create function to insert work_order_service_employees with queue_position support
CREATE OR REPLACE FUNCTION public.insert_work_order_service_employee(
    p_service_id uuid,
    p_employee_id uuid,
    p_status text DEFAULT 'Assigned',
    p_queue_position integer DEFAULT 0
)
RETURNS void AS $$
BEGIN
    -- Use SECURITY DEFINER to bypass RLS
    INSERT INTO public.work_order_service_employees 
        (service_id, employee_id, status, assigned_at, queue_position)
    VALUES 
        (p_service_id, p_employee_id, p_status, now(), p_queue_position)
    ON CONFLICT (service_id, employee_id) 
    DO UPDATE SET 
        status = EXCLUDED.status,
        queue_position = EXCLUDED.queue_position,
        updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Refresh schema
NOTIFY pgrst, 'reload schema';
