-- Migration: 20260227000012_comprehensive_attendance_audit
-- Description: Add audit fields and history tracking for attendance

-- 1. Add missing columns to attendance
ALTER TABLE public.attendance 
ADD COLUMN IF NOT EXISTS marked_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS remarks TEXT;

-- 2. Create attendance history table
CREATE TABLE IF NOT EXISTS public.attendance_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attendance_id UUID NOT NULL REFERENCES public.attendance(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL,
    date DATE NOT NULL,
    old_status TEXT,
    new_status TEXT,
    old_remarks TEXT,
    new_remarks TEXT,
    changed_by UUID REFERENCES auth.users(id),
    changed_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Create audit function and trigger
CREATE OR REPLACE FUNCTION public.log_attendance_change()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_log_attendance_change ON public.attendance;
CREATE TRIGGER tr_log_attendance_change
AFTER INSERT OR UPDATE ON public.attendance
FOR EACH ROW EXECUTE FUNCTION public.log_attendance_change();

-- 4. Enable RLS and policies for history
ALTER TABLE public.attendance_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins/Managers can view attendance history" ON public.attendance_history
    FOR SELECT USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'manager')));

-- 5. Refresh PostgREST
NOTIFY pgrst, 'reload schema';
