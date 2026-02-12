-- Create appointments table
CREATE TABLE IF NOT EXISTS public.appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
    vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,
    type TEXT CHECK (type IN ('face_to_face', 'service')) NOT NULL,
    status TEXT CHECK (status IN ('pending', 'confirmed', 'rejected', 'converted', 'completed', 'cancelled')) DEFAULT 'pending',
    scheduled_at TIMESTAMPTZ NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

-- Policies for Appointments
-- Customers can read their own
CREATE POLICY "Customers can see own appointments" ON public.appointments
    FOR SELECT USING (
        auth.uid() IN (
            SELECT user_id FROM public.customers WHERE id = appointments.customer_id
        )
    );

-- Customers can insert their own
CREATE POLICY "Customers can create appointments" ON public.appointments
    FOR INSERT WITH CHECK (
        auth.uid() IN (
            SELECT user_id FROM public.customers WHERE id = customer_id
        )
    );

-- Customers can update (cancel) their own appointment if pending
CREATE POLICY "Customers can cancel own pending appointments" ON public.appointments
    FOR UPDATE USING (
        auth.uid() IN (
            SELECT user_id FROM public.customers WHERE id = customer_id
        ) AND status = 'pending'
    );

-- Admins/Managers full access
CREATE POLICY "Admins full access" ON public.appointments
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_roles.user_id = auth.uid()
            AND user_roles.role IN ('admin', 'staff')
        )
    );


-- Trigger
CREATE TRIGGER update_appointments_modtime
    BEFORE UPDATE ON public.appointments
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();
