-- 1. Allow Users to delete their own messages
-- Checks if the current authenticated user is the sender of the message
DROP POLICY IF EXISTS "Users can delete their own messages" ON public.messages;
CREATE POLICY "Users can delete their own messages"
ON public.messages
FOR DELETE
USING (auth.uid() = sender_id);

-- 2. Allow Admins to delete ANY message
-- Uses the is_admin() function to verify admin status
DROP POLICY IF EXISTS "Admins can delete any message" ON public.messages;
CREATE POLICY "Admins can delete any message"
ON public.messages
FOR DELETE
USING ( is_admin() );
