-- Allow public access to company profiles (SELECT only)
-- This is needed for the login page to show company name and logo
CREATE POLICY "Public view company profiles" ON public.company_profiles
    FOR SELECT USING (true);
