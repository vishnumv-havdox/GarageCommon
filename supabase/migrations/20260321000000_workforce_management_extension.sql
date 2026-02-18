-- Migration: Workforce Management Extension
-- Description: Adds structured settings, leave requests, and enhanced attendance tracking

-- 1. Workforce Settings (Global Configuration)
CREATE TABLE IF NOT EXISTS public.workforce_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    standard_start_time TIME NOT NULL DEFAULT '09:00',
    standard_end_time TIME NOT NULL DEFAULT '18:00',
    late_threshold_mins INTEGER NOT NULL DEFAULT 15,
    standard_daily_hours NUMERIC(4,2) NOT NULL DEFAULT 8.0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Singleton guarantee: ensure only one active setting
CREATE UNIQUE INDEX IF NOT EXISTS workforce_settings_single_row ON public.workforce_settings (is_active) WHERE is_active = true;

-- 2. Leave Requests
CREATE TABLE IF NOT EXISTS public.leave_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    leave_type TEXT NOT NULL CHECK (leave_type IN ('casual', 'sick', 'emergency', 'compensated', 'unpaid')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    reason TEXT,
    approved_by UUID REFERENCES auth.users(id),
    rejection_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT valid_date_range CHECK (end_date >= start_date)
);

-- 3. Update Employees Table
ALTER TABLE public.employees 
    ADD COLUMN IF NOT EXISTS attendance_self_service BOOLEAN DEFAULT false;

-- 4. Update Attendance Table
ALTER TABLE public.attendance 
    ADD COLUMN IF NOT EXISTS total_hours NUMERIC(4,2) DEFAULT 0;

-- Update status check to include 'late'
DO $$ 
BEGIN 
    ALTER TABLE public.attendance DROP CONSTRAINT IF EXISTS attendance_status_check;
    ALTER TABLE public.attendance ADD CONSTRAINT attendance_status_check 
        CHECK (status IN ('present', 'absent', 'half-day', 'leave', 'overtime', 'holiday', 'paid-holiday', 'late'));
END $$;

-- 5. RLS Policies

-- Workforce Settings
ALTER TABLE public.workforce_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view workforce settings" ON public.workforce_settings
    FOR SELECT USING (true);
CREATE POLICY "Admins manage workforce settings" ON public.workforce_settings
    FOR ALL USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'manager')));

-- Leave Requests
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can view own leave requests" ON public.leave_requests
    FOR SELECT USING (employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid()));
CREATE POLICY "Staff can create own leave requests" ON public.leave_requests
    FOR INSERT WITH CHECK (employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid()));
CREATE POLICY "Admins manage all leave requests" ON public.leave_requests
    FOR ALL USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'manager')));

-- Attendance updates (Self-service insert)
CREATE POLICY "Staff can clock in/out" ON public.attendance
    FOR INSERT WITH CHECK (
        employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid() AND attendance_self_service = true)
        AND date = CURRENT_DATE
    );
CREATE POLICY "Staff can update today's attendance" ON public.attendance
    FOR UPDATE USING (
        employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid() AND attendance_self_service = true)
        AND date = CURRENT_DATE
    );

-- 6. Insert Default Settings
INSERT INTO public.workforce_settings (standard_start_time, standard_end_time, late_threshold_mins, standard_daily_hours)
VALUES ('09:00', '18:00', 15, 8.0)
ON CONFLICT DO NOTHING;

-- Refresh PostgREST
NOTIFY pgrst, 'reload schema';
