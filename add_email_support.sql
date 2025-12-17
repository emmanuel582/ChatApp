-- 1. Add email column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;

-- 2. Update the handle_new_user function to include email sync for NEW users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, username, avatar_url, email)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'username',
    new.raw_user_meta_data->>'avatar_url',
    new.email
  );
  RETURN new;
END;
$$;

-- 3. Backfill existing emails
-- Run this to sync emails for users already in the database
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id;
