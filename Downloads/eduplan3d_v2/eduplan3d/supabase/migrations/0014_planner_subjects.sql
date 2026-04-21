-- ═══════════════════════════════════════════════════════════════════════════
-- 0014_planner_subjects.sql
-- Materias y cursos personales para docentes externos (planner_solo)
-- No están atadas a ninguna institución — el docente las crea manualmente.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.planner_subjects (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  materia    text NOT NULL,                -- Ej: "Matemáticas"
  curso      text NOT NULL,                -- Ej: "8vo EGB"
  paralelo   text,                         -- Ej: "A" (opcional)
  nivel      text,                         -- "EGB" / "BGU" / "Preescolar" / etc.
  created_at timestamptz DEFAULT now()
);

-- Índice para búsquedas rápidas por usuario
CREATE INDEX IF NOT EXISTS idx_planner_subjects_user
  ON public.planner_subjects (user_id);

-- RLS: cada docente gestiona solo sus materias
ALTER TABLE public.planner_subjects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Docente gestiona sus materias" ON public.planner_subjects;
CREATE POLICY "Docente gestiona sus materias"
  ON public.planner_subjects
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
