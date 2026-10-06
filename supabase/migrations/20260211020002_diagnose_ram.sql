-- Migration: Diagnose Ram Work (Fixed)
-- Date: 2026-01-30

DO $$
DECLARE
    v_emp_id uuid;
    v_user_id uuid;
    v_task_count integer;
    v_task_completed_count integer;
    v_service_count integer;
    v_service_finished_count integer;
    v_rec record;
BEGIN
    -- 1. Find Ram
    SELECT id, user_id INTO v_emp_id, v_user_id 
    FROM public.employees 
    WHERE name ILIKE '%ram%' LIMIT 1;
    
    RAISE NOTICE 'Found Ram: emp_id=%, user_id=%', v_emp_id, v_user_id;

    -- 2. Check work_order_tasks
    SELECT count(*) INTO v_task_count 
    FROM public.work_order_tasks 
    WHERE (completed_by = v_user_id OR assigned_employee_id = v_emp_id);
    
    SELECT count(*) INTO v_task_completed_count 
    FROM public.work_order_tasks 
    WHERE completed = true AND (completed_by = v_user_id OR assigned_employee_id = v_emp_id);
    
    RAISE NOTICE 'work_order_tasks total: %, completed: %', v_task_count, v_task_completed_count;
    
    FOR v_rec IN (
        SELECT task_name, completed, completed_by, assigned_employee_id
        FROM public.work_order_tasks 
        WHERE (completed_by = v_user_id OR assigned_employee_id = v_emp_id)
        LIMIT 10
    ) LOOP
        RAISE NOTICE 'Task: %, completed=%, by=%, assigned=%', v_rec.task_name, v_rec.completed, v_rec.completed_by, v_rec.assigned_employee_id;
    END LOOP;

    -- 3. Check work_order_service_employees
    SELECT count(*) INTO v_service_count 
    FROM public.work_order_service_employees 
    WHERE employee_id = v_emp_id;
    
    SELECT count(*) INTO v_service_finished_count 
    FROM public.work_order_service_employees 
    WHERE employee_id = v_emp_id AND (status ILIKE 'completed' OR status ILIKE 'approved' OR status ILIKE 'pending_approval');
    
    RAISE NOTICE 'work_order_service_employees total: %, finished/pending: %', v_service_count, v_service_finished_count;

    FOR v_rec IN (
        SELECT id, status, completed_at 
        FROM public.work_order_service_employees 
        WHERE employee_id = v_emp_id
        LIMIT 10
    ) LOOP
        RAISE NOTICE 'Service Assign: id=%, status=%, completed_at=%', v_rec.id, v_rec.status, v_rec.completed_at;
    END LOOP;
END $$;
