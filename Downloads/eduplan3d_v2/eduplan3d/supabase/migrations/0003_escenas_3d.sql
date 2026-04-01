-- supabase/migrations/0003_escenas_3d.sql

-- ─── Tablas ──────────────────────────────────────────────
create table public.escenas_custom (
  id             uuid default uuid_generate_v4() primary key,
  user_id        uuid references public.profiles(id) on delete cascade not null,
  titulo         text not null,
  asignatura     text not null,
  descripcion    text,
  storage_path   text not null,
  created_at     timestamptz default now() not null
);

create table public.escena_puntos (
  id             uuid default uuid_generate_v4() primary key,
  escena_id      uuid references public.escenas_custom(id) on delete cascade not null,
  x              numeric not null,
  y              numeric not null,
  z              numeric not null,
  titulo         text not null,
  descripcion    text not null,
  created_at     timestamptz default now() not null
);

-- ─── Índices ──────────────────────────────────────────────
create index escenas_custom_user_id_idx on public.escenas_custom(user_id);
create index escena_puntos_escena_id_idx on public.escena_puntos(escena_id);

-- ─── RLS (Row Level Security) ─────────────────────────────
alter table public.escenas_custom enable row level security;
alter table public.escena_puntos enable row level security;

create policy "escenas_custom: select own" on public.escenas_custom for select using (auth.uid() = user_id);
create policy "escenas_custom: insert own" on public.escenas_custom for insert with check (auth.uid() = user_id);
create policy "escenas_custom: delete own" on public.escenas_custom for delete using (auth.uid() = user_id);

-- Para los puntos, permitimos a los dueños de la escena gestionarlos
create policy "escena_puntos: select own" on public.escena_puntos for select using (
  exists (select 1 from public.escenas_custom ec where ec.id = escena_puntos.escena_id and ec.user_id = auth.uid())
);
create policy "escena_puntos: insert own" on public.escena_puntos for insert with check (
  exists (select 1 from public.escenas_custom ec where ec.id = escena_puntos.escena_id and ec.user_id = auth.uid())
);
create policy "escena_puntos: delete own" on public.escena_puntos for delete using (
  exists (select 1 from public.escenas_custom ec where ec.id = escena_puntos.escena_id and ec.user_id = auth.uid())
);

-- ─── STORAGE: Bucket 'modelos_3d' ─────────────────────────
insert into storage.buckets (id, name, public) 
values ('modelos_3d', 'modelos_3d', false) 
on conflict (id) do nothing;

create policy "modelos_3d: select own" on storage.objects for select using (bucket_id = 'modelos_3d' and auth.uid() = owner);
create policy "modelos_3d: insert own" on storage.objects for insert with check (bucket_id = 'modelos_3d' and auth.uid() = owner);
create policy "modelos_3d: delete own" on storage.objects for delete using (bucket_id = 'modelos_3d' and auth.uid() = owner);
