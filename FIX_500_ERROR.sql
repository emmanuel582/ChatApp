-- FIX INFINITE RECURSION ERROR (Runs as Superuser to bypass RLS)
create or replace function public.is_admin()
returns boolean
language sql
security definer
as $$
  select coalesce(
    (select is_admin from profiles where id = auth.uid()),
    false
  );
$$;

-- Drop previous policies that caused the 500 error
drop policy if exists "Admins can select all messages" on messages;
drop policy if exists "Admins can insert messages as others" on messages;
drop policy if exists "Admins can select all profiles" on profiles;

-- Re-create policies using the secure function
create policy "Admins can select all messages"
    on messages for select
    using ( is_admin() );

create policy "Admins can insert messages as others"
    on messages for insert
    with check ( is_admin() );

create policy "Admins can select all profiles"
    on profiles for select
    using ( is_admin() );

-- Ensure columns exist (Repeated for safety)
alter table profiles add column if not exists is_admin boolean default false;
alter table messages add column if not exists is_admin_message boolean default false;
