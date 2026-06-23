create policy "Workspace admins can delete activity events"
on public.activity_events
for delete
to authenticated
using (public.is_workspace_admin(workspace_id));
