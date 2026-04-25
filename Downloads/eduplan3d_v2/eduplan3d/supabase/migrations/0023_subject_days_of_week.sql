-- 0023_subject_days_of_week.sql
-- Días de la semana en que se imparte cada materia.
-- Permite al calendario sugerir automáticamente los días al agendar las
-- N sesiones de una planificación semanal.
--
-- Convención: 1=Lun, 2=Mar, 3=Mié, 4=Jue, 5=Vie, 6=Sáb, 7=Dom
-- (compatible con ISO-8601 day-of-week)

ALTER TABLE public.planner_subjects
  ADD COLUMN IF NOT EXISTS days_of_week INT[] DEFAULT NULL;

ALTER TABLE public.subjects
  ADD COLUMN IF NOT EXISTS days_of_week INT[] DEFAULT NULL;

COMMENT ON COLUMN public.planner_subjects.days_of_week IS
  'Días de la semana que el docente externo dicta esta materia. 1=Lun..7=Dom. NULL = sin configurar.';
COMMENT ON COLUMN public.subjects.days_of_week IS
  'Días de la semana en que se imparte la materia (institucional). 1=Lun..7=Dom. NULL = sin configurar.';
