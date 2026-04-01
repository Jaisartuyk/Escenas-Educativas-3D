-- supabase/migrations/0002_biblioteca.sql

-- ─── Tabla: documentos ─────────────────────────────────────
create table public.documentos (
  id             uuid default uuid_generate_v4() primary key,
  user_id        uuid references public.profiles(id) on delete cascade not null,
  titulo         text not null,
  asignatura     text not null,
  grado          text not null,
  storage_path   text not null,
  file_size      integer default 0,
  created_at     timestamptz default now() not null
);

-- Índices para búsquedas rápidas al generar la planificación
create index documentos_user_id_idx on public.documentos(user_id);
create index documentos_asig_grado_idx on public.documentos(user_id, asignatura, grado);

-- ─── Row Level Security (RLS) ──────────────────────────────
alter table public.documentos enable row level security;

create policy "documentos: select own" on public.documentos for select using (auth.uid() = user_id);
create policy "documentos: insert own" on public.documentos for insert with check (auth.uid() = user_id);
create policy "documentos: delete own" on public.documentos for delete using (auth.uid() = user_id);

-- ─── STORAGE: Bucket 'biblioteca' ──────────────────────────
-- Nota: Para que esto corra, el usuario debe tener permisos sobre storage.
insert into storage.buckets (id, name, public) 
values ('biblioteca', 'biblioteca', false) 
on conflict (id) do nothing;

create policy "biblioteca: select own" on storage.objects for select using (bucket_id = 'biblioteca' and auth.uid() = owner);
create policy "biblioteca: insert own" on storage.objects for insert with check (bucket_id = 'biblioteca' and auth.uid() = owner);
create policy "biblioteca: delete own" on storage.objects for delete using (bucket_id = 'biblioteca' and auth.uid() = owner);
