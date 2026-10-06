-- Migration: Diagnose Legacy Assignments
-- Date: 2026-01-30

DO $$
DECLARE
    v_emp_id uuid;
    v_rec record;
    v_count integer;
BEGIN
    -- 1. Find Ram
    SELECT id INTO v_emp_id FROM public.employees WHERE name ILIKE '%ram%' LIMIT 1;
    
    RAISE NOTICE 'Ram ID: %', v_emp_id;

    -- 2. Check work_order_assignments (Legacy/Alternative tracking)
    SELECT count(*) INTO v_count 
    FROM public.work_order_assignments woa
    JOIN public.work_orders wo ON wo.id = woa.work_order_id
    WHERE woa.employee_id = v_emp_id AND wo.status = 'Completed';
    
    RAISE NOTICE 'Jobs in work_order_assignments (Completed): %', v_count;

    FOR v_rec IN (
        SELECT wo.id, wo.status, woa.status as assign_status
        FROM public.work_order_assignments woa
        JOIN public.work_orders wo ON wo.id = woa.work_order_id
        WHERE woa.employee_id = v_emp_id
        LIMIT 5
    ) LOOP
        RAISE NOTICE 'Assignment: WO=%, WO_Status=%, Assign_Status=%', v_rec.id, v_rec.status, v_rec.assign_status;
    END LOOP;

    -- 3. Check work_order_service_employees (New tracking)
    SELECT count(*) INTO v_count 
    FROM public.work_order_service_employees sae
    JOIN public.work_order_services s ON s.id = sae.service_id
    JOIN public.work_orders wo ON wo.id = s.work_order_id
    WHERE sae.employee_id = v_emp_id AND wo.status = 'Completed';
    
    RAISE NOTICE 'Jobs in work_order_service_employees (Completed): %', v_count;

END $$;
