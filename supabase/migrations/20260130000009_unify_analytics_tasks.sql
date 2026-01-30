-- Migration: Fix Analytics Visibility and Task Tracking
-- Date: 2026-01-30
-- Description: Unifies task tables and adds completed_by tracking for accurate analytics

-- 1. Add completed_by to work_order_tasks to track who actually did the work
ALTER TABLE public.work_order_tasks ADD COLUMN IF NOT EXISTS completed_by uuid;

-- 2. Update update_work_order_task_status to store the employee who completed the task
CREATE OR REPLACE FUNCTION public.update_work_order_task_status(
    p_task_id uuid,
    p_work_order_id uuid,
    p_completed boolean,
    p_employee_id uuid
) RETURNS void AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2.5 Backfill completed_by from assigned_employee_id mapping
-- This helps existing data show up in analytics
UPDATE public.work_order_tasks t
SET completed_by = e.user_id
FROM public.employees e
WHERE t.assigned_employee_id = e.id
AND t.completed = true
AND t.completed_by IS NULL;

-- 3. Update get_employee_analytics to use work_order_tasks and subqueries for correct counts
CREATE OR REPLACE FUNCTION public.get_employee_analytics(
    p_start_date timestamptz DEFAULT (now() - interval '30 days'),
    p_end_date timestamptz DEFAULT now()
)
RETURNS TABLE (
    employee_name text,
    department text,
    completed_tasks bigint,
    avg_task_completion_minutes numeric,
    acceptance_rate numeric
) AS $$
BEGIN
    RETURN QUERY
    WITH task_stats AS (
        SELECT 
            completed_by,
            COUNT(*) as completed_count,
            AVG(EXTRACT(EPOCH FROM (completed_at - created_at)) / 60) as avg_minutes
        FROM public.work_order_tasks
        WHERE completed = true 
        AND completed_at BETWEEN p_start_date AND p_end_date
        GROUP BY completed_by
    ),
    assignment_stats AS (
        SELECT 
            employee_id,
            (COUNT(*) FILTER (WHERE status = 'Accepted')::numeric / NULLIF(COUNT(*), 0)) * 100 as rate
        FROM public.work_order_service_employees
        WHERE assigned_at BETWEEN p_start_date AND p_end_date
        GROUP BY employee_id
    )
    SELECT 
        e.name as employee_name,
        COALESCE(p.department, 'General') as department,
        COALESCE(ts.completed_count, 0) as completed_tasks,
        COALESCE(ts.avg_minutes, 0) as avg_task_completion_minutes,
        COALESCE(asig.rate, 100) as acceptance_rate
    FROM public.employees e
    LEFT JOIN public.positions p ON e.position_id = p.id
    LEFT JOIN task_stats ts ON ts.completed_by = e.user_id
    LEFT JOIN assignment_stats asig ON asig.employee_id = e.id
    GROUP BY e.id, e.name, e.user_id, p.department, ts.completed_count, ts.avg_minutes, asig.rate
    ORDER BY completed_tasks DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_operational_analytics(timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_employee_analytics(timestamptz, timestamptz) TO authenticated;

NOTIFY pgrst, 'reload schema';
