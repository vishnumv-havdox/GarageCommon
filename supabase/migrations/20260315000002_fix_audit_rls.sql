-- Migration: Fix Appointment History and Soft-Delete RLS
-- Date: 2026-03-15

-- 1. Policies for appointment_history table
-- Drop existing insert policies if they exist (to be safe)
DROP POLICY IF EXISTS "Admins and Staff can insert appointment history" ON public.appointment_history;
DROP POLICY IF EXISTS "Customers can insert history for their appointments" ON public.appointment_history;

-- Create INSERT policies
CREATE POLICY "Admins and Staff can insert appointment history"
ON public.appointment_history
FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM user_roles 
        WHERE user_id = auth.uid() 
        AND role IN ('admin', 'staff')
    )
);

CREATE POLICY "Customers can insert history for their appointments"
ON public.appointment_history
FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.appointments a
        JOIN public.customers c ON a.customer_id = c.id
        WHERE a.id = public.appointment_history.appointment_id
        AND c.user_id = auth.uid()
    )
);

-- 2. Ensure customers can soft-delete their appointments (update status to cancelled)
-- Check if update policy exists, if not create/update it
DROP POLICY IF EXISTS "Customers can update their own appointments" ON public.appointments;

CREATE POLICY "Customers can update their own appointments"
ON public.appointments
FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM public.customers c
        WHERE c.id = public.appointments.customer_id
        AND c.user_id = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.customers c
        WHERE c.id = public.appointments.customer_id
        AND c.user_id = auth.uid()
    )
);
