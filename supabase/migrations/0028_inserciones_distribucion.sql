-- 0028_inserciones_distribucion.sql
-- Matriz Anual de Inserciones Curriculares MinEduc 2025-2026.
-- El admin/rector decide al inicio del año cuáles inserciones se trabajan
-- en cada trimestre. El planificador IA pre-llena las inserciones según
-- esta matriz al generar planificaciones del trimestre activo.
--
-- Filas posibles:
--   - 1 fila por trimestre (1, 2, 3) por institución → distribución institucional
--   - Opcionalmente más adelante: distribución por curso o por materia (course_id,
--     subject_id se dejan NULL en el MVP).

CREATE TABLE IF NOT EXISTS public.inserciones_distribucion (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id  uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  -- Granularidad opcional. NULL = aplica a toda la institución.
  course_id       uuid REFERENCES public.courses(id) ON DELETE CASCADE,
  subject_id      uuid REFERENCES public.subjects(id) ON DELETE CASCADE,
  trimestre       INT  NOT NULL CHECK (trimestre IN (1, 2, 3)),
  -- Array de IDs de inserciones del catálogo (lib/pedagogy/inserciones.ts):
  -- 'civica_etica' | 'desarrollo_sostenible' | 'socioemocional' |
  -- 'financiera' | 'vial'
  inserciones     TEXT[] NOT NULL DEFAULT '{}',
  -- Opcional: año lectivo al que aplica (NULL = aplica al año actual)
  academic_year_id uuid REFERENCES public.academic_years(id) ON DELETE SET NULL,
  created_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Una sola distribución por (institución, curso?, materia?, trimestre, año)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_inserciones_dist
  ON public.inserciones_distribucion (
    institution_id,
    COALESCE(course_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(subject_id, '00000000-0000-0000-0000-000000000000'::uuid),
    trimestre,
    COALESCE(academic_year_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

CREATE INDEX IF NOT EXISTS idx_inserciones_dist_inst
  ON public.inserciones_distribucion(institution_id);
CREATE INDEX IF NOT EXISTS idx_inserciones_dist_year
  ON public.inserciones_distribucion(academic_year_id);

-- ── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.inserciones_distribucion ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS id_select_member ON public.inserciones_distribucion;
CREATE POLICY id_select_member
  ON public.inserciones_distribucion
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.institution_id = inserciones_distribucion.institution_id
    )
  );

DROP POLICY IF EXISTS id_modify_admin ON public.inserciones_distribucion;
CREATE POLICY id_modify_admin
  ON public.inserciones_distribucion
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.institution_id = inserciones_distribucion.institution_id
        AND p.role IN ('admin', 'assistant', 'rector')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.institution_id = inserciones_distribucion.institution_id
        AND p.role IN ('admin', 'assistant', 'rector')
    )
  );

-- ── Trigger updated_at ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.touch_id_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_touch_id ON public.inserciones_distribucion;
CREATE TRIGGER trg_touch_id
  BEFORE UPDATE ON public.inserciones_distribucion
  FOR EACH ROW EXECUTE FUNCTION public.touch_id_updated_at();

COMMENT ON TABLE public.inserciones_distribucion IS
  'Matriz Anual de Inserciones Curriculares MinEduc 2025-2026. Admin/rector decide qué inserciones se trabajan en cada trimestre. El planificador la usa para auto-llenar al generar planes.';
COMMENT ON COLUMN public.inserciones_distribucion.inserciones IS
  'Array de IDs del catálogo de inserciones: civica_etica, desarrollo_sostenible, socioemocional, financiera, vial.';
