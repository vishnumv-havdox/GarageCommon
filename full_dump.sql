


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."access_level_enum" AS ENUM (
    'admin',
    'manager',
    'staff'
);


ALTER TYPE "public"."access_level_enum" OWNER TO "postgres";


CREATE TYPE "public"."task_status" AS ENUM (
    'assigned',
    'accepted',
    'in_progress',
    'completed',
    'rejected'
);


ALTER TYPE "public"."task_status" OWNER TO "postgres";


CREATE TYPE "public"."work_order_stage" AS ENUM (
    'Inspection',
    'Repair',
    'Review',
    'Quality Check',
    'Delivery'
);


ALTER TYPE "public"."work_order_stage" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."accept_task"("_assignment_id" "uuid", "_employee_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    UPDATE public.work_order_assignments 
    SET status = 'accepted', accepted_at = now(), updated_at = now()
    WHERE id = _assignment_id AND employee_id = _employee_id;
    
    -- Also update main work_order status
    UPDATE public.work_orders 
    SET status = 'In Progress', accepted_at = now(), updated_at = now()
    WHERE id = (SELECT work_order_id FROM public.work_order_assignments WHERE id = _assignment_id);
END;
$$;


ALTER FUNCTION "public"."accept_task"("_assignment_id" "uuid", "_employee_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."accept_work_assignment"("p_assignment_id" "uuid", "p_employee_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    UPDATE public.work_order_service_employees 
    SET status = 'Accepted', accepted_at = now(), updated_at = now()
    WHERE id = p_assignment_id AND employee_id = p_employee_id;

    UPDATE public.work_order_services 
    SET status = 'In Progress', started_at = now(), updated_at = now()
    WHERE id = (SELECT service_id FROM public.work_order_service_employees WHERE id = p_assignment_id);

    UPDATE public.work_orders 
    SET status = 'In Progress', accepted_at = now(), updated_at = now()
    WHERE id = (SELECT work_order_id FROM public.work_order_services WHERE id = (SELECT service_id FROM public.work_order_service_employees WHERE id = p_assignment_id))
    AND status = 'Pending';
END;
$$;


ALTER FUNCTION "public"."accept_work_assignment"("p_assignment_id" "uuid", "p_employee_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."advance_work_order_stage"("_work_order_id" "uuid", "_stage" "text", "_employee_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."advance_work_order_stage"("_work_order_id" "uuid", "_stage" "text", "_employee_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."approve_all_pending_assignments"("p_work_order_id" "uuid", "p_approver_id" "uuid") RETURNS TABLE("approved_count" integer, "assignment_ids" "uuid"[])
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_approved_count integer;
    v_assignment_ids uuid[];
BEGIN
    -- Update all pending assignments for this work order
    WITH updated AS (
        UPDATE public.work_order_service_employees
        SET 
            status = 'Accepted',
            accepted_at = now(),
            accepted_by = p_approver_id
        WHERE service_id IN (
            SELECT id 
            FROM public.work_order_services 
            WHERE work_order_id = p_work_order_id
        )
        AND status = 'Assigned' -- FIXED: Changed from 'Pending' to 'Assigned'
        RETURNING id
    )
    SELECT 
        COUNT(*)::integer,
        ARRAY_AGG(id)
    INTO v_approved_count, v_assignment_ids
    FROM updated;

    -- Return the count and IDs of approved assignments
    RETURN QUERY SELECT v_approved_count, v_assignment_ids;
END;
$$;


ALTER FUNCTION "public"."approve_all_pending_assignments"("p_work_order_id" "uuid", "p_approver_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."approve_inspection"("p_work_order_id" "uuid", "p_inspector_id" "uuid", "p_notes" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    -- Update work order
    UPDATE public.work_orders SET
        inspection_status = 'approved',
        inspection_notes = p_notes,
        inspection_completed_at = now(),
        inspection_completed_by = p_inspector_id,
        repairs_visible = true,
        repairs_approved = false,
        updated_at = now()
    WHERE id = p_work_order_id;

    -- If repair tasks don't exist, create default ones
    IF NOT EXISTS (SELECT 1 FROM public.repair_tasks WHERE work_order_id = p_work_order_id) THEN
        INSERT INTO public.repair_tasks (work_order_id, task_name, task_description, task_category, priority, sequence_order)
        VALUES 
            (p_work_order_id, 'Initial Assessment', 'Conduct thorough vehicle inspection and document all findings', 'Inspection', 'High', 1),
            (p_work_order_id, 'Parts Replacement', 'Replace worn or damaged parts as needed', 'Repair', 'High', 2),
            (p_work_order_id, 'System Testing', 'Test all repaired systems for proper functionality', 'Testing', 'High', 3),
            (p_work_order_id, 'Quality Check', 'Perform quality assurance verification', 'Quality', 'Medium', 4),
            (p_work_order_id, 'Final Documentation', 'Complete all documentation and paperwork', 'Documentation', 'Low', 5);
    END IF;
END;
$$;


ALTER FUNCTION "public"."approve_inspection"("p_work_order_id" "uuid", "p_inspector_id" "uuid", "p_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."approve_inspection_stage"("p_work_order_id" "uuid", "p_approver_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    UPDATE public.work_orders SET
        inspection_status = 'approved',
        updated_at = now()
    WHERE id = p_work_order_id;
END;
$$;


ALTER FUNCTION "public"."approve_inspection_stage"("p_work_order_id" "uuid", "p_approver_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."approve_part_request"("_request_id" "uuid", "_approved_qty" integer, "_admin_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_item_id UUID;
    v_available INTEGER;
BEGIN
    SELECT item_id INTO v_item_id FROM public.part_requests WHERE id = _request_id;
    SELECT available_qty INTO v_available FROM public.inventory WHERE id = v_item_id;

    IF v_available < _approved_qty THEN
        RAISE EXCEPTION 'Insufficient stock available';
    END IF;

    -- Update request with approver
    UPDATE public.part_requests 
    SET approved_qty = _approved_qty, 
        status = 'approved',
        approved_by = _admin_id, -- Save the approver
        updated_at = now()
    WHERE id = _request_id;

    -- Reserve stock
    UPDATE public.inventory 
    SET available_qty = available_qty - _approved_qty,
        reserved_qty = reserved_qty + _approved_qty,
        updated_at = now()
    WHERE id = v_item_id;

    -- Log transaction
    INSERT INTO public.inventory_transactions (item_id, type, quantity, reference_id, performed_by, notes)
    VALUES (v_item_id, 'reservation', _approved_qty, _request_id, _admin_id, 'Part request approved and reserved');
END;
$$;


ALTER FUNCTION "public"."approve_part_request"("_request_id" "uuid", "_approved_qty" integer, "_admin_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."approve_repair_stage"("p_work_order_id" "uuid", "p_approver_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    UPDATE public.work_orders SET
        repair_status = 'approved',
        updated_at = now()
    WHERE id = p_work_order_id;
END;
$$;


ALTER FUNCTION "public"."approve_repair_stage"("p_work_order_id" "uuid", "p_approver_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."approve_repairs"("p_work_order_id" "uuid", "p_approver_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_employee_id uuid;
BEGIN
    v_employee_id := public.get_employee_id_from_user(p_approver_id);

    -- GUARD: ONLY approve if not already cancelled or rejected
    UPDATE public.work_orders SET
        repairs_approved = true,
        repairs_approved_at = now(),
        repairs_approved_by = v_employee_id,
        status = 'Completed',
        customer_visible = true,
        portal_updated_at = now(),
        updated_at = now()
    WHERE id = p_work_order_id
    AND status NOT IN ('Cancelled', 'Rejected');

    -- SYNC: Mark Repair stage as completed
    UPDATE public.work_order_stages 
    SET status = 'completed', 
        completed_at = now(), 
        completed_by = v_employee_id,
        updated_at = now()
    WHERE work_order_id = p_work_order_id AND stage = 'Repair';

    -- SYNC: Mark all tasks as completed
    UPDATE public.repair_tasks 
    SET status = 'completed',
        completed_at = now(),
        completed_by = v_employee_id,
        updated_at = now()
    WHERE work_order_id = p_work_order_id AND status != 'completed';
END;
$$;


ALTER FUNCTION "public"."approve_repairs"("p_work_order_id" "uuid", "p_approver_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."approve_review_stage"("p_work_order_id" "uuid", "p_approver_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    UPDATE public.work_orders SET
        review_status = 'approved',
        updated_at = now()
    WHERE id = p_work_order_id;
END;
$$;


ALTER FUNCTION "public"."approve_review_stage"("p_work_order_id" "uuid", "p_approver_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."approve_task"("_assignment_id" "uuid", "_assignment_type" "text", "_approver_id" "uuid", "_notes" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    IF _assignment_type = 'legacy' THEN
        -- Update legacy assignment
        UPDATE public.work_order_assignments 
        SET status = 'completed', 
            approved_by = _approver_id, 
            approved_at = now(), 
            approval_notes = _notes,
            updated_at = now()
        WHERE id = _assignment_id;
        
        -- Update main work order to completed if all assignments are approved
        UPDATE public.work_orders 
        SET status = 'Completed', 
            customer_visible = true,
            approved_by = _approver_id,
            approved_at = now(),
            updated_at = now()
        WHERE id = (SELECT work_order_id FROM public.work_order_assignments WHERE id = _assignment_id)
        AND NOT EXISTS (
            SELECT 1 FROM public.work_order_assignments 
            WHERE work_order_id = (SELECT work_order_id FROM public.work_order_assignments WHERE id = _assignment_id)
            AND status NOT IN ('completed', 'rejected')
        );
    ELSE
        -- Update service employee
        UPDATE public.work_order_service_employees 
        SET status = 'Completed', 
            approved_by = _approver_id, 
            approved_at = now(), 
            approval_notes = _notes,
            updated_at = now()
        WHERE id = _assignment_id;
        
        -- Update service status
        UPDATE public.work_order_services 
        SET status = 'Completed', 
            approved_by = _approver_id,
            approved_at = now(),
            updated_at = now()
        WHERE id = (SELECT service_id FROM public.work_order_service_employees WHERE id = _assignment_id);
        
        -- Update main work order if all services are completed
        UPDATE public.work_orders 
        SET status = 'Completed', 
            customer_visible = true,
            approved_by = _approver_id,
            approved_at = now(),
            updated_at = now()
        WHERE id = (SELECT work_order_id FROM public.work_order_service_employees WHERE id = _assignment_id)
        AND NOT EXISTS (
            SELECT 1 FROM public.work_order_service_employees 
            WHERE service_id IN (SELECT id FROM public.work_order_services WHERE work_order_id = (SELECT work_order_id FROM public.work_order_service_employees WHERE id = _assignment_id))
            AND status NOT IN ('Completed', 'rejected')
        );
    END IF;
END;
$$;


ALTER FUNCTION "public"."approve_task"("_assignment_id" "uuid", "_assignment_type" "text", "_approver_id" "uuid", "_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."approve_work"("p_work_order_id" "uuid", "p_approver_id" "uuid", "p_notes" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    UPDATE public.work_orders 
    SET status = 'Approved', 
        approved_by = p_approver_id, 
        approved_at = now(),
        completed_at = now(),
        customer_visible = true,
        updated_at = now()
    WHERE id = p_work_order_id;

    UPDATE public.work_order_services 
    SET status = 'Approved', updated_at = now()
    WHERE work_order_id = p_work_order_id;

    UPDATE public.work_order_service_employees 
    SET status = 'Approved', updated_at = now()
    WHERE service_id IN (SELECT id FROM public.work_order_services WHERE work_order_id = p_work_order_id);

    IF p_notes IS NOT NULL THEN
        INSERT INTO public.work_order_service_notes (service_id, note_type, note_content, is_internal, created_by)
        SELECT DISTINCT s.id, 'Approval', p_notes, false, p_approver_id
        FROM public.work_order_services s
        WHERE s.work_order_id = p_work_order_id;
    END IF;
END;
$$;


ALTER FUNCTION "public"."approve_work"("p_work_order_id" "uuid", "p_approver_id" "uuid", "p_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."approve_work_order"("_work_order_id" "uuid", "_approver_id" "uuid", "_approval_type" "text", "_notes" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."approve_work_order"("_work_order_id" "uuid", "_approver_id" "uuid", "_approval_type" "text", "_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."auto_create_service_history_v2"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."auto_create_service_history_v2"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."backfill_service_history"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_count INTEGER := 0;
    v_task_summary TEXT;
    v_wo RECORD;
BEGIN
    FOR v_wo IN 
        SELECT * FROM work_orders 
        WHERE status IN ('Delivered', 'Completed', 'Approved')
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM service_history WHERE work_order_id = v_wo.id
        ) THEN
            -- Get work summary from work_order_tasks (not repair_tasks)
            SELECT string_agg(task_name, ', ') INTO v_task_summary
            FROM work_order_tasks WHERE work_order_id = v_wo.id;
            
            -- Insert history record
            INSERT INTO service_history (
                vehicle_id, work_order_id, service_type, 
                service_description, work_summary, status, 
                service_date, delivery_date, approved_by
            ) VALUES (
                v_wo.vehicle_id, v_wo.id, v_wo.service_type, v_wo.description,
                COALESCE(v_task_summary, v_wo.description), v_wo.status,
                COALESCE(v_wo.started_at, v_wo.created_at), v_wo.completed_at, v_wo.approved_by
            );
            v_count := v_count + 1;
        END IF;
    END LOOP;
    RETURN v_count;
END;
$$;


ALTER FUNCTION "public"."backfill_service_history"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_employee_payouts"("_period_start" "date", "_period_end" "date", "_admin_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    r_config RECORD;
    v_base_calc NUMERIC(12,2);
    v_attendance_adj NUMERIC(12,2) := 0;
    v_job_incentives NUMERIC(12,2) := 0;
    v_overtime_pay NUMERIC(12,2) := 0;
    v_arrears_adj NUMERIC(12,2) := 0;
    v_total_amount NUMERIC(12,2);
    v_absence_count INTEGER;
    v_present_days NUMERIC(4,1);
    v_unit_count INTEGER;
    v_ot_hours NUMERIC(6,2);
    v_generated_count INTEGER := 0;
    v_payout_id UUID;
BEGIN
    FOR r_config IN (
        SELECT esc.*, e.name 
        FROM public.employee_salary_configs esc
        JOIN public.employees e ON e.id = esc.employee_id
        WHERE esc.is_active = true
    ) LOOP
        v_generated_count := v_generated_count + 1;

        -- 1. Calculate Base and Attendance Adjustments
        IF r_config.pay_type = 'daily' THEN
            SELECT 
                SUM(CASE WHEN status IN ('present', 'overtime', 'paid-holiday') THEN 1 WHEN status = 'half-day' THEN 0.5 ELSE 0 END)
            INTO v_present_days
            FROM public.attendance 
            WHERE employee_id = r_config.employee_id 
              AND date >= _period_start AND date <= _period_end
              AND status IN ('present', 'half-day', 'overtime', 'paid-holiday'); -- 'holiday' (Unpaid) is NOT included
            
            v_base_calc := COALESCE(v_present_days, 0) * r_config.base_amount;
            v_attendance_adj := 0;
        ELSE
            -- For monthly/weekly, count absences. 
            -- 'holiday' (Unpaid) counts as an absence for deduction.
            -- 'paid-holiday' is NOT an absence.
            SELECT COUNT(*) INTO v_absence_count 
            FROM public.attendance 
            WHERE employee_id = r_config.employee_id 
              AND date >= _period_start AND date <= _period_end
              AND status IN ('absent', 'holiday');
            
            IF r_config.pay_type = 'monthly' THEN
                v_base_calc := r_config.base_amount;
                v_attendance_adj := -(v_base_calc / 30.0 * v_absence_count);
            ELSIF r_config.pay_type = 'weekly' THEN
                v_base_calc := r_config.base_amount; 
                v_attendance_adj := -(v_base_calc / 7.0 * v_absence_count);
            ELSE
                v_base_calc := 0;
            END IF;
        END IF;

        -- 2. Calculate Job Incentives (unchanged)
        WITH raw_completed_work AS (
            SELECT t.id FROM public.work_order_tasks t
            WHERE t.completed = true 
              AND t.assigned_employee_id = r_config.employee_id
              AND (COALESCE(t.completed_at, t.updated_at)::date BETWEEN _period_start AND _period_end)
            UNION ALL
            SELECT sae.id FROM public.work_order_service_employees sae
            JOIN public.work_order_services s ON s.id = sae.service_id
            WHERE (LOWER(sae.status) IN ('completed', 'approved', 'pending_approval') 
               OR LOWER(s.status) IN ('completed', 'approved', 'pending approval'))
              AND sae.employee_id = r_config.employee_id
              AND (COALESCE(sae.completed_at, sae.updated_at)::date BETWEEN _period_start AND _period_end)
            UNION ALL
            SELECT woa.id FROM public.work_order_assignments woa
            WHERE (LOWER(woa.status) = 'completed' OR woa.completed_at IS NOT NULL)
              AND woa.employee_id = r_config.employee_id
              AND (COALESCE(woa.completed_at, woa.updated_at)::date BETWEEN _period_start AND _period_end)
        )
        SELECT COUNT(*) INTO v_unit_count FROM raw_completed_work;
        v_job_incentives := v_unit_count * r_config.job_incentive_rate;

        -- 3. Calculate Overtime Pay (unchanged)
        SELECT SUM(overtime_hours) INTO v_ot_hours
        FROM public.attendance
        WHERE employee_id = r_config.employee_id
          AND date >= _period_start AND date <= _period_end;
        v_overtime_pay := COALESCE(v_ot_hours, 0) * r_config.overtime_rate;

        -- 4. Calculate Arrears (Gather unprocessed adjustments)
        SELECT COALESCE(SUM(amount), 0) INTO v_arrears_adj
        FROM public.payout_adjustments
        WHERE employee_id = r_config.employee_id AND is_processed = false;

        -- 5. Calculate Final Total
        v_total_amount := v_base_calc + v_attendance_adj + v_job_incentives + v_overtime_pay + r_config.allowances + v_arrears_adj;

        -- 6. Insert/Update Payout
        INSERT INTO public.employee_payouts (
            employee_id,
            period_start,
            period_end,
            base_calc,
            attendance_adj,
            job_incentives,
            overtime_pay,
            arrears_adj,
            total_amount,
            status,
            notes
        ) VALUES (
            r_config.employee_id,
            _period_start,
            _period_end,
            v_base_calc,
            v_attendance_adj,
            v_job_incentives,
            v_overtime_pay,
            v_arrears_adj,
            v_total_amount,
            'draft',
            CASE 
                WHEN v_arrears_adj != 0 THEN 'Includes ₹' || v_arrears_adj || ' in arrears from past corrections.'
                ELSE 'Regular payout period.'
            END
        )
        ON CONFLICT (employee_id, period_start, period_end)
        DO UPDATE SET
            base_calc = EXCLUDED.base_calc,
            attendance_adj = EXCLUDED.attendance_adj,
            job_incentives = EXCLUDED.job_incentives,
            overtime_pay = EXCLUDED.overtime_pay,
            arrears_adj = EXCLUDED.arrears_adj,
            total_amount = EXCLUDED.total_amount,
            notes = EXCLUDED.notes,
            updated_at = now()
        RETURNING id INTO v_payout_id;

        -- 7. Mark adjustments as processed for THIS payout
        UPDATE public.payout_adjustments 
        SET is_processed = true, processed_payout_id = v_payout_id
        WHERE employee_id = r_config.employee_id AND is_processed = false;
            
    END LOOP;
    
    RETURN v_generated_count;
END;
$$;


ALTER FUNCTION "public"."calculate_employee_payouts"("_period_start" "date", "_period_end" "date", "_admin_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_admin_role"("p_user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    is_admin boolean;
BEGIN
    -- Use SECURITY DEFINER to bypass RLS when checking
    SELECT EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = p_user_id AND role = 'admin'
    ) INTO is_admin;
    
    RETURN is_admin;
END;
$$;


ALTER FUNCTION "public"."check_admin_role"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_is_admin"("p_user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    is_admin boolean := false;
BEGIN
    -- Use SECURITY DEFINER to bypass RLS when checking
    -- This queries the user_roles table directly without triggering RLS
    SELECT EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = p_user_id AND role = 'admin'
    ) INTO is_admin;
    
    RETURN is_admin;
EXCEPTION
    WHEN OTHERS THEN
        -- Fallback: check if user has admin email pattern
        -- This is a simple heuristic for development
        RETURN false;
END;
$$;


ALTER FUNCTION "public"."check_is_admin"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_is_staff"("p_user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    is_staff boolean := false;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = p_user_id AND role IN ('admin', 'staff', 'manager')
    ) INTO is_staff;
    
    RETURN is_staff;
EXCEPTION
    WHEN OTHERS THEN
        RETURN false;
END;
$$;


ALTER FUNCTION "public"."check_is_staff"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."complete_repair_and_advance"("p_work_order_id" "uuid", "p_approver_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_next_stage text;
    v_employee_id uuid;
BEGIN
    -- Resolve approver to employee_id
    v_employee_id := public.get_employee_id_from_user(p_approver_id);

    -- Mark repair as completed
    UPDATE public.work_orders 
    SET repair_completed_at = now(), updated_at = now()
    WHERE id = p_work_order_id;

    -- Mark Repair stage as completed
    UPDATE public.work_order_stages 
    SET status = 'completed', 
        completed_at = now(), 
        completed_by = v_employee_id, -- Use resolved employee_id
        updated_at = now()
    WHERE work_order_id = p_work_order_id AND stage = 'Repair';

    -- Advance to next stage (Quality Check)
    SELECT stage INTO v_next_stage
    FROM public.work_order_stages
    WHERE work_order_id = p_work_order_id AND status = 'pending'
    ORDER BY created_at
    LIMIT 1;

    IF v_next_stage IS NOT NULL THEN
        UPDATE public.work_orders 
        SET current_stage = v_next_stage, updated_at = now()
        WHERE id = p_work_order_id;

        UPDATE public.work_order_stages 
        SET status = 'in_progress', started_at = now(), updated_at = now()
        WHERE work_order_id = p_work_order_id AND stage = v_next_stage;
    END IF;

    -- Update all service statuses to reflect progress
    UPDATE public.work_order_services 
    SET status = CASE 
        WHEN v_next_stage = 'Quality Check' THEN 'Pending Approval'
        ELSE status
    END,
    updated_at = now()
    WHERE work_order_id = p_work_order_id;
END;
$$;


ALTER FUNCTION "public"."complete_repair_and_advance"("p_work_order_id" "uuid", "p_approver_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."complete_repair_task"("p_task_id" "uuid", "p_completed_by" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_work_order_id uuid;
    v_task_count integer;
    v_completed_count integer;
    v_employee_id uuid;
BEGIN
    -- Resolve completed_by to employee_id
    v_employee_id := public.get_employee_id_from_user(p_completed_by);

    -- Get work order id
    SELECT work_order_id INTO v_work_order_id FROM public.repair_tasks WHERE id = p_task_id;

    -- Update task
    UPDATE public.repair_tasks SET
        status = 'completed',
        completed_at = now(),
        completed_by = v_employee_id,
        updated_at = now()
    WHERE id = p_task_id;

    -- Add to history
    INSERT INTO public.repair_task_history (task_id, action, performed_by, notes)
    VALUES (p_task_id, 'completed', v_employee_id, 'Task completed');

    -- Check if all tasks for this work order are completed
    SELECT COUNT(*), SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END)
    INTO v_task_count, v_completed_count
    FROM public.repair_tasks
    WHERE work_order_id = v_work_order_id;

    -- If all completed, update work order status AND set Repair stage to in_progress or completed
    -- GUARD: ONLY update status to 'Pending Approval' if it's currently 'In Progress' or 'Pending'
    IF v_task_count = v_completed_count AND v_task_count > 0 THEN
        UPDATE public.work_orders SET
            status = 'Pending Approval',
            updated_at = now()
        WHERE id = v_work_order_id
        AND status IN ('Pending', 'In Progress');
        
        UPDATE public.work_order_stages 
        SET status = 'in_progress', 
            updated_at = now()
        WHERE work_order_id = v_work_order_id AND stage = 'Repair' AND status = 'pending';
    END IF;
END;
$$;


ALTER FUNCTION "public"."complete_repair_task"("p_task_id" "uuid", "p_completed_by" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."complete_task"("p_task_id" "uuid", "p_employee_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_service_id uuid;
    v_all_completed boolean;
BEGIN
    SELECT service_id INTO v_service_id 
    FROM public.work_order_service_tasks 
    WHERE id = p_task_id;

    UPDATE public.work_order_service_tasks 
    SET status = 'Completed', completed_at = now(), updated_at = now()
    WHERE id = p_task_id;

    SELECT INTO v_all_completed 
    NOT EXISTS (
        SELECT 1 FROM public.work_order_service_tasks 
        WHERE service_id = v_service_id AND status != 'Completed'
    );

    IF v_all_completed THEN
        UPDATE public.work_order_services 
        SET status = 'Pending Approval', updated_at = now()
        WHERE id = v_service_id;

        UPDATE public.work_orders 
        SET status = 'Pending Approval', updated_at = now()
        WHERE id = (SELECT work_order_id FROM public.work_order_services WHERE id = v_service_id)
        AND status != 'Completed';
    END IF;
END;
$$;


ALTER FUNCTION "public"."complete_task"("p_task_id" "uuid", "p_employee_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_work_order_stages"("p_work_order_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_count integer;
BEGIN
    -- Check if stages already exist
    SELECT COUNT(*) INTO v_count FROM public.work_order_stages 
    WHERE work_order_id = p_work_order_id;
    
    IF v_count > 0 THEN
        RETURN;
    END IF;
    
    -- Insert all 5 stages for the work order
    INSERT INTO public.work_order_stages (work_order_id, stage, status, created_at, updated_at)
    VALUES 
        (p_work_order_id, 'Inspection', 'pending', now(), now()),
        (p_work_order_id, 'Repair', 'pending', now(), now()),
        (p_work_order_id, 'Review', 'pending', now(), now()),
        (p_work_order_id, 'Quality Check', 'pending', now(), now()),
        (p_work_order_id, 'Delivery', 'pending', now(), now());
END;
$$;


ALTER FUNCTION "public"."create_work_order_stages"("p_work_order_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_capture_attendance_correction"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_payout RECORD;
    v_salary_config RECORD;
    v_old_val NUMERIC;
    v_new_val NUMERIC;
    v_delta_days NUMERIC;
    v_adj_amount NUMERIC := 0;
    v_daily_rate NUMERIC;
BEGIN
    -- Only trigger if status or overtime_hours changed
    IF (OLD.status IS NOT DISTINCT FROM NEW.status AND OLD.overtime_hours IS NOT DISTINCT FROM NEW.overtime_hours) THEN
        RETURN NEW;
    END IF;

    -- Check if there is a PAID payout for this date
    SELECT * INTO v_payout 
    FROM public.employee_payouts 
    WHERE employee_id = NEW.employee_id 
      AND period_start <= NEW.date AND period_end >= NEW.date
      AND status = 'paid'
    LIMIT 1;

    IF FOUND THEN
        -- Get salary config for the rate
        SELECT * INTO v_salary_config FROM public.employee_salary_configs WHERE employee_id = NEW.employee_id;
        
        IF NOT FOUND THEN RETURN NEW; END IF;

        -- Calculate values for status: ONLY paid-holiday counts as 1.0 (Paid)
        -- 'holiday' (Unpaid) counts as 0.0
        v_old_val := CASE WHEN OLD.status IN ('present', 'overtime', 'paid-holiday') THEN 1.0 WHEN OLD.status = 'half-day' THEN 0.5 ELSE 0 END;
        v_new_val := CASE WHEN NEW.status IN ('present', 'overtime', 'paid-holiday') THEN 1.0 WHEN NEW.status = 'half-day' THEN 0.5 ELSE 0 END;
        v_delta_days := v_new_val - v_old_val;

        IF v_salary_config.pay_type = 'monthly' THEN
            v_daily_rate := v_salary_config.base_amount / 30.0;
        ELSIF v_salary_config.pay_type = 'weekly' THEN
            v_daily_rate := v_salary_config.base_amount / 7.0;
        ELSIF v_salary_config.pay_type = 'daily' THEN
            v_daily_rate := v_salary_config.base_amount;
        ELSE
            v_daily_rate := 0;
        END IF;

        v_adj_amount := v_delta_days * v_daily_rate;

        -- Handle Overtime Hours change
        v_adj_amount := v_adj_amount + (COALESCE(NEW.overtime_hours, 0) - COALESCE(OLD.overtime_hours, 0)) * v_salary_config.overtime_rate;

        IF v_adj_amount != 0 THEN
            INSERT INTO public.payout_adjustments (
                employee_id,
                payout_id,
                attendance_id,
                amount,
                description
            ) VALUES (
                NEW.employee_id,
                v_payout.id,
                NEW.id,
                v_adj_amount,
                format('Correction for %s: %s -> %s', NEW.date, OLD.status, NEW.status)
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."fn_capture_attendance_correction"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."force_complete_repair"("p_work_order_id" "uuid", "p_admin_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."force_complete_repair"("p_work_order_id" "uuid", "p_admin_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_inventory_units"("_inventory_id" "uuid", "_quantity" integer, "_sku" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    i INTEGER;
    v_qr TEXT;
BEGIN
    FOR i IN 1.._quantity LOOP
        -- Generate strict unique QR: SKU-TIMESTAMP-INDEX-RANDOM
        -- Using clock_timestamp() for better entropy, and 'i' to guarantee uniqueness within batch
        v_qr := _sku || '-' || to_char(clock_timestamp(), 'YYMMDDHH24MISS') || '-' || i || '-' || substring(md5(random()::text) from 1 for 3);
        
        BEGIN
            INSERT INTO public.inventory_units (inventory_id, qr_code, status)
            VALUES (_inventory_id, v_qr, 'available');
        EXCEPTION WHEN unique_violation THEN
            -- Retry once with different random or just skip (though index should prevent it)
            v_qr := _sku || '-' || to_char(clock_timestamp(), 'YYMMDDHH24MISS') || '-' || i || '-' || substring(md5(random()::text) from 1 for 4);
            INSERT INTO public.inventory_units (inventory_id, qr_code, status)
            VALUES (_inventory_id, v_qr, 'available');
        END;
    END LOOP;
END;
$$;


ALTER FUNCTION "public"."generate_inventory_units"("_inventory_id" "uuid", "_quantity" integer, "_sku" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_bottleneck_analysis"("p_start_date" timestamp with time zone DEFAULT ("now"() - '30 days'::interval), "p_end_date" timestamp with time zone DEFAULT "now"()) RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_result JSON;
BEGIN
    SELECT json_agg(
        json_build_object(
            'stage', stage_name,
            'avg_duration_hours', ROUND(avg_duration_hours, 2),
            'max_duration_hours', ROUND(max_duration_hours, 2),
            'order_count', order_count,
            'bottleneck_score', bottleneck_score
        )
    ) INTO v_result
    FROM (
        SELECT 
            ws.stage as stage_name,
            AVG(EXTRACT(EPOCH FROM (COALESCE(ws.completed_at, now()) - ws.started_at)) / 3600) as avg_duration_hours,
            MAX(EXTRACT(EPOCH FROM (COALESCE(ws.completed_at, now()) - ws.started_at)) / 3600) as max_duration_hours,
            COUNT(*) as order_count,
            -- Bottleneck score based on duration relative to average
            (AVG(EXTRACT(EPOCH FROM (COALESCE(ws.completed_at, now()) - ws.started_at)) / 3600) / 
             NULLIF((SELECT AVG(EXTRACT(EPOCH FROM (COALESCE(completed_at, now()) - started_at)) / 3600) 
                     FROM public.work_order_stages WHERE started_at IS NOT NULL), 0)) * 100 as bottleneck_score
        FROM public.work_order_stages ws
        JOIN public.work_orders wo ON wo.id = ws.work_order_id
        WHERE wo.created_at BETWEEN p_start_date AND p_end_date
        AND ws.started_at IS NOT NULL
        GROUP BY ws.stage
        ORDER BY avg_duration_hours DESC
        LIMIT 5
    ) bottlenecks;

    RETURN COALESCE(v_result, '[]'::json);
END;
$$;


ALTER FUNCTION "public"."get_bottleneck_analysis"("p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_comprehensive_operational_analytics"("p_start_date" timestamp with time zone DEFAULT ("now"() - '30 days'::interval), "p_end_date" timestamp with time zone DEFAULT "now"(), "p_service_type" "text" DEFAULT NULL::"text", "p_department" "text" DEFAULT NULL::"text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_result JSON;
    v_total_serviced integer;
    v_daily_serviced json;
    v_weekly_serviced json;
    v_monthly_serviced json;
    v_status_counts json;
    v_stage_counts json;
    v_avg_turnaround interval;
    v_avg_turnaround_hours numeric;
    v_bottleneck_stages json;
    v_rework_rate numeric;
    v_reopened_count integer;
    v_overdue_count integer;
    v_urgent_count integer;
BEGIN
    -- Total vehicles serviced
    SELECT count(*) INTO v_total_serviced
    FROM public.work_orders
    WHERE (status IN ('Completed', 'Approved', 'Delivered'))
    AND created_at BETWEEN p_start_date AND p_end_date
    AND (p_service_type IS NULL OR service_type = p_service_type);

    -- Daily serviced count
    SELECT json_object_agg(date_key, count) INTO v_daily_serviced
    FROM (
        SELECT to_char(created_at::date, 'YYYY-MM-DD') as date_key, count(*) as count
        FROM public.work_orders
        WHERE status IN ('Completed', 'Approved', 'Delivered')
        AND created_at BETWEEN p_start_date AND p_end_date
        AND (p_service_type IS NULL OR service_type = p_service_type)
        GROUP BY created_at::date
        ORDER BY created_at::date
    ) d;

    -- Weekly serviced count
    SELECT json_object_agg(week_key, count) INTO v_weekly_serviced
    FROM (
        SELECT to_char(created_at, 'YYYY-WW') as week_key, count(*) as count
        FROM public.work_orders
        WHERE status IN ('Completed', 'Approved', 'Delivered')
        AND created_at BETWEEN p_start_date AND p_end_date
        AND (p_service_type IS NULL OR service_type = p_service_type)
        GROUP BY to_char(created_at, 'YYYY-WW')
    ) w;

    -- Monthly serviced count
    SELECT json_object_agg(month_key, count) INTO v_monthly_serviced
    FROM (
        SELECT to_char(created_at, 'YYYY-MM') as month_key, count(*) as count
        FROM public.work_orders
        WHERE status IN ('Completed', 'Approved', 'Delivered')
        AND created_at BETWEEN p_start_date AND p_end_date
        AND (p_service_type IS NULL OR service_type = p_service_type)
        GROUP BY to_char(created_at, 'YYYY-MM')
    ) m;

    -- Work orders by status
    SELECT json_object_agg(status, count) INTO v_status_counts
    FROM (
        SELECT status, count(*) as count
        FROM public.work_orders
        WHERE created_at BETWEEN p_start_date AND p_end_date
        AND (p_service_type IS NULL OR service_type = p_service_type)
        GROUP BY status
    ) s;

    -- Work orders by stage (using work_order_stages)
    SELECT json_object_agg(stage, count) INTO v_stage_counts
    FROM (
        SELECT stage, count(*) as count
        FROM public.work_order_stages
        WHERE created_at BETWEEN p_start_date AND p_end_date
        GROUP BY stage
    ) st;

    -- Average turnaround time
    SELECT avg(completed_at - created_at) INTO v_avg_turnaround
    FROM public.work_orders
    WHERE status = 'Completed' 
    AND completed_at IS NOT NULL
    AND created_at BETWEEN p_start_date AND p_end_date;
    
    v_avg_turnaround_hours := COALESCE(extract(epoch from v_avg_turnaround) / 3600, 0);

    -- Bottleneck detection (longest stage delays)
    WITH stage_delays AS (
        SELECT 
            ws.stage,
            avg(COALESCE(ws.completed_at, now()) - ws.started_at) as avg_duration
        FROM public.work_order_stages ws
        JOIN public.work_orders wo ON wo.id = ws.work_order_id
        WHERE wo.created_at BETWEEN p_start_date AND p_end_date
        AND ws.started_at IS NOT NULL
        GROUP BY ws.stage
    )
    SELECT json_object_agg(stage, avg_duration) INTO v_bottleneck_stages
    FROM stage_delays
    ORDER BY avg_duration DESC;

    -- Rework rate
    SELECT count(DISTINCT work_order_id) INTO v_reopened_count
    FROM public.repair_tasks
    WHERE status = 'reopened'
    AND updated_at BETWEEN p_start_date AND p_end_date;
    
    v_rework_rate := CASE 
        WHEN v_total_serviced > 0 THEN (v_reopened_count::numeric / v_total_serviced) * 100 
        ELSE 0 
    END;

    -- Overdue work orders (older than 7 days and not completed)
    SELECT count(*) INTO v_overdue_count
    FROM public.work_orders
    WHERE status NOT IN ('Completed', 'Delivered', 'Cancelled')
    AND created_at < (now() - interval '7 days')
    AND created_at BETWEEN p_start_date AND p_end_date;

    -- Urgent/High priority jobs
    SELECT count(*) INTO v_urgent_count
    FROM public.work_orders
    WHERE priority IN ('Urgent', 'High')
    AND status NOT IN ('Completed', 'Delivered', 'Cancelled')
    AND created_at BETWEEN p_start_date AND p_end_date;

    v_result := json_build_object(
        'total_serviced', v_total_serviced,
        'daily_serviced', v_daily_serviced,
        'weekly_serviced', v_weekly_serviced,
        'monthly_serviced', v_monthly_serviced,
        'status_counts', v_status_counts,
        'stage_counts', v_stage_counts,
        'avg_turnaround_hours', v_avg_turnaround_hours,
        'bottleneck_stages', v_bottleneck_stages,
        'rework_rate', ROUND(v_rework_rate, 2),
        'reopened_count', v_reopened_count,
        'overdue_count', v_overdue_count,
        'urgent_count', v_urgent_count
    );

    RETURN v_result;
END;
$$;


ALTER FUNCTION "public"."get_comprehensive_operational_analytics"("p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone, "p_service_type" "text", "p_department" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_customer_insights"("p_start_date" timestamp with time zone DEFAULT ("now"() - '30 days'::interval), "p_end_date" timestamp with time zone DEFAULT "now"()) RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_result JSON;
    v_new_customers integer;
    v_returning_customers integer;
    v_avg_wait_time interval;
    v_avg_wait_time_minutes numeric;
    v_vehicles_per_customer numeric;
    v_repeat_service_freq json;
    v_delayed_delivery_count integer;
BEGIN
    -- New vs Returning Customers
    SELECT 
        COUNT(DISTINCT CASE WHEN created_at >= p_start_date THEN customer_id END),
        COUNT(DISTINCT CASE WHEN created_at < p_start_date THEN customer_id END)
    INTO v_new_customers, v_returning_customers
    FROM public.work_orders
    WHERE created_at BETWEEN p_start_date AND p_end_date;

    -- Average wait time (from created_at to first stage start)
    SELECT avg(first_stage_started - created_at) INTO v_avg_wait_time
    FROM (
        SELECT 
            wo.created_at,
            MIN(ws.started_at) as first_stage_started
        FROM public.work_orders wo
        LEFT JOIN public.work_order_stages ws ON ws.work_order_id = wo.id
        WHERE wo.created_at BETWEEN p_start_date AND p_end_date
        GROUP BY wo.id, wo.created_at
    ) t;

    v_avg_wait_time_minutes := COALESCE(extract(epoch from v_avg_wait_time) / 60, 0);

    -- Average vehicles per customer
    SELECT 
        AVG(vehicle_count) INTO v_vehicles_per_customer
    FROM (
        SELECT customer_id, COUNT(DISTINCT vehicle_id) as vehicle_count
        FROM public.work_orders
        WHERE created_at BETWEEN p_start_date AND p_end_date
        GROUP BY customer_id
    ) vc;

    -- Repeat service frequency
    SELECT json_object_agg(service_type, repeat_count) INTO v_repeat_service_freq
    FROM (
        SELECT 
            service_type,
            COUNT(*) filter (
                WHERE vehicle_id IN (
                    SELECT vehicle_id 
                    FROM public.work_orders wo2 
                    WHERE wo2.created_at < p_start_date
                )
            ) as repeat_count
        FROM public.work_orders wo1
        WHERE wo1.created_at BETWEEN p_start_date AND p_end_date
        GROUP BY service_type
    ) rs;

    -- Delayed delivery count (completed but not delivered within 24h)
    SELECT count(*) INTO v_delayed_delivery_count
    FROM public.work_orders
    WHERE status = 'Completed'
    AND completed_at < (now() - interval '24 hours')
    AND created_at BETWEEN p_start_date AND p_end_date;

    v_result := json_build_object(
        'new_customers', v_new_customers,
        'returning_customers', v_returning_customers,
        'total_customers_served', v_new_customers + v_returning_customers,
        'avg_wait_time_minutes', ROUND(v_avg_wait_time_minutes, 2),
        'avg_vehicles_per_customer', ROUND(v_vehicles_per_customer, 2),
        'repeat_service_frequency', v_repeat_service_freq,
        'delayed_delivery_count', v_delayed_delivery_count
    );

    RETURN v_result;
END;
$$;


ALTER FUNCTION "public"."get_customer_insights"("p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_dashboard_summary"("p_start_date" timestamp with time zone DEFAULT ("now"() - '30 days'::interval), "p_end_date" timestamp with time zone DEFAULT "now"()) RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_operational json;
    v_financial json;
    v_customer json;
    v_realtime json;
    v_bottlenecks json;
BEGIN
    v_operational := public.get_comprehensive_operational_analytics(p_start_date, p_end_date);
    v_financial := public.get_financial_analytics_v2(p_start_date, p_end_date);
    v_customer := public.get_customer_insights(p_start_date, p_end_date);
    v_realtime := public.get_realtime_status_indicators();
    v_bottlenecks := public.get_bottleneck_analysis(p_start_date, p_end_date);

    RETURN json_build_object(
        'operational', v_operational,
        'financial', v_financial,
        'customer', v_customer,
        'realtime', v_realtime,
        'bottlenecks', v_bottlenecks,
        'generated_at', now()
    );
END;
$$;


ALTER FUNCTION "public"."get_dashboard_summary"("p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_employee_active_workload"("p_employee_id" "uuid") RETURNS TABLE("assignment_id" "uuid", "work_order_id" "uuid", "service_id" "uuid", "service_type" "text", "vehicle_number" "text", "vehicle_model" "text", "customer_name" "text", "status" "text", "queue_position" integer, "total_tasks" bigint, "completed_tasks" bigint, "progress_percentage" numeric, "assigned_at" timestamp with time zone, "is_reopened" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        sae.id as assignment_id,
        wo.id as work_order_id,
        s.id as service_id,
        s.service_type,
        v.vehicle_number,
        v.model as vehicle_model,
        c.name as customer_name,
        sae.status as status,
        sae.queue_position,
        COUNT(t.id) as total_tasks,
        COUNT(CASE WHEN t.completed THEN 1 END) as completed_tasks,
        CASE 
            WHEN COUNT(t.id) > 0 THEN (COUNT(CASE WHEN t.completed THEN 1 END) * 100.0 / COUNT(t.id))::numeric(5,2)
            ELSE 0 
        END as progress_percentage,
        sae.assigned_at,
        wo.is_reopened
    FROM public.work_order_service_employees sae
    JOIN public.work_order_services s ON s.id = sae.service_id
    JOIN public.work_orders wo ON wo.id = s.work_order_id
    LEFT JOIN public.vehicles v ON v.id = wo.vehicle_id
    LEFT JOIN public.customers c ON c.id = v.customer_id
    LEFT JOIN public.work_order_tasks t ON t.work_order_id = wo.id 
        AND (t.assigned_employee_id = sae.employee_id OR t.assigned_employee_id IS NULL)
    WHERE sae.employee_id = p_employee_id
    AND sae.status NOT IN ('completed', 'cancelled')
    AND wo.status NOT IN ('Completed', 'Approved', 'Delivered', 'Finalized') -- Filter out completed work orders
    GROUP BY sae.id, wo.id, s.id, s.service_type, v.vehicle_number, v.model, c.name, sae.status, sae.queue_position, sae.assigned_at, wo.is_reopened
    ORDER BY sae.queue_position ASC, sae.assigned_at DESC;
END;
$$;


ALTER FUNCTION "public"."get_employee_active_workload"("p_employee_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_employee_analytics"("p_start_date" timestamp with time zone DEFAULT ("now"() - '30 days'::interval), "p_end_date" timestamp with time zone DEFAULT "now"()) RETURNS TABLE("employee_name" "text", "department" "text", "completed_tasks" bigint, "avg_task_completion_minutes" numeric, "acceptance_rate" numeric)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    WITH raw_completed_work AS (
        -- Source 1: Granular tasks (Highest priority for counting)
        SELECT 
            t.assigned_employee_id as employee_id, 
            t.id as unit_id,
            COALESCE(t.completed_at, t.updated_at) as finished_at,
            GREATEST(1, EXTRACT(EPOCH FROM (COALESCE(t.completed_at, t.updated_at) - t.created_at)) / 60) as duration_minutes
        FROM public.work_order_tasks t
        WHERE t.completed = true 
          AND t.assigned_employee_id IS NOT NULL
          AND (COALESCE(t.completed_at, t.updated_at) BETWEEN p_start_date AND p_end_date OR COALESCE(t.completed_at, t.updated_at) IS NULL)

        UNION ALL

        -- Source 2: Service assignments that DO NOT have granular tasks assigned to the same employee
        -- This prevents double counting the service and its constituent tasks
        SELECT 
            sae.employee_id, 
            sae.id as unit_id,
            COALESCE(sae.completed_at, sae.updated_at) as finished_at,
            GREATEST(1, EXTRACT(EPOCH FROM (COALESCE(sae.completed_at, sae.updated_at) - COALESCE(sae.accepted_at, sae.assigned_at, sae.created_at))) / 60) as duration_minutes
        FROM public.work_order_service_employees sae
        JOIN public.work_order_services s ON s.id = sae.service_id
        WHERE (LOWER(sae.status) IN ('completed', 'approved', 'pending_approval') 
           OR LOWER(s.status) IN ('completed', 'approved', 'pending approval'))
          AND (COALESCE(sae.completed_at, sae.updated_at) BETWEEN p_start_date AND p_end_date OR COALESCE(sae.completed_at, sae.updated_at) IS NULL)
          AND NOT EXISTS (
              SELECT 1 FROM public.work_order_tasks t 
              WHERE t.service_id = sae.service_id 
              AND t.assigned_employee_id = sae.employee_id
              AND t.completed = true
          )

        UNION ALL

        -- Source 3: Legacy Assignments
        SELECT 
            woa.employee_id, 
            woa.id as unit_id,
            COALESCE(woa.completed_at, woa.updated_at) as finished_at,
            GREATEST(1, EXTRACT(EPOCH FROM (COALESCE(woa.completed_at, woa.updated_at) - COALESCE(woa.accepted_at, woa.assigned_at, woa.created_at))) / 60) as duration_minutes
        FROM public.work_order_assignments woa
        WHERE (LOWER(woa.status) = 'completed' OR woa.completed_at IS NOT NULL)
          AND (COALESCE(woa.completed_at, woa.updated_at) BETWEEN p_start_date AND p_end_date OR COALESCE(woa.completed_at, woa.updated_at) IS NULL)
    ),
    summarized_metrics AS (
        SELECT 
            employee_id,
            COUNT(*) as completed_count,
            AVG(duration_minutes) as avg_minutes 
        FROM raw_completed_work
        GROUP BY employee_id
    ),
    acceptance_stats AS (
        SELECT 
            sae.employee_id,
            (COUNT(*) FILTER (WHERE LOWER(status) NOT IN ('assigned', 'rejected'))::numeric / NULLIF(COUNT(*), 0)) * 100 as rate
        FROM public.work_order_service_employees sae
        WHERE (assigned_at BETWEEN p_start_date AND p_end_date OR assigned_at IS NULL)
        GROUP BY employee_id
    )
    SELECT 
        e.name as employee_name,
        COALESCE(p.department, 'General') as department,
        COALESCE(sm.completed_count, 0)::bigint as completed_tasks,
        COALESCE(sm.avg_minutes, 0) as avg_task_completion_minutes,
        COALESCE(asig.rate, 100) as acceptance_rate
    FROM public.employees e
    LEFT JOIN public.positions p ON e.position_id = p.id
    LEFT JOIN summarized_metrics sm ON sm.employee_id = e.id
    LEFT JOIN acceptance_stats asig ON asig.employee_id = e.id
    GROUP BY e.id, e.name, p.department, sm.completed_count, sm.avg_minutes, asig.rate
    ORDER BY completed_tasks DESC;
END;
$$;


ALTER FUNCTION "public"."get_employee_analytics"("p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_employee_id_from_user"("p_user_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_employee_id uuid;
BEGIN
    -- 1. Try to find employee by user_id
    SELECT id INTO v_employee_id FROM public.employees WHERE user_id = p_user_id;
    
    -- 2. If not found, check if the input itself is an employee_id
    IF v_employee_id IS NULL THEN
        SELECT id INTO v_employee_id FROM public.employees WHERE id = p_user_id;
    END IF;
    
    RETURN v_employee_id;
END;
$$;


ALTER FUNCTION "public"."get_employee_id_from_user"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_employee_performance_metrics"("p_start_date" timestamp with time zone DEFAULT ("now"() - '30 days'::interval), "p_end_date" timestamp with time zone DEFAULT "now"(), "p_employee_id" "uuid" DEFAULT NULL::"uuid", "p_department" "text" DEFAULT NULL::"text") RETURNS TABLE("employee_id" "uuid", "employee_name" "text", "department" "text", "work_orders_handled" bigint, "repair_tasks_completed" bigint, "avg_task_completion_minutes" numeric, "acceptance_count" bigint, "rejection_count" bigint, "acceptance_rate" numeric, "productivity_score" numeric, "idle_time_minutes" numeric, "active_work_minutes" numeric)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        e.id as employee_id,
        e.name as employee_name,
        COALESCE(p.department, 'General') as department,
        COUNT(DISTINCT wo.id) as work_orders_handled,
        COUNT(DISTINCT rt.id) filter (where rt.status = 'completed') as repair_tasks_completed,
        COALESCE(AVG(EXTRACT(EPOCH FROM (rt.completed_at - rt.created_at)) / 60.0) FILTER (WHERE rt.status = 'completed'), 0) as avg_task_completion_minutes,
        COUNT(DISTINCT sae.id) filter (where sae.status = 'Accepted') as acceptance_count,
        COUNT(DISTINCT sae.id) filter (where sae.status = 'Rejected') as rejection_count,
        CASE 
            WHEN COUNT(DISTINCT sae.id) > 0 
            THEN (COUNT(DISTINCT sae.id) filter (where sae.status = 'Accepted')::numeric / COUNT(DISTINCT sae.id)) * 100
            ELSE 100 
        END as acceptance_rate,
        CASE 
            WHEN COUNT(DISTINCT sae.id) > 0 
            THEN ((COUNT(DISTINCT rt.id) filter (where rt.status = 'completed'))::numeric / NULLIF(COUNT(DISTINCT sae.id), 0)) * 100
            ELSE 0 
        END as productivity_score,
        0 as idle_time_minutes,
        COALESCE(SUM(EXTRACT(EPOCH FROM (rt.completed_at - rt.created_at)) / 60.0) FILTER (WHERE rt.status = 'completed'), 0) as active_work_minutes
    FROM public.employees e
    LEFT JOIN public.positions p ON e.position_id = p.id
    LEFT JOIN public.work_order_service_employees sae ON sae.employee_id = e.id 
        AND sae.assigned_at BETWEEN p_start_date AND p_end_date
    LEFT JOIN public.work_order_services wos ON wos.id = sae.service_id
    LEFT JOIN public.work_orders wo ON wo.id = wos.work_order_id
    LEFT JOIN public.repair_tasks rt ON rt.completed_by = e.id 
        AND rt.completed_at BETWEEN p_start_date AND p_end_date
    WHERE (p_employee_id IS NULL OR e.id = p_employee_id)
    AND (p_department IS NULL OR p.department = p_department)
    GROUP BY e.id, e.name, p.department;
END;
$$;


ALTER FUNCTION "public"."get_employee_performance_metrics"("p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone, "p_employee_id" "uuid", "p_department" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_financial_analytics"("p_start_date" timestamp with time zone DEFAULT ("now"() - '30 days'::interval), "p_end_date" timestamp with time zone DEFAULT "now"()) RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_total_revenue numeric;
    v_revenue_by_service json;
    v_avg_invoice numeric;
BEGIN
    -- Total Revenue (Based on work order estimated_cost or actual invoices if available)
    SELECT sum(estimated_cost), avg(estimated_cost) INTO v_total_revenue, v_avg_invoice
    FROM public.work_orders
    WHERE (status = 'Completed' OR status = 'Approved')
    AND created_at BETWEEN p_start_date AND p_end_date;

    -- Revenue by Service Type
    SELECT json_object_agg(service_type, total) INTO v_revenue_by_service
    FROM (
        SELECT service_type, sum(estimated_cost) as total
        FROM public.work_orders
        WHERE (status = 'Completed' OR status = 'Approved')
        AND created_at BETWEEN p_start_date AND p_end_date
        GROUP BY service_type
    ) ss;

    RETURN json_build_object(
        'total_revenue', COALESCE(v_total_revenue, 0),
        'avg_invoice', COALESCE(v_avg_invoice, 0),
        'revenue_by_service', v_revenue_by_service
    );
END;
$$;


ALTER FUNCTION "public"."get_financial_analytics"("p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_financial_analytics_v2"("p_start_date" timestamp with time zone DEFAULT ("now"() - '30 days'::interval), "p_end_date" timestamp with time zone DEFAULT "now"(), "p_service_type" "text" DEFAULT NULL::"text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_result JSON;
    v_total_revenue numeric;
    v_daily_revenue json;
    v_monthly_revenue json;
    v_yearly_revenue json;
    v_revenue_by_service json;
    v_avg_invoice numeric;
    v_pending_payments numeric;
    v_collected_payments numeric;
    v_total_deductions numeric;
    v_realization_rate numeric;
BEGIN
    -- 1. Total Billed Revenue (Gross)
    SELECT 
        COALESCE(SUM(total), 0),
        COALESCE(AVG(total), 0)
    INTO v_total_revenue, v_avg_invoice
    FROM public.invoices
    WHERE status != 'Draft'
    AND created_at BETWEEN p_start_date AND p_end_date;

    -- 2. Daily Billed Revenue
    SELECT json_object_agg(date_key, amount) INTO v_daily_revenue
    FROM (
        SELECT to_char(created_at::date, 'YYYY-MM-DD') as date_key, SUM(total) as amount
        FROM public.invoices
        WHERE status != 'Draft'
        AND created_at BETWEEN p_start_date AND p_end_date
        GROUP BY created_at::date
        ORDER BY created_at::date
    ) d;

    -- 3. Revenue by Service Type
    SELECT json_object_agg(service_type, total) INTO v_revenue_by_service
    FROM (
        SELECT wo.service_type, SUM(inv.total) as total
        FROM public.invoices inv
        JOIN public.work_orders wo ON inv.work_order_id = wo.id
        WHERE inv.status != 'Draft'
        AND inv.created_at BETWEEN p_start_date AND p_end_date
        AND (p_service_type IS NULL OR wo.service_type = p_service_type)
        GROUP BY wo.service_type
    ) ss;

    -- 4. Actual Cash Collected (Net Revenue)
    -- Sum of amount_applied from approved payments in the period
    SELECT 
        COALESCE(SUM(pl.amount_applied), 0)
    INTO v_collected_payments
    FROM public.payment_links pl
    JOIN public.payments p ON pl.payment_id = p.id
    WHERE p.status = 'approved'
    AND p.created_at BETWEEN p_start_date AND p_end_date;

    -- 5. Total Deductions
    -- For invoices created in the period
    SELECT 
        COALESCE(SUM(total_deductions), 0)
    INTO v_total_deductions
    FROM public.invoices
    WHERE status != 'Draft'
    AND created_at BETWEEN p_start_date AND p_end_date;

    -- 6. Total Outstanding (Billed - Collected - Deductions)
    -- This is tricky across periods, but for the period's invoices:
    SELECT 
        COALESCE(SUM(total - total_deductions), 0) - v_collected_payments
    INTO v_pending_payments
    FROM public.invoices
    WHERE status != 'Draft'
    AND created_at BETWEEN p_start_date AND p_end_date;
    
    -- Ensure pending is not negative (if payments from previous periods were high)
    v_pending_payments := GREATEST(0, v_pending_payments);

    -- 7. Calculate Realization Rate
    -- Realization Rate = (Collected) / (Total Billed In Period) * 100
    -- Or more accurately: Collected / (Collected + Deductions)
    IF (v_collected_payments + v_total_deductions) > 0 THEN
        v_realization_rate := (v_collected_payments / (v_collected_payments + v_total_deductions)) * 100;
    ELSE
        v_realization_rate := 100;
    END IF;

    v_result := json_build_object(
        'total_revenue', ROUND(v_total_revenue, 2), -- Billed
        'collected_payments', ROUND(v_collected_payments, 2), -- Net Cash
        'daily_revenue', v_daily_revenue,
        'revenue_by_service', v_revenue_by_service,
        'avg_invoice_value', ROUND(v_avg_invoice, 2),
        'pending_payments', ROUND(v_pending_payments, 2),
        'total_deductions', ROUND(v_total_deductions, 2),
        'realization_rate', ROUND(v_realization_rate, 2),
        'total_outstanding', ROUND(v_pending_payments, 2)
    );

    RETURN v_result;
END;
$$;


ALTER FUNCTION "public"."get_financial_analytics_v2"("p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone, "p_service_type" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_operational_analytics"("p_start_date" timestamp with time zone DEFAULT ("now"() - '30 days'::interval), "p_end_date" timestamp with time zone DEFAULT "now"()) RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_total_serviced integer;
    v_status_counts json;
    v_avg_turnaround_hours numeric;
    v_rework_rate numeric;
BEGIN
    -- 1. Total vehicles serviced in window (Completed/Delivered/Approved)
    SELECT count(*) INTO v_total_serviced
    FROM public.work_orders
    WHERE lower(status) IN ('completed', 'approved', 'delivered')
    AND (
        COALESCE(completed_at, updated_at, created_at) BETWEEN p_start_date AND p_end_date
    );

    -- 2. Aggregate Status Counts (Normalized to lowercase keys)
    SELECT json_object_agg(grp_status, grp_count) INTO v_status_counts
    FROM (
        SELECT lower(status) as grp_status, count(*) as grp_count
        FROM public.work_orders
        WHERE 
            -- Case A: Any active order (Always count)
            lower(status) NOT IN ('completed', 'approved', 'delivered', 'cancelled', 'rejected')
            OR
            -- Case B: Finished orders (Count only if in window)
            (
                lower(status) IN ('completed', 'approved', 'delivered', 'cancelled', 'rejected')
                AND (COALESCE(completed_at, updated_at, created_at) BETWEEN p_start_date AND p_end_date)
            )
        GROUP BY lower(status)
    ) s;

    -- 3. Calculate Average Turnaround
    SELECT COALESCE(extract(epoch from avg(completed_at - created_at)) / 3600, 0)
    INTO v_avg_turnaround_hours
    FROM public.work_orders
    WHERE lower(status) IN ('completed', 'approved', 'delivered')
    AND completed_at IS NOT NULL
    AND completed_at BETWEEN p_start_date AND p_end_date;

    -- 4. Calculate Rework Rate
    BEGIN
        SELECT (count(*)::numeric / NULLIF(v_total_serviced, 0)) * 100 INTO v_rework_rate
        FROM public.repair_task_history
        WHERE lower(action) IN ('reopened', 'rework')
        AND performed_at BETWEEN p_start_date AND p_end_date;
    EXCEPTION WHEN OTHERS THEN
        v_rework_rate := 0;
    END;

    RETURN json_build_object(
        'total_serviced', COALESCE(v_total_serviced, 0),
        'status_counts', COALESCE(v_status_counts, '{}'::json),
        'avg_turnaround_hours', COALESCE(v_avg_turnaround_hours, 0),
        'rework_rate', COALESCE(v_rework_rate, 0)
    );
END;
$$;


ALTER FUNCTION "public"."get_operational_analytics"("p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_realtime_status_indicators"() RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_result JSON;
    v_stage_counts json;
    v_urgent_jobs integer;
    v_overdue_work_orders integer;
    v_sla_breaches integer;
BEGIN
    -- Live vehicle count in each stage
    SELECT json_object_agg(stage, count) INTO v_stage_counts
    FROM (
        SELECT 
            COALESCE(current_stage, 'Unknown') as stage,
            count(*) as count
        FROM public.work_orders
        WHERE status NOT IN ('Completed', 'Delivered', 'Cancelled')
        GROUP BY current_stage
    ) s;

    -- Urgent/High priority active jobs
    SELECT count(*) INTO v_urgent_jobs
    FROM public.work_orders
    WHERE priority IN ('Urgent', 'High')
    AND status NOT IN ('Completed', 'Delivered', 'Cancelled');

    -- Overdue work orders (created more than 7 days ago, not completed)
    SELECT count(*) INTO v_overdue_work_orders
    FROM public.work_orders
    WHERE status NOT IN ('Completed', 'Delivered', 'Cancelled')
    AND created_at < (now() - interval '7 days');

    -- SLA breach alerts (estimated completion exceeded)
    SELECT count(*) INTO v_sla_breaches
    FROM public.work_orders
    WHERE status NOT IN ('Completed', 'Delivered', 'Cancelled')
    AND estimated_cost > 0
    AND created_at < (now() - interval '3 days');

    v_result := json_build_object(
        'stage_counts', v_stage_counts,
        'urgent_jobs', v_urgent_jobs,
        'overdue_work_orders', v_overdue_work_orders,
        'sla_breaches', v_sla_breaches,
        'active_total', (
            SELECT count(*) 
            FROM public.work_orders 
            WHERE status NOT IN ('Completed', 'Delivered', 'Cancelled')
        )
    );

    RETURN v_result;
END;
$$;


ALTER FUNCTION "public"."get_realtime_status_indicators"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_service_department_metrics"("p_start_date" timestamp with time zone DEFAULT ("now"() - '30 days'::interval), "p_end_date" timestamp with time zone DEFAULT "now"()) RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_result JSON;
    v_service_types json;
    v_repair_vs_maintenance json;
    v_department_workload json;
    v_service_efficiency json;
    v_repeat_repair_freq json;
BEGIN
    -- Most requested service types
    SELECT json_object_agg(service_type, count) INTO v_service_types
    FROM (
        SELECT service_type, count(*) as count
        FROM public.work_orders
        WHERE created_at BETWEEN p_start_date AND p_end_date
        GROUP BY service_type
        ORDER BY count DESC
        LIMIT 10
    ) s;

    -- Repair vs Maintenance ratio
    WITH service_categories AS (
        SELECT 
            CASE 
                WHEN LOWER(service_type) LIKE '%repair%' OR LOWER(service_type) LIKE '%overhaul%' OR LOWER(service_type) LIKE '%fix%' THEN 'Repair'
                WHEN LOWER(service_type) LIKE '%service%' OR LOWER(service_type) LIKE '%maintenance%' OR LOWER(service_type) LIKE '%check%' THEN 'Maintenance'
                ELSE 'Other'
            END as category,
            count(*) as count
        FROM public.work_orders
        WHERE created_at BETWEEN p_start_date AND p_end_date
        GROUP BY 1
    )
    SELECT json_object_agg(category, count) INTO v_repair_vs_maintenance
    FROM service_categories;

    -- Department-wise workload distribution
    SELECT json_object_agg(department, workload) INTO v_department_workload
    FROM (
        SELECT 
            COALESCE(p.department, 'Unassigned') as department,
            count(DISTINCT sae.id) as workload
        FROM public.positions p
        JOIN public.employees e ON e.position_id = p.id
        LEFT JOIN public.work_order_service_employees sae ON sae.employee_id = e.id
            AND sae.assigned_at BETWEEN p_start_date AND p_end_date
        GROUP BY p.department
    ) d;

    -- Completion efficiency by department
    SELECT json_object_agg(department, efficiency) INTO v_service_efficiency
    FROM (
        SELECT 
            COALESCE(p.department, 'Unknown') as department,
            CASE 
                WHEN COUNT(sae.id) > 0 
                THEN (COUNT(*) filter (where wos.status = 'completed')::numeric / COUNT(sae.id)) * 100
                ELSE 0
            END as efficiency
        FROM public.positions p
        JOIN public.employees e ON e.position_id = p.id
        LEFT JOIN public.work_order_service_employees sae ON sae.employee_id = e.id
        LEFT JOIN public.work_order_services wos ON wos.id = sae.service_id
        WHERE sae.assigned_at BETWEEN p_start_date AND p_end_date
        GROUP BY p.department
    ) eff;

    -- Repeat repair frequency per service type
    SELECT json_object_agg(service_type, repeat_count) INTO v_repeat_repair_freq
    FROM (
        SELECT 
            wo.service_type,
            count(DISTINCT wo.vehicle_id) filter (
                WHERE wo.id IN (
                    SELECT work_order_id FROM public.repair_tasks WHERE status = 'reopened'
                )
            ) as repeat_count
        FROM public.work_orders wo
        WHERE wo.created_at BETWEEN p_start_date AND p_end_date
        GROUP BY wo.service_type
    ) rr;

    v_result := json_build_object(
        'service_types', v_service_types,
        'repair_vs_maintenance', v_repair_vs_maintenance,
        'department_workload', v_department_workload,
        'service_efficiency', v_service_efficiency,
        'repeat_repair_frequency', v_repeat_repair_freq
    );

    RETURN v_result;
END;
$$;


ALTER FUNCTION "public"."get_service_department_metrics"("p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_staff_assigned_work"("p_user_id" "uuid") RETURNS TABLE("assignment_id" "uuid", "employee_id" "uuid", "assignment_status" "text", "assigned_at" timestamp with time zone, "accepted_at" timestamp with time zone, "completed_at" timestamp with time zone, "queue_position" integer, "service_id" "uuid", "work_order_id" "uuid", "service_type" "text", "service_status" "text", "description" "text", "priority" "text", "current_stage" "text", "estimated_cost" numeric, "created_at" timestamp with time zone, "vehicle_number" "text", "vehicle_model" "text", "customer_name" "text", "company_name" "text", "work_order_status" "text", "inspection_status" "text", "repair_status" "text", "review_status" "text", "customer_visible" boolean, "is_reopened" boolean, "reopen_reason" "text", "tasks" json)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        sae.id as assignment_id,
        sae.employee_id,
        sae.status as assignment_status,
        sae.assigned_at,
        sae.accepted_at,
        sae.completed_at,
        sae.queue_position,
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
        c.company_name, -- Added
        wo.status as work_order_status,
        wo.inspection_status,
        wo.repair_status,
        wo.review_status,
        wo.customer_visible,
        wo.is_reopened,
        wo.reopen_reason,
        (
            SELECT json_agg(
                json_build_object(
                    'id', t.id,
                    'task_name', t.task_name,
                    'task_type', t.task_type,
                    'service_id', t.service_id,
                    'is_completed', t.completed,
                    'completed_at', t.completed_at,
                    'is_rejected', t.is_rejected,
                    'rejection_reason', t.rejection_reason
                ) ORDER BY t.sequence_order
            )
            FROM public.work_order_tasks t
            WHERE t.service_id = s.id -- FIXED: Filter by service_id instead of work_order_id
            AND (t.assigned_employee_id = sae.employee_id OR t.assigned_employee_id IS NULL)
        ) as tasks
    FROM public.work_order_service_employees sae
    JOIN public.employees e ON e.id = sae.employee_id
    JOIN public.work_order_services s ON s.id = sae.service_id
    JOIN public.work_orders wo ON wo.id = s.work_order_id
    LEFT JOIN public.vehicles v ON v.id = wo.vehicle_id
    LEFT JOIN public.customers c ON c.id = v.customer_id
    WHERE e.user_id = p_user_id
    AND sae.status IN ('Accepted', 'pending_acceptance', 'completed') -- Only show released assignments
    AND sae.status NOT IN ('Assigned') -- Exclude assignments pending admin approval
    ORDER BY 
        sae.queue_position ASC,
        CASE wo.priority 
            WHEN 'Urgent' THEN 1 
            WHEN 'High' THEN 2 
            WHEN 'Medium' THEN 3 
            WHEN 'Low' THEN 4 
            ELSE 5 
        END,
        wo.created_at DESC;
END;
$$;


ALTER FUNCTION "public"."get_staff_assigned_work"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_invoice_finalization"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    -- Logic triggers when an invoice is moved from 'Draft' to a Finalized status
    -- Finalized statuses: 'Sent', 'Unpaid', 'Paid', 'Pending Payment', 'Payment Verification Pending', 'Overdue'
    -- We assume 'Draft' is the only non-final state.
    
    IF (OLD.status = 'Draft' AND NEW.status != 'Draft') THEN
        
        -- CASE A: It is a QUOTATION
        IF (NEW.type = 'quotation') THEN
            -- Assign Quotation Number if not present
            IF (NEW.quotation_number IS NULL) THEN
                 NEW.quotation_number := nextval('public.quotation_number_seq');
            END IF;
            
            -- Prevent Bill Number assignment (Tax Invoice compliance)
            -- If the row has a bill_number (e.g. from default), we nullify it to avoid consuming the sequence or confusing the system.
            -- However, be careful if the logic relies on bill_number. 
            -- Given the requirement "separate bill no", we ensure it has its OWN number.
            NEW.bill_number := NULL; 
        
        -- CASE B: It is a TAX INVOICE (type 'invoice' or null)
        ELSIF (NEW.type = 'invoice' OR NEW.type IS NULL) THEN
            -- Assign Bill Number if not present
            IF (NEW.bill_number IS NULL) THEN
                NEW.bill_number := nextval('public.invoice_bill_number_seq');
            END IF;
            
            -- Ensure it doesn't have a quotation number
            NEW.quotation_number := NULL; 
        END IF;
        
    END IF;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_invoice_finalization"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      split_part(NEW.email, '@', 1)
    )
  );
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_work_order"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    PERFORM public.create_work_order_stages(new.id);
    RETURN new;
END;
$$;


ALTER FUNCTION "public"."handle_new_work_order"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_queue_reorder"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."handle_queue_reorder"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = _user_id AND role = _role
    );
END;
$$;


ALTER FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."insert_work_order_assignment"("p_work_order_id" "uuid", "p_employee_id" "uuid", "p_notes" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    -- Use SECURITY DEFINER to bypass RLS
    INSERT INTO public.work_order_assignments 
        (work_order_id, employee_id, status, assigned_at, notes)
    VALUES 
        (p_work_order_id, p_employee_id, 'assigned', now(), p_notes)
    ON CONFLICT (work_order_id, employee_id) 
    DO UPDATE SET 
        notes = EXCLUDED.notes,
        updated_at = now();
END;
$$;


ALTER FUNCTION "public"."insert_work_order_assignment"("p_work_order_id" "uuid", "p_employee_id" "uuid", "p_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."insert_work_order_service_employee"("p_service_id" "uuid", "p_employee_id" "uuid", "p_status" "text" DEFAULT 'Assigned'::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    -- Use SECURITY DEFINER to bypass RLS
    INSERT INTO public.work_order_service_employees 
        (service_id, employee_id, status, assigned_at)
    VALUES 
        (p_service_id, p_employee_id, p_status, now())
    ON CONFLICT DO NOTHING;
END;
$$;


ALTER FUNCTION "public"."insert_work_order_service_employee"("p_service_id" "uuid", "p_employee_id" "uuid", "p_status" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."insert_work_order_service_employee"("p_service_id" "uuid", "p_employee_id" "uuid", "p_status" "text" DEFAULT 'Assigned'::"text", "p_queue_position" integer DEFAULT 0) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    -- Use SECURITY DEFINER to bypass RLS
    -- Simply insert without ON CONFLICT since we don't have a unique constraint
    INSERT INTO public.work_order_service_employees 
        (service_id, employee_id, status, assigned_at, queue_position)
    VALUES 
        (p_service_id, p_employee_id, p_status, now(), p_queue_position);
END;
$$;


ALTER FUNCTION "public"."insert_work_order_service_employee"("p_service_id" "uuid", "p_employee_id" "uuid", "p_status" "text", "p_queue_position" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin"("p_user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM auth.users u
        WHERE u.id = p_user_id
        AND u.email LIKE '%admin%'  -- Simple check: email contains 'admin'
    );
EXCEPTION
    WHEN OTHERS THEN RETURN false;
END;
$$;


ALTER FUNCTION "public"."is_admin"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."issue_part_request"("_request_id" "uuid", "_issued_qty" integer, "_employee_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_item_id UUID;
    v_reserved INTEGER;
    v_wo_id UUID;
    v_unit_price NUMERIC;
    v_item_name TEXT;
    v_current_issued INTEGER;
    v_approved_qty INTEGER;
    v_new_status TEXT;
BEGIN
    SELECT item_id, work_order_id, issued_qty, approved_qty 
    INTO v_item_id, v_wo_id, v_current_issued, v_approved_qty 
    FROM public.part_requests WHERE id = _request_id;
    
    SELECT reserved_qty, unit_price, item_name 
    INTO v_reserved, v_unit_price, v_item_name 
    FROM public.inventory WHERE id = v_item_id;

    IF _issued_qty > v_reserved THEN
        RAISE EXCEPTION 'Cannot issue more than reserved quantity';
    END IF;
    
    -- Determine new status
    IF (v_current_issued + _issued_qty) >= v_approved_qty THEN
        v_new_status := 'issued';
    ELSE
        v_new_status := 'approved'; -- Keep as approved so it appears in the scanner list
    END IF;

    -- Update request
    UPDATE public.part_requests 
    SET issued_qty = issued_qty + _issued_qty,
        status = v_new_status,
        updated_at = now()
    WHERE id = _request_id;

    -- Deduct from physical stock (was already removed from available during reservation)
    UPDATE public.inventory 
    SET reserved_qty = reserved_qty - _issued_qty,
        quantity = quantity - _issued_qty,
        updated_at = now()
    WHERE id = v_item_id;

    -- Add to work_order_parts for invoicing
    INSERT INTO public.work_order_parts (work_order_id, inventory_id, part_name, quantity, unit_price, added_by)
    VALUES (v_wo_id, v_item_id, v_item_name, _issued_qty, v_unit_price, _employee_id);

    -- Log transaction
    INSERT INTO public.inventory_transactions (item_id, type, quantity, reference_id, performed_by, notes)
    VALUES (v_item_id, 'issue', _issued_qty, _request_id, _employee_id, 'Part scanned and issued to work order');
END;
$$;


ALTER FUNCTION "public"."issue_part_request"("_request_id" "uuid", "_issued_qty" integer, "_employee_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_attendance_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    IF (TG_OP = 'UPDATE') THEN
        IF (OLD.status IS DISTINCT FROM NEW.status OR OLD.remarks IS DISTINCT FROM NEW.remarks) THEN
            INSERT INTO public.attendance_history (
                attendance_id,
                employee_id,
                date,
                old_status,
                new_status,
                old_remarks,
                new_remarks,
                changed_by
            ) VALUES (
                NEW.id,
                NEW.employee_id,
                NEW.date,
                OLD.status,
                NEW.status,
                OLD.remarks,
                NEW.remarks,
                NEW.updated_by
            );
        END IF;
    ELSIF (TG_OP = 'INSERT') THEN
        INSERT INTO public.attendance_history (
            attendance_id,
            employee_id,
            date,
            new_status,
            new_remarks,
            changed_by
        ) VALUES (
            NEW.id,
            NEW.employee_id,
            NEW.date,
            NEW.status,
            NEW.remarks,
            NEW.marked_by
        );
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."log_attendance_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."populate_missing_work_order_stages"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_created_count integer := 0;
    v_wo RECORD;
BEGIN
    -- Loop through all work orders that don't have stages
    FOR v_wo IN 
        SELECT wo.id 
        FROM public.work_orders wo
        LEFT JOIN public.work_order_stages wos ON wo.id = wos.work_order_id
        WHERE wos.id IS NULL
    LOOP
        PERFORM public.create_work_order_stages(v_wo.id);
        v_created_count := v_created_count + 1;
    END LOOP;
    
    RETURN v_created_count;
END;
$$;


ALTER FUNCTION "public"."populate_missing_work_order_stages"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."process_part_return"("_return_id" "uuid", "_status" "text", "_admin_id" "uuid", "_notes" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_item_id UUID;
    v_qty INTEGER;
    v_condition TEXT;
    v_wo_id UUID;
    v_request_id UUID;
BEGIN
    IF _status NOT IN ('approved', 'rejected') THEN
        RAISE EXCEPTION 'Invalid status.';
    END IF;

    SELECT inventory_id, quantity, condition, work_order_id 
    INTO v_item_id, v_qty, v_condition, v_wo_id 
    FROM public.inventory_returns 
    WHERE id = _return_id;

    UPDATE public.inventory_returns 
    SET status = _status, approved_by = _admin_id, notes = _notes, updated_at = now()
    WHERE id = _return_id;

    IF _status = 'approved' THEN
        UPDATE public.inventory 
        SET quantity = quantity + v_qty,
            available_qty = CASE WHEN v_condition != 'damaged' THEN available_qty + v_qty ELSE available_qty END,
            updated_at = now()
        WHERE id = v_item_id;

        UPDATE public.work_order_parts SET quantity = quantity - v_qty
        WHERE work_order_id = v_wo_id AND inventory_id = v_item_id;
        DELETE FROM public.work_order_parts WHERE work_order_id = v_wo_id AND inventory_id = v_item_id AND quantity <= 0;

        SELECT id INTO v_request_id FROM public.part_requests 
        WHERE work_order_id = v_wo_id AND item_id = v_item_id AND status IN ('issued', 'approved')
        ORDER BY created_at DESC LIMIT 1;

        IF v_request_id IS NOT NULL THEN
            UPDATE public.part_requests SET returned_qty = COALESCE(returned_qty, 0) + v_qty, updated_at = now()
            WHERE id = v_request_id;
        END IF;

        UPDATE public.inventory_units
        SET status = 'available',
            current_work_order_id = NULL,
            issued_by = NULL,
            updated_at = now()
        WHERE id IN (
            SELECT id FROM public.inventory_units 
            WHERE inventory_id = v_item_id AND status = 'issued' AND (current_work_order_id = v_wo_id OR current_work_order_id IS NULL)
            LIMIT v_qty
        );

        INSERT INTO public.inventory_transactions (item_id, type, quantity, reference_id, performed_by, notes)
        VALUES (v_item_id, 'return', v_qty, _return_id, _admin_id, 'Part return approved');
    END IF;
END;
$$;


ALTER FUNCTION "public"."process_part_return"("_return_id" "uuid", "_status" "text", "_admin_id" "uuid", "_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reject_inspection"("p_work_order_id" "uuid", "p_inspector_id" "uuid", "p_notes" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    UPDATE public.work_orders SET
        inspection_status = 'rejected',
        inspection_notes = p_notes,
        repairs_visible = false,
        updated_at = now()
    WHERE id = p_work_order_id;
END;
$$;


ALTER FUNCTION "public"."reject_inspection"("p_work_order_id" "uuid", "p_inspector_id" "uuid", "p_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reject_part_request"("_request_id" "uuid", "_admin_id" "uuid", "_notes" "text" DEFAULT 'Request rejected / cancelled'::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_item_id UUID;
    v_approved_qty INTEGER;
    v_status TEXT;
BEGIN
    -- Get request details
    SELECT item_id, approved_qty, status 
    INTO v_item_id, v_approved_qty, v_status 
    FROM public.part_requests 
    WHERE id = _request_id;

    IF v_status = 'issued' THEN
        RAISE EXCEPTION 'Cannot reject an already issued part. Use return instead.';
    END IF;

    -- 1. If it was already approved/reserved, restore stock
    IF v_status = 'approved' AND v_approved_qty > 0 THEN
        UPDATE public.inventory 
        SET available_qty = available_qty + v_approved_qty,
            reserved_qty = reserved_qty - v_approved_qty,
            updated_at = now()
        WHERE id = v_item_id;

        -- Log cancellation transaction
        INSERT INTO public.inventory_transactions (item_id, type, quantity, reference_id, performed_by, notes)
        VALUES (v_item_id, 'adjustment', v_approved_qty, _request_id, _admin_id, 'Reservation cancelled: ' || _notes);
    END IF;

    -- 2. Update request status
    UPDATE public.part_requests 
    SET status = 'rejected',
        notes = _notes,
        updated_at = now()
    WHERE id = _request_id;

END;
$$;


ALTER FUNCTION "public"."reject_part_request"("_request_id" "uuid", "_admin_id" "uuid", "_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reject_task"("_assignment_id" "uuid", "_assignment_type" "text", "_rejector_id" "uuid", "_notes" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    IF _assignment_type = 'legacy' THEN
        UPDATE public.work_order_assignments 
        SET status = 'in_progress', 
            approved_by = null,
            approved_at = null,
            approval_notes = _notes,
            updated_at = now()
        WHERE id = _assignment_id;
        
        -- Update work order back to in progress
        UPDATE public.work_orders 
        SET status = 'In Progress',
            customer_visible = false,
            updated_at = now()
        WHERE id = (SELECT work_order_id FROM public.work_order_assignments WHERE id = _assignment_id);
    ELSE
        UPDATE public.work_order_service_employees 
        SET status = 'in_progress', 
            approved_by = null,
            approved_at = null,
            approval_notes = _notes,
            updated_at = now()
        WHERE id = _assignment_id;
        
        -- Update service back to in progress
        UPDATE public.work_order_services 
        SET status = 'In Progress',
            approved_by = null,
            approved_at = null,
            updated_at = now()
        WHERE id = (SELECT service_id FROM public.work_order_service_employees WHERE id = _assignment_id);
        
        -- Update work order back to in progress
        UPDATE public.work_orders 
        SET status = 'In Progress',
            customer_visible = false,
            updated_at = now()
        WHERE id = (SELECT work_order_id FROM public.work_order_service_employees WHERE id = _assignment_id);
    END IF;
END;
$$;


ALTER FUNCTION "public"."reject_task"("_assignment_id" "uuid", "_assignment_type" "text", "_rejector_id" "uuid", "_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reject_work_tasks"("p_work_order_id" "uuid", "p_task_ids" "uuid"[], "p_reason" "text", "p_approver_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    -- 1. Update rejected tasks
    UPDATE public.work_order_tasks 
    SET is_rejected = true,
        rejection_reason = p_reason,
        rejected_at = now(),
        completed = false,
        completed_at = NULL,
        updated_at = now()
    WHERE id = ANY(p_task_ids) AND work_order_id = p_work_order_id;

    -- 2. Revert work order status to In Progress
    UPDATE public.work_orders 
    SET status = 'In Progress',
        repair_status = 'in_progress',
        updated_at = now()
    WHERE id = p_work_order_id;

    -- 3. Revert service statuses to In Progress
    UPDATE public.work_order_services 
    SET status = 'In Progress',
        updated_at = now()
    WHERE work_order_id = p_work_order_id;

    -- 4. Revert employee assignment statuses to Accepted (so they see it again)
    UPDATE public.work_order_service_employees 
    SET status = 'Accepted',
        updated_at = now()
    WHERE service_id IN (SELECT id FROM public.work_order_services WHERE work_order_id = p_work_order_id);

    -- 5. Add internal note about rejection
    INSERT INTO public.work_order_service_notes (service_id, note_type, note_content, is_internal, created_by)
    SELECT DISTINCT s.id, 'Issue', 'Tasks rejected: ' || p_reason, true, p_approver_id
    FROM public.work_order_services s
    WHERE s.work_order_id = p_work_order_id;
END;
$$;


ALTER FUNCTION "public"."reject_work_tasks"("p_work_order_id" "uuid", "p_task_ids" "uuid"[], "p_reason" "text", "p_approver_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."release_unissued_reservation"("_request_id" "uuid", "_admin_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_item_id UUID;
    v_approved_qty INTEGER;
    v_issued_qty INTEGER;
    v_remaining INTEGER;
BEGIN
    SELECT item_id, approved_qty, issued_qty 
    INTO v_item_id, v_approved_qty, v_issued_qty 
    FROM public.part_requests 
    WHERE id = _request_id;

    v_remaining := v_approved_qty - v_issued_qty;

    IF v_remaining <= 0 THEN
        RAISE EXCEPTION 'No remaining reservation to release.';
    END IF;

    -- 1. Restore stock to available pool
    UPDATE public.inventory 
    SET available_qty = available_qty + v_remaining,
        reserved_qty = reserved_qty - v_remaining,
        updated_at = now()
    WHERE id = v_item_id;

    -- 2. Update request so approved == issued (closing the reservation gap)
    UPDATE public.part_requests 
    SET approved_qty = issued_qty,
        notes = COALESCE(notes, '') || ' (Remainder ' || v_remaining || ' unissued units released back to stock at ' || now()::text || ')',
        updated_at = now()
    WHERE id = _request_id;

    -- 3. Log transaction
    INSERT INTO public.inventory_transactions (item_id, type, quantity, reference_id, performed_by, notes)
    VALUES (v_item_id, 'adjustment', v_remaining, _request_id, _admin_id, 'Released ' || v_remaining || ' unissued reserved units back to stock');
END;
$$;


ALTER FUNCTION "public"."release_unissued_reservation"("_request_id" "uuid", "_admin_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reopen_repair_task"("p_task_id" "uuid", "p_reopened_by" "uuid", "p_reason" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    UPDATE public.repair_tasks SET
        status = 'reopened',
        reopened_at = now(),
        reopened_by = p_reopened_by,
        completed_at = null,
        completed_by = null,
        notes = COALESCE(p_reason, notes) || ' | Reopened: ' || now()::text,
        updated_at = now()
    WHERE id = p_task_id;

    INSERT INTO public.repair_task_history (task_id, action, performed_by, notes)
    VALUES (p_task_id, 'reopened', p_reopened_by, p_reason);
END;
$$;


ALTER FUNCTION "public"."reopen_repair_task"("p_task_id" "uuid", "p_reopened_by" "uuid", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reopen_repairs"("p_work_order_id" "uuid", "p_reopened_by" "uuid", "p_reason" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_employee_id uuid;
BEGIN
    v_employee_id := public.get_employee_id_from_user(p_reopened_by);

    UPDATE public.work_orders SET
        repairs_approved = false,
        repairs_approved_at = null,
        repairs_approved_by = null,
        status = 'In Progress',
        updated_at = now()
    WHERE id = p_work_order_id;

    -- SYNC: Reset Repair stage to in_progress
    UPDATE public.work_order_stages 
    SET status = 'in_progress', 
        completed_at = null, 
        completed_by = null,
        updated_at = now()
    WHERE work_order_id = p_work_order_id AND stage = 'Repair';

    -- SYNC: Reopen all tasks
    UPDATE public.repair_tasks SET
        status = 'reopened',
        reopened_at = now(),
        reopened_by = v_employee_id,
        completed_at = null,
        completed_by = null,
        notes = COALESCE(notes, '') || ' | Reopened: ' || p_reason,
        updated_at = now()
    WHERE work_order_id = p_work_order_id;
END;
$$;


ALTER FUNCTION "public"."reopen_repairs"("p_work_order_id" "uuid", "p_reopened_by" "uuid", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reopen_task"("p_task_id" "uuid", "p_employee_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_service_id uuid;
    v_any_pending boolean;
BEGIN
    SELECT service_id INTO v_service_id 
    FROM public.work_order_service_tasks 
    WHERE id = p_task_id;

    UPDATE public.work_order_service_tasks 
    SET status = 'Pending', completed_at = null, updated_at = now()
    WHERE id = p_task_id;

    SELECT INTO v_any_pending 
    EXISTS (
        SELECT 1 FROM public.work_order_service_tasks 
        WHERE service_id = v_service_id AND status != 'Completed'
    );

    IF v_any_pending THEN
        UPDATE public.work_order_services 
        SET status = 'In Progress', updated_at = now()
        WHERE id = v_service_id;

        UPDATE public.work_orders 
        SET status = 'In Progress', updated_at = now()
        WHERE id = (SELECT work_order_id FROM public.work_order_services WHERE id = v_service_id);
    END IF;
END;
$$;


ALTER FUNCTION "public"."reopen_task"("p_task_id" "uuid", "p_employee_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reopen_work_order"("p_work_order_id" "uuid", "p_reason" "text", "p_admin_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    -- 1. Update work order status
    UPDATE public.work_orders 
    SET status = 'In Progress',
        is_reopened = true,
        reopen_reason = p_reason,
        reopened_at = now(),
        reopened_by = p_admin_id,
        completed_at = NULL,
        approved_at = NULL,
        approved_by = NULL,
        repair_status = 'in_progress',
        updated_at = now()
    WHERE id = p_work_order_id;

    -- 2. Revert service statuses
    UPDATE public.work_order_services 
    SET status = 'In Progress',
        completed_at = NULL,
        updated_at = now()
    WHERE work_order_id = p_work_order_id;

    -- 3. Revert employee assignment statuses
    UPDATE public.work_order_service_employees 
    SET status = 'Accepted',
        completed_at = NULL,
        updated_at = now()
    WHERE service_id IN (SELECT id FROM public.work_order_services WHERE work_order_id = p_work_order_id);

    -- 4. Revert specific tasks if needed? 
    -- For now, keep them as completed but allow editing. 
    -- If user rejected all, they would use reject_work_tasks.

    -- 5. Add internal note about reopening
    INSERT INTO public.work_order_service_notes (service_id, note_type, note_content, is_internal, created_by)
    SELECT DISTINCT s.id, 'Information', 'Work Order Reopened: ' || p_reason, true, p_admin_id
    FROM public.work_order_services s
    WHERE s.work_order_id = p_work_order_id;
END;
$$;


ALTER FUNCTION "public"."reopen_work_order"("p_work_order_id" "uuid", "p_reason" "text", "p_admin_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."request_changes"("p_work_order_id" "uuid", "p_approver_id" "uuid", "p_notes" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    UPDATE public.work_orders 
    SET status = 'In Progress', updated_at = now()
    WHERE id = p_work_order_id;

    UPDATE public.work_order_services 
    SET status = 'In Progress', updated_at = now()
    WHERE work_order_id = p_work_order_id;

    UPDATE public.work_order_service_employees 
    SET status = 'Accepted', updated_at = now()
    WHERE service_id IN (SELECT id FROM public.work_order_services WHERE work_order_id = p_work_order_id);

    INSERT INTO public.work_order_service_notes (service_id, note_type, note_content, is_internal, created_by)
    SELECT DISTINCT s.id, 'Issue', p_notes, true, p_approver_id
    FROM public.work_order_services s
    WHERE s.work_order_id = p_work_order_id;
END;
$$;


ALTER FUNCTION "public"."request_changes"("p_work_order_id" "uuid", "p_approver_id" "uuid", "p_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."request_part_return"("_work_order_id" "uuid", "_inventory_id" "uuid", "_quantity" integer, "_reason" "text", "_condition" "text", "_employee_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_return_id UUID;
BEGIN
    INSERT INTO public.inventory_returns (work_order_id, inventory_id, requested_by, quantity, reason, condition)
    VALUES (_work_order_id, _inventory_id, _employee_id, _quantity, _reason, _condition)
    RETURNING id INTO v_return_id;
    
    RETURN v_return_id;
END;
$$;


ALTER FUNCTION "public"."request_part_return"("_work_order_id" "uuid", "_inventory_id" "uuid", "_quantity" integer, "_reason" "text", "_condition" "text", "_employee_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."scan_and_issue_unit"("_qr_code" "text", "_work_order_id" "uuid", "_employee_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_unit RECORD;
    v_request RECORD;
BEGIN
    SELECT * INTO v_unit FROM public.inventory_units WHERE qr_code = _qr_code;
    IF v_unit IS NULL THEN
        RETURN jsonb_build_object('success', false, 'code', 'NOT_FOUND', 'message', 'QR Code not found');
    END IF;
    IF v_unit.status != 'available' THEN
        RETURN jsonb_build_object('success', false, 'code', 'ALREADY_USED', 'message', 'Unit is ' || v_unit.status);
    END IF;

    SELECT * INTO v_request 
    FROM public.part_requests 
    WHERE work_order_id = _work_order_id 
      AND item_id = v_unit.inventory_id 
      AND status IN ('approved', 'issued')
      AND issued_qty < approved_qty
    LIMIT 1;

    IF v_request IS NULL THEN
        RETURN jsonb_build_object('success', false, 'code', 'NOT_APPROVED', 'message', 'Item not approved or quota exceeded');
    END IF;

    PERFORM public.issue_part_request(v_request.id, 1, _employee_id);

    UPDATE public.inventory_units 
    SET status = 'issued', 
        current_work_order_id = _work_order_id,
        issued_by = _employee_id,
        updated_at = now() 
    WHERE id = v_unit.id;

    RETURN jsonb_build_object('success', true, 'message', 'Unit issued successfully', 'item_name', (SELECT item_name FROM public.inventory WHERE id = v_unit.inventory_id));
END;
$$;


ALTER FUNCTION "public"."scan_and_issue_unit"("_qr_code" "text", "_work_order_id" "uuid", "_employee_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."start_repair_task"("p_task_id" "uuid", "p_started_by" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_employee_id uuid;
BEGIN
    -- Resolve to employee_id
    v_employee_id := public.get_employee_id_from_user(p_started_by);

    UPDATE public.repair_tasks SET
        status = 'in_progress',
        updated_at = now()
    WHERE id = p_task_id;

    INSERT INTO public.repair_task_history (task_id, action, performed_by, notes)
    VALUES (p_task_id, 'started', v_employee_id, 'Task started');
END;
$$;


ALTER FUNCTION "public"."start_repair_task"("p_task_id" "uuid", "p_started_by" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_work_order_to_vehicle"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    -- Only run if status changed to 'Completed' or 'Delivered'
    IF (NEW.status IN ('Completed', 'Delivered')) AND (OLD.status NOT IN ('Completed', 'Delivered')) THEN
        
        -- Update Vehicle Odometer if meaningful value provided
        IF NEW.odometer_reading IS NOT NULL AND NEW.odometer_reading > 0 THEN
             UPDATE public.vehicles 
             SET kilometers_driven = NEW.odometer_reading
             WHERE id = NEW.vehicle_id;
        END IF;

        -- Update Next Service Due info
        IF NEW.next_service_due_km IS NOT NULL OR NEW.next_service_due_date IS NOT NULL THEN
             UPDATE public.vehicles 
             SET next_service_km = COALESCE(NEW.next_service_due_km, next_service_km),
                 next_service_date = COALESCE(NEW.next_service_due_date, next_service_date)
             WHERE id = NEW.vehicle_id;
        END IF;

    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_work_order_to_vehicle"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_customer_portal"("p_work_order_id" "uuid", "p_make_visible" boolean DEFAULT true) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    -- Update work order
    UPDATE public.work_orders 
    SET 
        customer_visible = p_make_visible,
        portal_updated_at = now(),
        updated_at = now()
    WHERE id = p_work_order_id;
    
    -- Update all services
    UPDATE public.work_order_services 
    SET 
        customer_visible = p_make_visible,
        portal_updated_at = now(),
        updated_at = now()
    WHERE work_order_id = p_work_order_id;
END;
$$;


ALTER FUNCTION "public"."update_customer_portal"("p_work_order_id" "uuid", "p_make_visible" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_work_order_stage"("p_work_order_id" "uuid", "p_completed_stages" "text"[], "p_approver_id" "uuid" DEFAULT NULL::"uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_current_stage text;
    v_next_stage text;
    v_employee_id uuid;
BEGIN
    -- Resolve approver to employee_id
    v_employee_id := public.get_employee_id_from_user(p_approver_id);

    -- Update completed stages in work_order_stages table
    UPDATE public.work_order_stages 
    SET status = 'completed', 
        completed_at = now(), 
        completed_by = v_employee_id,
        updated_at = now()
    WHERE work_order_id = p_work_order_id 
    AND stage = ANY(p_completed_stages);

    -- SYNC: If 'Repair' stage is completed, mark all repair_tasks as completed
    IF 'Repair' = ANY(p_completed_stages) THEN
        UPDATE public.repair_tasks 
        SET status = 'completed',
            completed_at = now(),
            completed_by = v_employee_id,
            updated_at = now()
        WHERE work_order_id = p_work_order_id 
        AND status != 'completed';

        UPDATE public.work_orders 
        SET repair_completed_at = now(), updated_at = now()
        WHERE id = p_work_order_id;
    END IF;

    -- Update work order current_stage to next uncompleted stage
    SELECT stage INTO v_next_stage
    FROM public.work_order_stages
    WHERE work_order_id = p_work_order_id AND status = 'pending'
    ORDER BY created_at
    LIMIT 1;

    IF v_next_stage IS NOT NULL THEN
        UPDATE public.work_orders 
        SET current_stage = v_next_stage, updated_at = now()
        WHERE id = p_work_order_id;

        -- Update the new current stage to in_progress
        UPDATE public.work_order_stages 
        SET status = 'in_progress', started_at = now(), updated_at = now()
        WHERE work_order_id = p_work_order_id AND stage = v_next_stage;
    ELSE
        -- All stages completed
        UPDATE public.work_orders 
        SET current_stage = 'Delivery', 
            status = 'Completed',
            updated_at = now()
        WHERE id = p_work_order_id;
        
        -- CRITICAL COMPONENT: Sync all assignments for this work order to 'completed'
        UPDATE public.work_order_service_employees
        SET status = 'completed', 
            completed_at = now(), 
            updated_at = now()
        WHERE service_id IN (SELECT id FROM public.work_order_services WHERE work_order_id = p_work_order_id)
        AND status != 'completed';
        
        -- Also sync service statuses
        UPDATE public.work_order_services
        SET status = 'Completed',
            updated_at = now()
        WHERE work_order_id = p_work_order_id
        AND status != 'Completed';
    END IF;

    -- Make work order visible to customer
    UPDATE public.work_orders 
    SET customer_visible = true, portal_updated_at = now(), updated_at = now()
    WHERE id = p_work_order_id;
END;
$$;


ALTER FUNCTION "public"."update_work_order_stage"("p_work_order_id" "uuid", "p_completed_stages" "text"[], "p_approver_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_work_order_task_status"("p_task_id" "uuid", "p_work_order_id" "uuid", "p_completed" boolean, "p_employee_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    UPDATE public.work_order_tasks 
    SET completed = p_completed,
        completed_at = CASE WHEN p_completed THEN now() ELSE NULL END,
        completed_by = CASE WHEN p_completed THEN p_employee_id ELSE NULL END, -- Store the user_id
        updated_at = now()
    WHERE id = p_task_id AND work_order_id = p_work_order_id;

    -- Recalculate work order repair_status
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
        UPDATE public.work_orders 
        SET repair_status = 'in_progress',
            updated_at = now()
        WHERE id = p_work_order_id AND repair_status = 'completed';
    END IF;
END;
$$;


ALTER FUNCTION "public"."update_work_order_task_status"("p_task_id" "uuid", "p_work_order_id" "uuid", "p_completed" boolean, "p_employee_id" "uuid") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."attendance" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "employee_id" "uuid" NOT NULL,
    "date" "date" NOT NULL,
    "status" "text" NOT NULL,
    "overtime_hours" numeric(4,2) DEFAULT 0,
    "check_in" timestamp with time zone,
    "check_out" timestamp with time zone,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "marked_by" "uuid",
    "updated_by" "uuid",
    "remarks" "text",
    CONSTRAINT "attendance_status_check" CHECK (("status" = ANY (ARRAY['present'::"text", 'absent'::"text", 'half-day'::"text", 'leave'::"text", 'overtime'::"text", 'holiday'::"text", 'paid-holiday'::"text"])))
);


ALTER TABLE "public"."attendance" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."attendance_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "attendance_id" "uuid" NOT NULL,
    "employee_id" "uuid" NOT NULL,
    "date" "date" NOT NULL,
    "old_status" "text",
    "new_status" "text",
    "old_remarks" "text",
    "new_remarks" "text",
    "changed_by" "uuid",
    "changed_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."attendance_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_name" "text" NOT NULL,
    "address" "text",
    "phone" "text",
    "email" "text",
    "website" "text",
    "tax_id" "text",
    "logo_url" "text",
    "bank_details" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "payment_qr_code_url" "text",
    "acc_name" "text",
    "acc_number" "text",
    "ifsc" "text",
    "bank_name" "text",
    "upi_id" "text",
    "owner_name" "text",
    "owner_phone" "text"
);


ALTER TABLE "public"."company_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."custom_work_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "service_type" "text" NOT NULL,
    "task_name" "text" NOT NULL,
    "task_description" "text",
    "estimated_effort" numeric(10,2),
    "effort_unit" "text" DEFAULT 'hours'::"text",
    "is_active" boolean DEFAULT true,
    "usage_count" integer DEFAULT 0,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."custom_work_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."customers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "email" "text",
    "phone" "text",
    "address" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "user_id" "uuid",
    "company_name" "text",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "gst_number" "text"
);


ALTER TABLE "public"."customers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."document_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "doc_type" "text" NOT NULL,
    "prefix" "text" DEFAULT ''::"text",
    "current_number" integer DEFAULT 1,
    "min_digits" integer DEFAULT 4,
    "show_rates" boolean DEFAULT true,
    "show_taxes" boolean DEFAULT true,
    "show_discounts" boolean DEFAULT false,
    "show_fc_details" boolean DEFAULT true,
    "show_service_history" boolean DEFAULT false,
    "title" "text",
    "terms_and_conditions" "text",
    "footer_text" "text",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "document_settings_doc_type_check" CHECK (("doc_type" = ANY (ARRAY['work_slip'::"text", 'invoice'::"text"])))
);


ALTER TABLE "public"."document_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."employees" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "position" "text" DEFAULT 'Staff'::"text",
    "role" "text" DEFAULT 'staff'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "position_id" "uuid",
    "access_level" "public"."access_level_enum" DEFAULT 'staff'::"public"."access_level_enum",
    "user_id" "uuid",
    "email" "text" DEFAULT ''::"text" NOT NULL,
    "phone" "text",
    "salary" numeric(10,2),
    "status" "text" DEFAULT 'active'::"text",
    "hire_date" "date",
    "emergency_contact" "text",
    "emergency_phone" "text",
    "address" "text",
    "notes" "text",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "joining_date" "date" DEFAULT CURRENT_DATE,
    "aadhaar_number" "text",
    "pan_number" "text",
    "date_of_birth" "date",
    "blood_group" "text",
    "pay_type" "text" DEFAULT 'monthly'::"text"
);


ALTER TABLE "public"."employees" OWNER TO "postgres";


COMMENT ON COLUMN "public"."employees"."aadhaar_number" IS 'Government ID: Aadhaar Number';



COMMENT ON COLUMN "public"."employees"."pan_number" IS 'Tax ID: PAN Number';



CREATE TABLE IF NOT EXISTS "public"."positions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "department" "text" DEFAULT 'General'::"text" NOT NULL,
    "access_level" "public"."access_level_enum" DEFAULT 'staff'::"public"."access_level_enum" NOT NULL,
    "base_salary" numeric(10,2)
);


ALTER TABLE "public"."positions" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."employee_details" AS
 SELECT "e"."id",
    "e"."name",
    "e"."email",
    "e"."phone",
    "e"."salary",
    "e"."status",
    "e"."hire_date",
    "p"."name" AS "position_name",
    "p"."department",
    "p"."access_level" AS "position_access_level",
    "e"."created_at"
   FROM ("public"."employees" "e"
     LEFT JOIN "public"."positions" "p" ON (("e"."position_id" = "p"."id")));


ALTER VIEW "public"."employee_details" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."employee_payouts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "employee_id" "uuid" NOT NULL,
    "period_start" "date" NOT NULL,
    "period_end" "date" NOT NULL,
    "base_calc" numeric(12,2) NOT NULL,
    "attendance_adj" numeric(12,2) DEFAULT 0,
    "job_incentives" numeric(12,2) DEFAULT 0,
    "overtime_pay" numeric(12,2) DEFAULT 0,
    "bonuses" numeric(12,2) DEFAULT 0,
    "deductions" numeric(12,2) DEFAULT 0,
    "total_amount" numeric(12,2) NOT NULL,
    "status" "text" DEFAULT 'draft'::"text",
    "payment_date" timestamp with time zone,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "days_present" numeric(4,1) DEFAULT 0,
    "arrears_adj" numeric(12,2) DEFAULT 0,
    CONSTRAINT "employee_payouts_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'approved'::"text", 'paid'::"text"])))
);


ALTER TABLE "public"."employee_payouts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."inventory_returns" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "work_order_id" "uuid" NOT NULL,
    "inventory_id" "uuid" NOT NULL,
    "requested_by" "uuid" NOT NULL,
    "quantity" integer DEFAULT 1 NOT NULL,
    "reason" "text",
    "condition" "text",
    "status" "text" DEFAULT 'pending'::"text",
    "approved_by" "uuid",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "inventory_returns_condition_check" CHECK (("condition" = ANY (ARRAY['unused'::"text", 'opened'::"text", 'damaged'::"text"]))),
    CONSTRAINT "inventory_returns_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."inventory_returns" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."part_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "work_order_id" "uuid" NOT NULL,
    "item_id" "uuid" NOT NULL,
    "requested_by" "uuid" NOT NULL,
    "requested_qty" integer DEFAULT 1 NOT NULL,
    "approved_qty" integer DEFAULT 0,
    "issued_qty" integer DEFAULT 0,
    "status" "text" DEFAULT 'pending'::"text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "returned_qty" integer DEFAULT 0,
    "approved_by" "uuid",
    CONSTRAINT "part_requests_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'issued'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."part_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."work_order_assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "work_order_id" "uuid" NOT NULL,
    "employee_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'assigned'::"text" NOT NULL,
    "assigned_at" timestamp with time zone DEFAULT "now"(),
    "accepted_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "approved_by" "uuid",
    "approved_at" timestamp with time zone,
    "approval_notes" "text",
    CONSTRAINT "work_order_assignments_status_check_v2" CHECK (("status" = ANY (ARRAY['assigned'::"text", 'accepted'::"text", 'in_progress'::"text", 'pending_approval'::"text", 'approved'::"text", 'rejected'::"text", 'completed'::"text", 'pending_acceptance'::"text"])))
);


ALTER TABLE "public"."work_order_assignments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."work_orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "vehicle_id" "uuid" NOT NULL,
    "assigned_to" "uuid",
    "service_type" "text" NOT NULL,
    "description" "text",
    "status" "text" DEFAULT 'Pending'::"text",
    "priority" "text" DEFAULT 'Medium'::"text",
    "estimated_cost" numeric(10,2),
    "actual_cost" numeric(10,2),
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "current_stage" "text" DEFAULT 'Inspection'::"text",
    "requires_approval" boolean DEFAULT false,
    "approved_by" "uuid",
    "approved_at" timestamp with time zone,
    "accepted_at" timestamp with time zone,
    "customer_visible" boolean DEFAULT false,
    "notes" "text",
    "portal_updated_at" timestamp with time zone,
    "repair_completed_at" timestamp with time zone,
    "inspection_status" "text" DEFAULT 'pending'::"text",
    "inspection_notes" "text",
    "inspection_completed_at" timestamp with time zone,
    "inspection_completed_by" "uuid",
    "repairs_visible" boolean DEFAULT false,
    "repairs_approved" boolean DEFAULT false,
    "repairs_approved_at" timestamp with time zone,
    "repairs_approved_by" "uuid",
    "repair_status" "text" DEFAULT 'pending'::"text",
    "review_status" "text" DEFAULT 'pending'::"text",
    "completed_by_admin" boolean DEFAULT false,
    "quality_check_status" "text" DEFAULT 'pending'::"text",
    "customer_notified" boolean DEFAULT false,
    "odometer_reading" integer,
    "next_service_due_km" integer,
    "next_service_due_date" "date",
    "is_fc_renewal" boolean DEFAULT false,
    "estimated_delivery_date" timestamp with time zone,
    "is_reopened" boolean DEFAULT false,
    "reopen_reason" "text",
    "reopened_at" timestamp with time zone,
    "reopened_by" "uuid",
    "rejection_reason" "text",
    "rejected_at" timestamp with time zone,
    "rejected_by" "uuid",
    CONSTRAINT "work_orders_current_stage_check" CHECK (("current_stage" = ANY (ARRAY['Inspection'::"text", 'Repair'::"text", 'Review'::"text", 'Quality Check'::"text", 'Delivery'::"text"]))),
    CONSTRAINT "work_orders_priority_check" CHECK (("priority" = ANY (ARRAY['Low'::"text", 'Medium'::"text", 'High'::"text", 'Urgent'::"text"]))),
    CONSTRAINT "work_orders_quality_check_status_check" CHECK (("quality_check_status" = ANY (ARRAY['pending'::"text", 'completed'::"text"]))),
    CONSTRAINT "work_orders_repair_status_check" CHECK (("repair_status" = ANY (ARRAY['pending'::"text", 'in_progress'::"text", 'completed'::"text", 'approved'::"text"]))),
    CONSTRAINT "work_orders_review_status_check" CHECK (("review_status" = ANY (ARRAY['pending'::"text", 'approved'::"text"]))),
    CONSTRAINT "work_orders_status_check_v2" CHECK (("status" = ANY (ARRAY['Pending'::"text", 'In Progress'::"text", 'Pending Approval'::"text", 'Approved'::"text", 'Completed'::"text", 'Cancelled'::"text", 'Rejected'::"text"])))
);


ALTER TABLE "public"."work_orders" OWNER TO "postgres";


COMMENT ON COLUMN "public"."work_orders"."quality_check_status" IS 'Status of quality check/evaluation before delivery';



COMMENT ON COLUMN "public"."work_orders"."customer_notified" IS 'Whether customer has been alerted for delivery';



CREATE OR REPLACE VIEW "public"."employee_performance_metrics" AS
 SELECT "e"."id" AS "employee_id",
    "e"."name" AS "employee_name",
    "count"(DISTINCT "woa"."work_order_id") FILTER (WHERE ("wo"."status" = 'delivered'::"text")) AS "total_jobs_completed",
    COALESCE("avg"((EXTRACT(epoch FROM ("wo"."updated_at" - "wo"."created_at")) / (3600)::numeric)) FILTER (WHERE ("wo"."status" = 'delivered'::"text")), (0)::numeric) AS "avg_completion_hours",
    "count"(DISTINCT "pr"."id") AS "total_parts_requested",
    "count"(DISTINCT "ir"."id") AS "total_parts_returned",
    ( SELECT "count"(*) AS "count"
           FROM "public"."attendance" "a"
          WHERE (("a"."employee_id" = "e"."id") AND ("a"."status" = ANY (ARRAY['present'::"text", 'overtime'::"text", 'paid-holiday'::"text"])) AND ("a"."date" >= ("now"() - '30 days'::interval)))) AS "days_present_30d",
    ( SELECT "sum"("a"."overtime_hours") AS "sum"
           FROM "public"."attendance" "a"
          WHERE (("a"."employee_id" = "e"."id") AND ("a"."date" >= ("now"() - '30 days'::interval)))) AS "overtime_hours_30d"
   FROM (((("public"."employees" "e"
     LEFT JOIN "public"."work_order_assignments" "woa" ON (("woa"."employee_id" = "e"."id")))
     LEFT JOIN "public"."work_orders" "wo" ON (("wo"."id" = "woa"."work_order_id")))
     LEFT JOIN "public"."part_requests" "pr" ON (("pr"."requested_by" = "e"."id")))
     LEFT JOIN "public"."inventory_returns" "ir" ON (("ir"."requested_by" = "e"."id")))
  GROUP BY "e"."id", "e"."name";


ALTER VIEW "public"."employee_performance_metrics" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."employee_salary_configs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "employee_id" "uuid" NOT NULL,
    "pay_type" "text" NOT NULL,
    "base_amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "overtime_rate" numeric(10,2) DEFAULT 0,
    "job_incentive_rate" numeric(10,2) DEFAULT 0,
    "allowances" numeric(12,2) DEFAULT 0,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "employee_salary_configs_pay_type_check" CHECK (("pay_type" = ANY (ARRAY['monthly'::"text", 'weekly'::"text", 'per-job'::"text", 'daily'::"text"])))
);


ALTER TABLE "public"."employee_salary_configs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vehicles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "vehicle_no" "text" DEFAULT ''::"text",
    "customer_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "vehicle_type" "text" DEFAULT ''::"text" NOT NULL,
    "model" "text",
    "year" integer,
    "status" "text" DEFAULT 'Inspection'::"text",
    "notes" "text",
    "entry_date" timestamp with time zone,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "vehicle_number" "text" DEFAULT ''::"text",
    "fc_number" "text",
    "fc_expiry_date" "date",
    "last_fc_date" "date",
    "kilometers_driven" integer DEFAULT 0,
    "next_service_km" integer,
    "next_service_date" "date",
    "color" "text",
    "vin" "text",
    "engine_number" "text",
    "model_id" "uuid"
);


ALTER TABLE "public"."vehicles" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."employee_tasks" AS
 SELECT "woa"."id",
    "woa"."work_order_id",
    "woa"."employee_id",
    "woa"."status",
    "woa"."assigned_at",
    "woa"."accepted_at",
    "woa"."completed_at",
    "woa"."notes",
    "woa"."created_at",
    "woa"."updated_at",
    "wo"."vehicle_id",
    "wo"."service_type",
    "wo"."description",
    "wo"."priority",
    "wo"."status" AS "work_order_status",
    "wo"."current_stage",
    "wo"."estimated_cost",
    "wo"."actual_cost",
    "wo"."requires_approval",
    "wo"."created_at" AS "work_order_created",
    "v"."vehicle_number",
    "v"."model",
    "c"."name" AS "customer_name",
    "e"."name" AS "employee_name"
   FROM (((("public"."work_order_assignments" "woa"
     JOIN "public"."work_orders" "wo" ON (("wo"."id" = "woa"."work_order_id")))
     LEFT JOIN "public"."vehicles" "v" ON (("v"."id" = "wo"."vehicle_id")))
     LEFT JOIN "public"."customers" "c" ON (("c"."id" = "v"."customer_id")))
     LEFT JOIN "public"."employees" "e" ON (("e"."id" = "woa"."employee_id")));


ALTER VIEW "public"."employee_tasks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."inventory" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "item_name" "text" NOT NULL,
    "category" "text" NOT NULL,
    "quantity" integer DEFAULT 0 NOT NULL,
    "unit_price" numeric(10,2) NOT NULL,
    "reorder_level" integer DEFAULT 10,
    "supplier" "text",
    "location" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "sku" "text",
    "available_qty" integer DEFAULT 0,
    "reserved_qty" integer DEFAULT 0,
    "qr_code" "text",
    "hsn_code" "text",
    "gst_rate" numeric DEFAULT 18.0,
    "cgst_rate" numeric DEFAULT 9.0,
    "sgst_rate" numeric DEFAULT 9.0
);


ALTER TABLE "public"."inventory" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."inventory_transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "item_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "quantity" integer NOT NULL,
    "reference_id" "uuid",
    "performed_by" "uuid",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "inventory_transactions_type_check" CHECK (("type" = ANY (ARRAY['restock'::"text", 'issue'::"text", 'adjustment'::"text", 'reservation'::"text", 'return'::"text"])))
);


ALTER TABLE "public"."inventory_transactions" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."inventory_lifecycle_history" AS
 SELECT "it"."id" AS "transaction_id",
    "i"."id" AS "item_id",
    "i"."item_name",
    "i"."sku",
    "i"."qr_code",
    "it"."type" AS "transaction_type",
    "it"."quantity",
    "it"."created_at" AS "transaction_date",
    "it"."notes" AS "transaction_notes",
    "e"."name" AS "performed_by_name",
    "req_emp"."name" AS "requested_by_name",
    COALESCE("app_emp"."name", "issue_app_emp"."name") AS "approved_by_name",
    "wo"."id" AS "work_order_id",
    "v"."vehicle_number",
    "c"."name" AS "customer_name",
    "c"."company_name",
    "pr"."status" AS "request_status",
    "ir"."status" AS "return_status",
    "ir"."condition" AS "return_condition"
   FROM (((((((((("public"."inventory_transactions" "it"
     JOIN "public"."inventory" "i" ON (("i"."id" = "it"."item_id")))
     LEFT JOIN "public"."employees" "e" ON (("e"."id" = "it"."performed_by")))
     LEFT JOIN "public"."part_requests" "pr" ON ((("pr"."id" = "it"."reference_id") AND ("it"."type" = ANY (ARRAY['reservation'::"text", 'issue'::"text", 'adjustment'::"text"])))))
     LEFT JOIN "public"."inventory_returns" "ir" ON ((("ir"."id" = "it"."reference_id") AND ("it"."type" = 'return'::"text"))))
     LEFT JOIN "public"."employees" "req_emp" ON (("req_emp"."id" = COALESCE("pr"."requested_by", "ir"."requested_by"))))
     LEFT JOIN "public"."employees" "app_emp" ON (("app_emp"."id" = "ir"."approved_by")))
     LEFT JOIN "public"."employees" "issue_app_emp" ON (("issue_app_emp"."id" = "pr"."approved_by")))
     LEFT JOIN "public"."work_orders" "wo" ON (("wo"."id" = COALESCE("pr"."work_order_id", "ir"."work_order_id"))))
     LEFT JOIN "public"."vehicles" "v" ON (("v"."id" = "wo"."vehicle_id")))
     LEFT JOIN "public"."customers" "c" ON (("c"."id" = "v"."customer_id")));


ALTER VIEW "public"."inventory_lifecycle_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."inventory_units" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "inventory_id" "uuid" NOT NULL,
    "qr_code" "text" NOT NULL,
    "status" "text" DEFAULT 'available'::"text" NOT NULL,
    "batch_number" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "current_work_order_id" "uuid",
    "issued_by" "uuid",
    CONSTRAINT "inventory_units_status_check" CHECK (("status" = ANY (ARRAY['available'::"text", 'withdrawn'::"text", 'lost'::"text", 'issued'::"text"])))
);


ALTER TABLE "public"."inventory_units" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."invoice_bill_number_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."invoice_bill_number_seq" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."invoice_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "invoice_id" "uuid" NOT NULL,
    "work_order_service_id" "uuid",
    "description" "text" NOT NULL,
    "quantity" numeric(10,2) DEFAULT 1 NOT NULL,
    "unit_price" numeric(10,2) DEFAULT 0 NOT NULL,
    "total" numeric(10,2) DEFAULT 0 NOT NULL,
    "type" "text" DEFAULT 'service'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "category" "text",
    "hsn_code" "text",
    "taxable_value" numeric,
    "gst_rate" numeric,
    "cgst_rate" numeric,
    "sgst_rate" numeric,
    "cgst_amount" numeric,
    "sgst_amount" numeric,
    CONSTRAINT "invoice_items_type_check" CHECK (("type" = ANY (ARRAY['service'::"text", 'part'::"text", 'labor'::"text", 'adjustment'::"text", 'tax'::"text", 'discount'::"text"])))
);


ALTER TABLE "public"."invoice_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."invoices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "invoice_number" "text" NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "work_order_id" "uuid",
    "subtotal" numeric(10,2) NOT NULL,
    "tax" numeric(10,2) DEFAULT 0 NOT NULL,
    "total" numeric(10,2) NOT NULL,
    "status" "text" DEFAULT 'Draft'::"text",
    "due_date" "date",
    "paid_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "bill_number" bigint DEFAULT "nextval"('"public"."invoice_bill_number_seq"'::"regclass"),
    "notes" "text",
    "type" "text" DEFAULT 'invoice'::"text",
    "quotation_number" bigint,
    "total_deductions" numeric(10,2) DEFAULT 0,
    CONSTRAINT "invoices_status_check" CHECK (("status" = ANY (ARRAY['Draft'::"text", 'Sent'::"text", 'Paid'::"text", 'Overdue'::"text", 'Cancelled'::"text"]))),
    CONSTRAINT "invoices_type_check" CHECK (("type" = ANY (ARRAY['invoice'::"text", 'quotation'::"text"])))
);


ALTER TABLE "public"."invoices" OWNER TO "postgres";


COMMENT ON COLUMN "public"."invoices"."type" IS 'Distinguishes between Tax Invoice and Quotation';



CREATE TABLE IF NOT EXISTS "public"."payment_links" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "payment_id" "uuid" NOT NULL,
    "invoice_id" "uuid" NOT NULL,
    "amount_applied" numeric(10,2) DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."payment_links" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "invoice_id" "uuid",
    "amount" numeric(10,2) NOT NULL,
    "payment_method" "text" NOT NULL,
    "transaction_reference" "text",
    "proof_url" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "admin_remarks" "text",
    "verified_by" "uuid",
    "verified_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "deduction_amount" numeric(10,2) DEFAULT 0,
    "deduction_reason" "text",
    "is_final_settlement" boolean DEFAULT false,
    CONSTRAINT "payments_payment_method_check" CHECK (("payment_method" = ANY (ARRAY['UPI'::"text", 'Bank Transfer'::"text", 'Cash'::"text"]))),
    CONSTRAINT "payments_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."payments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payout_adjustments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "employee_id" "uuid" NOT NULL,
    "payout_id" "uuid",
    "attendance_id" "uuid",
    "amount" numeric(12,2) NOT NULL,
    "description" "text",
    "is_processed" boolean DEFAULT false,
    "processed_payout_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."payout_adjustments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pricing_rules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "service_type_id" "uuid" NOT NULL,
    "vehicle_category_id" "uuid",
    "vehicle_type_id" "uuid",
    "customer_id" "uuid",
    "modifier_type" "text" NOT NULL,
    "modifier_value" numeric(10,2) NOT NULL,
    "priority" integer DEFAULT 0,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "task_template_id" "uuid",
    CONSTRAINT "pricing_rules_modifier_type_check" CHECK (("modifier_type" = ANY (ARRAY['fixed'::"text", 'percentage'::"text", 'override'::"text"])))
);


ALTER TABLE "public"."pricing_rules" OWNER TO "postgres";


COMMENT ON COLUMN "public"."pricing_rules"."task_template_id" IS 'If set, this rule applies specifically to this task template within the service.';



CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "full_name" "text",
    "phone" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."quotation_number_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."quotation_number_seq" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."repair_task_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "task_id" "uuid" NOT NULL,
    "action" "text" NOT NULL,
    "performed_by" "uuid",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "repair_task_history_action_check" CHECK (("action" = ANY (ARRAY['created'::"text", 'started'::"text", 'completed'::"text", 'reopened'::"text", 'updated'::"text"])))
);


ALTER TABLE "public"."repair_task_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."repair_tasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "work_order_id" "uuid" NOT NULL,
    "task_name" "text" NOT NULL,
    "task_description" "text",
    "task_category" "text" DEFAULT 'General'::"text",
    "status" "text" DEFAULT 'pending'::"text",
    "priority" "text" DEFAULT 'Medium'::"text",
    "sequence_order" integer DEFAULT 0,
    "notes" "text",
    "completed_at" timestamp with time zone,
    "completed_by" "uuid",
    "reopened_at" timestamp with time zone,
    "reopened_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "repair_tasks_priority_check" CHECK (("priority" = ANY (ARRAY['Low'::"text", 'Medium'::"text", 'High'::"text", 'Urgent'::"text"]))),
    CONSTRAINT "repair_tasks_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'in_progress'::"text", 'completed'::"text", 'reopened'::"text"])))
);


ALTER TABLE "public"."repair_tasks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."service_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."service_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."service_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "vehicle_id" "uuid" NOT NULL,
    "work_order_id" "uuid" NOT NULL,
    "service_type" "text" NOT NULL,
    "service_description" "text",
    "work_summary" "text",
    "status" "text" DEFAULT 'Completed'::"text" NOT NULL,
    "service_date" timestamp with time zone NOT NULL,
    "delivery_date" timestamp with time zone,
    "approved_by" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."service_history" OWNER TO "postgres";


COMMENT ON TABLE "public"."service_history" IS 'Tracks complete service history for vehicles. Records are automatically created when work orders are delivered/completed/approved.';



CREATE TABLE IF NOT EXISTS "public"."service_types" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "category" "text" DEFAULT 'General'::"text",
    "description" "text",
    "base_price" numeric DEFAULT 0,
    "estimated_duration" "text",
    "tax_applicable" boolean DEFAULT true,
    "is_active" boolean DEFAULT true,
    "required_fields" "text"[] DEFAULT '{}'::"text"[],
    "inventory_categories" "text"[] DEFAULT '{}'::"text"[],
    "last_updated_by" "uuid",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "is_fc_exclusive" boolean DEFAULT false,
    "hsn_code" "text",
    "sac_code" "text"
);


ALTER TABLE "public"."service_types" OWNER TO "postgres";


COMMENT ON COLUMN "public"."service_types"."hsn_code" IS 'Harmonized System of Nomenclature code for goods';



COMMENT ON COLUMN "public"."service_types"."sac_code" IS 'Service Accounting Code for services';



CREATE TABLE IF NOT EXISTS "public"."service_vehicle_applicability" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "service_type_id" "uuid" NOT NULL,
    "vehicle_category_id" "uuid",
    "vehicle_type_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "vehicle_manufacturer_id" "uuid"
);


ALTER TABLE "public"."service_vehicle_applicability" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."task_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "service_type_id" "uuid",
    "name" "text" NOT NULL,
    "description" "text",
    "priority" "text" DEFAULT 'Medium'::"text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "last_updated_by" "uuid",
    "price" numeric(10,2) DEFAULT 0,
    "hsn_code" "text",
    "sac_code" "text"
);


ALTER TABLE "public"."task_templates" OWNER TO "postgres";


COMMENT ON COLUMN "public"."task_templates"."hsn_code" IS 'HSN code override for specific tasks';



CREATE TABLE IF NOT EXISTS "public"."user_roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_roles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vehicle_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."vehicle_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vehicle_fc_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "vehicle_id" "uuid" NOT NULL,
    "fc_number" "text",
    "issue_date" "date",
    "expiry_date" "date",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid"
);


ALTER TABLE "public"."vehicle_fc_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vehicle_manufacturers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."vehicle_manufacturers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vehicle_models" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "manufacturer_id" "uuid",
    "vehicle_type_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."vehicle_models" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vehicle_types" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "category_id" "uuid",
    "base_workload_multiplier" numeric(10,2) DEFAULT 1.0,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."vehicle_types" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."work_order_approvals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "work_order_id" "uuid" NOT NULL,
    "approver_id" "uuid" NOT NULL,
    "approval_type" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."work_order_approvals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."work_order_parts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "work_order_id" "uuid" NOT NULL,
    "inventory_id" "uuid",
    "part_name" "text" NOT NULL,
    "quantity" integer DEFAULT 1 NOT NULL,
    "unit_price" numeric(10,2) DEFAULT 0 NOT NULL,
    "total_price" numeric(10,2) GENERATED ALWAYS AS ((("quantity")::numeric * "unit_price")) STORED,
    "added_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."work_order_parts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."work_order_stages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "work_order_id" "uuid" NOT NULL,
    "stage" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "notes" "text",
    "completed_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "work_order_stages_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'in_progress'::"text", 'completed'::"text"])))
);


ALTER TABLE "public"."work_order_stages" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."work_order_details" AS
 SELECT "wo"."id",
    "wo"."vehicle_id",
    "wo"."assigned_to",
    "wo"."service_type",
    "wo"."description",
    "wo"."status",
    "wo"."priority",
    "wo"."estimated_cost",
    "wo"."actual_cost",
    "wo"."started_at",
    "wo"."completed_at",
    "wo"."created_at",
    "wo"."updated_at",
    "wo"."current_stage",
    "wo"."requires_approval",
    "wo"."approved_by",
    "wo"."approved_at",
    "wo"."accepted_at",
    "wo"."customer_visible",
    "v"."vehicle_number",
    "v"."model",
    "v"."vehicle_type",
    "c"."name" AS "customer_name",
    "c"."email" AS "customer_email",
    "c"."phone" AS "customer_phone",
    "e"."name" AS "assigned_employee",
    "p"."name" AS "position_name",
    "p"."department" AS "position_department",
    ( SELECT "json_agg"("json_build_object"('id', "s"."id", 'stage', "s"."stage", 'status', "s"."status", 'started_at', "s"."started_at", 'completed_at', "s"."completed_at") ORDER BY "s"."created_at") AS "json_agg"
           FROM "public"."work_order_stages" "s"
          WHERE ("s"."work_order_id" = "wo"."id")) AS "stages",
    ( SELECT "json_agg"("json_build_object"('id', "a"."id", 'employee_id', "a"."employee_id", 'employee_name', "e2"."name", 'status', "a"."status", 'assigned_at', "a"."assigned_at", 'accepted_at', "a"."accepted_at", 'completed_at', "a"."completed_at")) AS "json_agg"
           FROM ("public"."work_order_assignments" "a"
             JOIN "public"."employees" "e2" ON (("e2"."id" = "a"."employee_id")))
          WHERE ("a"."work_order_id" = "wo"."id")) AS "assignments",
    ( SELECT "json_agg"("json_build_object"('id', "wp"."id", 'part_name', "wp"."part_name", 'quantity', "wp"."quantity", 'unit_price', "wp"."unit_price", 'total_price', "wp"."total_price")) AS "json_agg"
           FROM "public"."work_order_parts" "wp"
          WHERE ("wp"."work_order_id" = "wo"."id")) AS "parts"
   FROM (((("public"."work_orders" "wo"
     LEFT JOIN "public"."vehicles" "v" ON (("v"."id" = "wo"."vehicle_id")))
     LEFT JOIN "public"."customers" "c" ON (("c"."id" = "v"."customer_id")))
     LEFT JOIN "public"."employees" "e" ON (("e"."id" = "wo"."assigned_to")))
     LEFT JOIN "public"."positions" "p" ON (("p"."id" = "e"."position_id")));


ALTER VIEW "public"."work_order_details" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."work_order_service_employees" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "service_id" "uuid" NOT NULL,
    "employee_id" "uuid" NOT NULL,
    "role" "text",
    "status" "text" DEFAULT 'Assigned'::"text",
    "assigned_at" timestamp with time zone DEFAULT "now"(),
    "accepted_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "approved_by" "uuid",
    "approved_at" timestamp with time zone,
    "approval_notes" "text",
    "queue_position" integer DEFAULT 0,
    "accepted_by" "uuid",
    CONSTRAINT "work_order_service_employees_status_check_v2" CHECK (("status" = ANY (ARRAY['Assigned'::"text", 'Accepted'::"text", 'In Progress'::"text", 'Pending Approval'::"text", 'Approved'::"text", 'Rejected'::"text", 'pending_acceptance'::"text", 'pending_approval'::"text"])))
);


ALTER TABLE "public"."work_order_service_employees" OWNER TO "postgres";


COMMENT ON COLUMN "public"."work_order_service_employees"."accepted_by" IS 'Admin user who approved/released this assignment to staff';



CREATE TABLE IF NOT EXISTS "public"."work_order_service_notes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "service_id" "uuid" NOT NULL,
    "note_type" "text",
    "note_content" "text" NOT NULL,
    "is_internal" boolean DEFAULT false,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."work_order_service_notes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."work_order_services" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "work_order_id" "uuid" NOT NULL,
    "service_type" "text" NOT NULL,
    "display_order" integer DEFAULT 0,
    "estimated_duration" interval,
    "estimated_cost" numeric(10,2) DEFAULT 0,
    "actual_cost" numeric(10,2) DEFAULT 0,
    "status" "text" DEFAULT 'Pending'::"text" NOT NULL,
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "approved_by" "uuid",
    "approved_at" timestamp with time zone,
    "customer_visible" boolean DEFAULT false,
    "portal_updated_at" timestamp with time zone,
    "calculated_price" numeric(10,2),
    "base_price_snapshot" numeric(10,2),
    "billing_price" numeric(10,2),
    "override_reason" "text",
    "price_approved_by" "uuid",
    "price_approved_at" timestamp with time zone,
    CONSTRAINT "work_order_services_status_check_v2" CHECK (("status" = ANY (ARRAY['Pending'::"text", 'In Progress'::"text", 'Pending Approval'::"text", 'Approved'::"text", 'Rejected'::"text", 'Completed'::"text", 'Cancelled'::"text"])))
);


ALTER TABLE "public"."work_order_services" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."work_order_tasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "work_order_id" "uuid" NOT NULL,
    "task_name" "text" NOT NULL,
    "task_type" "text",
    "assigned_employee_id" "uuid",
    "completed" boolean DEFAULT false,
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "service_id" "uuid",
    "description" "text",
    "notes" "text",
    "is_predefined" boolean DEFAULT false,
    "sequence_order" integer DEFAULT 0,
    "completed_by" "uuid",
    "price" numeric(10,2) DEFAULT 0,
    "is_rejected" boolean DEFAULT false,
    "rejection_reason" "text",
    "rejected_at" timestamp with time zone,
    CONSTRAINT "work_order_tasks_task_type_check" CHECK (("task_type" = ANY (ARRAY['inspection'::"text", 'repair'::"text", 'testing'::"text", 'quality'::"text"])))
);


ALTER TABLE "public"."work_order_tasks" OWNER TO "postgres";


ALTER TABLE ONLY "public"."attendance"
    ADD CONSTRAINT "attendance_employee_id_date_key" UNIQUE ("employee_id", "date");



ALTER TABLE ONLY "public"."attendance_history"
    ADD CONSTRAINT "attendance_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."attendance"
    ADD CONSTRAINT "attendance_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_profiles"
    ADD CONSTRAINT "company_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."custom_work_items"
    ADD CONSTRAINT "custom_work_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."document_settings"
    ADD CONSTRAINT "document_settings_doc_type_key" UNIQUE ("doc_type");



ALTER TABLE ONLY "public"."document_settings"
    ADD CONSTRAINT "document_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."employee_payouts"
    ADD CONSTRAINT "employee_payouts_period_unique" UNIQUE ("employee_id", "period_start", "period_end");



ALTER TABLE ONLY "public"."employee_payouts"
    ADD CONSTRAINT "employee_payouts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."employee_salary_configs"
    ADD CONSTRAINT "employee_salary_configs_employee_id_key" UNIQUE ("employee_id");



ALTER TABLE ONLY "public"."employee_salary_configs"
    ADD CONSTRAINT "employee_salary_configs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."employees"
    ADD CONSTRAINT "employees_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inventory"
    ADD CONSTRAINT "inventory_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inventory_returns"
    ADD CONSTRAINT "inventory_returns_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inventory"
    ADD CONSTRAINT "inventory_sku_key" UNIQUE ("sku");



ALTER TABLE ONLY "public"."inventory_transactions"
    ADD CONSTRAINT "inventory_transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inventory_units"
    ADD CONSTRAINT "inventory_units_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inventory_units"
    ADD CONSTRAINT "inventory_units_qr_code_key" UNIQUE ("qr_code");



ALTER TABLE ONLY "public"."invoice_items"
    ADD CONSTRAINT "invoice_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_bill_number_key" UNIQUE ("bill_number");



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_invoice_number_key" UNIQUE ("invoice_number");



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_quotation_number_key" UNIQUE ("quotation_number");



ALTER TABLE ONLY "public"."part_requests"
    ADD CONSTRAINT "part_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payment_links"
    ADD CONSTRAINT "payment_links_payment_id_invoice_id_key" UNIQUE ("payment_id", "invoice_id");



ALTER TABLE ONLY "public"."payment_links"
    ADD CONSTRAINT "payment_links_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payout_adjustments"
    ADD CONSTRAINT "payout_adjustments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."positions"
    ADD CONSTRAINT "positions_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."positions"
    ADD CONSTRAINT "positions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pricing_rules"
    ADD CONSTRAINT "pricing_rules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."repair_task_history"
    ADD CONSTRAINT "repair_task_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."repair_tasks"
    ADD CONSTRAINT "repair_tasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."service_categories"
    ADD CONSTRAINT "service_categories_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."service_categories"
    ADD CONSTRAINT "service_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."service_history"
    ADD CONSTRAINT "service_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."service_types"
    ADD CONSTRAINT "service_types_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."service_types"
    ADD CONSTRAINT "service_types_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."service_vehicle_applicability"
    ADD CONSTRAINT "service_vehicle_applicability_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."service_vehicle_applicability"
    ADD CONSTRAINT "service_vehicle_applicability_service_type_id_vehicle_categ_key" UNIQUE ("service_type_id", "vehicle_category_id", "vehicle_type_id");



ALTER TABLE ONLY "public"."task_templates"
    ADD CONSTRAINT "task_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_role_key" UNIQUE ("user_id", "role");



ALTER TABLE ONLY "public"."vehicle_categories"
    ADD CONSTRAINT "vehicle_categories_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."vehicle_categories"
    ADD CONSTRAINT "vehicle_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vehicle_fc_history"
    ADD CONSTRAINT "vehicle_fc_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vehicle_manufacturers"
    ADD CONSTRAINT "vehicle_manufacturers_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."vehicle_manufacturers"
    ADD CONSTRAINT "vehicle_manufacturers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vehicle_models"
    ADD CONSTRAINT "vehicle_models_name_manufacturer_id_vehicle_type_id_key" UNIQUE ("name", "manufacturer_id", "vehicle_type_id");



ALTER TABLE ONLY "public"."vehicle_models"
    ADD CONSTRAINT "vehicle_models_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vehicle_types"
    ADD CONSTRAINT "vehicle_types_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."vehicle_types"
    ADD CONSTRAINT "vehicle_types_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vehicles"
    ADD CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."work_order_approvals"
    ADD CONSTRAINT "work_order_approvals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."work_order_assignments"
    ADD CONSTRAINT "work_order_assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."work_order_assignments"
    ADD CONSTRAINT "work_order_assignments_work_order_id_employee_id_key" UNIQUE ("work_order_id", "employee_id");



ALTER TABLE ONLY "public"."work_order_parts"
    ADD CONSTRAINT "work_order_parts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."work_order_service_employees"
    ADD CONSTRAINT "work_order_service_employees_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."work_order_service_notes"
    ADD CONSTRAINT "work_order_service_notes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."work_order_services"
    ADD CONSTRAINT "work_order_services_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."work_order_stages"
    ADD CONSTRAINT "work_order_stages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."work_order_stages"
    ADD CONSTRAINT "work_order_stages_work_order_id_stage_key" UNIQUE ("work_order_id", "stage");



ALTER TABLE ONLY "public"."work_order_tasks"
    ADD CONSTRAINT "work_order_tasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."work_orders"
    ADD CONSTRAINT "work_orders_pkey" PRIMARY KEY ("id");



CREATE UNIQUE INDEX "idx_customers_user_id" ON "public"."customers" USING "btree" ("user_id");



CREATE UNIQUE INDEX "idx_employees_user_id" ON "public"."employees" USING "btree" ("user_id");



CREATE INDEX "idx_inventory_units_inv_id" ON "public"."inventory_units" USING "btree" ("inventory_id");



CREATE INDEX "idx_inventory_units_qr" ON "public"."inventory_units" USING "btree" ("qr_code");



CREATE INDEX "idx_payment_links_invoice_id" ON "public"."payment_links" USING "btree" ("invoice_id");



CREATE INDEX "idx_payment_links_payment_id" ON "public"."payment_links" USING "btree" ("payment_id");



CREATE UNIQUE INDEX "idx_service_applicability_unique_all" ON "public"."service_vehicle_applicability" USING "btree" ("service_type_id", "vehicle_manufacturer_id", "vehicle_category_id", "vehicle_type_id");



CREATE INDEX "idx_service_history_service_date" ON "public"."service_history" USING "btree" ("service_date" DESC);



CREATE INDEX "idx_service_history_status" ON "public"."service_history" USING "btree" ("status");



CREATE INDEX "idx_service_history_vehicle" ON "public"."service_history" USING "btree" ("vehicle_id");



CREATE INDEX "idx_service_history_work_order" ON "public"."service_history" USING "btree" ("work_order_id");



CREATE UNIQUE INDEX "idx_user_roles_user_id" ON "public"."user_roles" USING "btree" ("user_id");



CREATE OR REPLACE TRIGGER "auto_create_work_order_stages" AFTER INSERT ON "public"."work_orders" FOR EACH ROW EXECUTE FUNCTION "public"."handle_new_work_order"();



CREATE OR REPLACE TRIGGER "on_invoice_finalization" BEFORE UPDATE ON "public"."invoices" FOR EACH ROW EXECUTE FUNCTION "public"."handle_invoice_finalization"();



CREATE OR REPLACE TRIGGER "tr_capture_attendance_correction" BEFORE UPDATE ON "public"."attendance" FOR EACH ROW EXECUTE FUNCTION "public"."fn_capture_attendance_correction"();



CREATE OR REPLACE TRIGGER "tr_log_attendance_change" AFTER INSERT OR UPDATE ON "public"."attendance" FOR EACH ROW EXECUTE FUNCTION "public"."log_attendance_change"();



CREATE OR REPLACE TRIGGER "trigger_auto_create_service_history" AFTER UPDATE ON "public"."work_orders" FOR EACH ROW EXECUTE FUNCTION "public"."auto_create_service_history_v2"();



CREATE OR REPLACE TRIGGER "trigger_reorder_queue" AFTER DELETE OR UPDATE ON "public"."work_order_service_employees" FOR EACH ROW EXECUTE FUNCTION "public"."handle_queue_reorder"();



CREATE OR REPLACE TRIGGER "trigger_sync_work_order_to_vehicle" AFTER UPDATE ON "public"."work_orders" FOR EACH ROW EXECUTE FUNCTION "public"."sync_work_order_to_vehicle"();



CREATE OR REPLACE TRIGGER "update_custom_work_items_updated_at" BEFORE UPDATE ON "public"."custom_work_items" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_customers_updated_at" BEFORE UPDATE ON "public"."customers" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_employees_updated_at" BEFORE UPDATE ON "public"."employees" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_inventory_updated_at" BEFORE UPDATE ON "public"."inventory" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_invoice_items_updated_at" BEFORE UPDATE ON "public"."invoice_items" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_invoices_updated_at" BEFORE UPDATE ON "public"."invoices" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_payments_updated_at" BEFORE UPDATE ON "public"."payments" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_service_types_updated_at" BEFORE UPDATE ON "public"."service_types" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_task_templates_updated_at" BEFORE UPDATE ON "public"."task_templates" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_vehicles_updated_at" BEFORE UPDATE ON "public"."vehicles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_work_order_approvals_updated_at" BEFORE UPDATE ON "public"."work_order_approvals" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_work_order_assignments_updated_at" BEFORE UPDATE ON "public"."work_order_assignments" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_work_order_parts_updated_at" BEFORE UPDATE ON "public"."work_order_parts" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_work_order_service_employees_updated_at" BEFORE UPDATE ON "public"."work_order_service_employees" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_work_order_service_notes_updated_at" BEFORE UPDATE ON "public"."work_order_service_notes" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_work_order_services_updated_at" BEFORE UPDATE ON "public"."work_order_services" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_work_order_stages_updated_at" BEFORE UPDATE ON "public"."work_order_stages" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_work_orders_updated_at" BEFORE UPDATE ON "public"."work_orders" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."attendance"
    ADD CONSTRAINT "attendance_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."attendance_history"
    ADD CONSTRAINT "attendance_history_attendance_id_fkey" FOREIGN KEY ("attendance_id") REFERENCES "public"."attendance"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."attendance_history"
    ADD CONSTRAINT "attendance_history_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."attendance"
    ADD CONSTRAINT "attendance_marked_by_fkey" FOREIGN KEY ("marked_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."attendance"
    ADD CONSTRAINT "attendance_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."custom_work_items"
    ADD CONSTRAINT "custom_work_items_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."employee_payouts"
    ADD CONSTRAINT "employee_payouts_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."employee_salary_configs"
    ADD CONSTRAINT "employee_salary_configs_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."employees"
    ADD CONSTRAINT "employees_position_fk" FOREIGN KEY ("position_id") REFERENCES "public"."positions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."employees"
    ADD CONSTRAINT "employees_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."inventory_returns"
    ADD CONSTRAINT "inventory_returns_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "public"."employees"("id");



ALTER TABLE ONLY "public"."inventory_returns"
    ADD CONSTRAINT "inventory_returns_inventory_id_fkey" FOREIGN KEY ("inventory_id") REFERENCES "public"."inventory"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory_returns"
    ADD CONSTRAINT "inventory_returns_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "public"."employees"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory_returns"
    ADD CONSTRAINT "inventory_returns_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory_transactions"
    ADD CONSTRAINT "inventory_transactions_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."inventory"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory_transactions"
    ADD CONSTRAINT "inventory_transactions_performed_by_fkey" FOREIGN KEY ("performed_by") REFERENCES "public"."employees"("id");



ALTER TABLE ONLY "public"."inventory_units"
    ADD CONSTRAINT "inventory_units_current_work_order_id_fkey" FOREIGN KEY ("current_work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."inventory_units"
    ADD CONSTRAINT "inventory_units_inventory_id_fkey" FOREIGN KEY ("inventory_id") REFERENCES "public"."inventory"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory_units"
    ADD CONSTRAINT "inventory_units_issued_by_fkey" FOREIGN KEY ("issued_by") REFERENCES "public"."employees"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."invoice_items"
    ADD CONSTRAINT "invoice_items_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invoice_items"
    ADD CONSTRAINT "invoice_items_work_order_service_id_fkey" FOREIGN KEY ("work_order_service_id") REFERENCES "public"."work_order_services"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."part_requests"
    ADD CONSTRAINT "part_requests_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "public"."employees"("id");



ALTER TABLE ONLY "public"."part_requests"
    ADD CONSTRAINT "part_requests_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."inventory"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."part_requests"
    ADD CONSTRAINT "part_requests_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "public"."employees"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."part_requests"
    ADD CONSTRAINT "part_requests_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payment_links"
    ADD CONSTRAINT "payment_links_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payment_links"
    ADD CONSTRAINT "payment_links_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_verified_by_fkey" FOREIGN KEY ("verified_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."payout_adjustments"
    ADD CONSTRAINT "payout_adjustments_attendance_id_fkey" FOREIGN KEY ("attendance_id") REFERENCES "public"."attendance"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payout_adjustments"
    ADD CONSTRAINT "payout_adjustments_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payout_adjustments"
    ADD CONSTRAINT "payout_adjustments_payout_id_fkey" FOREIGN KEY ("payout_id") REFERENCES "public"."employee_payouts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payout_adjustments"
    ADD CONSTRAINT "payout_adjustments_processed_payout_id_fkey" FOREIGN KEY ("processed_payout_id") REFERENCES "public"."employee_payouts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."pricing_rules"
    ADD CONSTRAINT "pricing_rules_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pricing_rules"
    ADD CONSTRAINT "pricing_rules_service_type_id_fkey" FOREIGN KEY ("service_type_id") REFERENCES "public"."service_types"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pricing_rules"
    ADD CONSTRAINT "pricing_rules_task_template_id_fkey" FOREIGN KEY ("task_template_id") REFERENCES "public"."task_templates"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pricing_rules"
    ADD CONSTRAINT "pricing_rules_vehicle_category_id_fkey" FOREIGN KEY ("vehicle_category_id") REFERENCES "public"."vehicle_categories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pricing_rules"
    ADD CONSTRAINT "pricing_rules_vehicle_type_id_fkey" FOREIGN KEY ("vehicle_type_id") REFERENCES "public"."vehicle_types"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."repair_tasks"
    ADD CONSTRAINT "repair_tasks_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."service_history"
    ADD CONSTRAINT "service_history_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."service_history"
    ADD CONSTRAINT "service_history_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."service_types"
    ADD CONSTRAINT "service_types_last_updated_by_fkey" FOREIGN KEY ("last_updated_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."service_vehicle_applicability"
    ADD CONSTRAINT "service_vehicle_applicability_service_type_id_fkey" FOREIGN KEY ("service_type_id") REFERENCES "public"."service_types"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."service_vehicle_applicability"
    ADD CONSTRAINT "service_vehicle_applicability_vehicle_category_id_fkey" FOREIGN KEY ("vehicle_category_id") REFERENCES "public"."vehicle_categories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."service_vehicle_applicability"
    ADD CONSTRAINT "service_vehicle_applicability_vehicle_manufacturer_id_fkey" FOREIGN KEY ("vehicle_manufacturer_id") REFERENCES "public"."vehicle_manufacturers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."service_vehicle_applicability"
    ADD CONSTRAINT "service_vehicle_applicability_vehicle_type_id_fkey" FOREIGN KEY ("vehicle_type_id") REFERENCES "public"."vehicle_types"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_templates"
    ADD CONSTRAINT "task_templates_last_updated_by_fkey" FOREIGN KEY ("last_updated_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."task_templates"
    ADD CONSTRAINT "task_templates_service_type_id_fkey" FOREIGN KEY ("service_type_id") REFERENCES "public"."service_types"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."vehicle_fc_history"
    ADD CONSTRAINT "vehicle_fc_history_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."vehicle_fc_history"
    ADD CONSTRAINT "vehicle_fc_history_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."vehicle_models"
    ADD CONSTRAINT "vehicle_models_manufacturer_id_fkey" FOREIGN KEY ("manufacturer_id") REFERENCES "public"."vehicle_manufacturers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."vehicle_models"
    ADD CONSTRAINT "vehicle_models_vehicle_type_id_fkey" FOREIGN KEY ("vehicle_type_id") REFERENCES "public"."vehicle_types"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."vehicle_types"
    ADD CONSTRAINT "vehicle_types_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."vehicle_categories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."vehicles"
    ADD CONSTRAINT "vehicles_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id");



ALTER TABLE ONLY "public"."vehicles"
    ADD CONSTRAINT "vehicles_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "public"."vehicle_models"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."work_order_approvals"
    ADD CONSTRAINT "work_order_approvals_approver_id_fkey" FOREIGN KEY ("approver_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."work_order_approvals"
    ADD CONSTRAINT "work_order_approvals_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."work_order_assignments"
    ADD CONSTRAINT "work_order_assignments_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."work_order_assignments"
    ADD CONSTRAINT "work_order_assignments_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."work_order_assignments"
    ADD CONSTRAINT "work_order_assignments_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."work_order_parts"
    ADD CONSTRAINT "work_order_parts_added_by_fkey" FOREIGN KEY ("added_by") REFERENCES "public"."employees"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."work_order_parts"
    ADD CONSTRAINT "work_order_parts_inventory_id_fkey" FOREIGN KEY ("inventory_id") REFERENCES "public"."inventory"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."work_order_parts"
    ADD CONSTRAINT "work_order_parts_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."work_order_service_employees"
    ADD CONSTRAINT "work_order_service_employees_accepted_by_fkey" FOREIGN KEY ("accepted_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."work_order_service_employees"
    ADD CONSTRAINT "work_order_service_employees_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."work_order_service_employees"
    ADD CONSTRAINT "work_order_service_employees_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."work_order_service_employees"
    ADD CONSTRAINT "work_order_service_employees_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."work_order_services"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."work_order_service_notes"
    ADD CONSTRAINT "work_order_service_notes_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."work_order_service_notes"
    ADD CONSTRAINT "work_order_service_notes_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."work_order_services"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."work_order_services"
    ADD CONSTRAINT "work_order_services_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."work_order_services"
    ADD CONSTRAINT "work_order_services_price_approved_by_fkey" FOREIGN KEY ("price_approved_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."work_order_services"
    ADD CONSTRAINT "work_order_services_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."work_order_stages"
    ADD CONSTRAINT "work_order_stages_completed_by_fkey" FOREIGN KEY ("completed_by") REFERENCES "public"."employees"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."work_order_stages"
    ADD CONSTRAINT "work_order_stages_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."work_order_tasks"
    ADD CONSTRAINT "work_order_tasks_assigned_employee_id_fkey" FOREIGN KEY ("assigned_employee_id") REFERENCES "public"."employees"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."work_order_tasks"
    ADD CONSTRAINT "work_order_tasks_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."work_order_services"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."work_order_tasks"
    ADD CONSTRAINT "work_order_tasks_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."work_orders"
    ADD CONSTRAINT "work_orders_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."work_orders"
    ADD CONSTRAINT "work_orders_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "public"."employees"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."work_orders"
    ADD CONSTRAINT "work_orders_rejected_by_fkey" FOREIGN KEY ("rejected_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."work_orders"
    ADD CONSTRAINT "work_orders_reopened_by_fkey" FOREIGN KEY ("reopened_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."work_orders"
    ADD CONSTRAINT "work_orders_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE CASCADE;



CREATE POLICY "Admins and Managers can update payments" ON "public"."payments" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = ANY (ARRAY['admin'::"text", 'manager'::"text"]))))));



CREATE POLICY "Admins and Staff can delete payment_links" ON "public"."payment_links" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = ANY (ARRAY['admin'::"text", 'manager'::"text", 'staff'::"text"]))))));



CREATE POLICY "Admins and Staff can insert payment_links" ON "public"."payment_links" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = ANY (ARRAY['admin'::"text", 'manager'::"text", 'staff'::"text"]))))));



CREATE POLICY "Admins and Staff can update payment_links" ON "public"."payment_links" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = ANY (ARRAY['admin'::"text", 'manager'::"text", 'staff'::"text"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = ANY (ARRAY['admin'::"text", 'manager'::"text", 'staff'::"text"]))))));



CREATE POLICY "Admins and Staff can view all payment_links" ON "public"."payment_links" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = ANY (ARRAY['admin'::"text", 'manager'::"text", 'staff'::"text"]))))));



CREATE POLICY "Admins and Staff can view all payments" ON "public"."payments" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = ANY (ARRAY['admin'::"text", 'manager'::"text", 'staff'::"text"]))))));



CREATE POLICY "Admins can approve work_order_assignments" ON "public"."work_order_assignments" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = ANY (ARRAY['admin'::"text", 'manager'::"text"]))))));



CREATE POLICY "Admins can approve work_order_service_employees" ON "public"."work_order_service_employees" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = ANY (ARRAY['admin'::"text", 'manager'::"text"]))))));



CREATE POLICY "Admins can create transactions" ON "public"."inventory_transactions" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = ANY (ARRAY['admin'::"text", 'manager'::"text"]))))));



