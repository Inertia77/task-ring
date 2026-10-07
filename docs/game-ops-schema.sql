-- TaskRingAI: canonical limited-time / recurring tasks. Additive migration.
create table public.game_ops_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id),
  task_key text not null unique check (length(trim(task_key)) > 0),
  game text not null check (game in ('ZZZ','WUWA','HSR','NTE','ONMYOJI','ENF')),
  server text not null check (server in ('GLOBAL','CN')),
  task_name text not null check (length(trim(task_name)) > 0),
  task_type text not null check (task_type in ('LIMITED_TIME','RECURRING')),
  period text,
  open_at timestamptz,
  open_date date,
  deadline_at timestamptz,
  deadline_date date,
  gameplay_end_at timestamptz,
  claim_end_at timestamptz,
  lifecycle_status text not null default 'TO_VERIFY' check (lifecycle_status in ('UPCOMING','ACTIVE','ENDING_SOON','ARCHIVED','TO_VERIFY')),
  user_action text not null default 'NONE' check (user_action in ('NONE','DONE','SKIP')),
  archive_reason text check (archive_reason in ('DONE','SKIP','EXPIRED','REPLACED','INVALID')),
  archived_at timestamptz,
  priority text not null default 'NORMAL' check (priority in ('HIGH','NORMAL','LOW')),
  verification text not null default 'TO_VERIFY' check (verification in ('CONFIRMED','TO_VERIFY','ESTIMATED')),
  source_level text check (source_level in ('P0','P1','MANUAL')),
  source_url text check (source_url is null or source_url ~ '^https?://'),
  notes text,
  last_verified_at timestamptz,
  last_verified_date date,
  legacy_task_key text,
  migration_source_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint game_ops_server_matches_game check ((game in ('ZZZ','WUWA','HSR') and server='GLOBAL') or (game in ('NTE','ONMYOJI','ENF') and server='CN')),
  constraint game_ops_archive_consistency check (
    (lifecycle_status='ARCHIVED' and archived_at is not null and archive_reason is not null)
    or (lifecycle_status<>'ARCHIVED' and archived_at is null and archive_reason is null and user_action='NONE')),
  constraint game_ops_action_consistency check (
    (user_action='DONE' and archive_reason='DONE') or (user_action='SKIP' and archive_reason='SKIP')
    or (user_action='NONE' and (archive_reason is null or archive_reason in ('EXPIRED','REPLACED','INVALID'))))
);
create index game_ops_game_idx on public.game_ops_tasks(game);
create index game_ops_lifecycle_idx on public.game_ops_tasks(lifecycle_status);
create index game_ops_deadline_idx on public.game_ops_tasks(deadline_at);
create index game_ops_archive_idx on public.game_ops_tasks(archived_at desc);
create index game_ops_owner_active_idx on public.game_ops_tasks(user_id,deadline_at) where archived_at is null;
create index game_ops_owner_archive_idx on public.game_ops_tasks(user_id,archived_at desc,id desc) where archived_at is not null;
create function public.game_ops_stamp_archive() returns trigger language plpgsql set search_path='' as $$
begin
  if new.lifecycle_status='ARCHIVED' and new.archived_at is null then new.archived_at=clock_timestamp(); end if;
  return new;
end;
$$;
create trigger game_ops_archive_stamp before insert or update on public.game_ops_tasks for each row execute function public.game_ops_stamp_archive();
create trigger game_ops_updated_at before update on public.game_ops_tasks for each row execute function public.set_taskring_updated_at();
alter table public.game_ops_tasks enable row level security;
revoke all on public.game_ops_tasks from anon;
grant select,insert,update on public.game_ops_tasks to authenticated;
grant all on public.game_ops_tasks to service_role;
create policy game_ops_read_own on public.game_ops_tasks for select to authenticated using ((select auth.uid())=user_id);
create policy game_ops_insert_own on public.game_ops_tasks for insert to authenticated with check ((select auth.uid())=user_id);
create policy game_ops_update_own on public.game_ops_tasks for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create view public.game_ops_active with (security_invoker=true) as select * from public.game_ops_tasks where archived_at is null;
create view public.game_ops_archive with (security_invoker=true) as select * from public.game_ops_tasks where archived_at is not null;
revoke all on public.game_ops_active,public.game_ops_archive from anon;
grant select on public.game_ops_active,public.game_ops_archive to authenticated,service_role;
