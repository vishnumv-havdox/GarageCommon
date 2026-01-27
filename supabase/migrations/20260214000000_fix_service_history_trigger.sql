-- Migration: Fix Service History Trigger Function
-- Date: 2026-02-14
-- Description: Updates auto_create_service_history_v2 to use work_order_tasks instead of the dropped work_order_service_tasks table

CREATE OR REPLACE FUNCTION auto_create_service_history_v2()
RETURNS TRIGGER AS $$
DECLARE 
    v_task_summary TEXT;
    v_service RECORD;
BEGIN
    -- Only create history record when work order is delivered/completed/approved
    IF NEW.status IN ('Delivered', 'Completed', 'Approved') 
       AND (OLD.status IS NULL OR OLD.status NOT IN ('Delivered', 'Completed', 'Approved')) THEN
        
        -- Check if there are work_order_services
        IF EXISTS (SELECT 1 FROM work_order_services WHERE work_order_id = NEW.id) THEN
            -- Create history for each service
            FOR v_service IN SELECT * FROM work_order_services WHERE work_order_id = NEW.id LOOP
                -- FIXED: Changed work_order_service_tasks to work_order_tasks
                SELECT string_agg(task_name, ', ') INTO v_task_summary
                FROM work_order_tasks WHERE service_id = v_service.id;
                
                INSERT INTO service_history (
                    vehicle_id, work_order_id, service_type, service_description,
                    work_summary, status, service_date, delivery_date, approved_by
                ) VALUES (
                    NEW.vehicle_id, NEW.id, v_service.service_type,
                    v_service.service_type || ' service',
                    COALESCE(v_task_summary, v_service.service_type || ' completed'),
                    NEW.status,
                    COALESCE(v_service.started_at, NEW.created_at),
                    v_service.completed_at,
                    NEW.approved_by
                );
            END LOOP;
        ELSE
            -- Single service work order
            SELECT string_agg(task_name, ', ') INTO v_task_summary
            FROM repair_tasks WHERE work_order_id = NEW.id;
            
            INSERT INTO service_history (
                vehicle_id, work_order_id, service_type, service_description,
                work_summary, status, service_date, delivery_date, approved_by
            ) VALUES (
                NEW.vehicle_id, NEW.id, NEW.service_type, NEW.description,
                COALESCE(v_task_summary, NEW.description),
                NEW.status,
                COALESCE(NEW.started_at, NEW.created_at),
                NOW(),
                NEW.approved_by
            );
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