CREATE POLICY "Admins can delete work_order_services" ON "public"."work_order_services" FOR DELETE USING (("auth"."uid"() IN ( SELECT "user_roles"."user_id"
   FROM "public"."user_roles"
  WHERE ("user_roles"."role" = ANY (ARRAY['admin'::"text", 'manager'::"text"])))));



CREATE POLICY "Admins can manage all work orders" ON "public"."work_orders" USING ("public"."check_is_admin"("auth"."uid"()));



CREATE POLICY "Admins can manage approvals" ON "public"."work_order_approvals" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"text")))));



CREATE POLICY "Admins can manage customers" ON "public"."customers" USING ("public"."check_is_admin"("auth"."uid"()));



CREATE POLICY "Admins can manage employees" ON "public"."employees" USING ("public"."check_is_admin"("auth"."uid"()));



CREATE POLICY "Admins can manage inventory" ON "public"."inventory" USING ("public"."check_is_admin"("auth"."uid"()));



CREATE POLICY "Admins can manage invoices" ON "public"."invoices" USING ("public"."check_is_admin"("auth"."uid"()));



CREATE POLICY "Admins can manage positions" ON "public"."positions" USING ("public"."check_is_admin"("auth"."uid"()));



CREATE POLICY "Admins can manage requests" ON "public"."part_requests" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = ANY (ARRAY['admin'::"text", 'manager'::"text"]))))));



