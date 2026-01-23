-- =============================================================================
-- ENHANCED WORK ORDERS MODULE
-- Migration: 20260125000000_work_orders_enhanced
-- Description: Adds workflow tracking, assignments, parts tracking, and approvals
-- =============================================================================

SET session_replication_role = 'replica';

-- =============================================================================
-- 1. ADD COLUMNS TO EXISTING WORK_ORDERS TABLE
-- =============================================================================

-- Add missing columns to work_orders table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'work_orders' AND column_name = 'priority') THEN
        ALTER TABLE public.work_orders ADD COLUMN priority text DEFAULT 'Medium';
    END IF;
END$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'work_orders' AND column_name = 'assigned_to') THEN
        ALTER TABLE public.work_orders ADD COLUMN assigned_to uuid REFERENCES public.employees(id) ON DELETE SET NULL;
    END IF;
END$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'work_orders' AND column_name = 'current_stage') THEN
        ALTER TABLE public.work_orders ADD COLUMN current_stage text DEFAULT 'Inspection';
    END IF;
END$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'work_orders' AND column_name = 'requires_approval') THEN
        ALTER TABLE public.work_orders ADD COLUMN requires_approval boolean DEFAULT false;
    END IF;
END$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'work_orders' AND column_name = 'approved_by') THEN
        ALTER TABLE public.work_orders ADD COLUMN approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
    END IF;
END$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'work_orders' AND column_name = 'approved_at') THEN
        ALTER TABLE public.work_orders ADD COLUMN approved_at timestamptz;
    END IF;
END$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'work_orders' AND column_name = 'actual_cost') THEN
        ALTER TABLE public.work_orders ADD COLUMN actual_cost numeric(10,2);
    END IF;
END$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'work_orders' AND column_name = 'accepted_at') THEN
        ALTER TABLE public.work_orders ADD COLUMN accepted_at timestamptz;
    END IF;
END$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'work_orders' AND column_name = 'customer_visible') THEN
        ALTER TABLE public.work_orders ADD COLUMN customer_visible boolean DEFAULT false;
    END IF;
END$$;

-- =============================================================================
-- 2. WORK ORDER STAGES TABLE (Stage-by-stage tracking)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.work_order_stages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    work_order_id uuid NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
    stage text NOT NULL,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
    started_at timestamptz,
    completed_at timestamptz,
    notes text,
    completed_by uuid REFERENCES public.employees(id) ON DELETE SET NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(work_order_id, stage)
);

-- =============================================================================
-- 3. WORK ORDER ASSIGNMENTS TABLE (Multi-employee assignments)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.work_order_assignments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    work_order_id uuid NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
    employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    status text NOT NULL DEFAULT 'assigned', -- assigned, accepted, in_progress, completed
    assigned_at timestamptz DEFAULT now(),
    accepted_at timestamptz,
    completed_at timestamptz,
    notes text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(work_order_id, employee_id)
);

-- =============================================================================
-- 4. WORK ORDER PARTS TABLE (Parts used tracking)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.work_order_parts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    work_order_id uuid NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
    inventory_id uuid REFERENCES public.inventory(id) ON DELETE SET NULL,
    part_name text NOT NULL,
    quantity integer NOT NULL DEFAULT 1,
    unit_price numeric(10,2) NOT NULL DEFAULT 0,
    total_price numeric(10,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
    added_by uuid REFERENCES public.employees(id) ON DELETE SET NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- =============================================================================
-- 5. WORK ORDER APPROVALS TABLE (Approval workflow)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.work_order_approvals (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    work_order_id uuid NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
    approver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    approval_type text NOT NULL, -- completion, cost, delivery
    status text NOT NULL DEFAULT 'pending', -- pending, approved, rejected
    notes text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- =============================================================================
-- 6. CREATE OR REPLACE ENUMS
-- =============================================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'work_order_stage') THEN
        CREATE TYPE work_order_stage AS ENUM ('Inspection', 'Repair', 'Review', 'Quality Check', 'Delivery');
    END IF;
END$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_status') THEN
        CREATE TYPE task_status AS ENUM ('assigned', 'accepted', 'in_progress', 'completed', 'rejected');
    END IF;
END$$;

-- =============================================================================
-- 7. ADD CHECK CONSTRAINTS
-- =============================================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'work_orders_priority_check') THEN
        ALTER TABLE public.work_orders ADD CONSTRAINT work_orders_priority_check 
            CHECK (priority IN ('Low', 'Medium', 'High', 'Urgent'));
    END IF;
