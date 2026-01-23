-- 1. Access level enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'access_level_enum') THEN
    CREATE TYPE access_level_enum AS ENUM ('admin', 'manager', 'staff');
  END IF;
END$$;

-- 2. Positions table
CREATE TABLE IF NOT EXISTS public.positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  department text NOT NULL,
  access_level access_level_enum NOT NULL DEFAULT 'staff',
  description text,
  base_salary numeric(10,2),
  created_at timestamptz DEFAULT now()
);

-- 3. Employees table (safe FK)
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS position_id uuid;

ALTER TABLE public.employees
  ADD CONSTRAINT employees_position_fk
  FOREIGN KEY (position_id)
  REFERENCES public.positions(id)
  ON DELETE SET NULL;

-- 4. Ensure employees access_level exists
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS access_level access_level_enum DEFAULT 'staff';

-- 5. Refresh PostgREST schema
NOTIFY pgrst, 'reload schema';
