-- IMPORTANT: Run this entire script in your Supabase SQL Editor to enable Replies!

-- 1. Add reply_to_id column if it doesn't exist
do $$ 
begin 
    if not exists (select 1 from information_schema.columns where table_name = 'messages' and column_name = 'reply_to_id') then
        alter table messages add column reply_to_id uuid references messages(id);
    end if; 
end $$;

-- 2. Add last_seen to profiles if missing
do $$ 
begin 
    if not exists (select 1 from information_schema.columns where table_name = 'profiles' and column_name = 'last_seen') then
        alter table profiles add column last_seen timestamp with time zone;
    end if; 
end $$;

-- 3. Ensure Storage Bucket exists
insert into storage.buckets (id, name, public) 
values ('chat-attachments', 'chat-attachments', true)
on conflict (id) do nothing;

-- 4. Storage Policies (Safe to run multiple times, they might error if exist but that's fine in manual run, usually use drop if exists)
drop policy if exists "Anyone can upload chat attachments" on storage.objects;
create policy "Anyone can upload chat attachments" on storage.objects for insert with check ( bucket_id = 'chat-attachments' );

drop policy if exists "Anyone can view chat attachments" on storage.objects;
create policy "Anyone can view chat attachments" on storage.objects for select using ( bucket_id = 'chat-attachments' );
