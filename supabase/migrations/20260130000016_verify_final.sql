-- Migration: Verify Final Analytics
-- Date: 2026-01-30

DO $$
DECLARE
    v_rec record;
BEGIN
    RAISE NOTICE '--- Final get_employee_analytics() Result ---';
    FOR v_rec IN (
        SELECT employee_name, department, completed_tasks, avg_task_completion_minutes
        FROM public.get_employee_analytics()
    ) LOOP
        RAISE NOTICE 'Employee: %, Dept: %, Completed: %, AvgMin: %', 
            v_rec.employee_name, v_rec.department, v_rec.completed_tasks, v_rec.avg_task_completion_minutes;
    END LOOP;
END $$;
