-- 0008_grade_categories.sql
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- Sistema de Calificaciones por Categorías Ponderadas (estilo iDukay)

-- 1. Tabla de categorías de actividades
CREATE TABLE IF NOT EXISTS grade_categories (
  id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  institution_id uuid NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  name           text NOT NULL,           -- ej: "Formativa: Tarea"
  color          text NOT NULL DEFAULT '#4F46E5',  -- hex color para la UI
  weight_percent numeric(5,2) NOT NULL DEFAULT 20.00, -- porcentaje del aporte
  sort_order     integer NOT NULL DEFAULT 0,
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now()
);

-- 2. Agregar category_id a assignments
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES grade_categories(id) ON DELETE SET NULL;

-- 3. Trigger de updated_at
CREATE OR REPLACE TRIGGER grade_categories_updated_at
  BEFORE UPDATE ON grade_categories
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
