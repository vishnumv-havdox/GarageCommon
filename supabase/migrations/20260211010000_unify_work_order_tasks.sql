-- Migration: 20260211010000_unify_work_order_tasks
-- Description: Unify work_order_service_tasks into work_order_tasks

-- 1. Add missing columns to work_order_tasks
ALTER TABLE public.work_order_tasks ADD COLUMN IF NOT EXISTS service_id uuid REFERENCES public.work_order_services(id) ON DELETE CASCADE;
ALTER TABLE public.work_order_tasks ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.work_order_tasks ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE public.work_order_tasks ADD COLUMN IF NOT EXISTS is_predefined boolean DEFAULT false;
ALTER TABLE public.work_order_tasks ADD COLUMN IF NOT EXISTS sequence_order integer DEFAULT 0;

-- 2. Migrate data from work_order_service_tasks if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'work_order_service_tasks') THEN
        INSERT INTO public.work_order_tasks (
            id, 
            work_order_id, 
            service_id, 
            task_name, 
            task_type, 
            completed, 
            completed_at, 
            is_predefined, 
            sequence_order, 
            notes, 
            created_at, 
            updated_at
        )
        SELECT 
            t.id, 
            s.work_order_id, 
            t.service_id, 
            t.task_name, 
            'repair', 
            CASE WHEN t.status = 'Completed' THEN true ELSE false END, 
            t.completed_at, 
            t.is_predefined, 
            t.sequence_order, 
            t.notes, 
            t.created_at, 
            t.updated_at
        FROM public.work_order_service_tasks t
        JOIN public.work_order_services s ON s.id = t.service_id;
        
        DROP TABLE public.work_order_service_tasks CASCADE;
    END IF;
END $$;

-- 3. Update get_staff_assigned_work RPC to include service_id in tasks json
DROP FUNCTION IF EXISTS public.get_staff_assigned_work(uuid);
CREATE OR REPLACE FUNCTION public.get_staff_assigned_work(p_user_id uuid)
RETURNS TABLE (
    assignment_id uuid,
    employee_id uuid,
    assignment_status text,
    assigned_at timestamptz,
    accepted_at timestamptz,
    completed_at timestamptz,
    service_id uuid,
    work_order_id uuid,
    service_type text,
    service_status text,
    description text,
    priority text,
    current_stage text,
    estimated_cost numeric,
    created_at timestamptz,
    vehicle_number text,
    vehicle_model text,
    customer_name text,
    work_order_status text,
    inspection_status text,
    repair_status text,
    review_status text,
    customer_visible boolean,
    tasks json
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        sae.id as assignment_id,
        sae.employee_id,
        sae.status as assignment_status,
        sae.assigned_at,
        sae.accepted_at,
        sae.completed_at,
        s.id as service_id,
        s.work_order_id,
        s.service_type,
        s.status as service_status,
        wo.description,
        wo.priority,
        wo.current_stage,
        wo.estimated_cost,
        wo.created_at,
        v.vehicle_number,
        v.model,
        c.name as customer_name,
        wo.status as work_order_status,
        wo.inspection_status,
        wo.repair_status,
        wo.review_status,
        wo.customer_visible,
        (
            SELECT json_agg(
                json_build_object(
                    'id', t.id,
                    'task_name', t.task_name,
                    'task_type', t.task_type,
                    'service_id', t.service_id,
                    'is_completed', t.completed,
                    'completed_at', t.completed_at
                )
            )
            FROM public.work_order_tasks t
            WHERE t.work_order_id = wo.id 
            AND (t.assigned_employee_id = sae.employee_id OR t.assigned_employee_id IS NULL)
        ) as tasks
    FROM public.work_order_service_employees sae
    JOIN public.employees e ON e.id = sae.employee_id
    JOIN public.work_order_services s ON s.id = sae.service_id
    JOIN public.work_orders wo ON wo.id = s.work_order_id
    LEFT JOIN public.vehicles v ON v.id = wo.vehicle_id
    LEFT JOIN public.customers c ON c.id = v.customer_id
    WHERE e.user_id = p_user_id
    ORDER BY 
        CASE wo.priority 
            WHEN 'Urgent' THEN 1 
            WHEN 'High' THEN 2 
            WHEN 'Medium' THEN 3 
            WHEN 'Low' THEN 4 
            ELSE 5 
        END,
        wo.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_staff_assigned_work(uuid) TO authenticated;

-- Refresh schema
NOTIFY pgrst, 'reload schema';
