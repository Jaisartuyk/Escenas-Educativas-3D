-- ─── 0002_lms_schema.sql ─────────────────────────────
-- Ejecutar en: Supabase Dashboard → SQL Editor

-- 0. Función Auxiliar (En caso de que no exista en tu proyecto)
create or replace function public.set_updated_at()
returns trigger language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 1. Enum para Roles
create type user_role as enum ('admin', 'teacher', 'student', 'assistant', 'horarios_only');

-- 2. Institutions (Entidad principal del SaaS)
create table public.institutions (
  id          uuid default uuid_generate_v4() primary key,
  name        text not null,
  join_code   text unique, -- Código corto único para que alumnos/docentes se unan rápido
  settings    jsonb default '{}',
  created_at  timestamptz default now() not null,
  updated_at  timestamptz default now() not null
);

-- Trigger de Updated At para instituciones
create trigger institutions_updated_at
  before update on public.institutions
  for each row execute procedure public.set_updated_at();

-- 3. Modificaciones a Profiles (Conectándolos a la escuela y asignando rol)
alter table public.profiles
  add column institution_id uuid references public.institutions(id) on delete set null,
  add column role user_role default 'admin'; -- El primer perfil de una escuela arranca como admin

-- 4. Courses (Cursos/Grados) ej: 8vo BGU A
create table public.courses (
  id             uuid default uuid_generate_v4() primary key,
  institution_id uuid references public.institutions(id) on delete cascade not null,
  name           text not null, -- ej. "1RO BGU"
  parallel       text, -- ej. "A"
  level          text, -- "Colegio" o "Escuela"
  shift          text, -- "MATUTINA" o "VESPERTINA"
  created_at     timestamptz default now() not null,
  updated_at     timestamptz default now() not null
);

create trigger courses_updated_at
  before update on public.courses
  for each row execute procedure public.set_updated_at();

-- 5. Subjects (Materias impartidas en los Cursos)
create table public.subjects (
  id             uuid default uuid_generate_v4() primary key,
  course_id      uuid references public.courses(id) on delete cascade not null,
  teacher_id     uuid references public.profiles(id) on delete set null,
  name           text not null, -- ej "Matemáticas"
  weekly_hours   integer default 1,
  created_at     timestamptz default now() not null,
  updated_at     timestamptz default now() not null
);

create trigger subjects_updated_at
  before update on public.subjects
  for each row execute procedure public.set_updated_at();

-- 6. Enrollments (Matrículas: Cuales alumnos están en cuales cursos)
create table public.enrollments (
  id             uuid default uuid_generate_v4() primary key,
  course_id      uuid references public.courses(id) on delete cascade not null,
  student_id     uuid references public.profiles(id) on delete cascade not null,
  created_at     timestamptz default now() not null,
  unique(course_id, student_id)
);

-- 7. Assignments & Grades (Módulo de Tareas y Calificaciones)
create table public.assignments (
  id             uuid default uuid_generate_v4() primary key,
  subject_id     uuid references public.subjects(id) on delete cascade not null,
  title          text not null,
  description    text,
  due_date       timestamptz,
  created_at     timestamptz default now() not null,
  updated_at     timestamptz default now() not null
);

create trigger assignments_updated_at
  before update on public.assignments
  for each row execute procedure public.set_updated_at();

create table public.grades (
  id             uuid default uuid_generate_v4() primary key,
  assignment_id  uuid references public.assignments(id) on delete cascade not null,
  student_id     uuid references public.profiles(id) on delete cascade not null,
  score          numeric(5,2),
  feedback       text,
  submitted_url  text, -- Link del archivo de tarea en Supabase Storage subido por el alumno
  created_at     timestamptz default now() not null,
  updated_at     timestamptz default now() not null,
  unique(assignment_id, student_id)
);

create trigger grades_updated_at
  before update on public.grades
  for each row execute procedure public.set_updated_at();

-- Seguridad (Para proteger las tablas por defecto)
alter table public.institutions enable row level security;
alter table public.courses enable row level security;
alter table public.subjects enable row level security;
alter table public.enrollments enable row level security;
alter table public.assignments enable row level security;
alter table public.grades enable row level security;
