-- 0027_planificaciones_manuales.sql
-- Planificación manual editable tipo Word para docentes institucionales.
-- Una planificación por materia/curso del docente; el docente la edita
-- todo el año. El admin/rector la ve en "Planificaciones Docentes".
--
-- Diferente del modelo `planificaciones` (IA, markdown, por sesión) — esta
-- es texto rich-text (HTML/JSON de TipTap) y vive todo el año.

CREATE TABLE IF NOT EXISTS public.planificaciones_manuales (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  institution_id  uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  subject_id      uuid REFERENCES public.subjects(id) ON DELETE SET NULL,
  course_id       uuid REFERENCES public.courses(id) ON DELETE SET NULL,
  -- Snapshot legible: si se borran subject/course, el docente sigue viendo
  -- el título de la planificación.
  subject_name    text NOT NULL,
  course_name     text NOT NULL,
  title           text NOT NULL,
  -- TipTap JSON (Doc) — el editor lo serializa así. content_html es opcional
  -- (cache renderizado para listados).
  content_json    jsonb NOT NULL DEFAULT '{}'::jsonb,
  content_html    text,
  status          text NOT NULL DEFAULT 'borrador'
    CHECK (status IN ('borrador', 'publicada')),
  -- Año lectivo opcional para archivo anual.
  academic_year_id uuid REFERENCES public.academic_years(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  -- Una sola planificación manual por (user, subject, course, año lectivo).
  CONSTRAINT pm_unique_user_subject_course_year
    UNIQUE (user_id, subject_id, course_id, academic_year_id)
);

CREATE INDEX IF NOT EXISTS idx_pm_user
  ON public.planificaciones_manuales(user_id);
CREATE INDEX IF NOT EXISTS idx_pm_institution
  ON public.planificaciones_manuales(institution_id);
CREATE INDEX IF NOT EXISTS idx_pm_subject
  ON public.planificaciones_manuales(subject_id);
CREATE INDEX IF NOT EXISTS idx_pm_status
  ON public.planificaciones_manuales(status);

-- ── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.planificaciones_manuales ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pm_select_own ON public.planificaciones_manuales;
CREATE POLICY pm_select_own
  ON public.planificaciones_manuales
  FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.institution_id = planificaciones_manuales.institution_id
        AND p.role IN ('admin', 'assistant', 'rector', 'supervisor')
    )
  );

DROP POLICY IF EXISTS pm_insert_own ON public.planificaciones_manuales;
CREATE POLICY pm_insert_own
  ON public.planificaciones_manuales
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS pm_update_own ON public.planificaciones_manuales;
CREATE POLICY pm_update_own
  ON public.planificaciones_manuales
  FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS pm_delete_own ON public.planificaciones_manuales;
CREATE POLICY pm_delete_own
  ON public.planificaciones_manuales
  FOR DELETE
  USING (auth.uid() = user_id);

-- ── Trigger updated_at ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.touch_pm_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_touch_pm ON public.planificaciones_manuales;
CREATE TRIGGER trg_touch_pm
  BEFORE UPDATE ON public.planificaciones_manuales
  FOR EACH ROW EXECUTE FUNCTION public.touch_pm_updated_at();

COMMENT ON TABLE public.planificaciones_manuales IS
  'Planificación manual editable (rich-text, TipTap) que el docente mantiene durante todo el año por cada materia/curso. Visible al admin/rector de la institución.';
COMMENT ON COLUMN public.planificaciones_manuales.content_json IS
  'Documento TipTap serializado como JSON (campo source-of-truth).';
COMMENT ON COLUMN public.planificaciones_manuales.content_html IS
  'HTML renderizado del documento (cache para previsualización rápida en listados).';
COMMENT ON COLUMN public.planificaciones_manuales.status IS
  'borrador (solo el docente lo ve) | publicada (visible a admin/rector como definitiva).';
