-- Migration: Fix Appointment Audit Trail FKs
-- Date: 2026-03-15

-- Drop existing FKs if they exist (PostgreSQL adds them with specific names)
ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_created_by_fkey;
ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_status_updated_by_fkey;
ALTER TABLE public.appointment_history DROP CONSTRAINT IF EXISTS appointment_history_changed_by_fkey;

-- Re-add FKs pointing to public.profiles for easier PostgREST joins
ALTER TABLE public.appointments 
ADD CONSTRAINT appointments_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id),
ADD CONSTRAINT appointments_status_updated_by_fkey FOREIGN KEY (status_updated_by) REFERENCES public.profiles(id);

ALTER TABLE public.appointment_history 
ADD CONSTRAINT appointment_history_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.profiles(id);
