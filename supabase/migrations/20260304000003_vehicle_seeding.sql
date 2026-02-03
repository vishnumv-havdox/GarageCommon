-- Migration: 20260303000003_vehicle_seeding
-- Description: Seeds normalized vehicle tables with provided Tata, Eicher, Force, and Nissan data

-- 1. Insert Manufacturers
INSERT INTO public.vehicle_manufacturers (name) VALUES 
('Tata Motors'),
('Eicher Motors'),
('Force Motors'),
('Nissan')
ON CONFLICT (name) DO NOTHING;

-- 2. Insert Categories
INSERT INTO public.vehicle_categories (name) VALUES 
('Bus'),
('Truck'),
('Pickup'),
('Van'),
('Utility')
ON CONFLICT (name) DO NOTHING;

-- 3. Insert Vehicle Types (linked to Categories)
-- Bus Chassis -> Bus
INSERT INTO public.vehicle_types (name, category_id)
SELECT 'Bus Chassis', id FROM public.vehicle_categories WHERE name = 'Bus'
ON CONFLICT (name) DO NOTHING;

-- Light Commercial Truck -> Truck
INSERT INTO public.vehicle_types (name, category_id)
SELECT 'Light Commercial Truck', id FROM public.vehicle_categories WHERE name = 'Truck'
ON CONFLICT (name) DO NOTHING;

-- Medium Commercial Truck -> Truck
INSERT INTO public.vehicle_types (name, category_id)
SELECT 'Medium Commercial Truck', id FROM public.vehicle_categories WHERE name = 'Truck'
ON CONFLICT (name) DO NOTHING;

-- Heavy Commercial Truck -> Truck
INSERT INTO public.vehicle_types (name, category_id)
SELECT 'Heavy Commercial Truck', id FROM public.vehicle_categories WHERE name = 'Truck'
ON CONFLICT (name) DO NOTHING;

-- Mini Truck -> Pickup
INSERT INTO public.vehicle_types (name, category_id)
SELECT 'Mini Truck', id FROM public.vehicle_categories WHERE name = 'Pickup'
ON CONFLICT (name) DO NOTHING;

-- Passenger Van -> Van
INSERT INTO public.vehicle_types (name, category_id)
SELECT 'Passenger Van', id FROM public.vehicle_categories WHERE name = 'Van'
ON CONFLICT (name) DO NOTHING;

-- Passenger/Cargo Van -> Van
INSERT INTO public.vehicle_types (name, category_id)
SELECT 'Passenger/Cargo Van', id FROM public.vehicle_categories WHERE name = 'Van'
ON CONFLICT (name) DO NOTHING;

-- Pickup Truck -> Pickup
INSERT INTO public.vehicle_types (name, category_id)
SELECT 'Pickup Truck', id FROM public.vehicle_categories WHERE name = 'Pickup'
ON CONFLICT (name) DO NOTHING;

-- Light & Medium Truck -> Truck
INSERT INTO public.vehicle_types (name, category_id)
SELECT 'Light & Medium Truck', id FROM public.vehicle_categories WHERE name = 'Truck'
ON CONFLICT (name) DO NOTHING;

-- Small Pickup -> Pickup
INSERT INTO public.vehicle_types (name, category_id)
SELECT 'Small Pickup', id FROM public.vehicle_categories WHERE name = 'Pickup'
ON CONFLICT (name) DO NOTHING;

-- Electric Mini Truck -> Pickup
INSERT INTO public.vehicle_types (name, category_id)
SELECT 'Electric Mini Truck', id FROM public.vehicle_categories WHERE name = 'Pickup'
ON CONFLICT (name) DO NOTHING;

-- Cargo Van -> Van
INSERT INTO public.vehicle_types (name, category_id)
SELECT 'Cargo Van', id FROM public.vehicle_categories WHERE name = 'Van'
ON CONFLICT (name) DO NOTHING;

-- Utility Vehicle -> Utility
INSERT INTO public.vehicle_types (name, category_id)
SELECT 'Utility Vehicle', id FROM public.vehicle_categories WHERE name = 'Utility'
ON CONFLICT (name) DO NOTHING;

-- Cab-over Van -> Van
INSERT INTO public.vehicle_types (name, category_id)
SELECT 'Cab-over Van', id FROM public.vehicle_categories WHERE name = 'Van'
ON CONFLICT (name) DO NOTHING;


-- 4. Insert Models (linked to Manufacturer and Type)
DO $$
DECLARE
    m_tata UUID;
    m_eicher UUID;
    m_force UUID;
    m_nissan UUID;
    t_bus_chassis UUID;
    t_lct UUID;
    t_mct UUID;
    t_hct UUID;
    t_mini UUID;
    t_pvan UUID;
    t_pcvan UUID;
    t_ptruck UUID;
    t_lmt UUID;
    t_spickup UUID;
    t_emini UUID;
    t_cvan UUID;
    t_uvec UUID;
    t_covan UUID;
