-- 0004_add_user_roles.sql
-- Agrega campo role a profiles para control de acceso por usuario

create type user_role as enum ('admin', 'full', 'horarios_only');

alter table public.profiles
  add column role user_role not null default 'full';

-- Asignar rol restringido al usuario específico
update public.profiles
  set role = 'horarios_only'
  where email = 'israferaldascarlett15@gmail.com';
