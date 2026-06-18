-- 0005_schedule_relational.sql
-- Ejecutar en: Supabase Dashboard → SQL Editor
--
-- Cambios:
--   1. Nueva tabla schedule_configs  → recesos, períodos y configuración institucional en relacional
--   2. Columna institution_id en subjects → permite queries eficientes por institución
--   3. Unique index (course_id, name) en subjects → permite UPSERT sin duplicados
--   4. Limpieza de duplicados previos antes del index
--   5. Backfill de institution_id en subjects existentes

-- ─── 1. Tabla de configuración de horarios ───────────────────────────────────
create table if not exists public.schedule_configs (
  id             uuid default uuid_generate_v4() primary key,
  institution_id uuid references public.institutions(id) on delete cascade not null,
  nombre         text    not null default '',
  anio           text    not null default '',
  jornada        text    not null default 'MATUTINA',   -- 'MATUTINA' | 'VESPERTINA'
  nivel          text    not null default 'Colegio',    -- 'Colegio'  | 'Escuela'
  n_periodos     integer not null default 8,
  periodos       jsonb   not null default '[]',         -- ["07:00 - 07:45", ...]
  recesos        integer[] not null default '{4}',      -- índices de períodos que son receso
  tutores        jsonb   not null default '{}',         -- { "8VO": "Prof. Fulano", ... }
  created_at     timestamptz default now() not null,
  updated_at     timestamptz default now() not null,
  constraint schedule_configs_institution_unique unique (institution_id)
);

create trigger schedule_configs_updated_at
  before update on public.schedule_configs
  for each row execute procedure public.set_updated_at();

alter table public.schedule_configs enable row level security;

-- Todos los miembros de la institución pueden leer la configuración
create policy "schedule_configs: leer por miembros"
  on public.schedule_configs for select
  using (
    institution_id in (
      select institution_id from public.profiles where id = auth.uid()
    )
  );

-- Solo el admin puede crear/editar/borrar
create policy "schedule_configs: gestionar por admin"
  on public.schedule_configs for all
  using (
    institution_id in (
      select institution_id from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  )
  with check (
    institution_id in (
      select institution_id from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- ─── 2. Agregar institution_id a subjects ────────────────────────────────────
alter table public.subjects
  add column if not exists institution_id uuid references public.institutions(id) on delete cascade;

-- Backfill: rellenar institution_id en filas existentes desde su curso padre
update public.subjects s
set institution_id = c.institution_id
from public.courses c
where s.course_id = c.id
  and s.institution_id is null;

-- ─── 3. Limpiar duplicados antes del unique index ────────────────────────────
-- Conserva solo el registro más reciente de cada par (course_id, name)
with ranked as (
  select id,
         row_number() over (
           partition by course_id, name
           order by created_at desc
         ) as rn
  from public.subjects
)
delete from public.subjects
where id in (select id from ranked where rn > 1);

-- ─── 4. Unique index para upsert sin duplicados ──────────────────────────────
-- "Una materia con ese nombre en ese curso" → un solo registro
create unique index if not exists subjects_course_name_unique
  on public.subjects(course_id, name);
