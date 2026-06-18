-- 0030_planificaciones_manuales_supervisor_notes.sql
-- Add supervisor/admin feedback fields for institutional review of teacher plans.

ALTER TABLE public.planificaciones_manuales
  ADD COLUMN IF NOT EXISTS supervisor_notes text,
  ADD COLUMN IF NOT EXISTS supervisor_notes_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS supervisor_notes_updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.planificaciones_manuales.supervisor_notes IS
  'Retroalimentación u observaciones del supervisor/admin/rector sobre la planificación docente.';
COMMENT ON COLUMN public.planificaciones_manuales.supervisor_notes_updated_at IS
  'Fecha de la última actualización de la retroalimentación institucional.';
COMMENT ON COLUMN public.planificaciones_manuales.supervisor_notes_updated_by IS
  'Usuario institucional que guardó la última retroalimentación.';
