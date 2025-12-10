-- Add is_admin column to profiles
alter table profiles add column if not exists is_admin boolean default false;

-- Add is_admin_message column to messages
alter table messages add column if not exists is_admin_message boolean default false;

-- Add policy to allow admins to view all data (This is simplified, usually implies updating RLS)
-- For now, we assume RLS allows users to see their own data.
-- If Admin is 'impersonating', they are technically fetching as the 'admin user' but querying for 'other user' data.
-- So we need RLS to allow Admins to SELECT ANY message.

create policy "Admins can select all messages"
    on messages for select
    using ( exists (select 1 from profiles where id = auth.uid() and is_admin = true) );

create policy "Admins can insert messages as others"
    on messages for insert
    with check ( exists (select 1 from profiles where id = auth.uid() and is_admin = true) );

create policy "Admins can select all profiles"
    on profiles for select
    using ( exists (select 1 from profiles where id = auth.uid() and is_admin = true) );
