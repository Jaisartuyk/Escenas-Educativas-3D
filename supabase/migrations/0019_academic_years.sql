-- 0019_academic_years.sql
-- Ejecutar en: Supabase Dashboard → SQL Editor
--
-- Cambios:
--   1. Nueva tabla academic_years  → años lectivos por institución
--   2. Solo 1 "current" por institución (índice único parcial)
--   3. FK academic_year_id en schedule_configs (nullable, compat)
--   4. FK academic_year_id en planificaciones (nullable)
--   5. Backfill: crear año current por institución a partir de schedule_configs.anio
--                (o año calendario si no existe) y asignar datos existentes
--   6. RLS: miembros de la institución leen; admin gestiona (insert/update)
--
-- NOTA: planner_solo (docentes externos sin institution_id) NO usan este sistema.
--       Sus planificaciones quedan con academic_year_id = NULL y siguen funcionando
--       como hoy (el filtro por año solo aplica cuando hay institution_id).

-- ─── 1. Tabla academic_years ─────────────────────────────────────────────────
create table if not exists public.academic_years (
  id              uuid default uuid_generate_v4() primary key,
  institution_id  uuid not null references public.institutions(id) on delete cascade,
  label           text not null,                              -- '2026 - 2027'
  start_date      date,
  end_date        date,
  is_current      boolean not null default false,
  status          text not null default 'active',             -- active | archived | draft
  created_at      timestamptz default now() not null,
  updated_at      timestamptz default now() not null,
  constraint academic_years_label_unique unique (institution_id, label),
  constraint academic_years_status_chk check (status in ('active','archived','draft'))
);

-- Solo un año "current" por institución
create unique index if not exists academic_years_one_current
  on public.academic_years (institution_id)
  where is_current = true;

create index if not exists academic_years_institution_idx
  on public.academic_years (institution_id);

create trigger academic_years_updated_at
  before update on public.academic_years
  for each row execute procedure public.set_updated_at();

-- ─── 2. RLS ──────────────────────────────────────────────────────────────────
alter table public.academic_years enable row level security;

create policy "academic_years: leer por miembros"
  on public.academic_years for select
  using (
    institution_id in (
      select institution_id from public.profiles where id = auth.uid()
    )
  );

create policy "academic_years: admin inserta"
  on public.academic_years for insert
  with check (
    institution_id in (
      select institution_id from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

create policy "academic_years: admin actualiza"
  on public.academic_years for update
  using (
    institution_id in (
      select institution_id from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- ─── 3. Backfill: crear año current por institución ─────────────────────────
-- 3a) Si la institución tiene schedule_configs.anio usable, usarlo
insert into public.academic_years (institution_id, label, is_current, status)
select distinct sc.institution_id,
       nullif(trim(sc.anio), '') as label,
       true,
       'active'
from public.schedule_configs sc
where sc.institution_id is not null
  and nullif(trim(sc.anio), '') is not null
on conflict (institution_id, label) do nothing;

-- 3b) Si la institución no tiene año, crear uno calendario por defecto
insert into public.academic_years (institution_id, label, is_current, status)
select i.id,
       extract(year from now())::int || ' - ' || (extract(year from now())::int + 1)::int,
       true,
       'active'
from public.institutions i
where not exists (
  select 1 from public.academic_years ay where ay.institution_id = i.id
)
on conflict (institution_id, label) do nothing;

-- ─── 4. Añadir FK a schedule_configs ─────────────────────────────────────────
alter table public.schedule_configs
  add column if not exists academic_year_id uuid
  references public.academic_years(id) on delete set null;

create index if not exists schedule_configs_academic_year_idx
  on public.schedule_configs (academic_year_id);

-- Backfill: asignar cada schedule_config al año current de su institución
update public.schedule_configs sc
set academic_year_id = ay.id
from public.academic_years ay
where ay.institution_id = sc.institution_id
  and ay.is_current = true
  and sc.academic_year_id is null;

-- ─── 5. Añadir FK a planificaciones ──────────────────────────────────────────
alter table public.planificaciones
  add column if not exists academic_year_id uuid
  references public.academic_years(id) on delete set null;

create index if not exists planificaciones_academic_year_idx
  on public.planificaciones (academic_year_id);

-- Backfill: asignar planificaciones al año current de la institución del user
-- (solo si el user tiene institution_id; planner_solo quedan con NULL)
update public.planificaciones p
set academic_year_id = ay.id
from public.profiles pr
join public.academic_years ay on ay.institution_id = pr.institution_id
where pr.id = p.user_id
  and ay.is_current = true
  and pr.institution_id is not null
  and p.academic_year_id is null;