CREATE POLICY "Admins can manage return requests" ON "public"."inventory_returns" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = ANY (ARRAY['admin'::"text", 'manager'::"text"]))))));



CREATE POLICY "Admins can manage service history" ON "public"."service_history" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"text")))));



CREATE POLICY "Admins can manage units" ON "public"."inventory_units" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = ANY (ARRAY['admin'::"text", 'manager'::"text"]))))));



CREATE POLICY "Admins can manage user roles" ON "public"."user_roles" USING ("public"."check_is_admin"("auth"."uid"()));



CREATE POLICY "Admins can manage vehicles" ON "public"."vehicles" USING ("public"."check_is_admin"("auth"."uid"()));



CREATE POLICY "Admins can manage work order stages" ON "public"."work_order_stages" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"text")))));



CREATE POLICY "Admins can update payments" ON "public"."payments" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = ANY (ARRAY['admin'::"text", 'manager'::"text"]))))));



CREATE POLICY "Admins can view all payments" ON "public"."payments" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = ANY (ARRAY['admin'::"text", 'manager'::"text", 'staff'::"text"]))))));



CREATE POLICY "Admins can view approvals" ON "public"."work_order_approvals" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = ANY (ARRAY['admin'::"text", 'manager'::"text"]))))));



CREATE POLICY "Admins manage profiles" ON "public"."company_profiles" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = ANY (ARRAY['admin'::"text", 'manager'::"text"]))))));



