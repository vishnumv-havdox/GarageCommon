-- Migration: Complete Service History Setup
-- Date: 2026-02-13
-- Creates the service_history table, trigger, and policies

-- Step 1: Create the service_history table
CREATE TABLE IF NOT EXISTS service_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    work_order_id UUID NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
    service_type TEXT NOT NULL,
    service_description TEXT,
    work_summary TEXT,
    status TEXT NOT NULL DEFAULT 'Completed',
    service_date TIMESTAMPTZ NOT NULL,
    delivery_date TIMESTAMPTZ,
    approved_by TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Step 2: Create indexes
CREATE INDEX IF NOT EXISTS idx_service_history_vehicle ON service_history(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_service_history_work_order ON service_history(work_order_id);
CREATE INDEX IF NOT EXISTS idx_service_history_status ON service_history(status);
CREATE INDEX IF NOT EXISTS idx_service_history_service_date ON service_history(service_date DESC);

-- Step 3: Create the trigger function
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
                SELECT string_agg(task_name, ', ') INTO v_task_summary
                FROM work_order_service_tasks WHERE service_id = v_service.id;
                
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

-- Step 4: Create the trigger
DROP TRIGGER IF EXISTS trigger_auto_create_service_history ON work_orders;
CREATE TRIGGER trigger_auto_create_service_history
    AFTER UPDATE ON work_orders
    FOR EACH ROW
    EXECUTE FUNCTION auto_create_service_history_v2();

-- Step 5: Create RLS policies
ALTER TABLE service_history ENABLE ROW LEVEL SECURITY;

-- Customers can view their own vehicle history
DROP POLICY IF EXISTS "Customers can view their vehicle history" ON service_history;
CREATE POLICY "Customers can view their vehicle history"
    ON service_history FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM vehicles v
            WHERE v.id = service_history.vehicle_id
            AND v.customer_id IN (
                SELECT id FROM customers WHERE user_id = auth.uid()
            )
        )
    );

-- Staff can view all service history
DROP POLICY IF EXISTS "Staff can view all service history" ON service_history;
CREATE POLICY "Staff can view all service history"
    ON service_history FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id = auth.uid()
            AND role IN ('admin', 'manager', 'staff')
        )
    );

-- Admins can manage service history
DROP POLICY IF EXISTS "Admins can manage service history" ON service_history;
CREATE POLICY "Admins can manage service history"
    ON service_history FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id = auth.uid()
            AND role = 'admin'
        )
    );

-- Step 6: Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE service_history TO postgres, anon, authenticated, service_role;

-- Note: UUID primary keys don't use sequences, so no sequence grants needed

-- Step 7: Comments
COMMENT ON TABLE service_history IS 'Tracks complete service history for vehicles. Records are automatically created when work orders are delivered/completed/approved.';

-- Step 8: Backfill function for existing completed work orders
-- Run this manually if you want to create history for existing work orders:
-- SELECT backfill_service_history();
CREATE OR REPLACE FUNCTION backfill_service_history()
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER := 0;
    v_task_summary TEXT;
    wo_record RECORD;
BEGIN
    FOR wo_record IN 
        SELECT * FROM work_orders 
        WHERE status IN ('Delivered', 'Completed', 'Approved')
        AND NOT EXISTS (
            SELECT 1 FROM service_history 
            WHERE work_order_id = wo_record.id
        )
    LOOP
        -- Get work summary from repair tasks
        SELECT string_agg(task_name, ', ')
        INTO v_task_summary
        FROM repair_tasks 
        WHERE work_order_id = wo_record.id;
        
        INSERT INTO service_history (
            vehicle_id,
            work_order_id,
            service_type,
            service_description,
            work_summary,
            status,
            service_date,
            delivery_date,
            approved_by
        ) VALUES (
            wo_record.vehicle_id,
            wo_record.id,
            wo_record.service_type,
            wo_record.description,
            COALESCE(v_task_summary, wo_record.description),
            wo_record.status,
            COALESCE(wo_record.started_at, wo_record.created_at),
            wo_record.completed_at,
            wo_record.approved_by
        );
        v_count := v_count + 1;
    END LOOP;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute on the backfill function
GRANT EXECUTE ON FUNCTION backfill_service_history() TO postgres, anon, authenticated, service_role;


