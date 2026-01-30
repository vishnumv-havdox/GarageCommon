-- Allow all authenticated users to view company profile
CREATE POLICY "Anyone can view company profiles" ON public.company_profiles
    FOR SELECT USING (auth.role() = 'authenticated');

-- Ensure document settings are also viewable by authenticated users (needed for generating PDFs in some contexts)
CREATE POLICY "Anyone can view document settings" ON public.document_settings
    FOR SELECT USING (auth.role() = 'authenticated');
