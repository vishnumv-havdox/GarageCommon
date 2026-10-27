-- Add theme_settings to company_profiles for custom UI colors & branding theme
ALTER TABLE public.company_profiles ADD COLUMN IF NOT EXISTS theme_settings JSONB DEFAULT '{}'::jsonb;
