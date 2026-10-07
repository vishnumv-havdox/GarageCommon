-- =============================================================================
-- Migration: 20261007000000_reminders_and_notes
-- Description: Operational Reminders, Quick Workshop Notes, and Alarms System
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.reminders_and_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    category TEXT DEFAULT 'general', -- 'general', 'customer', 'vendor_parts', 'payment', 'workshop', 'urgent'
    priority TEXT DEFAULT 'medium', -- 'low', 'medium', 'high', 'urgent'
    color TEXT DEFAULT 'amber', -- 'amber', 'blue', 'emerald', 'purple', 'rose', 'slate'
    due_at TIMESTAMPTZ,
    has_alarm BOOLEAN DEFAULT false,
    alarm_tone TEXT DEFAULT 'chime',
    is_completed BOOLEAN DEFAULT false,
    completed_at TIMESTAMPTZ,
    snoozed_until TIMESTAMPTZ,
    is_pinned BOOLEAN DEFAULT false,
    checklist JSONB DEFAULT '[]'::jsonb,
    vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reminders_due_at ON public.reminders_and_notes(due_at);
CREATE INDEX IF NOT EXISTS idx_reminders_is_completed ON public.reminders_and_notes(is_completed);
CREATE INDEX IF NOT EXISTS idx_reminders_category ON public.reminders_and_notes(category);
CREATE INDEX IF NOT EXISTS idx_reminders_vehicle_id ON public.reminders_and_notes(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_reminders_customer_id ON public.reminders_and_notes(customer_id);

-- Enable Row Level Security
ALTER TABLE public.reminders_and_notes ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'reminders_and_notes' 
        AND policyname = 'Authenticated full access on reminders_and_notes'
    ) THEN
        CREATE POLICY "Authenticated full access on reminders_and_notes"
            ON public.reminders_and_notes FOR ALL
            TO authenticated
            USING (true)
            WITH CHECK (true);
    END IF;
END $$;
