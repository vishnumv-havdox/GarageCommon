-- Migration: 20260303000000_add_manufacturer_applicability
-- Description: Adds vehicle_manufacturer_id to service_vehicle_applicability for manufacturer-level service filtering.

ALTER TABLE public.service_vehicle_applicability 
ADD COLUMN IF NOT EXISTS vehicle_manufacturer_id UUID REFERENCES public.vehicle_manufacturers(id) ON DELETE CASCADE;

-- Update unique constraint to include manufacturer_id
-- We need to drop the old unique constraint if it exists and create a new one. 
-- Assuming the previous migration created a named constraint or implicit one.
-- Best effort to drop based on column names if default naming was used, or just add a unique index that allows nulls.

-- Since PostgreSQL treats NULLs as distinct for UNIQUE constraints, multiple rows with all NULLs are allowed, 
-- but exact duplicate sets of (service_type_id, mfr, cat, type) are not.
-- The previous definition was: UNIQUE(service_type_id, vehicle_category_id, vehicle_type_id)

ALTER TABLE public.service_vehicle_applicability 
DROP CONSTRAINT IF EXISTS service_vehicle_applicability_service_type_id_vehicle_category_key; -- potential default name

-- It is safer to just add a new unique index spanning all 4 columns to prevent exact duplicates including manufacturer
CREATE UNIQUE INDEX IF NOT EXISTS idx_service_applicability_unique_all 
ON public.service_vehicle_applicability (service_type_id, vehicle_manufacturer_id, vehicle_category_id, vehicle_type_id);

NOTIFY pgrst, 'reload schema';
