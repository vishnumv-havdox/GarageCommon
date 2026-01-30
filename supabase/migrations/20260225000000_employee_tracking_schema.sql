-- Migration: Employee Attendance, Salary, and Performance Schema
-- Date: 2026-01-30
-- Description: Adds tables for tracking attendance, payout structures, and performance views

-- 1. Attendance Table
CREATE TABLE IF NOT EXISTS public.attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('present', 'absent', 'half-day', 'leave', 'overtime')),
    overtime_hours NUMERIC(4,2) DEFAULT 0,
    check_in TIMESTAMPTZ,
    check_out TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(employee_id, date)
);

-- 2. Employee Salary Configurations
CREATE TABLE IF NOT EXISTS public.employee_salary_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL UNIQUE REFERENCES public.employees(id) ON DELETE CASCADE,
    pay_type TEXT NOT NULL CHECK (pay_type IN ('monthly', 'weekly', 'per-job')),
    base_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    overtime_rate NUMERIC(10,2) DEFAULT 0, -- hourly rate for overtime
    job_incentive_rate NUMERIC(10,2) DEFAULT 0, -- flat amount per job if pay_type is per-job
    allowances NUMERIC(12,2) DEFAULT 0, -- monthly/weekly recurring allowances
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Employee Payouts (History)
CREATE TABLE IF NOT EXISTS public.employee_payouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    base_calc NUMERIC(12,2) NOT NULL,
    attendance_adj NUMERIC(12,2) DEFAULT 0, -- deductions for absence, etc.
    job_incentives NUMERIC(12,2) DEFAULT 0,
    overtime_pay NUMERIC(12,2) DEFAULT 0,
    bonuses NUMERIC(12,2) DEFAULT 0,
    deductions NUMERIC(12,2) DEFAULT 0,
    total_amount NUMERIC(12,2) NOT NULL,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'paid')),
    payment_date TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Performance View
-- Aggregates jobs completed, efficiency, and rework for tracking
CREATE OR REPLACE VIEW public.employee_performance_metrics AS
SELECT 
    e.id as employee_id,
    e.name as employee_name,
    COUNT(DISTINCT woa.work_order_id) FILTER (WHERE wo.status = 'delivered') as total_jobs_completed,
    COALESCE(AVG(EXTRACT(EPOCH FROM (wo.updated_at - wo.created_at))/3600) FILTER (WHERE wo.status = 'delivered'), 0) as avg_completion_hours,
    COUNT(DISTINCT pr.id) as total_parts_requested,
    COUNT(DISTINCT ir.id) as total_parts_returned,
    (SELECT COUNT(*) FROM public.attendance a WHERE a.employee_id = e.id AND a.status = 'present' AND a.date >= now() - interval '30 days') as days_present_30d,
    (SELECT SUM(overtime_hours) FROM public.attendance a WHERE a.employee_id = e.id AND a.date >= now() - interval '30 days') as overtime_hours_30d
FROM public.employees e
LEFT JOIN public.work_order_assignments woa ON woa.employee_id = e.id
LEFT JOIN public.work_orders wo ON wo.id = woa.work_order_id
LEFT JOIN public.part_requests pr ON pr.requested_by = e.id
LEFT JOIN public.inventory_returns ir ON ir.requested_by = e.id
GROUP BY e.id, e.name;

-- 5. RLS Policies
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_salary_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_payouts ENABLE ROW LEVEL SECURITY;

-- Admins/Managers can see/manage everything
CREATE POLICY "Admins/Managers can manage attendance" ON public.attendance
    FOR ALL USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'manager')));

CREATE POLICY "Admins/Managers can manage salary configs" ON public.employee_salary_configs
    FOR ALL USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'manager')));

CREATE POLICY "Admins/Managers can manage payouts" ON public.employee_payouts
    FOR ALL USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'manager')));

-- Staff can view their own data
CREATE POLICY "Staff can view own attendance" ON public.attendance
    FOR SELECT USING (employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid()));

CREATE POLICY "Staff can view own payouts" ON public.employee_payouts
    FOR SELECT USING (employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid()));

-- 6. Permissions
GRANT SELECT ON public.employee_performance_metrics TO authenticated;

-- Refresh PostgREST
NOTIFY pgrst, 'reload schema';
