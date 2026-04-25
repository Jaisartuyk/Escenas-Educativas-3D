-- 0020_planner_subscriptions.sql
-- Suscripciones mensuales del planificador IA por docente individual.
-- Modelo: $20/mes, registro manual, suspension dura via planner_suspended.

-- ── Tabla de suscripciones (1 fila por docente, mantiene estado actual) ──────
CREATE TABLE IF NOT EXISTS public.planner_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  current_period_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  current_period_end   TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'expired', 'suspended', 'cancelled')),
  monthly_amount NUMERIC(10,2) NOT NULL DEFAULT 20.00,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_planner_subscriptions_user_id
  ON public.planner_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_planner_subscriptions_period_end
  ON public.planner_subscriptions(current_period_end);
CREATE INDEX IF NOT EXISTS idx_planner_subscriptions_status
  ON public.planner_subscriptions(status);

-- ── Tabla de pagos individuales (historial) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.planner_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES public.planner_subscriptions(id) ON DELETE SET NULL,
  amount NUMERIC(10,2) NOT NULL,
  paid_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  period_start TIMESTAMPTZ NOT NULL,
  period_end   TIMESTAMPTZ NOT NULL,
  method TEXT, -- 'efectivo' | 'transferencia' | 'deposito' | 'otro'
  notes TEXT,
  recorded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_planner_payments_user_id
  ON public.planner_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_planner_payments_paid_at
  ON public.planner_payments(paid_at DESC);

-- ── Bandera de suspension en profiles ────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS planner_suspended BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_profiles_planner_suspended
  ON public.profiles(planner_suspended) WHERE planner_suspended = true;

-- ── RLS: solo service_role escribe; users ven lo suyo ────────────────────────
ALTER TABLE public.planner_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planner_payments      ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see own subscription" ON public.planner_subscriptions;
CREATE POLICY "Users see own subscription"
  ON public.planner_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users see own payments" ON public.planner_payments;
CREATE POLICY "Users see own payments"
  ON public.planner_payments FOR SELECT
  USING (auth.uid() = user_id);

-- ── Trigger: updated_at ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.touch_planner_subscriptions_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_touch_planner_subscriptions ON public.planner_subscriptions;
CREATE TRIGGER trg_touch_planner_subscriptions
  BEFORE UPDATE ON public.planner_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.touch_planner_subscriptions_updated_at();

COMMENT ON TABLE public.planner_subscriptions IS
  'Suscripcion mensual al planificador IA por docente. $20/mes default. Renovacion manual via planner_payments.';
COMMENT ON TABLE public.planner_payments IS
  'Historial de pagos del planificador IA. Cada pago extiende current_period_end de la suscripcion en 30 dias.';
COMMENT ON COLUMN public.profiles.planner_suspended IS
  'Si true, bloquea 100% el acceso al planificador. Activado automaticamente al expirar suscripcion o manual desde SuperAdmin.';
