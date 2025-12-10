-- Create messages table
create table if not exists messages (
  id uuid default uuid_generate_v4() primary key,
  sender_id uuid references auth.users(id) not null,
  recipient_id uuid references auth.users(id) not null,
  content text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  is_read boolean default false
);

-- Enable RLS
alter table messages enable row level security;

-- Policies
create policy "Users can see their own messages" on messages
  for select using (auth.uid() = sender_id or auth.uid() = recipient_id);

create policy "Users can insert their own messages" on messages
  for insert with check (auth.uid() = sender_id);

-- Create a view or function to get recent conversations might be useful, but for now we'll do it in client side or simple query
