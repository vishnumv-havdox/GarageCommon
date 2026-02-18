-- Create driver_positions table for managing custom driver position types
CREATE TABLE IF NOT EXISTS public.driver_positions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Insert default positions
INSERT INTO public.driver_positions (name, description) VALUES
    ('Driver', 'Standard driver position'),
    ('Fleet Supervisor', 'Supervises fleet operations'),
    ('Transport Manager', 'Manages transport logistics'),
    ('Owner', 'Vehicle/Fleet owner'),
    ('Other', 'Other position type')
ON CONFLICT (name) DO NOTHING;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_driver_positions_active ON public.driver_positions(is_active) WHERE is_active = true;

-- Enable RLS
ALTER TABLE public.driver_positions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Staff and admins can view all positions
CREATE POLICY "Staff and admins can view driver positions"
    ON public.driver_positions
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_id = auth.uid()
            AND role IN ('admin', 'staff')
        )
    );

-- Only admins can insert/update/delete positions
CREATE POLICY "Admins can manage driver positions"
    ON public.driver_positions
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_id = auth.uid()
            AND role = 'admin'
        )
    );

-- Create updated_at trigger
CREATE TRIGGER update_driver_positions_updated_at
    BEFORE UPDATE ON public.driver_positions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
