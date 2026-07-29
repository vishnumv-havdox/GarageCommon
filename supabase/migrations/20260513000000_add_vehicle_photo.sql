-- Migration: add photo_url to vehicles
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS photo_url TEXT;
