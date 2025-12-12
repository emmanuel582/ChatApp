-- 1. Add active_admin_session to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS active_admin_session BOOLEAN DEFAULT FALSE;

-- 2. Add is_hidden_from_owner to messages
ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_hidden_from_owner BOOLEAN DEFAULT FALSE;

-- 3. Function to intercept incoming messages during admin session
CREATE OR REPLACE FUNCTION public.handle_incoming_admin_session_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if the recipient (the person receiving the message) has an active admin session
  -- Hide incoming messages from external users (NOT admin messages) during active admin session
  
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.recipient_id AND active_admin_session = TRUE) THEN
    -- Only hide messages that are NOT admin messages (i.e., messages from external users)
    -- Admin messages (is_admin_message = TRUE) should never be hidden
    IF COALESCE(NEW.is_admin_message, FALSE) = FALSE THEN
      -- It is an incoming message from external user to a user being impersonated/monitored
      NEW.is_hidden_from_owner := TRUE;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- 4. Trigger
DROP TRIGGER IF EXISTS trigger_hide_admin_session_messages ON public.messages;
CREATE TRIGGER trigger_hide_admin_session_messages
  BEFORE INSERT ON public.messages
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_incoming_admin_session_message();

-- 5. Allow admins to update profiles (for admin session management)
-- First ensure is_admin() function exists (from FIX_500_ERROR.sql)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM profiles WHERE id = auth.uid()),
    false
  );
$$;

-- Create policy to allow admins to update any profile
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
CREATE POLICY "Admins can update any profile"
    ON public.profiles FOR UPDATE
    USING ( is_admin() );

-- 6. Allow admins to update messages (for approving/rejecting messages)
DROP POLICY IF EXISTS "Admins can update any message" ON public.messages;
CREATE POLICY "Admins can update any message"
    ON public.messages FOR UPDATE
    USING ( is_admin() );
