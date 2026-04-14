-- 0012_attendance_justifications.sql
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- Añade soporte para la justificación de faltas y atrasos por parte de padres/estudiantes

ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS justification_text text;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS justification_status text DEFAULT 'pending' CHECK (justification_status IN ('pending', 'approved', 'rejected'));
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS justification_file_url text; -- Para subir certificados médicos si es necesario

-- Actualizar comentario de la tabla para documentación
COMMENT ON COLUMN public.attendance.justification_text IS 'Motivo ingresado por el padre/estudiante para justificar falta/atraso';
COMMENT ON COLUMN public.attendance.justification_status IS 'Estado de la justificación: pending, approved, rejected';
COMMENT ON COLUMN public.attendance.justification_file_url IS 'URL del archivo subido como justificativo (ej. certificado médico)';

-- NOTA: Asegúrate de tener un bucket de almacenamiento llamado "justifications" creado en Supabase Storage (público) 
-- para que los padres puedan subir las evidencias médicas.

