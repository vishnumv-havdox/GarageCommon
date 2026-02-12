-- Migration: Allow Appointment History Deletion
-- Date: 2026-03-15

-- 1. Policies for DELETE on appointment_history table
DROP POLICY IF EXISTS "Admins and Staff can delete appointment history" ON public.appointment_history;
DROP POLICY IF EXISTS "Customers can delete their own appointment history" ON public.appointment_history;

CREATE POLICY "Admins and Staff can delete appointment history"
ON public.appointment_history
FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM user_roles 
        WHERE user_id = auth.uid() 
        AND role IN ('admin', 'staff')
    )
);

CREATE POLICY "Customers can delete their own appointment history"
ON public.appointment_history
FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM public.appointments a
        JOIN public.customers c ON a.customer_id = c.id
        WHERE a.id = public.appointment_history.appointment_id
        AND c.user_id = auth.uid()
    )
);
