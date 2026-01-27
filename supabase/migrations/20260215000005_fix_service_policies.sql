-- Enable update access for staff and admins
CREATE POLICY "Enable update access for staff and admins" ON public.service_types
    FOR UPDATE
    USING (
        public.has_role(auth.uid(), 'staff') OR 
        public.has_role(auth.uid(), 'admin') OR
        public.has_role(auth.uid(), 'manager')
    );

-- Enable delete access for admins and managers
CREATE POLICY "Enable delete access for admins and managers" ON public.service_types
    FOR DELETE
    USING (
        public.has_role(auth.uid(), 'admin') OR
        public.has_role(auth.uid(), 'manager')
    );
