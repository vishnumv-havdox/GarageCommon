-- Migration: fix_attendance_auditor_joins
-- Description: Re-point foreign keys to public.profiles instead of auth.users to enable PostgREST joins

-- 1. Fix Attendance Table
ALTER TABLE public.attendance 
    DROP CONSTRAINT IF EXISTS attendance_marked_by_fkey,
    DROP CONSTRAINT IF EXISTS attendance_updated_by_fkey;

ALTER TABLE public.attendance
    ADD CONSTRAINT attendance_marked_by_fkey FOREIGN KEY (marked_by) REFERENCES public.profiles(id),
    ADD CONSTRAINT attendance_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id);

-- 2. Fix Attendance History Table
ALTER TABLE public.attendance_history
    DROP CONSTRAINT IF EXISTS attendance_history_changed_by_fkey;

ALTER TABLE public.attendance_history
    ADD CONSTRAINT attendance_history_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.profiles(id);

-- 3. Fix Leave Requests Table
ALTER TABLE public.leave_requests
    DROP CONSTRAINT IF EXISTS leave_requests_approved_by_fkey;

-- Note: leave_requests_approved_by_fkey might have been auto-named or not exist. 
-- Listing common names if it was created via REFERENCES auth.users(id)
ALTER TABLE public.leave_requests
    ADD CONSTRAINT leave_requests_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.profiles(id);

-- Refresh PostgREST
NOTIFY pgrst, 'reload schema';
