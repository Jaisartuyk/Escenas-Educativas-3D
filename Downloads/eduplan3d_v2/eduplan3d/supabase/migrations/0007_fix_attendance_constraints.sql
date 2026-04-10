-- 0007_fix_attendance_constraints.sql
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- Corrige constraints faltantes y desalineados en attendance y behavior_records

-- 1. Eliminar el CHECK constraint existente que no coincide con el código
ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_status_check;

-- 2. Recrear el CHECK con los valores correctos usados por el frontend
ALTER TABLE attendance ADD CONSTRAINT attendance_status_check 
  CHECK (status IN ('present', 'absent', 'late'));

-- 3. Agregar UNIQUE constraint para evitar duplicados (si no existe)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'attendance_subject_student_date_unique'
  ) THEN
    ALTER TABLE attendance 
      ADD CONSTRAINT attendance_subject_student_date_unique 
      UNIQUE (subject_id, student_id, date);
  END IF;
END $$;

-- 4. Agregar institution_id si no existe (para futuro uso)
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS institution_id uuid REFERENCES institutions(id) ON DELETE CASCADE;
ALTER TABLE behavior_records ADD COLUMN IF NOT EXISTS institution_id uuid REFERENCES institutions(id) ON DELETE CASCADE;
