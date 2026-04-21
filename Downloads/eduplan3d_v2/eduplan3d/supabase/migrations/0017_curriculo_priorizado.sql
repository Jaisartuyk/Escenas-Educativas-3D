-- 0017_curriculo_priorizado.sql
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- Tabla maestra del Currículo Priorizado MinEduc (Ecuador).
--
-- Cada fila representa una Destreza con Criterio de Desempeño (DCD) o un
-- indicador de evaluación, asociado a un grado/asignatura/unidad.
-- El planificador consulta esta tabla al generar una planificación para
-- anclar los objetivos/destrezas/indicadores al documento oficial.

CREATE TABLE IF NOT EXISTS public.curriculo_priorizado (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  subnivel            text        NOT NULL,            -- 'preparatoria' | 'elemental' | 'media' | 'superior' | 'bgu'
  grado               text        NOT NULL,            -- '1ro_egb', '2do_egb', ..., '1ro_bgu', '2do_bgu', '3ro_bgu'
  asignatura          text        NOT NULL,            -- 'matematica', 'lengua_literatura', 'ciencias_naturales', ...
  unidad              text,                            -- nombre/numero de unidad si aplica
  bloque_curricular   text,                            -- bloque curricular (ej: 'algebra y funciones')
  destreza_codigo     text,                            -- código oficial ej. 'M.2.1.1'
  destreza_descripcion text       NOT NULL,
  indicador_codigo    text,                            -- ej. 'I.M.2.1.1.'
  indicador_descripcion text,
  contenidos          text,                            -- contenidos conceptuales asociados
  criterios_evaluacion text,
  fuente              text,                            -- ruta del PDF o URL MinEduc de origen
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_curriculo_grado_asig
  ON public.curriculo_priorizado(grado, asignatura);

CREATE INDEX IF NOT EXISTS idx_curriculo_destreza_codigo
  ON public.curriculo_priorizado(destreza_codigo);

CREATE INDEX IF NOT EXISTS idx_curriculo_subnivel
  ON public.curriculo_priorizado(subnivel);

-- Búsqueda full-text en español para destreza/indicador/contenidos
CREATE INDEX IF NOT EXISTS idx_curriculo_fts
  ON public.curriculo_priorizado
  USING gin (to_tsvector('spanish',
    coalesce(destreza_descripcion,'') || ' ' ||
    coalesce(indicador_descripcion,'') || ' ' ||
    coalesce(contenidos,'')
  ));

COMMENT ON TABLE public.curriculo_priorizado IS
  'Currículo Priorizado MinEduc: destrezas, indicadores y contenidos por grado/asignatura.';
