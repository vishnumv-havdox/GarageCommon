-- Migration: 20260210000000_comprehensive_workflow_overhaul
-- Description: Audit and correction of Work Order workflow

-- 1. Update work_orders table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'inspection_status') THEN
        ALTER TABLE public.work_orders ADD COLUMN inspection_status text DEFAULT 'pending' CHECK (inspection_status IN ('pending', 'completed', 'approved'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'repair_status') THEN
        ALTER TABLE public.work_orders ADD COLUMN repair_status text DEFAULT 'pending' CHECK (repair_status IN ('pending', 'in_progress', 'completed', 'approved'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'review_status') THEN
        ALTER TABLE public.work_orders ADD COLUMN review_status text DEFAULT 'pending' CHECK (review_status IN ('pending', 'approved'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'customer_visible') THEN
        ALTER TABLE public.work_orders ADD COLUMN customer_visible boolean DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'completed_by_admin') THEN
        ALTER TABLE public.work_orders ADD COLUMN completed_by_admin boolean DEFAULT false;
    END IF;
END$$;

-- 2. Create work_order_tasks table
CREATE TABLE IF NOT EXISTS public.work_order_tasks (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    work_order_id uuid NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
    task_name text NOT NULL,
    task_type text CHECK (task_type IN ('inspection', 'repair', 'testing', 'quality')),
    assigned_employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
    completed boolean DEFAULT false,
    completed_at timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 3. Migrate data from repair_tasks if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'repair_tasks') THEN
        INSERT INTO public.work_order_tasks (id, work_order_id, task_name, task_type, assigned_employee_id, completed, completed_at, created_at, updated_at)
        SELECT 
            id, 
            work_order_id, 
            task_name, 
            CASE 
                WHEN task_category = 'Inspection' THEN 'inspection'
                WHEN task_category = 'Repair' THEN 'repair'
                WHEN task_category = 'Testing' THEN 'testing'
                WHEN task_category = 'Quality' THEN 'quality'
                ELSE 'repair'
            END,
            completed_by,
            CASE WHEN status = 'completed' THEN true ELSE false END,
            completed_at,
            created_at,
            updated_at
        FROM public.repair_tasks;
        
        DROP TABLE public.repair_tasks CASCADE;
    END IF;
END $$;

-- 4. Admin Force Complete logic
CREATE OR REPLACE FUNCTION public.force_complete_repair(p_work_order_id uuid, p_admin_id uuid)
RETURNS void AS $$
BEGIN
    -- Mark all repair tasks for that work order as completed
    UPDATE public.work_order_tasks 
    SET completed = true, 
        completed_at = now(),
        updated_at = now()
    WHERE work_order_id = p_work_order_id AND task_type = 'repair' AND completed = false;

    -- Set work order statuses
    UPDATE public.work_orders SET
        repair_status = 'completed',
        completed_by_admin = true,
        updated_at = now()
    WHERE id = p_work_order_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Stage-specific approvals
CREATE OR REPLACE FUNCTION public.approve_inspection_stage(p_work_order_id uuid, p_approver_id uuid)
RETURNS void AS $$
BEGIN
    UPDATE public.work_orders SET
        inspection_status = 'approved',
        updated_at = now()
    WHERE id = p_work_order_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.approve_repair_stage(p_work_order_id uuid, p_approver_id uuid)
RETURNS void AS $$
BEGIN
    UPDATE public.work_orders SET
        repair_status = 'approved',
        updated_at = now()
    WHERE id = p_work_order_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.approve_review_stage(p_work_order_id uuid, p_approver_id uuid)
RETURNS void AS $$
BEGIN
    UPDATE public.work_orders SET
        review_status = 'approved',
        updated_at = now()
    WHERE id = p_work_order_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Task Update Function (Isolation Fix)
CREATE OR REPLACE FUNCTION public.update_work_order_task_status(
    p_task_id uuid,
    p_work_order_id uuid,
    p_completed boolean,
    p_employee_id uuid
) RETURNS void AS $$
BEGIN
    -- Explicit validation: WHERE task_id = ? AND work_order_id = ?
    UPDATE public.work_order_tasks 
    SET completed = p_completed,
        completed_at = CASE WHEN p_completed THEN now() ELSE NULL END,
        updated_at = now()
    WHERE id = p_task_id AND work_order_id = p_work_order_id;

    -- Recalculate repair_status if all repair tasks are done
    IF p_completed THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.work_order_tasks 
            WHERE work_order_id = p_work_order_id 
            AND task_type = 'repair' 
            AND completed = false
        ) THEN
            UPDATE public.work_orders 
            SET repair_status = 'completed',
                updated_at = now()
            WHERE id = p_work_order_id;
        END IF;
    ELSE
        -- If a task is uncompleted, the repair_status should be in_progress
        UPDATE public.work_orders 
        SET repair_status = 'in_progress',
            updated_at = now()
        WHERE id = p_work_order_id AND repair_status = 'completed';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Grant Permissions
GRANT EXECUTE ON FUNCTION public.force_complete_repair(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_inspection_stage(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_repair_stage(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_review_stage(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_work_order_task_status(uuid, uuid, boolean, uuid) TO authenticated;

-- 8. Revamped get_staff_assigned_work RPC
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

-- 9. Refresh schema
NOTIFY pgrst, 'reload schema';
