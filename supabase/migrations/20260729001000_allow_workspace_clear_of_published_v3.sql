-- Published Company Intelligence remains immutable during normal operation.
-- The admin-only Settings cleanup RPC sets this transaction-local workspace
-- scope before deleting one workspace's complete intelligence graph.

create or replace function public.prevent_published_v3_child_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'DELETE'
    and current_setting('app.workspace_cleanup_id', true) =
      old.workspace_id::text
  then
    return old;
  end if;

  if old.profile_version_id is not null then
    raise exception 'Published Company Intelligence V3 records are immutable.';
  end if;

  return new;
end;
$$;