CREATE POLICY "Admins manage settings" ON "public"."document_settings" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = ANY (ARRAY['admin'::"text", 'manager'::"text"]))))));



CREATE POLICY "Admins+ can manage assignments" ON "public"."work_order_assignments" USING (("auth"."uid"() IN ( SELECT "user_roles"."user_id"
   FROM "public"."user_roles"
  WHERE ("user_roles"."role" = ANY (ARRAY['admin'::"text", 'manager'::"text"])))));



CREATE POLICY "Admins+ can manage service_employees" ON "public"."work_order_service_employees" USING (("auth"."uid"() IN ( SELECT "user_roles"."user_id"
   FROM "public"."user_roles"
  WHERE ("user_roles"."role" = ANY (ARRAY['admin'::"text", 'manager'::"text"])))));



CREATE POLICY "Admins/Managers can manage adjustments" ON "public"."payout_adjustments" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = ANY (ARRAY['admin'::"text", 'manager'::"text"]))))));



CREATE POLICY "Admins/Managers can manage attendance" ON "public"."attendance" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = ANY (ARRAY['admin'::"text", 'manager'::"text"]))))));



CREATE POLICY "Admins/Managers can manage invoice_items" ON "public"."invoice_items" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = ANY (ARRAY['admin'::"text", 'manager'::"text"]))))));



