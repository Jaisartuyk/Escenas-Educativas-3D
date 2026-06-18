-- 0025_mensajes_staff_role.sql
-- Permite que conversation_participants.role acepte 'staff' además de los
-- roles existentes ('student', 'tutor', 'admin'). Necesario para mensajería
-- interna staff-a-staff (docente↔docente, docente↔admin, admin↔admin).

ALTER TABLE public.conversation_participants
  DROP CONSTRAINT IF EXISTS conversation_participants_role_check;

ALTER TABLE public.conversation_participants
  ADD CONSTRAINT conversation_participants_role_check
  CHECK (role IN ('student', 'tutor', 'admin', 'staff'));

COMMENT ON COLUMN public.conversation_participants.role IS
  'Rol del participante en la conversación: student, tutor (docente del estudiante), admin, o staff (mensajería interna entre miembros del staff).';
