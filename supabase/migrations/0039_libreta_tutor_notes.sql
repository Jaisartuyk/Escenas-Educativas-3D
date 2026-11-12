-- 0039_libreta_tutor_notes.sql
-- Calificación de comportamiento y observaciones registradas por el tutor por trimestre

CREATE TABLE IF NOT EXISTS public.libreta_tutor_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  trimestre integer NOT NULL CHECK (trimestre IN (1, 2, 3)),
  behavior_grade text CHECK (behavior_grade IN ('S', 'F', 'U', 'N')),
  observation text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT libreta_tutor_notes_unique UNIQUE (institution_id, course_id, student_id, trimestre)
);

CREATE INDEX IF NOT EXISTS idx_libreta_tutor_notes_lookup ON public.libreta_tutor_notes(institution_id, course_id, trimestre);
ALTER TABLE public.libreta_tutor_notes ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'libreta_tutor_notes' AND policyname = 'libreta_tutor_notes_all'
  ) THEN
    CREATE POLICY "libreta_tutor_notes_all" ON public.libreta_tutor_notes FOR ALL USING (true) WITH CHECK (true);
  END IF;
END
$$;

COMMENT ON TABLE public.libreta_tutor_notes IS 'Notas de comportamiento (S, F, U, N) y observaciones del tutor para la libreta escolar.';
COMMENT ON COLUMN public.libreta_tutor_notes.behavior_grade IS 'S (Lidera/Transforma), F (Participa activamente), U (Acepta compromisos), N (Requiere acompañamiento)';
