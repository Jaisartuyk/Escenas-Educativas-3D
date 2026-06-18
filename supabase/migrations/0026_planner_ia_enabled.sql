-- 0026_planner_ia_enabled.sql
-- El Planificador IA pasa a ser un servicio OPCIONAL para instituciones.
-- Doble flag de habilitación:
--   1. institutions.planner_ia_enabled  → la institución contrató el servicio
--   2. profiles.planner_ia_enabled      → el docente concreto está habilitado
--      por el admin/superadmin dentro de la institución habilitada
--
-- Regla efectiva (institucional):
--   puede usar planificador ↔ institutions.planner_ia_enabled = true
--                            AND profiles.planner_ia_enabled = true
--                            AND profiles.planner_suspended  = false
--
-- planner_solo (externos) no usa estos flags — están siempre habilitados
-- mientras tengan suscripción activa (planner_subscriptions).

ALTER TABLE public.institutions
  ADD COLUMN IF NOT EXISTS planner_ia_enabled BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS planner_ia_enabled BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_institutions_planner_ia
  ON public.institutions(planner_ia_enabled) WHERE planner_ia_enabled = true;
CREATE INDEX IF NOT EXISTS idx_profiles_planner_ia
  ON public.profiles(planner_ia_enabled) WHERE planner_ia_enabled = true;

COMMENT ON COLUMN public.institutions.planner_ia_enabled IS
  'Si true, la institución contrató el servicio de Planificador IA. Necesario para que sus docentes puedan habilitarse individualmente.';
COMMENT ON COLUMN public.profiles.planner_ia_enabled IS
  'Si true, este docente puede usar el Planificador IA (siempre que su institución también esté habilitada). Solo aplica a docentes institucionales.';