END$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'work_orders_current_stage_check') THEN
        ALTER TABLE public.work_orders ADD CONSTRAINT work_orders_current_stage_check 
            CHECK (current_stage IN ('Inspection', 'Repair', 'Review', 'Quality Check', 'Delivery'));
    END IF;
END$$;

-- =============================================================================
-- 8. CREATE VIEWS
-- =============================================================================
-- View for work orders with full details
CREATE OR REPLACE VIEW public.work_order_details AS
SELECT 
    wo.*,
    v.vehicle_number,
    v.model,
    v.vehicle_type,
    c.name as customer_name,
    c.email as customer_email,
    c.phone as customer_phone,
    e.name as assigned_employee,
    p.name as position_name,
    p.department as position_department,
    (
        SELECT json_agg(json_build_object(
            'id', s.id,
            'stage', s.stage,
            'status', s.status,
            'started_at', s.started_at,
            'completed_at', s.completed_at
        ) ORDER BY s.created_at)
        FROM public.work_order_stages s
        WHERE s.work_order_id = wo.id
    ) as stages,
    (
        SELECT json_agg(json_build_object(
            'id', a.id,
            'employee_id', a.employee_id,
            'employee_name', e2.name,
            'status', a.status,
            'assigned_at', a.assigned_at,
            'accepted_at', a.accepted_at,
            'completed_at', a.completed_at
        ))
        FROM public.work_order_assignments a
        JOIN public.employees e2 ON e2.id = a.employee_id
        WHERE a.work_order_id = wo.id
    ) as assignments,
    (
        SELECT json_agg(json_build_object(
            'id', wp.id,
            'part_name', wp.part_name,
            'quantity', wp.quantity,
            'unit_price', wp.unit_price,
            'total_price', wp.total_price
        ))
        FROM public.work_order_parts wp
        WHERE wp.work_order_id = wo.id
    ) as parts
FROM public.work_orders wo
LEFT JOIN public.vehicles v ON v.id = wo.vehicle_id
LEFT JOIN public.customers c ON c.id = v.customer_id
LEFT JOIN public.employees e ON e.id = wo.assigned_to
LEFT JOIN public.positions p ON p.id = e.position_id;

-- View for employee tasks
CREATE OR REPLACE VIEW public.employee_tasks AS
SELECT 
    woa.*,
    wo.vehicle_id,
    wo.service_type,
    wo.description,
    wo.priority,
    wo.status as work_order_status,
    wo.current_stage,
    wo.estimated_cost,
    wo.actual_cost,
    wo.requires_approval,
    wo.created_at as work_order_created,
    v.vehicle_number,
    v.model,
    c.name as customer_name,
    e.name as employee_name
FROM public.work_order_assignments woa
JOIN public.work_orders wo ON wo.id = woa.work_order_id
LEFT JOIN public.vehicles v ON v.id = wo.vehicle_id
LEFT JOIN public.customers c ON c.id = v.customer_id
LEFT JOIN public.employees e ON e.id = woa.employee_id;

-- =============================================================================
-- 9. FUNCTIONS
-- =============================================================================
-- Function to advance work order to next stage
CREATE OR REPLACE FUNCTION public.advance_work_order_stage(
    _work_order_id uuid,
    _stage text,
    _employee_id uuid
) RETURNS void AS $$
DECLARE
    _current_stage text;
BEGIN
    SELECT current_stage INTO _current_stage FROM public.work_orders WHERE id = _work_order_id;
    
    -- Mark current stage as completed
    UPDATE public.work_order_stages 
    SET status = 'completed', completed_at = now(), completed_by = _employee_id, updated_at = now()
    WHERE work_order_id = _work_order_id AND stage = _current_stage;
    
    -- Update new stage to in_progress
    UPDATE public.work_order_stages 
    SET status = 'in_progress', started_at = now(), updated_at = now()
    WHERE work_order_id = _work_order_id AND stage = _stage;
    
    -- Update work order current_stage
    UPDATE public.work_orders 
    SET current_stage = _stage, updated_at = now()
    WHERE id = _work_order_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to accept a task
