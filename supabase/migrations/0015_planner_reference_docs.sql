-- ═══════════════════════════════════════════════════════════════════════════
-- 0015_planner_reference_docs.sql
-- Documentos de referencia (PDFs, libros) subidos por el docente externo
-- atados a una materia (planner_subjects). El sistema de IA los usará como
-- contexto para generar planificaciones alineadas al libro del docente.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.planner_reference_docs (
  id                 uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id            uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  planner_subject_id uuid REFERENCES public.planner_subjects(id) ON DELETE CASCADE NOT NULL,
  titulo             text NOT NULL,
  storage_path       text NOT NULL,
  file_name          text,
  file_type          text,
  file_size          bigint DEFAULT 0,
  created_at         timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_planner_ref_docs_subject
  ON public.planner_reference_docs (planner_subject_id);
CREATE INDEX IF NOT EXISTS idx_planner_ref_docs_user
  ON public.planner_reference_docs (user_id);

ALTER TABLE public.planner_reference_docs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Docente gestiona sus documentos de referencia"
  ON public.planner_reference_docs;
CREATE POLICY "Docente gestiona sus documentos de referencia"
  ON public.planner_reference_docs
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
