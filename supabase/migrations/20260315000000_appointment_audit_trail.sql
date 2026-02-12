-- Migration: Appointment Audit Trail
-- Date: 2026-03-15

-- 1. Add audit columns to appointments table
ALTER TABLE public.appointments 
ADD COLUMN created_by UUID REFERENCES auth.users(id),
ADD COLUMN status_updated_by UUID REFERENCES auth.users(id),
ADD COLUMN deleted_at TIMESTAMPTZ;

-- 2. Create appointment_history table
CREATE TABLE public.appointment_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    appointment_id UUID NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
    old_status TEXT,
    new_status TEXT,
    changed_by UUID REFERENCES auth.users(id),
    changed_at TIMESTAMPTZ DEFAULT now(),
    action_type TEXT NOT NULL, -- 'created', 'status_changed', 'details_updated', 'soft_deleted'
    notes TEXT
);

-- 3. Enable RLS
ALTER TABLE public.appointment_history ENABLE ROW LEVEL SECURITY;

-- 4. Create Policies for appointment_history
CREATE POLICY "Admins and Managers can view all appointment history" 
ON public.appointment_history 
FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM user_roles 
        WHERE user_id = auth.uid() 
        AND role IN ('admin', 'staff')
    )
);

CREATE POLICY "Customers can view their own appointment history" 
ON public.appointment_history 
FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM public.appointments a
        JOIN public.customers c ON a.customer_id = c.id
        WHERE a.id = public.appointment_history.appointment_id
        AND c.user_id = auth.uid()
    )
);

-- 5. Add index for performance
CREATE INDEX idx_appointment_history_appointment_id ON public.appointment_history(appointment_id);
CREATE INDEX idx_appointment_history_changed_at ON public.appointment_history(changed_at);
