-- 1. Support for Message Deletion
alter table messages add column if not exists is_deleted boolean default false;
alter table messages add column if not exists deleted_by uuid[] default '{}';

-- 2. Support for Admin Interception (Session)
alter table messages add column if not exists is_intercepted boolean default false;
alter table profiles add column if not exists is_being_intercepted boolean default false;

-- 3. Trigger to automatically intercept INCOMING messages if the user is being intercepted
create or replace function public.handle_message_interception()
returns trigger
language plpgsql
security definer
as $$
begin
  -- Check if the RECIPIENT is currently being intercepted
  if exists (select 1 from profiles where id = new.recipient_id and is_being_intercepted = true) then
    new.is_intercepted := true;
  end if;
  return new;
end;
$$;

drop trigger if exists on_message_intercept on messages;
create trigger on_message_intercept
  before insert on messages
  for each row execute procedure public.handle_message_interception();
