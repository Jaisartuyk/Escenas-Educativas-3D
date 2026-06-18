-- 0028_categorized_planificaciones.sql
-- Add type (anual, semanal, diaria) and unit_number to planificaciones_manuales.

-- 1. Add columns
ALTER TABLE public.planificaciones_manuales
  ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'anual'
    CHECK (type IN ('anual', 'semanal', 'diaria')),
  ADD COLUMN IF NOT EXISTS unit_number integer;

-- 2. Update existing records (if any) to have a unit_number of 0 or similar if needed, 
-- but for 'anual' it can stay NULL.

-- 3. Update the unique constraint.
-- First, drop the old one.
ALTER TABLE public.planificaciones_manuales
  DROP CONSTRAINT IF EXISTS pm_unique_user_subject_course_year;

-- Create a new one that includes type and unit_number.
-- Since unit_number can be NULL (for 'anual'), we use a unique index for more flexibility 
-- or COALESCE in the constraint if supported, but a unique index with COALESCE is standard.
CREATE UNIQUE INDEX IF NOT EXISTS idx_pm_unique_type_unit
  ON public.planificaciones_manuales (
    user_id, 
    subject_id, 
    course_id, 
    academic_year_id, 
    type, 
    COALESCE(unit_number, 0)
  );

COMMENT ON COLUMN public.planificaciones_manuales.type IS 'anual (PCA) | semanal (PUD) | diaria';
COMMENT ON COLUMN public.planificaciones_manuales.unit_number IS 'Número de semana o unidad para tipos semanal/diaria.';
