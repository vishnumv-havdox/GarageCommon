-- Migration: 20260313000005_add_owner_details_to_profile.sql
-- Description: Adds owner_name and owner_phone columns to company_profiles table.

ALTER TABLE public.company_profiles 
ADD COLUMN IF NOT EXISTS owner_name text,
ADD COLUMN IF NOT EXISTS owner_phone text;
