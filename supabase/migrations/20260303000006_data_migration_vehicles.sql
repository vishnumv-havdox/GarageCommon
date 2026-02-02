-- Migration: 20260303000002_data_migration_vehicles
-- Description: Migrates existing vehicle text data to normalized tables

DO $$
DECLARE
    v RECORD;
    m_id UUID;
    cat_id UUID;
    t_id UUID;
    mod_id UUID;
BEGIN
    FOR v IN SELECT id, vehicle_type, model FROM public.vehicles LOOP
        -- Skip if model AND vehicle_type are missing, nothing to normalize
        IF v.model IS NULL AND v.vehicle_type IS NULL THEN
            CONTINUE;
        END IF;

        -- 1. Try to guess manufacturer from model (simplified)
        -- We'll just use 'UNKNOWN' or try to extract the first word
        m_id := NULL;
        IF v.model IS NOT NULL THEN
            SELECT id INTO m_id FROM public.vehicle_manufacturers WHERE name = UPPER(SPLIT_PART(v.model, ' ', 1));
        END IF;
        
        IF m_id IS NULL THEN
            -- Use 'OTHER' if we can't determine manufacturer
            INSERT INTO public.vehicle_manufacturers (name) 
            VALUES (COALESCE(UPPER(SPLIT_PART(COALESCE(v.model, 'OTHER'), ' ', 1)), 'OTHER'))
            ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
            RETURNING id INTO m_id;
        END IF;

        -- 2. Map Category
        cat_id := NULL;
        SELECT id INTO cat_id FROM public.vehicle_categories WHERE name = v.vehicle_type;
        
        IF cat_id IS NULL AND v.vehicle_type IS NOT NULL THEN
            INSERT INTO public.vehicle_categories (name) 
            VALUES (v.vehicle_type)
            ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
            RETURNING id INTO cat_id;
        END IF;

        -- 3. Map Type (HCV/MCV/LCV as default if truck)
        t_id := NULL;
        IF v.vehicle_type = 'Truck' THEN
            SELECT id INTO t_id FROM public.vehicle_types WHERE name = 'HCV' LIMIT 1;
        ELSE
            -- Create a default type for this category if missing
            SELECT id INTO t_id FROM public.vehicle_types WHERE category_id = cat_id LIMIT 1;
            IF t_id IS NULL AND cat_id IS NOT NULL THEN
                INSERT INTO public.vehicle_types (name, category_id) 
                VALUES ('Standard ' || v.vehicle_type, cat_id)
                RETURNING id INTO t_id;
            END IF;
        END IF;

        -- 4. Create Model
        mod_id := NULL;
        -- Ensure name is not null using COALESCE
        INSERT INTO public.vehicle_models (name, manufacturer_id, vehicle_type_id)
        VALUES (COALESCE(v.model, 'Unknown Model'), m_id, t_id)
        ON CONFLICT (name, manufacturer_id, vehicle_type_id) DO UPDATE SET name = EXCLUDED.name
        RETURNING id INTO mod_id;

        -- 5. Link Vehicle
        UPDATE public.vehicles SET model_id = mod_id WHERE id = v.id;
    END LOOP;
END $$;
