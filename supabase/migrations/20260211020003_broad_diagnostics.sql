-- Migration: Broad Diagnostics
-- Date: 2026-01-30

DO $$
DECLARE
    v_rec record;
BEGIN
    -- 1. Any completed tasks in work_order_tasks?
    RAISE NOTICE '--- Completed work_order_tasks ---';
    FOR v_rec IN (
        SELECT t.task_name, t.completed, e.name as emp_name
        FROM public.work_order_tasks t
        LEFT JOIN public.employees e ON (t.assigned_employee_id = e.id OR t.completed_by = e.user_id)
        WHERE t.completed = true
        LIMIT 10
    ) LOOP
        RAISE NOTICE 'Task: %, emp: %', v_rec.task_name, v_rec.emp_name;
    END LOOP;

    -- 2. Any finished services in work_order_service_employees?
    RAISE NOTICE '--- Finished work_order_service_employees ---';
    FOR v_rec IN (
        SELECT sae.status, e.name as emp_name
        FROM public.work_order_service_employees sae
        JOIN public.employees e ON sae.employee_id = e.id
        WHERE sae.status IN ('Completed', 'Approved', 'pending_approval', 'completed', 'approved')
        LIMIT 10
    ) LOOP
        RAISE NOTICE 'Service Status: %, emp: %', v_rec.status, v_rec.emp_name;
    END LOOP;

    -- 3. Any work orders completed?
    RAISE NOTICE '--- Completed work_orders ---';
    FOR v_rec IN (
        SELECT id, vehicle_id, status, created_at
        FROM public.work_orders
        WHERE status IN ('Completed', 'Approved', 'completed', 'approved')
        LIMIT 10
    ) LOOP
        RAISE NOTICE 'Work Order: %, status: %', v_rec.id, v_rec.status;
    END LOOP;
END $$;
