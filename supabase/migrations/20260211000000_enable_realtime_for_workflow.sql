-- Migration: 20260211000000_enable_realtime_for_workflow
-- Description: Enable Realtime for key tables to ensure Staff and Admin portals sync immediately

-- 1. Enable Realtime for work_orders
ALTER PUBLICATION supabase_realtime ADD TABLE public.work_orders;

-- 2. Enable Realtime for work_order_tasks
ALTER PUBLICATION supabase_realtime ADD TABLE public.work_order_tasks;

-- 3. Enable Realtime for work_order_service_employees
ALTER PUBLICATION supabase_realtime ADD TABLE public.work_order_service_employees;

-- 4. Enable Realtime for work_order_services (optional but recommended)
ALTER PUBLICATION supabase_realtime ADD TABLE public.work_order_services;
