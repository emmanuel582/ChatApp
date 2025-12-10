-- Create storage bucket for chat attachments
insert into storage.buckets (id, name, public) values ('chat-attachments', 'chat-attachments', true);

-- Storage policies
create policy "Anyone can upload chat attachments"
  on storage.objects for insert
  with check ( bucket_id = 'chat-attachments' );

create policy "Anyone can view chat attachments"
  on storage.objects for select
  using ( bucket_id = 'chat-attachments' );

-- Add last_seen to profiles if not exists
alter table profiles add column if not exists last_seen timestamp with time zone;

-- Update messages table to support image type (optional, can just use content with a prefix or metadata)
-- For simplicity, we will assume if content starts with 'https://' and contains 'supabase' and 'chat-attachments', it is an image.
-- Or we can add a type column.
alter table messages add column if not exists type text default 'text'; -- 'text' or 'image'