CREATE POLICY "Admins/Managers can manage payouts" ON "public"."employee_payouts" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = ANY (ARRAY['admin'::"text", 'manager'::"text"]))))));



CREATE POLICY "Admins/Managers can manage salary configs" ON "public"."employee_salary_configs" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = ANY (ARRAY['admin'::"text", 'manager'::"text"]))))));



CREATE POLICY "Admins/Managers can view attendance history" ON "public"."attendance_history" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = ANY (ARRAY['admin'::"text", 'manager'::"text"]))))));



CREATE POLICY "Allow admin manage applicability" ON "public"."service_vehicle_applicability" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"text")))));



CREATE POLICY "Allow admin manage categories" ON "public"."vehicle_categories" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"text")))));



CREATE POLICY "Allow admin manage manufacturers" ON "public"."vehicle_manufacturers" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"text")))));



CREATE POLICY "Allow admin manage models" ON "public"."vehicle_models" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"text")))));



CREATE POLICY "Allow admin manage pricing rules" ON "public"."pricing_rules" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"text")))));



CREATE POLICY "Allow admin manage types" ON "public"."vehicle_types" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"text")))));



CREATE POLICY "Allow view applicability" ON "public"."service_vehicle_applicability" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow view categories" ON "public"."vehicle_categories" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow view manufacturers" ON "public"."vehicle_manufacturers" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow view models" ON "public"."vehicle_models" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow view pricing rules" ON "public"."pricing_rules" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow view types" ON "public"."vehicle_types" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Anyone can view company profiles" ON "public"."company_profiles" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Anyone can view document settings" ON "public"."document_settings" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Anyone can view repair task history" ON "public"."repair_task_history" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Anyone can view repair tasks" ON "public"."repair_tasks" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Assigned employee can view own assignments" ON "public"."work_order_assignments" FOR SELECT USING ((("employee_id" IN ( SELECT "employees"."id"
   FROM "public"."employees"
  WHERE ("employees"."user_id" = "auth"."uid"()))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = ANY (ARRAY['admin'::"text", 'manager'::"text"])))))));