BEGIN
    -- Get Manufacturers
    SELECT id INTO m_tata FROM public.vehicle_manufacturers WHERE name = 'Tata Motors';
    SELECT id INTO m_eicher FROM public.vehicle_manufacturers WHERE name = 'Eicher Motors';
    SELECT id INTO m_force FROM public.vehicle_manufacturers WHERE name = 'Force Motors';
    SELECT id INTO m_nissan FROM public.vehicle_manufacturers WHERE name = 'Nissan';

    -- Get Types
    SELECT id INTO t_bus_chassis FROM public.vehicle_types WHERE name = 'Bus Chassis';
    SELECT id INTO t_lct FROM public.vehicle_types WHERE name = 'Light Commercial Truck';
    SELECT id INTO t_mct FROM public.vehicle_types WHERE name = 'Medium Commercial Truck';
    SELECT id INTO t_hct FROM public.vehicle_types WHERE name = 'Heavy Commercial Truck';
    SELECT id INTO t_mini FROM public.vehicle_types WHERE name = 'Mini Truck';
    SELECT id INTO t_pvan FROM public.vehicle_types WHERE name = 'Passenger Van';
    SELECT id INTO t_pcvan FROM public.vehicle_types WHERE name = 'Passenger/Cargo Van';
    SELECT id INTO t_ptruck FROM public.vehicle_types WHERE name = 'Pickup Truck';
    SELECT id INTO t_lmt FROM public.vehicle_types WHERE name = 'Light & Medium Truck';
    SELECT id INTO t_spickup FROM public.vehicle_types WHERE name = 'Small Pickup';
    SELECT id INTO t_emini FROM public.vehicle_types WHERE name = 'Electric Mini Truck';
    SELECT id INTO t_cvan FROM public.vehicle_types WHERE name = 'Cargo Van';
    SELECT id INTO t_uvec FROM public.vehicle_types WHERE name = 'Utility Vehicle';
    SELECT id INTO t_covan FROM public.vehicle_types WHERE name = 'Cab-over Van';

    -- TATA Models
    INSERT INTO public.vehicle_models (name, manufacturer_id, vehicle_type_id) VALUES
    ('Tata 1510', m_tata, t_bus_chassis),
    ('Tata 1512', m_tata, t_bus_chassis),
    ('Tata 407', m_tata, t_lct),
    ('Tata 608', m_tata, t_lct),
    ('Tata 709', m_tata, t_mct),
    ('Tata 1109', m_tata, t_mct),
    ('Tata LPK Series', m_tata, t_hct),
    ('Tata SFC Series', m_tata, t_lct),
    ('Tata Ace', m_tata, t_mini),
    ('Tata Ace Zip', m_tata, t_mini),
    ('Tata Ace Mega', m_tata, t_mini),
    ('Tata Magic', m_tata, t_pvan),
    ('Tata Winger', m_tata, t_pcvan),
    ('Tata Xenon', m_tata, t_ptruck),
    ('Tata Prima', m_tata, t_hct),
    ('Tata Signa', m_tata, t_hct),
    ('Tata Ultra', m_tata, t_lmt),
    ('Tata Intra', m_tata, t_spickup),
    ('Tata Ace EV', m_tata, t_emini),
    ('Tata Winger Cargo', m_tata, t_cvan)
    ON CONFLICT DO NOTHING;

    -- EICHER Models
    INSERT INTO public.vehicle_models (name, manufacturer_id, vehicle_type_id) VALUES
    ('Eicher 10.10', m_eicher, t_mct),
    ('Eicher 20.16', m_eicher, t_hct),
    ('Eicher Pro 1049', m_eicher, t_lct),
    ('Eicher Pro 2049', m_eicher, t_lct),
    ('Eicher Pro 3015', m_eicher, t_mct),
    ('Eicher Pro 3019', m_eicher, t_mct),
    ('Eicher Pro 6025', m_eicher, t_hct),
    ('Eicher Pro 6041', m_eicher, t_hct),
    ('Eicher Pro Bus Series', m_eicher, t_bus_chassis),
    ('Eicher Polaris Multix', m_eicher, t_uvec)
    ON CONFLICT DO NOTHING;

    -- FORCE Models
    INSERT INTO public.vehicle_models (name, manufacturer_id, vehicle_type_id) VALUES
    ('Tempo Traveller', m_force, t_pvan),
    ('Force Traveller', m_force, t_pvan),
    ('Force Traveller T1', m_force, t_cvan),
    ('Force Trax', m_force, t_uvec),
    ('Force Gurkha (Commercial)', m_force, t_uvec)
    ON CONFLICT DO NOTHING;

    -- NISSAN Models
    INSERT INTO public.vehicle_models (name, manufacturer_id, vehicle_type_id) VALUES
    ('Nissan Vanette', m_nissan, t_covan),
    ('Nissan Caravan', m_nissan, t_pcvan),
    ('Nissan Atlas', m_nissan, t_lct),
    ('Nissan NT400 Cabstar', m_nissan, t_lct)
    ON CONFLICT DO NOTHING;

END $$;
