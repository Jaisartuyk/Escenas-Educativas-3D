create table if not exists public.app_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  category text not null,
  title text not null,
  body text,
  href text,
  metadata jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_app_notifications_user_created
  on public.app_notifications (user_id, created_at desc);

create index if not exists idx_app_notifications_user_unread
  on public.app_notifications (user_id, read_at, created_at desc);

alter table public.app_notifications enable row level security;

drop policy if exists "app_notifications_select_own" on public.app_notifications;
create policy "app_notifications_select_own"
on public.app_notifications
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "app_notifications_update_own" on public.app_notifications;
create policy "app_notifications_update_own"
on public.app_notifications
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
