-- ── Tabla de Asistencias ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS attendance (
  id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  subject_id     uuid NOT NULL REFERENCES subjects(id)      ON DELETE CASCADE,
  student_id     uuid NOT NULL REFERENCES profiles(id)      ON DELETE CASCADE,
  institution_id uuid          REFERENCES institutions(id)  ON DELETE CASCADE,
  date           date NOT NULL,
  status         text NOT NULL DEFAULT 'present'
                   CHECK (status IN ('present', 'absent', 'late')),
  created_at     timestamptz DEFAULT now(),
  UNIQUE(subject_id, student_id, date)
);

-- ── Tabla de Comportamiento ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS behavior_records (
  id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  subject_id     uuid NOT NULL REFERENCES subjects(id)      ON DELETE CASCADE,
  student_id     uuid NOT NULL REFERENCES profiles(id)      ON DELETE CASCADE,
  institution_id uuid          REFERENCES institutions(id)  ON DELETE CASCADE,
  type           text NOT NULL CHECK (type IN ('positive', 'negative', 'recommendation')),
  description    text DEFAULT '',
  date           date NOT NULL DEFAULT CURRENT_DATE,
  created_at     timestamptz DEFAULT now()
);

-- ── Parcial / Trimestre en Tareas ────────────────────────────────────────────
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS parcial   integer DEFAULT 1;
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS trimestre integer DEFAULT 1;