CREATE POLICY "Assigned staff can update work orders" ON "public"."work_orders" FOR UPDATE USING ((("assigned_to" = "auth"."uid"()) OR "public"."check_is_staff"("auth"."uid"())));



CREATE POLICY "Authenticated users can read positions" ON "public"."positions" FOR SELECT USING ((("auth"."role"() = ANY (ARRAY['authenticated'::"text", 'admin'::"text"])) OR "public"."check_is_staff"("auth"."uid"())));



CREATE POLICY "Customers can insert payment_links" ON "public"."payment_links" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."invoices" "i"
     JOIN "public"."customers" "c" ON (("i"."customer_id" = "c"."id")))
  WHERE (("i"."id" = "payment_links"."invoice_id") AND ("c"."user_id" = "auth"."uid"())))));



CREATE POLICY "Customers can insert payments" ON "public"."payments" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Customers can view own record" ON "public"."customers" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Customers can view their own invoice items" ON "public"."invoice_items" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."invoices" "i"
     JOIN "public"."customers" "c" ON (("i"."customer_id" = "c"."id")))
  WHERE (("i"."id" = "invoice_items"."invoice_id") AND ("c"."user_id" = "auth"."uid"())))));



CREATE POLICY "Customers can view their own invoices" ON "public"."invoices" FOR SELECT USING (("auth"."uid"() IN ( SELECT "customers"."user_id"
   FROM "public"."customers"
  WHERE ("customers"."id" = "invoices"."customer_id"))));



