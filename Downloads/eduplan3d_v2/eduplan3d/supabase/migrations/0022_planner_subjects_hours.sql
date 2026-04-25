-- 0022_planner_subjects_hours.sql
-- Configuración de horas pedagógicas semanales para docentes externos.
-- Los institucionales ya tienen subjects.weekly_hours y schedule_configs.period_minutes;
-- los planner_solo necesitan los mismos campos en su propia tabla.

ALTER TABLE public.planner_subjects
  ADD COLUMN IF NOT EXISTS weekly_hours INT NOT NULL DEFAULT 4,
  ADD COLUMN IF NOT EXISTS period_minutes INT NOT NULL DEFAULT 45;

COMMENT ON COLUMN public.planner_subjects.weekly_hours IS
  'Horas pedagógicas semanales que el docente externo dicta de esta materia (default 4).';
COMMENT ON COLUMN public.planner_subjects.period_minutes IS
  'Duración en minutos de cada hora pedagógica para esta materia (40/45/60, default 45).';
