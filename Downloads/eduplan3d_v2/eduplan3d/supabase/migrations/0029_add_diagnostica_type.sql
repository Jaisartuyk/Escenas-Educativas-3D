-- 0029_add_diagnostica_type.sql
-- Add 'adaptacion' and 'diagnostica' to planificacion_type enum.

ALTER TYPE public.planificacion_type ADD VALUE IF NOT EXISTS 'adaptacion';
ALTER TYPE public.planificacion_type ADD VALUE IF NOT EXISTS 'diagnostica';

-- Also ensure the institutional planificaciones_manuales table supports it if needed in the future,
-- but the user specifically asked for the Planificador (which uses the 'planificaciones' table).
-- The 'planificaciones' table uses the 'planificacion_type' enum, so the change above is sufficient.
