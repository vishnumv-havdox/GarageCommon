-- Migration: Status Inspection
-- Date: 2026-01-30

DO $$
DECLARE
    v_rec record;
BEGIN
    RAISE NOTICE '--- Unique statuses in work_order_service_employees ---';
    FOR v_rec IN (
        SELECT status, count(*) 
        FROM public.work_order_service_employees 
        GROUP BY status
    ) LOOP
        RAISE NOTICE 'Status: %, Count: %', v_rec.status, v_rec.count;
    END LOOP;

    RAISE NOTICE '--- Unique statuses in work_order_services ---';
    FOR v_rec IN (
        SELECT status, count(*) 
        FROM public.work_order_services 
        GROUP BY status
    ) LOOP
        RAISE NOTICE 'Status: %, Count: %', v_rec.status, v_rec.count;
    END LOOP;
END $$;
