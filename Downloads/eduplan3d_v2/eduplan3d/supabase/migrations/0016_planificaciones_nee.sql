-- 0016_planificaciones_nee.sql
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- Soporte para planificaciones NEE paralelas (regular + sin discapacidad + DIAC).
--
-- Cada generación del planificador ahora puede producir hasta 3 documentos:
--   1. Regular               → tipo_documento = 'regular'
--   2. NEE sin discapacidad  → tipo_documento = 'nee_sin_disc'  (adaptación no significativa)
--   3. NEE con discapacidad  → tipo_documento = 'diac'          (adaptación significativa)
--
-- Los documentos adaptados referencian a la planificación regular vía parent_planificacion_id.

ALTER TABLE public.planificaciones
  ADD COLUMN IF NOT EXISTS tipo_documento          text    DEFAULT 'regular',
  ADD COLUMN IF NOT EXISTS parent_planificacion_id uuid,
  ADD COLUMN IF NOT EXISTS nee_tipos               text[]  DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS estudiante_nombre       text,
  ADD COLUMN IF NOT EXISTS grado_curricular_real   text;

-- Constraint: valores permitidos para tipo_documento
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'planificaciones_tipo_documento_check'
  ) THEN
    ALTER TABLE public.planificaciones
      ADD CONSTRAINT planificaciones_tipo_documento_check
      CHECK (tipo_documento IN ('regular', 'nee_sin_disc', 'diac'));
  END IF;
END $$;

-- FK a la planificación padre (regular). Si se borra la padre, se borran hijas.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'planificaciones_parent_fk'
  ) THEN
    ALTER TABLE public.planificaciones
      ADD CONSTRAINT planificaciones_parent_fk
      FOREIGN KEY (parent_planificacion_id)
      REFERENCES public.planificaciones(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Índices útiles para listar variantes de una planificación y filtrar por tipo.
CREATE INDEX IF NOT EXISTS idx_planificaciones_parent_id
  ON public.planificaciones(parent_planificacion_id);

CREATE INDEX IF NOT EXISTS idx_planificaciones_tipo_documento
  ON public.planificaciones(tipo_documento);

COMMENT ON COLUMN public.planificaciones.tipo_documento IS
  'Tipo: regular | nee_sin_disc (no significativa) | diac (significativa)';
COMMENT ON COLUMN public.planificaciones.parent_planificacion_id IS
  'Si es NEE/DIAC, apunta a la planificación regular original';
COMMENT ON COLUMN public.planificaciones.nee_tipos IS
  'Códigos de tipos NEE aplicados (ver src/lib/pedagogy/nee.ts)';
COMMENT ON COLUMN public.planificaciones.estudiante_nombre IS
  'Nombre opcional del estudiante para DIAC individualizado';
COMMENT ON COLUMN public.planificaciones.grado_curricular_real IS
  'Grado real del estudiante DIAC (puede ser inferior al grado del aula)';
