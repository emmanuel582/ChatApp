-- 1. Create a table for public profiles
create table profiles (
  id uuid references auth.users on delete cascade not null primary key,
  updated_at timestamp with time zone,
  username text unique,
  full_name text,
  avatar_url text,
  constraint username_length check (char_length(username) >= 3)
);

-- 2. Set up Row Level Security (RLS)
-- This ensures users can't delete or chat as other people
alter table profiles enable row level security;

create policy "Public profiles are viewable by everyone."
  on profiles for select
  using ( true );

create policy "Users can insert their own profile."
  on profiles for insert
  with check ( auth.uid() = id );

create policy "Users can update own profile."
  on profiles for update
  using ( auth.uid() = id );

-- 3. Create a Trigger to handle new user signup automatically
-- This specifically grabs the 'avatar_url' we assigned randomly in the frontend
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, username, avatar_url)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'username',
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$;

-- 4. Attach the trigger to the auth.users table
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
