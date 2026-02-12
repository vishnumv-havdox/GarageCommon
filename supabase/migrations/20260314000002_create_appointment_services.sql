-- Create appointment_services table
CREATE TABLE IF NOT EXISTS public.appointment_services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    appointment_id UUID REFERENCES public.appointments(id) ON DELETE CASCADE,
    catalog_item_id UUID REFERENCES public.booking_catalog(id) ON DELETE SET NULL,
    service_name TEXT NOT NULL,
    cost_estimate NUMERIC(10, 2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.appointment_services ENABLE ROW LEVEL SECURITY;

-- Policies
-- Inherit access from appointments basically
CREATE POLICY "Access via appointment" ON public.appointment_services
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.appointments a
            WHERE a.id = appointment_services.appointment_id
            AND (
                -- Check if user is the customer linked to appointment
                (
                    EXISTS (
                        SELECT 1 FROM public.customers c
                        WHERE c.id = a.customer_id
                        AND c.user_id = auth.uid()
                    )
                ) OR
                -- Check if user is admin/manager
                (
                    EXISTS (
                        SELECT 1 FROM public.user_roles
                        WHERE user_roles.user_id = auth.uid()
                        AND user_roles.role IN ('admin', 'staff')
                    )
                )
            )
        )
    );
