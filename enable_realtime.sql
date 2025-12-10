-- Add messages table to realtime publication
alter publication supabase_realtime add table messages;

-- Ensure RLS allows access (already done, but good to verify)
-- grant select on messages to authenticated; -- usually handled by RLS enablement
