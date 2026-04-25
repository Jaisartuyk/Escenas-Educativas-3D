-- 0024_calendario_sesion_numero.sql
-- Identifica qué sesión de una planificación semanal corresponde a la entrada
-- agendada. NULL = planificación tratada como sesión única (planes viejos sin
-- metadata.sesiones[]).

ALTER TABLE public.planificacion_calendario
  ADD COLUMN IF NOT EXISTS sesion_numero INT;

-- Constraint: si hay sesion_numero, debe ser >= 1
ALTER TABLE public.planificacion_calendario
  DROP CONSTRAINT IF EXISTS chk_pcal_sesion_numero;
ALTER TABLE public.planificacion_calendario
  ADD CONSTRAINT chk_pcal_sesion_numero
  CHECK (sesion_numero IS NULL OR sesion_numero >= 1);

-- Índice para queries por (planificacion_id, sesion_numero) — útil al
-- verificar qué sesiones ya están agendadas.
CREATE INDEX IF NOT EXISTS idx_pcal_plan_sesion
  ON public.planificacion_calendario(planificacion_id, sesion_numero);

COMMENT ON COLUMN public.planificacion_calendario.sesion_numero IS
  'Número de sesión (1..N) cuando la planificación tiene múltiples sesiones semanales. NULL para planes de sesión única.';
