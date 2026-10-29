-- Migration: 20261029131500_fix_work_order_service_tasks_relation.sql
-- Description: Fixes error 42P01 "relation work_order_service_tasks does not exist"
--              1. Updates auto_create_service_history_v2 to query work_order_tasks
--              2. Provides compatibility views for work_order_service_tasks and repair_tasks
--              3. Adds INSTEAD OF UPDATE trigger on work_order_service_tasks view

-- 1. Create compatibility view for work_order_service_tasks
CREATE OR REPLACE VIEW public.work_order_service_tasks AS 
SELECT 
    id,
    work_order_id,
    service_id,
    task_name,
    task_type,
    assigned_employee_id,
    completed,
    CASE 
        WHEN completed THEN 'Completed'
        WHEN is_rejected THEN 'Cancelled'
        ELSE 'Pending'
    END AS status,
    completed_at,
    completed_by,
    price,
    description,
    notes,
    sequence_order,
    is_predefined,
    is_rejected,
    rejection_reason,
    rejected_at,
    created_at,
    updated_at
FROM public.work_order_tasks;

GRANT ALL ON public.work_order_service_tasks TO anon, authenticated, service_role;

-- 2. Instead-of trigger on view for legacy functions that update work_order_service_tasks
CREATE OR REPLACE FUNCTION public.trig_update_work_order_service_tasks()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.work_order_tasks
    SET 
        completed = CASE WHEN NEW.status = 'Completed' THEN true ELSE false END,
        completed_at = COALESCE(NEW.completed_at, CASE WHEN NEW.status = 'Completed' THEN now() ELSE null END),
        completed_by = COALESCE(NEW.completed_by, completed_by),
        updated_at = now()
    WHERE id = OLD.id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trig_instead_update_work_order_service_tasks ON public.work_order_service_tasks;
CREATE TRIGGER trig_instead_update_work_order_service_tasks
INSTEAD OF UPDATE ON public.work_order_service_tasks
FOR EACH ROW
EXECUTE FUNCTION public.trig_update_work_order_service_tasks();

-- 3. Create compatibility view for repair_tasks
CREATE OR REPLACE VIEW public.repair_tasks AS 
SELECT 
    id,
    work_order_id,
    service_id,
    task_name,
    completed,
    CASE 
        WHEN completed THEN 'Completed'
        ELSE 'Pending'
    END AS status,
    price,
    created_at,
    updated_at
FROM public.work_order_tasks;

GRANT ALL ON public.repair_tasks TO anon, authenticated, service_role;

-- 4. Update auto_create_service_history_v2 to query work_order_tasks directly
CREATE OR REPLACE FUNCTION public.auto_create_service_history_v2()
RETURNS TRIGGER AS $$
DECLARE 
    v_task_summary TEXT;
    v_service RECORD;
BEGIN
    -- Only create history record when work order is delivered/completed/approved
    IF NEW.status IN ('Delivered', 'Completed', 'Approved') 
       AND (OLD.status IS NULL OR OLD.status NOT IN ('Delivered', 'Completed', 'Approved')) THEN
        
        -- Sync next service targets to vehicle record
        IF NEW.vehicle_id IS NOT NULL THEN
            UPDATE public.vehicles
            SET 
                kilometers_driven = COALESCE(NEW.odometer_reading, kilometers_driven),
                next_service_km = COALESCE(NEW.next_service_due_km, next_service_km),
                next_service_date = COALESCE(NEW.next_service_due_date, next_service_date),
                updated_at = NOW()
            WHERE id = NEW.vehicle_id;
        END IF;

        -- Check if there are work_order_services
        IF EXISTS (SELECT 1 FROM work_order_services WHERE work_order_id = NEW.id) THEN
            FOR v_service IN SELECT * FROM work_order_services WHERE work_order_id = NEW.id LOOP
                -- Query work_order_tasks
                SELECT string_agg(task_name, ', ') INTO v_task_summary
                FROM work_order_tasks WHERE service_id = v_service.id;
                
                INSERT INTO service_history (
                    vehicle_id, work_order_id, service_type, service_description,
                    work_summary, status, service_date, delivery_date, approved_by,
                    odometer_reading, next_service_km, next_service_date, contact_id
                ) VALUES (
                    NEW.vehicle_id, NEW.id, v_service.service_type,
                    v_service.service_type || ' service',
                    COALESCE(v_task_summary, v_service.service_type || ' completed'),
                    NEW.status,
                    COALESCE(v_service.started_at, NEW.created_at),
                    v_service.completed_at,
                    NEW.approved_by,
                    NEW.odometer_reading,
                    NEW.next_service_due_km,
                    NEW.next_service_due_date,
                    NEW.contact_id
                );
            END LOOP;
        ELSE
            -- Single service work order
            SELECT string_agg(task_name, ', ') INTO v_task_summary
            FROM work_order_tasks WHERE work_order_id = NEW.id;
            
            INSERT INTO service_history (
                vehicle_id, work_order_id, service_type, service_description,
                work_summary, status, service_date, delivery_date, approved_by,
                odometer_reading, next_service_km, next_service_date, contact_id
            ) VALUES (
                NEW.vehicle_id, NEW.id, NEW.service_type, NEW.description,
                COALESCE(v_task_summary, NEW.description),
                NEW.status,
                COALESCE(NEW.started_at, NEW.created_at),
                NOW(),
                NEW.approved_by,
                NEW.odometer_reading,
                NEW.next_service_due_km,
                NEW.next_service_due_date,
                NEW.contact_id
            );
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Notify PostgREST to refresh schema cache
NOTIFY pgrst, 'reload schema';
