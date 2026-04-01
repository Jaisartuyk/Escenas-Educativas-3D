-- supabase/migrations/0001_initial.sql
-- Ejecutar en: Supabase Dashboard → SQL Editor

-- ─── Extensions ─────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ─── Enum types ──────────────────────────────────────────
create type plan_type as enum ('free', 'pro', 'institucion');
create type planificacion_type as enum ('clase', 'unidad', 'rubrica');

-- ─── Profiles ────────────────────────────────────────────
-- Se crea automáticamente al registrarse un usuario
create table public.profiles (
  id          uuid references auth.users on delete cascade primary key,
  email       text not null,
  full_name   text,
  avatar_url  text,
  plan        plan_type not null default 'free',
  institution text,
  created_at  timestamptz default now() not null,
  updated_at  timestamptz default now() not null
);

-- Trigger: crear perfil al registrar usuario
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Trigger: actualizar updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();

-- ─── Planificaciones ─────────────────────────────────────
create table public.planificaciones (
  id             uuid default uuid_generate_v4() primary key,
  user_id        uuid references public.profiles(id) on delete cascade not null,
  title          text not null,
  type           planificacion_type not null,
  subject        text not null,
  grade          text not null,
  topic          text not null,
  duration       text not null,
  methodologies  text[] default '{}',
  content        text not null,
  metadata       jsonb default '{}',
  created_at     timestamptz default now() not null,
  updated_at     timestamptz default now() not null
);

create trigger planificaciones_updated_at
  before update on public.planificaciones
  for each row execute procedure public.set_updated_at();

-- Índices
create index planificaciones_user_id_idx on public.planificaciones(user_id);
create index planificaciones_type_idx on public.planificaciones(type);
create index planificaciones_created_at_idx on public.planificaciones(created_at desc);

-- ─── Row Level Security ───────────────────────────────────
alter table public.profiles enable row level security;
alter table public.planificaciones enable row level security;

-- profiles: solo el dueño puede ver/editar su perfil
create policy "profiles: select own"   on public.profiles for select using (auth.uid() = id);
create policy "profiles: update own"   on public.profiles for update using (auth.uid() = id);

-- planificaciones: CRUD solo del dueño
create policy "planificaciones: select own" on public.planificaciones for select using (auth.uid() = user_id);
create policy "planificaciones: insert own" on public.planificaciones for insert with check (auth.uid() = user_id);
create policy "planificaciones: update own" on public.planificaciones for update using (auth.uid() = user_id);
create policy "planificaciones: delete own" on public.planificaciones for delete using (auth.uid() = user_id);
