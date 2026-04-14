import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envContent = fs.readFileSync('.env.local', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const [key, ...val] = line.split('=');
  if (key && val) env[key.trim()] = val.join('=').trim().replace(/\"/g, '');
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const sql = `
-- Habilitar permisos para horarios_only en Instituciones
DROP POLICY IF EXISTS "institutions: select personal" ON public.institutions;
CREATE POLICY "institutions: select personal" ON public.institutions FOR SELECT
USING (id IN (SELECT institution_id FROM public.profiles WHERE id = auth.uid()));

-- Habilitar permisos para horarios_only en Courses
DROP POLICY IF EXISTS "courses: gestionar por miembros autorizados" ON public.courses;
CREATE POLICY "courses: gestionar por miembros autorizados" ON public.courses FOR ALL
USING (
  institution_id IN (
    SELECT institution_id FROM public.profiles 
    WHERE id = auth.uid() AND (role = 'admin' OR role = 'horarios_only' OR role = 'assistant')
  )
)
WITH CHECK (
  institution_id IN (
    SELECT institution_id FROM public.profiles 
    WHERE id = auth.uid() AND (role = 'admin' OR role = 'horarios_only' OR role = 'assistant')
  )
);

-- Habilitar permisos para horarios_only en Subjects
DROP POLICY IF EXISTS "subjects: gestionar por miembros autorizados" ON public.subjects;
CREATE POLICY "subjects: gestionar por miembros autorizados" ON public.subjects FOR ALL
USING (
  institution_id IN (
    SELECT institution_id FROM public.profiles 
    WHERE id = auth.uid() AND (role = 'admin' OR role = 'horarios_only' OR role = 'assistant')
  )
)
WITH CHECK (
  institution_id IN (
    SELECT institution_id FROM public.profiles 
    WHERE id = auth.uid() AND (role = 'admin' OR role = 'horarios_only' OR role = 'assistant')
  )
);

-- Habilitar permisos para horarios_only en Schedule Configs
DROP POLICY IF EXISTS "schedule_configs: gestionar por miembros autorizados" ON public.schedule_configs;
CREATE POLICY "schedule_configs: gestionar por miembros autorizados" ON public.schedule_configs FOR ALL
USING (
  institution_id IN (
    SELECT institution_id FROM public.profiles 
    WHERE id = auth.uid() AND (role = 'admin' OR role = 'horarios_only' OR role = 'assistant')
  )
)
WITH CHECK (
  institution_id IN (
    SELECT institution_id FROM public.profiles 
    WHERE id = auth.uid() AND (role = 'admin' OR role = 'horarios_only' OR role = 'assistant')
  )
);

-- Asegurar que pueden ver los perfiles de sus docentes
DROP POLICY IF EXISTS "profiles: select institution members" ON public.profiles;
CREATE POLICY "profiles: select institution members" ON public.profiles FOR SELECT
USING (
  institution_id IN (
    SELECT institution_id FROM public.profiles WHERE id = auth.uid()
  )
);
`;

async function run() {
  console.log('Aplicando políticas de seguridad...');
  // Nota: Supabase client no permite ejecutar SQL directamente via JS fácilmente sin RPC.
  // Pero podemos intentar ejecutarlo vía rpc('exec_sql') si existe, o imprimirlo para el usuario.
  // Dado que no puedo asegurar que exista exec_sql, imprimiré el SQL y le pediré al usuario que lo pegue.
  console.log('--- COPIA ESTE SQL EN EL EDITOR DE SUPABASE ---');
  console.log(sql);
}

run();
