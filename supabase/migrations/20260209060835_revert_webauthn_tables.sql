-- Revert biometric tables
drop table if exists public.user_authenticators cascade;
drop table if exists public.auth_challenges cascade;
