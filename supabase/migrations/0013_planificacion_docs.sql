-- 0013_planificacion_docs.sql
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- Tabla para que los docentes suban sus planificaciones manuales (independiente del planificador IA)

CREATE TABLE IF NOT EXISTS public.planificacion_docs (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  subject_id    uuid,                        -- referencia opcional a subjects
  titulo        text NOT NULL,
  tipo          text NOT NULL CHECK (tipo IN ('anual', 'trimestral', 'semanal', 'diaria', 'unidad')),
  trimestre     int  CHECK (trimestre IS NULL OR trimestre IN (1, 2, 3)),
  semana        int,                          -- semana del trimestre (1-6), opcional
  asignatura    text NOT NULL,
  curso         text NOT NULL,
  storage_path  text NOT NULL,
  file_size     bigint DEFAULT 0,
  file_name     text,                         -- nombre original del archivo
  file_type     text,                         -- mime type
  created_at    timestamptz DEFAULT now()
);

-- RLS: cada docente solo ve y gestiona sus propias planificaciones
ALTER TABLE public.planificacion_docs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Docente gestiona sus planificaciones"
  ON public.planificacion_docs FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Índice para búsqueda rápida por docente
CREATE INDEX IF NOT EXISTS idx_planificacion_docs_user_id ON public.planificacion_docs(user_id);
CREATE INDEX IF NOT EXISTS idx_planificacion_docs_tipo    ON public.planificacion_docs(tipo);

COMMENT ON TABLE public.planificacion_docs IS
  'Planificaciones manuales subidas por docentes (independiente del planificador IA de pago)';
