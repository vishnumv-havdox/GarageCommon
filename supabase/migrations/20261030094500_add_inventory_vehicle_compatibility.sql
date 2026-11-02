-- Migration: Add vehicle compatibility and OEM part number to inventory
ALTER TABLE public.inventory
ADD COLUMN IF NOT EXISTS compatibility_type TEXT DEFAULT 'universal',
ADD COLUMN IF NOT EXISTS compatible_models TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS oem_part_number TEXT,
ADD COLUMN IF NOT EXISTS is_universal BOOLEAN DEFAULT true;

-- Update existing rows to default to universal if null
UPDATE public.inventory
SET compatibility_type = 'universal',
    is_universal = true
WHERE compatibility_type IS NULL;

-- Create index on compatible_models for fast array searches
CREATE INDEX IF NOT EXISTS idx_inventory_compatible_models ON public.inventory USING GIN (compatible_models);
CREATE INDEX IF NOT EXISTS idx_inventory_oem_part_number ON public.inventory (oem_part_number);
