-- Migration: 20260805000000_add_vehicles_model_id_fk
-- Description: Adds model_id column and foreign key constraint between vehicles and vehicle_models for PostgREST joins

DO $$
BEGIN
    -- 1. Ensure model_id column exists on vehicles
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'vehicles' 
        AND column_name = 'model_id'
    ) THEN
        ALTER TABLE public.vehicles ADD COLUMN model_id UUID;
    END IF;

    -- 2. Add foreign key constraint to vehicle_models
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'vehicles_model_id_fkey'
    ) THEN
        ALTER TABLE public.vehicles 
        ADD CONSTRAINT vehicles_model_id_fkey 
        FOREIGN KEY (model_id) REFERENCES public.vehicle_models(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 3. Reload schema cache for PostgREST
NOTIFY pgrst, 'reload schema';
