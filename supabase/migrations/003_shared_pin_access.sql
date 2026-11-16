-- Shared-PIN access is authorized by the server API, not Supabase Auth.
-- Leave user_id nullable so server-side service-role writes can use a shared dataset.
alter table public.studios alter column user_id drop not null;
alter table public.clubs alter column user_id drop not null;
alter table public.students alter column user_id drop not null;
alter table public.payments alter column user_id drop not null;
alter table public.payment_schedules alter column user_id drop not null;
alter table public.pause_history alter column user_id drop not null;
