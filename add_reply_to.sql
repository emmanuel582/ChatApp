-- Add reply_to_id column to messages table
alter table messages add column if not exists reply_to_id uuid references messages(id);
