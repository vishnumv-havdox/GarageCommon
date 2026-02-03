-- Migration: Fix insert_work_order_service_employee RPC
-- Description: Remove ON CONFLICT clause that requires a unique constraint

CREATE OR REPLACE FUNCTION public.insert_work_order_service_employee(
    p_service_id uuid,
    p_employee_id uuid,
    p_status text DEFAULT 'Assigned',
    p_queue_position integer DEFAULT 0
)
RETURNS void AS $$
BEGIN
    -- Use SECURITY DEFINER to bypass RLS
    -- Simply insert without ON CONFLICT since we don't have a unique constraint
    INSERT INTO public.work_order_service_employees 
        (service_id, employee_id, status, assigned_at, queue_position)
    VALUES 
        (p_service_id, p_employee_id, p_status, now(), p_queue_position);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.insert_work_order_service_employee(uuid, uuid, text, integer) TO authenticated;

-- Refresh schema
NOTIFY pgrst, 'reload schema';
