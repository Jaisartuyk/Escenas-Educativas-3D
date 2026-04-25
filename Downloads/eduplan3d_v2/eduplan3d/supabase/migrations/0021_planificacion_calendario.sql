-- 0021_planificacion_calendario.sql
-- Calendario docente: agenda planificaciones a fechas concretas (drag & drop manual).
-- Una planificacion puede aparecer multiples veces (reutilizacion en distintos grupos/dias).

-- ── Campo opcional "grupo" en planificaciones ────────────────────────────────
-- Texto libre para que docentes externos identifiquen "5to A - Colegio San José"
-- y los institucionales puedan etiquetar sus paralelos. No reemplaza grade/paralelo.
ALTER TABLE public.planificaciones
  ADD COLUMN IF NOT EXISTS grupo TEXT;

-- ── Tabla de agendamiento ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.planificacion_calendario (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  planificacion_id UUID NOT NULL REFERENCES public.planificaciones(id) ON DELETE CASCADE,
  fecha_inicio DATE NOT NULL,
  fecha_fin DATE,                  -- NULL = un solo dia; con valor = bloque multi-dia
  grupo TEXT,                      -- override del grupo (ej. cuando la misma plan se da en 2 cursos)
  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_fecha_fin_ge_inicio CHECK (fecha_fin IS NULL OR fecha_fin >= fecha_inicio)
);

CREATE INDEX IF NOT EXISTS idx_pcal_user_id
  ON public.planificacion_calendario(user_id);
CREATE INDEX IF NOT EXISTS idx_pcal_user_fecha
  ON public.planificacion_calendario(user_id, fecha_inicio);
CREATE INDEX IF NOT EXISTS idx_pcal_planificacion_id
  ON public.planificacion_calendario(planificacion_id);

-- ── RLS: solo el dueño ──────────────────────────────────────────────────────
ALTER TABLE public.planificacion_calendario ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pcal: select own" ON public.planificacion_calendario;
CREATE POLICY "pcal: select own"
  ON public.planificacion_calendario FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "pcal: insert own" ON public.planificacion_calendario;
CREATE POLICY "pcal: insert own"
  ON public.planificacion_calendario FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "pcal: update own" ON public.planificacion_calendario;
CREATE POLICY "pcal: update own"
  ON public.planificacion_calendario FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "pcal: delete own" ON public.planificacion_calendario;
CREATE POLICY "pcal: delete own"
  ON public.planificacion_calendario FOR DELETE
  USING (auth.uid() = user_id);

-- ── Trigger updated_at ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.touch_pcal_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_touch_pcal ON public.planificacion_calendario;
CREATE TRIGGER trg_touch_pcal
  BEFORE UPDATE ON public.planificacion_calendario
  FOR EACH ROW EXECUTE FUNCTION public.touch_pcal_updated_at();

COMMENT ON TABLE public.planificacion_calendario IS
  'Agendamiento de planificaciones por fecha (drag & drop). Una planificacion puede tener N entradas.';
COMMENT ON COLUMN public.planificaciones.grupo IS
  'Texto libre para identificar curso/grupo (util para docentes externos con varios colegios).';