CREATE POLICY "Customers can view their own payment_links" ON "public"."payment_links" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."invoices" "i"
     JOIN "public"."customers" "c" ON (("i"."customer_id" = "c"."id")))
  WHERE (("i"."id" = "payment_links"."invoice_id") AND ("c"."user_id" = "auth"."uid"())))));



CREATE POLICY "Customers can view their own payments" ON "public"."payments" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."invoices" "i"
     JOIN "public"."customers" "c" ON (("i"."customer_id" = "c"."id")))
  WHERE ((("i"."id" = "payments"."invoice_id") OR ("i"."id" IN ( SELECT "payment_links"."invoice_id"
           FROM "public"."payment_links"
          WHERE ("payment_links"."payment_id" = "payments"."id")))) AND ("c"."user_id" = "auth"."uid"())))));



CREATE POLICY "Customers can view their vehicle history" ON "public"."service_history" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."vehicles" "v"
  WHERE (("v"."id" = "service_history"."vehicle_id") AND ("v"."customer_id" IN ( SELECT "customers"."id"
           FROM "public"."customers"
          WHERE ("customers"."user_id" = "auth"."uid"())))))));



CREATE POLICY "Employees can create requests" ON "public"."part_requests" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = ANY (ARRAY['admin'::"text", 'manager'::"text", 'staff'::"text"]))))));



CREATE POLICY "Employees can create return requests" ON "public"."inventory_returns" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = ANY (ARRAY['admin'::"text", 'manager'::"text", 'staff'::"text"]))))));



CREATE POLICY "Employees can view their own requests" ON "public"."part_requests" FOR SELECT USING (("requested_by" IN ( SELECT "employees"."id"
   FROM "public"."employees"
  WHERE ("employees"."user_id" = "auth"."uid"()))));



CREATE POLICY "Employees can view their own return requests" ON "public"."inventory_returns" FOR SELECT USING (("requested_by" IN ( SELECT "employees"."id"
   FROM "public"."employees"
  WHERE ("employees"."user_id" = "auth"."uid"()))));



CREATE POLICY "Enable all access for staff and admins" ON "public"."task_templates" USING (("public"."has_role"("auth"."uid"(), 'staff'::"text") OR "public"."has_role"("auth"."uid"(), 'admin'::"text") OR "public"."has_role"("auth"."uid"(), 'manager'::"text")));



CREATE POLICY "Enable delete access for admins and managers" ON "public"."service_types" FOR DELETE USING (("public"."has_role"("auth"."uid"(), 'admin'::"text") OR "public"."has_role"("auth"."uid"(), 'manager'::"text")));



CREATE POLICY "Enable insert access for authenticated users" ON "public"."service_categories" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Enable insert access for staff and admins" ON "public"."service_types" FOR INSERT WITH CHECK (("public"."has_role"("auth"."uid"(), 'staff'::"text") OR "public"."has_role"("auth"."uid"(), 'admin'::"text") OR "public"."has_role"("auth"."uid"(), 'manager'::"text")));



CREATE POLICY "Enable read access for authenticated users" ON "public"."service_categories" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Enable read access for authenticated users" ON "public"."service_types" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Enable read access for authenticated users" ON "public"."task_templates" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Enable update access for staff and admins" ON "public"."service_types" FOR UPDATE USING (("public"."has_role"("auth"."uid"(), 'staff'::"text") OR "public"."has_role"("auth"."uid"(), 'admin'::"text") OR "public"."has_role"("auth"."uid"(), 'manager'::"text")));



CREATE POLICY "Public profiles are viewable by everyone" ON "public"."profiles" FOR SELECT USING (true);



CREATE POLICY "Public view company profiles" ON "public"."company_profiles" FOR SELECT USING (true);



CREATE POLICY "Staff can view all service history" ON "public"."service_history" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = ANY (ARRAY['admin'::"text", 'manager'::"text", 'staff'::"text"]))))));



CREATE POLICY "Staff can view own attendance" ON "public"."attendance" FOR SELECT USING (("employee_id" IN ( SELECT "employees"."id"
   FROM "public"."employees"
  WHERE ("employees"."user_id" = "auth"."uid"()))));



CREATE POLICY "Staff can view own payouts" ON "public"."employee_payouts" FOR SELECT USING (("employee_id" IN ( SELECT "employees"."id"
   FROM "public"."employees"
  WHERE ("employees"."user_id" = "auth"."uid"()))));



CREATE POLICY "Staff view profiles" ON "public"."company_profiles" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'staff'::"text")))));



CREATE POLICY "Staff view settings" ON "public"."document_settings" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'staff'::"text")))));



CREATE POLICY "Staff+ can create work orders" ON "public"."work_orders" FOR INSERT WITH CHECK ("public"."check_is_staff"("auth"."uid"()));



CREATE POLICY "Staff+ can insert service_notes" ON "public"."work_order_service_notes" FOR INSERT WITH CHECK (("auth"."uid"() IN ( SELECT "user_roles"."user_id"
   FROM "public"."user_roles"
  WHERE ("user_roles"."role" = ANY (ARRAY['admin'::"text", 'manager'::"text", 'staff'::"text"])))));



CREATE POLICY "Staff+ can insert work_order_services" ON "public"."work_order_services" FOR INSERT WITH CHECK (("auth"."uid"() IN ( SELECT "user_roles"."user_id"
   FROM "public"."user_roles"
  WHERE ("user_roles"."role" = ANY (ARRAY['admin'::"text", 'manager'::"text", 'staff'::"text"])))));



CREATE POLICY "Staff+ can manage custom_work_items" ON "public"."custom_work_items" USING (("auth"."uid"() IN ( SELECT "user_roles"."user_id"
   FROM "public"."user_roles"
  WHERE ("user_roles"."role" = ANY (ARRAY['admin'::"text", 'staff'::"text"])))));



CREATE POLICY "Staff+ can manage fc history" ON "public"."vehicle_fc_history" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = ANY (ARRAY['admin'::"text", 'manager'::"text", 'staff'::"text"]))))));



CREATE POLICY "Staff+ can manage work order parts" ON "public"."work_order_parts" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = ANY (ARRAY['admin'::"text", 'manager'::"text", 'staff'::"text"]))))));



CREATE POLICY "Staff+ can read assignments" ON "public"."work_order_assignments" FOR SELECT USING ((("auth"."uid"() IN ( SELECT "user_roles"."user_id"
   FROM "public"."user_roles"
  WHERE ("user_roles"."role" = ANY (ARRAY['admin'::"text", 'manager'::"text", 'staff'::"text"])))) OR ("employee_id" IN ( SELECT "employees"."id"
   FROM "public"."employees"
  WHERE ("employees"."user_id" = "auth"."uid"())))));



CREATE POLICY "Staff+ can read custom_work_items" ON "public"."custom_work_items" FOR SELECT USING (("auth"."uid"() IN ( SELECT "user_roles"."user_id"
   FROM "public"."user_roles"
  WHERE ("user_roles"."role" = ANY (ARRAY['admin'::"text", 'staff'::"text"])))));



CREATE POLICY "Staff+ can read customers" ON "public"."customers" FOR SELECT USING (("auth"."uid"() IN ( SELECT "user_roles"."user_id"
   FROM "public"."user_roles"
  WHERE ("user_roles"."role" = ANY (ARRAY['admin'::"text", 'manager'::"text", 'staff'::"text"])))));



CREATE POLICY "Staff+ can read employees" ON "public"."employees" FOR SELECT USING ("public"."check_is_staff"("auth"."uid"()));



CREATE POLICY "Staff+ can read inventory" ON "public"."inventory" FOR SELECT USING ("public"."check_is_staff"("auth"."uid"()));



CREATE POLICY "Staff+ can read invoice_items" ON "public"."invoice_items" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = ANY (ARRAY['admin'::"text", 'manager'::"text", 'staff'::"text"]))))));



CREATE POLICY "Staff+ can read invoices" ON "public"."invoices" FOR SELECT USING ("public"."check_is_staff"("auth"."uid"()));



CREATE POLICY "Staff+ can read service_employees" ON "public"."work_order_service_employees" FOR SELECT USING (("auth"."uid"() IN ( SELECT "user_roles"."user_id"
   FROM "public"."user_roles"
  WHERE ("user_roles"."role" = ANY (ARRAY['admin'::"text", 'manager'::"text", 'staff'::"text"])))));



CREATE POLICY "Staff+ can read service_notes" ON "public"."work_order_service_notes" FOR SELECT USING (("auth"."uid"() IN ( SELECT "user_roles"."user_id"
   FROM "public"."user_roles"
  WHERE ("user_roles"."role" = ANY (ARRAY['admin'::"text", 'manager'::"text", 'staff'::"text"])))));



CREATE POLICY "Staff+ can read vehicles" ON "public"."vehicles" FOR SELECT USING (("auth"."uid"() IN ( SELECT "user_roles"."user_id"
   FROM "public"."user_roles"
  WHERE ("user_roles"."role" = ANY (ARRAY['admin'::"text", 'manager'::"text", 'staff'::"text"])))));



CREATE POLICY "Staff+ can read work orders" ON "public"."work_orders" FOR SELECT USING ("public"."check_is_staff"("auth"."uid"()));



CREATE POLICY "Staff+ can read work_order_services" ON "public"."work_order_services" FOR SELECT USING (("auth"."uid"() IN ( SELECT "user_roles"."user_id"
   FROM "public"."user_roles"
  WHERE ("user_roles"."role" = ANY (ARRAY['admin'::"text", 'manager'::"text", 'staff'::"text"])))));



CREATE POLICY "Staff+ can update service_notes" ON "public"."work_order_service_notes" FOR UPDATE USING (("auth"."uid"() IN ( SELECT "user_roles"."user_id"
   FROM "public"."user_roles"
  WHERE ("user_roles"."role" = ANY (ARRAY['admin'::"text", 'manager'::"text", 'staff'::"text"])))));



CREATE POLICY "Staff+ can update work_order_services" ON "public"."work_order_services" FOR UPDATE USING (("auth"."uid"() IN ( SELECT "user_roles"."user_id"
   FROM "public"."user_roles"
  WHERE ("user_roles"."role" = ANY (ARRAY['admin'::"text", 'manager'::"text", 'staff'::"text"])))));



CREATE POLICY "Staff+ can view all requests" ON "public"."part_requests" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = ANY (ARRAY['admin'::"text", 'manager'::"text", 'staff'::"text"]))))));



CREATE POLICY "Staff+ can view all return requests" ON "public"."inventory_returns" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = ANY (ARRAY['admin'::"text", 'manager'::"text", 'staff'::"text"]))))));



CREATE POLICY "Staff+ can view assigned work" ON "public"."work_orders" FOR SELECT USING ((("auth"."uid"() IN ( SELECT "user_roles"."user_id"
   FROM "public"."user_roles"
  WHERE ("user_roles"."role" = ANY (ARRAY['admin'::"text", 'manager'::"text", 'staff'::"text"])))) OR ("assigned_to" IN ( SELECT "employees"."id"
   FROM "public"."employees"
  WHERE ("employees"."user_id" = "auth"."uid"()))) OR (EXISTS ( SELECT 1
   FROM ("public"."work_order_service_employees" "wose"
     JOIN "public"."work_order_services" "wos" ON (("wos"."id" = "wose"."service_id")))
  WHERE (("wos"."work_order_id" = "work_orders"."id") AND ("wose"."employee_id" IN ( SELECT "employees"."id"
           FROM "public"."employees"
          WHERE ("employees"."user_id" = "auth"."uid"()))))))));



CREATE POLICY "Staff+ can view fc history" ON "public"."vehicle_fc_history" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = ANY (ARRAY['admin'::"text", 'manager'::"text", 'staff'::"text"]))))));



CREATE POLICY "Staff+ can view transactions" ON "public"."inventory_transactions" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = ANY (ARRAY['admin'::"text", 'manager'::"text", 'staff'::"text"]))))));



CREATE POLICY "Staff+ can view units" ON "public"."inventory_units" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = ANY (ARRAY['admin'::"text", 'manager'::"text", 'staff'::"text"]))))));



CREATE POLICY "Staff+ can view work order parts" ON "public"."work_order_parts" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = ANY (ARRAY['admin'::"text", 'manager'::"text", 'staff'::"text"]))))));



CREATE POLICY "Staff+ can view work order stages" ON "public"."work_order_stages" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = ANY (ARRAY['admin'::"text", 'manager'::"text", 'staff'::"text"]))))));



CREATE POLICY "Users can update own profile" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can view own employee record" ON "public"."employees" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR ("auth"."uid"() IN ( SELECT "user_roles"."user_id"
   FROM "public"."user_roles"
  WHERE ("user_roles"."role" = ANY (ARRAY['admin'::"text", 'manager'::"text"]))))));



CREATE POLICY "Users can view own role" ON "public"."user_roles" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "admin access" ON "public"."employees" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"text")))));



CREATE POLICY "admin full access employees" ON "public"."employees" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"text")))));



ALTER TABLE "public"."attendance" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."attendance_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."company_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."custom_work_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."customers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."document_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."employee_payouts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."employee_salary_configs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."employees" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."inventory" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."inventory_returns" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."inventory_transactions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."inventory_units" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."invoice_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."invoices" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."part_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."payment_links" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."payments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."payout_adjustments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."positions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pricing_rules" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "read own customer record" ON "public"."customers" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "read own profile" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "id"));