CREATE OR REPLACE FUNCTION public.accept_task(
    _assignment_id uuid,
    _employee_id uuid
) RETURNS void AS $$
BEGIN
    UPDATE public.work_order_assignments 
    SET status = 'accepted', accepted_at = now(), updated_at = now()
    WHERE id = _assignment_id AND employee_id = _employee_id;
    
    -- Also update main work_order status
    UPDATE public.work_orders 
    SET status = 'In Progress', accepted_at = now(), updated_at = now()
    WHERE id = (SELECT work_order_id FROM public.work_order_assignments WHERE id = _assignment_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to complete a task
CREATE OR REPLACE FUNCTION public.complete_task(
    _assignment_id uuid,
    _employee_id uuid
) RETURNS void AS $$
BEGIN
    UPDATE public.work_order_assignments 
    SET status = 'completed', completed_at = now(), updated_at = now()
    WHERE id = _assignment_id AND employee_id = _employee_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to approve work order completion
CREATE OR REPLACE FUNCTION public.approve_work_order(
    _work_order_id uuid,
    _approver_id uuid,
    _approval_type text,
    _notes text DEFAULT null
) RETURNS void AS $$
BEGIN
    -- Add approval record
    INSERT INTO public.work_order_approvals (work_order_id, approver_id, approval_type, status, notes)
    VALUES (_work_order_id, _approver_id, _approval_type, 'approved', _notes);
    
    -- Update work order
    UPDATE public.work_orders 
    SET approved_by = _approver_id, approved_at = now(), customer_visible = true, updated_at = now()
    WHERE id = _work_order_id;
    
    -- If completion approval, mark as completed
    IF _approval_type = 'completion' THEN
        UPDATE public.work_orders 
        SET status = 'Completed', current_stage = 'Delivery', updated_at = now()
        WHERE id = _work_order_id;
        
        -- Mark Delivery stage as completed
        UPDATE public.work_order_stages 
        SET status = 'completed', completed_at = now(), updated_at = now()
        WHERE work_order_id = _work_order_id AND stage = 'Delivery';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 10. TRIGGERS
-- =============================================================================
DROP TRIGGER IF EXISTS update_work_order_stages_updated_at ON public.work_order_stages;
CREATE TRIGGER update_work_order_stages_updated_at
    BEFORE UPDATE ON public.work_order_stages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_work_order_assignments_updated_at ON public.work_order_assignments;
CREATE TRIGGER update_work_order_assignments_updated_at
    BEFORE UPDATE ON public.work_order_assignments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_work_order_parts_updated_at ON public.work_order_parts;
CREATE TRIGGER update_work_order_parts_updated_at
    BEFORE UPDATE ON public.work_order_parts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_work_order_approvals_updated_at ON public.work_order_approvals;
CREATE TRIGGER update_work_order_approvals_updated_at
    BEFORE UPDATE ON public.work_order_approvals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- 11. RLS POLICIES
-- =============================================================================
ALTER TABLE public.work_order_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_order_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_order_parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_order_approvals ENABLE ROW LEVEL SECURITY;

-- Work order stages policies
CREATE POLICY "Staff+ can view work order stages" ON public.work_order_stages
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'manager', 'staff'))
    );

CREATE POLICY "Admins can manage work order stages" ON public.work_order_stages
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
    );

-- Work order assignments policies
CREATE POLICY "Assigned employee can view own assignments" ON public.work_order_assignments
    FOR SELECT USING (
        employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid()) OR
        EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'manager'))
    );

CREATE POLICY "Staff+ can manage assignments" ON public.work_order_assignments
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'manager'))
    );

-- Work order parts policies
CREATE POLICY "Staff+ can view work order parts" ON public.work_order_parts
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'manager', 'staff'))
    );

CREATE POLICY "Staff+ can manage work order parts" ON public.work_order_parts
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'manager', 'staff'))
    );

-- Work order approvals policies
CREATE POLICY "Admins can view approvals" ON public.work_order_approvals
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'manager'))
    );

CREATE POLICY "Admins can manage approvals" ON public.work_order_approvals
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
    );

-- =============================================================================
-- 12. REENABLE TRIGGERS
-- =============================================================================
RESET session_replication_role;

-- =============================================================================
-- 13. REFRESH PostgREST SCHEMA
-- =============================================================================
NOTIFY pgrst, 'reload schema';

-- =============================================================================
-- 14. INSERT DEFAULT STAGES FOR EXISTING WORK ORDERS
-- =============================================================================
INSERT INTO public.work_order_stages (work_order_id, stage, status)
SELECT id, 'Inspection', CASE WHEN status IN ('Pending', 'In Progress') THEN 'pending' ELSE 'completed' END
FROM public.work_orders o
WHERE NOT EXISTS (
    SELECT 1 FROM public.work_order_stages s WHERE s.work_order_id = o.id AND s.stage = 'Inspection'
);

-- =============================================================================
-- END OF MIGRATION
-- =============================================================================

