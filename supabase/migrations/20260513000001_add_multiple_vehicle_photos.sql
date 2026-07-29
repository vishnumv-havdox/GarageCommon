-- Migration: add photos JSONB to vehicles
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS photos JSONB DEFAULT '[]'::jsonb;

-- Migrate existing single photos to the new array
UPDATE public.vehicles SET photos = jsonb_build_array(photo_url) WHERE photo_url IS NOT NULL AND photo_url != '';