CREATE POLICY "read own role" ON "public"."user_roles" FOR SELECT USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."repair_task_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."repair_tasks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."service_categories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."service_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."service_types" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."service_vehicle_applicability" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."task_templates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_roles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."vehicle_categories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."vehicle_fc_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."vehicle_manufacturers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."vehicle_models" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."vehicle_types" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."vehicles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."work_order_approvals" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."work_order_assignments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."work_order_parts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."work_order_service_employees" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."work_order_service_notes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."work_order_services" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."work_order_stages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."work_orders" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."work_order_service_employees";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."work_order_services";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."work_order_tasks";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."work_orders";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."accept_task"("_assignment_id" "uuid", "_employee_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."accept_task"("_assignment_id" "uuid", "_employee_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."accept_task"("_assignment_id" "uuid", "_employee_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."accept_work_assignment"("p_assignment_id" "uuid", "p_employee_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."accept_work_assignment"("p_assignment_id" "uuid", "p_employee_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."accept_work_assignment"("p_assignment_id" "uuid", "p_employee_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."advance_work_order_stage"("_work_order_id" "uuid", "_stage" "text", "_employee_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."advance_work_order_stage"("_work_order_id" "uuid", "_stage" "text", "_employee_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."advance_work_order_stage"("_work_order_id" "uuid", "_stage" "text", "_employee_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."approve_all_pending_assignments"("p_work_order_id" "uuid", "p_approver_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."approve_all_pending_assignments"("p_work_order_id" "uuid", "p_approver_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."approve_all_pending_assignments"("p_work_order_id" "uuid", "p_approver_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."approve_inspection"("p_work_order_id" "uuid", "p_inspector_id" "uuid", "p_notes" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."approve_inspection"("p_work_order_id" "uuid", "p_inspector_id" "uuid", "p_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."approve_inspection"("p_work_order_id" "uuid", "p_inspector_id" "uuid", "p_notes" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."approve_inspection_stage"("p_work_order_id" "uuid", "p_approver_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."approve_inspection_stage"("p_work_order_id" "uuid", "p_approver_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."approve_inspection_stage"("p_work_order_id" "uuid", "p_approver_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."approve_part_request"("_request_id" "uuid", "_approved_qty" integer, "_admin_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."approve_part_request"("_request_id" "uuid", "_approved_qty" integer, "_admin_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."approve_part_request"("_request_id" "uuid", "_approved_qty" integer, "_admin_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."approve_repair_stage"("p_work_order_id" "uuid", "p_approver_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."approve_repair_stage"("p_work_order_id" "uuid", "p_approver_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."approve_repair_stage"("p_work_order_id" "uuid", "p_approver_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."approve_repairs"("p_work_order_id" "uuid", "p_approver_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."approve_repairs"("p_work_order_id" "uuid", "p_approver_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."approve_repairs"("p_work_order_id" "uuid", "p_approver_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."approve_review_stage"("p_work_order_id" "uuid", "p_approver_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."approve_review_stage"("p_work_order_id" "uuid", "p_approver_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."approve_review_stage"("p_work_order_id" "uuid", "p_approver_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."approve_task"("_assignment_id" "uuid", "_assignment_type" "text", "_approver_id" "uuid", "_notes" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."approve_task"("_assignment_id" "uuid", "_assignment_type" "text", "_approver_id" "uuid", "_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."approve_task"("_assignment_id" "uuid", "_assignment_type" "text", "_approver_id" "uuid", "_notes" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."approve_work"("p_work_order_id" "uuid", "p_approver_id" "uuid", "p_notes" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."approve_work"("p_work_order_id" "uuid", "p_approver_id" "uuid", "p_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."approve_work"("p_work_order_id" "uuid", "p_approver_id" "uuid", "p_notes" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."approve_work_order"("_work_order_id" "uuid", "_approver_id" "uuid", "_approval_type" "text", "_notes" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."approve_work_order"("_work_order_id" "uuid", "_approver_id" "uuid", "_approval_type" "text", "_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."approve_work_order"("_work_order_id" "uuid", "_approver_id" "uuid", "_approval_type" "text", "_notes" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."auto_create_service_history_v2"() TO "anon";
GRANT ALL ON FUNCTION "public"."auto_create_service_history_v2"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."auto_create_service_history_v2"() TO "service_role";



GRANT ALL ON FUNCTION "public"."backfill_service_history"() TO "anon";
GRANT ALL ON FUNCTION "public"."backfill_service_history"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."backfill_service_history"() TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_employee_payouts"("_period_start" "date", "_period_end" "date", "_admin_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_employee_payouts"("_period_start" "date", "_period_end" "date", "_admin_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_employee_payouts"("_period_start" "date", "_period_end" "date", "_admin_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_admin_role"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."check_admin_role"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_admin_role"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_is_admin"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."check_is_admin"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_is_admin"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_is_staff"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."check_is_staff"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_is_staff"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."complete_repair_and_advance"("p_work_order_id" "uuid", "p_approver_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."complete_repair_and_advance"("p_work_order_id" "uuid", "p_approver_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."complete_repair_and_advance"("p_work_order_id" "uuid", "p_approver_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."complete_repair_task"("p_task_id" "uuid", "p_completed_by" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."complete_repair_task"("p_task_id" "uuid", "p_completed_by" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."complete_repair_task"("p_task_id" "uuid", "p_completed_by" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."complete_task"("p_task_id" "uuid", "p_employee_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."complete_task"("p_task_id" "uuid", "p_employee_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."complete_task"("p_task_id" "uuid", "p_employee_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_work_order_stages"("p_work_order_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."create_work_order_stages"("p_work_order_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_work_order_stages"("p_work_order_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_capture_attendance_correction"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_capture_attendance_correction"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_capture_attendance_correction"() TO "service_role";



GRANT ALL ON FUNCTION "public"."force_complete_repair"("p_work_order_id" "uuid", "p_admin_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."force_complete_repair"("p_work_order_id" "uuid", "p_admin_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."force_complete_repair"("p_work_order_id" "uuid", "p_admin_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_inventory_units"("_inventory_id" "uuid", "_quantity" integer, "_sku" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."generate_inventory_units"("_inventory_id" "uuid", "_quantity" integer, "_sku" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_inventory_units"("_inventory_id" "uuid", "_quantity" integer, "_sku" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_bottleneck_analysis"("p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."get_bottleneck_analysis"("p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_bottleneck_analysis"("p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_comprehensive_operational_analytics"("p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone, "p_service_type" "text", "p_department" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_comprehensive_operational_analytics"("p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone, "p_service_type" "text", "p_department" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_comprehensive_operational_analytics"("p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone, "p_service_type" "text", "p_department" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_customer_insights"("p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."get_customer_insights"("p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_customer_insights"("p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_dashboard_summary"("p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."get_dashboard_summary"("p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_dashboard_summary"("p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_employee_active_workload"("p_employee_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_employee_active_workload"("p_employee_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_employee_active_workload"("p_employee_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_employee_analytics"("p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."get_employee_analytics"("p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_employee_analytics"("p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_employee_id_from_user"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_employee_id_from_user"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_employee_id_from_user"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_employee_performance_metrics"("p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone, "p_employee_id" "uuid", "p_department" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_employee_performance_metrics"("p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone, "p_employee_id" "uuid", "p_department" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_employee_performance_metrics"("p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone, "p_employee_id" "uuid", "p_department" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_financial_analytics"("p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."get_financial_analytics"("p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_financial_analytics"("p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_financial_analytics_v2"("p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone, "p_service_type" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_financial_analytics_v2"("p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone, "p_service_type" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_financial_analytics_v2"("p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone, "p_service_type" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_operational_analytics"("p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."get_operational_analytics"("p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_operational_analytics"("p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_realtime_status_indicators"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_realtime_status_indicators"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_realtime_status_indicators"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_service_department_metrics"("p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."get_service_department_metrics"("p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_service_department_metrics"("p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_staff_assigned_work"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_staff_assigned_work"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_staff_assigned_work"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_invoice_finalization"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_invoice_finalization"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_invoice_finalization"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_work_order"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_work_order"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_work_order"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_queue_reorder"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_queue_reorder"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_queue_reorder"() TO "service_role";



GRANT ALL ON FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."insert_work_order_assignment"("p_work_order_id" "uuid", "p_employee_id" "uuid", "p_notes" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."insert_work_order_assignment"("p_work_order_id" "uuid", "p_employee_id" "uuid", "p_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."insert_work_order_assignment"("p_work_order_id" "uuid", "p_employee_id" "uuid", "p_notes" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."insert_work_order_service_employee"("p_service_id" "uuid", "p_employee_id" "uuid", "p_status" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."insert_work_order_service_employee"("p_service_id" "uuid", "p_employee_id" "uuid", "p_status" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."insert_work_order_service_employee"("p_service_id" "uuid", "p_employee_id" "uuid", "p_status" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."insert_work_order_service_employee"("p_service_id" "uuid", "p_employee_id" "uuid", "p_status" "text", "p_queue_position" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."insert_work_order_service_employee"("p_service_id" "uuid", "p_employee_id" "uuid", "p_status" "text", "p_queue_position" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."insert_work_order_service_employee"("p_service_id" "uuid", "p_employee_id" "uuid", "p_status" "text", "p_queue_position" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."is_admin"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."issue_part_request"("_request_id" "uuid", "_issued_qty" integer, "_employee_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."issue_part_request"("_request_id" "uuid", "_issued_qty" integer, "_employee_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."issue_part_request"("_request_id" "uuid", "_issued_qty" integer, "_employee_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."log_attendance_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_attendance_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_attendance_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."populate_missing_work_order_stages"() TO "anon";
GRANT ALL ON FUNCTION "public"."populate_missing_work_order_stages"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."populate_missing_work_order_stages"() TO "service_role";



GRANT ALL ON FUNCTION "public"."process_part_return"("_return_id" "uuid", "_status" "text", "_admin_id" "uuid", "_notes" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."process_part_return"("_return_id" "uuid", "_status" "text", "_admin_id" "uuid", "_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."process_part_return"("_return_id" "uuid", "_status" "text", "_admin_id" "uuid", "_notes" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."reject_inspection"("p_work_order_id" "uuid", "p_inspector_id" "uuid", "p_notes" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."reject_inspection"("p_work_order_id" "uuid", "p_inspector_id" "uuid", "p_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."reject_inspection"("p_work_order_id" "uuid", "p_inspector_id" "uuid", "p_notes" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."reject_part_request"("_request_id" "uuid", "_admin_id" "uuid", "_notes" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."reject_part_request"("_request_id" "uuid", "_admin_id" "uuid", "_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."reject_part_request"("_request_id" "uuid", "_admin_id" "uuid", "_notes" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."reject_task"("_assignment_id" "uuid", "_assignment_type" "text", "_rejector_id" "uuid", "_notes" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."reject_task"("_assignment_id" "uuid", "_assignment_type" "text", "_rejector_id" "uuid", "_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."reject_task"("_assignment_id" "uuid", "_assignment_type" "text", "_rejector_id" "uuid", "_notes" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."reject_work_tasks"("p_work_order_id" "uuid", "p_task_ids" "uuid"[], "p_reason" "text", "p_approver_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."reject_work_tasks"("p_work_order_id" "uuid", "p_task_ids" "uuid"[], "p_reason" "text", "p_approver_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."reject_work_tasks"("p_work_order_id" "uuid", "p_task_ids" "uuid"[], "p_reason" "text", "p_approver_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."release_unissued_reservation"("_request_id" "uuid", "_admin_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."release_unissued_reservation"("_request_id" "uuid", "_admin_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."release_unissued_reservation"("_request_id" "uuid", "_admin_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."reopen_repair_task"("p_task_id" "uuid", "p_reopened_by" "uuid", "p_reason" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."reopen_repair_task"("p_task_id" "uuid", "p_reopened_by" "uuid", "p_reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."reopen_repair_task"("p_task_id" "uuid", "p_reopened_by" "uuid", "p_reason" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."reopen_repairs"("p_work_order_id" "uuid", "p_reopened_by" "uuid", "p_reason" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."reopen_repairs"("p_work_order_id" "uuid", "p_reopened_by" "uuid", "p_reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."reopen_repairs"("p_work_order_id" "uuid", "p_reopened_by" "uuid", "p_reason" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."reopen_task"("p_task_id" "uuid", "p_employee_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."reopen_task"("p_task_id" "uuid", "p_employee_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."reopen_task"("p_task_id" "uuid", "p_employee_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."reopen_work_order"("p_work_order_id" "uuid", "p_reason" "text", "p_admin_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."reopen_work_order"("p_work_order_id" "uuid", "p_reason" "text", "p_admin_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."reopen_work_order"("p_work_order_id" "uuid", "p_reason" "text", "p_admin_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."request_changes"("p_work_order_id" "uuid", "p_approver_id" "uuid", "p_notes" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."request_changes"("p_work_order_id" "uuid", "p_approver_id" "uuid", "p_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."request_changes"("p_work_order_id" "uuid", "p_approver_id" "uuid", "p_notes" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."request_part_return"("_work_order_id" "uuid", "_inventory_id" "uuid", "_quantity" integer, "_reason" "text", "_condition" "text", "_employee_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."request_part_return"("_work_order_id" "uuid", "_inventory_id" "uuid", "_quantity" integer, "_reason" "text", "_condition" "text", "_employee_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."request_part_return"("_work_order_id" "uuid", "_inventory_id" "uuid", "_quantity" integer, "_reason" "text", "_condition" "text", "_employee_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."scan_and_issue_unit"("_qr_code" "text", "_work_order_id" "uuid", "_employee_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."scan_and_issue_unit"("_qr_code" "text", "_work_order_id" "uuid", "_employee_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."scan_and_issue_unit"("_qr_code" "text", "_work_order_id" "uuid", "_employee_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."start_repair_task"("p_task_id" "uuid", "p_started_by" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."start_repair_task"("p_task_id" "uuid", "p_started_by" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."start_repair_task"("p_task_id" "uuid", "p_started_by" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_work_order_to_vehicle"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_work_order_to_vehicle"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_work_order_to_vehicle"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_customer_portal"("p_work_order_id" "uuid", "p_make_visible" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."update_customer_portal"("p_work_order_id" "uuid", "p_make_visible" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_customer_portal"("p_work_order_id" "uuid", "p_make_visible" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_work_order_stage"("p_work_order_id" "uuid", "p_completed_stages" "text"[], "p_approver_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."update_work_order_stage"("p_work_order_id" "uuid", "p_completed_stages" "text"[], "p_approver_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_work_order_stage"("p_work_order_id" "uuid", "p_completed_stages" "text"[], "p_approver_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_work_order_task_status"("p_task_id" "uuid", "p_work_order_id" "uuid", "p_completed" boolean, "p_employee_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."update_work_order_task_status"("p_task_id" "uuid", "p_work_order_id" "uuid", "p_completed" boolean, "p_employee_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_work_order_task_status"("p_task_id" "uuid", "p_work_order_id" "uuid", "p_completed" boolean, "p_employee_id" "uuid") TO "service_role";


















GRANT ALL ON TABLE "public"."attendance" TO "anon";
GRANT ALL ON TABLE "public"."attendance" TO "authenticated";
GRANT ALL ON TABLE "public"."attendance" TO "service_role";



GRANT ALL ON TABLE "public"."attendance_history" TO "anon";
GRANT ALL ON TABLE "public"."attendance_history" TO "authenticated";
GRANT ALL ON TABLE "public"."attendance_history" TO "service_role";



GRANT ALL ON TABLE "public"."company_profiles" TO "anon";
GRANT ALL ON TABLE "public"."company_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."company_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."custom_work_items" TO "anon";
GRANT ALL ON TABLE "public"."custom_work_items" TO "authenticated";
GRANT ALL ON TABLE "public"."custom_work_items" TO "service_role";



GRANT ALL ON TABLE "public"."customers" TO "anon";
GRANT ALL ON TABLE "public"."customers" TO "authenticated";
GRANT ALL ON TABLE "public"."customers" TO "service_role";



GRANT ALL ON TABLE "public"."document_settings" TO "anon";
GRANT ALL ON TABLE "public"."document_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."document_settings" TO "service_role";



GRANT ALL ON TABLE "public"."employees" TO "anon";
GRANT ALL ON TABLE "public"."employees" TO "authenticated";
GRANT ALL ON TABLE "public"."employees" TO "service_role";



GRANT ALL ON TABLE "public"."positions" TO "anon";
GRANT ALL ON TABLE "public"."positions" TO "authenticated";
GRANT ALL ON TABLE "public"."positions" TO "service_role";



GRANT ALL ON TABLE "public"."employee_details" TO "anon";
GRANT ALL ON TABLE "public"."employee_details" TO "authenticated";
GRANT ALL ON TABLE "public"."employee_details" TO "service_role";



GRANT ALL ON TABLE "public"."employee_payouts" TO "anon";
GRANT ALL ON TABLE "public"."employee_payouts" TO "authenticated";
GRANT ALL ON TABLE "public"."employee_payouts" TO "service_role";



GRANT ALL ON TABLE "public"."inventory_returns" TO "anon";
GRANT ALL ON TABLE "public"."inventory_returns" TO "authenticated";
GRANT ALL ON TABLE "public"."inventory_returns" TO "service_role";



GRANT ALL ON TABLE "public"."part_requests" TO "anon";
GRANT ALL ON TABLE "public"."part_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."part_requests" TO "service_role";



GRANT ALL ON TABLE "public"."work_order_assignments" TO "anon";
GRANT ALL ON TABLE "public"."work_order_assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."work_order_assignments" TO "service_role";



GRANT ALL ON TABLE "public"."work_orders" TO "anon";
GRANT ALL ON TABLE "public"."work_orders" TO "authenticated";
GRANT ALL ON TABLE "public"."work_orders" TO "service_role";



GRANT ALL ON TABLE "public"."employee_performance_metrics" TO "anon";
GRANT ALL ON TABLE "public"."employee_performance_metrics" TO "authenticated";
GRANT ALL ON TABLE "public"."employee_performance_metrics" TO "service_role";



GRANT ALL ON TABLE "public"."employee_salary_configs" TO "anon";
GRANT ALL ON TABLE "public"."employee_salary_configs" TO "authenticated";
GRANT ALL ON TABLE "public"."employee_salary_configs" TO "service_role";



GRANT ALL ON TABLE "public"."vehicles" TO "anon";
GRANT ALL ON TABLE "public"."vehicles" TO "authenticated";
GRANT ALL ON TABLE "public"."vehicles" TO "service_role";



GRANT ALL ON TABLE "public"."employee_tasks" TO "anon";
GRANT ALL ON TABLE "public"."employee_tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."employee_tasks" TO "service_role";



GRANT ALL ON TABLE "public"."inventory" TO "anon";
GRANT ALL ON TABLE "public"."inventory" TO "authenticated";
GRANT ALL ON TABLE "public"."inventory" TO "service_role";



GRANT ALL ON TABLE "public"."inventory_transactions" TO "anon";
GRANT ALL ON TABLE "public"."inventory_transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."inventory_transactions" TO "service_role";



GRANT ALL ON TABLE "public"."inventory_lifecycle_history" TO "anon";
GRANT ALL ON TABLE "public"."inventory_lifecycle_history" TO "authenticated";
GRANT ALL ON TABLE "public"."inventory_lifecycle_history" TO "service_role";



GRANT ALL ON TABLE "public"."inventory_units" TO "anon";
GRANT ALL ON TABLE "public"."inventory_units" TO "authenticated";
GRANT ALL ON TABLE "public"."inventory_units" TO "service_role";



GRANT ALL ON SEQUENCE "public"."invoice_bill_number_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."invoice_bill_number_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."invoice_bill_number_seq" TO "service_role";



GRANT ALL ON TABLE "public"."invoice_items" TO "anon";
GRANT ALL ON TABLE "public"."invoice_items" TO "authenticated";
GRANT ALL ON TABLE "public"."invoice_items" TO "service_role";



GRANT ALL ON TABLE "public"."invoices" TO "anon";
GRANT ALL ON TABLE "public"."invoices" TO "authenticated";
GRANT ALL ON TABLE "public"."invoices" TO "service_role";



GRANT ALL ON TABLE "public"."payment_links" TO "anon";
GRANT ALL ON TABLE "public"."payment_links" TO "authenticated";
GRANT ALL ON TABLE "public"."payment_links" TO "service_role";



GRANT ALL ON TABLE "public"."payments" TO "anon";
GRANT ALL ON TABLE "public"."payments" TO "authenticated";
GRANT ALL ON TABLE "public"."payments" TO "service_role";



GRANT ALL ON TABLE "public"."payout_adjustments" TO "anon";
GRANT ALL ON TABLE "public"."payout_adjustments" TO "authenticated";
GRANT ALL ON TABLE "public"."payout_adjustments" TO "service_role";



GRANT ALL ON TABLE "public"."pricing_rules" TO "anon";
GRANT ALL ON TABLE "public"."pricing_rules" TO "authenticated";
GRANT ALL ON TABLE "public"."pricing_rules" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON SEQUENCE "public"."quotation_number_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."quotation_number_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."quotation_number_seq" TO "service_role";



GRANT ALL ON TABLE "public"."repair_task_history" TO "anon";
GRANT ALL ON TABLE "public"."repair_task_history" TO "authenticated";
GRANT ALL ON TABLE "public"."repair_task_history" TO "service_role";



GRANT ALL ON TABLE "public"."repair_tasks" TO "anon";
GRANT ALL ON TABLE "public"."repair_tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."repair_tasks" TO "service_role";



GRANT ALL ON TABLE "public"."service_categories" TO "anon";
GRANT ALL ON TABLE "public"."service_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."service_categories" TO "service_role";



GRANT ALL ON TABLE "public"."service_history" TO "anon";
GRANT ALL ON TABLE "public"."service_history" TO "authenticated";
GRANT ALL ON TABLE "public"."service_history" TO "service_role";



GRANT ALL ON TABLE "public"."service_types" TO "anon";
GRANT ALL ON TABLE "public"."service_types" TO "authenticated";
GRANT ALL ON TABLE "public"."service_types" TO "service_role";



GRANT ALL ON TABLE "public"."service_vehicle_applicability" TO "anon";
GRANT ALL ON TABLE "public"."service_vehicle_applicability" TO "authenticated";
GRANT ALL ON TABLE "public"."service_vehicle_applicability" TO "service_role";



GRANT ALL ON TABLE "public"."task_templates" TO "anon";
GRANT ALL ON TABLE "public"."task_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."task_templates" TO "service_role";



GRANT ALL ON TABLE "public"."user_roles" TO "anon";
GRANT ALL ON TABLE "public"."user_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_roles" TO "service_role";



GRANT ALL ON TABLE "public"."vehicle_categories" TO "anon";
GRANT ALL ON TABLE "public"."vehicle_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."vehicle_categories" TO "service_role";



GRANT ALL ON TABLE "public"."vehicle_fc_history" TO "anon";
GRANT ALL ON TABLE "public"."vehicle_fc_history" TO "authenticated";
GRANT ALL ON TABLE "public"."vehicle_fc_history" TO "service_role";



GRANT ALL ON TABLE "public"."vehicle_manufacturers" TO "anon";
GRANT ALL ON TABLE "public"."vehicle_manufacturers" TO "authenticated";
GRANT ALL ON TABLE "public"."vehicle_manufacturers" TO "service_role";



GRANT ALL ON TABLE "public"."vehicle_models" TO "anon";
GRANT ALL ON TABLE "public"."vehicle_models" TO "authenticated";
GRANT ALL ON TABLE "public"."vehicle_models" TO "service_role";



GRANT ALL ON TABLE "public"."vehicle_types" TO "anon";
GRANT ALL ON TABLE "public"."vehicle_types" TO "authenticated";
GRANT ALL ON TABLE "public"."vehicle_types" TO "service_role";



GRANT ALL ON TABLE "public"."work_order_approvals" TO "anon";
GRANT ALL ON TABLE "public"."work_order_approvals" TO "authenticated";
GRANT ALL ON TABLE "public"."work_order_approvals" TO "service_role";



GRANT ALL ON TABLE "public"."work_order_parts" TO "anon";
GRANT ALL ON TABLE "public"."work_order_parts" TO "authenticated";
GRANT ALL ON TABLE "public"."work_order_parts" TO "service_role";



GRANT ALL ON TABLE "public"."work_order_stages" TO "anon";
GRANT ALL ON TABLE "public"."work_order_stages" TO "authenticated";
GRANT ALL ON TABLE "public"."work_order_stages" TO "service_role";



GRANT ALL ON TABLE "public"."work_order_details" TO "anon";
GRANT ALL ON TABLE "public"."work_order_details" TO "authenticated";
GRANT ALL ON TABLE "public"."work_order_details" TO "service_role";



GRANT ALL ON TABLE "public"."work_order_service_employees" TO "anon";
GRANT ALL ON TABLE "public"."work_order_service_employees" TO "authenticated";
GRANT ALL ON TABLE "public"."work_order_service_employees" TO "service_role";



GRANT ALL ON TABLE "public"."work_order_service_notes" TO "anon";
GRANT ALL ON TABLE "public"."work_order_service_notes" TO "authenticated";
GRANT ALL ON TABLE "public"."work_order_service_notes" TO "service_role";



GRANT ALL ON TABLE "public"."work_order_services" TO "anon";
GRANT ALL ON TABLE "public"."work_order_services" TO "authenticated";
GRANT ALL ON TABLE "public"."work_order_services" TO "service_role";



GRANT ALL ON TABLE "public"."work_order_tasks" TO "anon";
GRANT ALL ON TABLE "public"."work_order_tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."work_order_tasks" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































