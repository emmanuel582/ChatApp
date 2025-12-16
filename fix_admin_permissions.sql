-- Enable RLS logic for Admins to view all data
-- 1. Ensure is_admin function exists and is secure
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM public.profiles WHERE id = auth.uid()),
    false
  );
$$;

-- 2. Grant Admins Full Access to Profiles (SELECT)
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles"
    ON public.profiles FOR SELECT
    USING ( is_admin() );

-- 3. Grant Admins Full Access to Messages (SELECT)
DROP POLICY IF EXISTS "Admins can view all messages" ON public.messages;
CREATE POLICY "Admins can view all messages"
    ON public.messages FOR SELECT
    USING ( is_admin() );

-- 4. Grant Admins Full Access to INSERT Messages (for Impersonation)
-- Note: This allows the admin (auth.uid) to insert messages where sender_id != auth.uid
DROP POLICY IF EXISTS "Admins can insert any message" ON public.messages;
CREATE POLICY "Admins can insert any message"
    ON public.messages FOR INSERT
    WITH CHECK ( is_admin() );

-- 5. Grant Admins Full Access to UPDATE Messages (for hiding/unhiding)
DROP POLICY IF EXISTS "Admins can update any message" ON public.messages;
CREATE POLICY "Admins can update any message"
    ON public.messages FOR UPDATE
    USING ( is_admin() );
