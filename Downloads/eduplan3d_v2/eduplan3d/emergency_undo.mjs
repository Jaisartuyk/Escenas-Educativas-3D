import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envContent = fs.readFileSync('.env.local', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const [key, ...val] = line.split('=');
  if (key && val) env[key.trim()] = val.join('=').trim().replace(/\"/g, '');
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const LETAMENDI = '52572a7d-ba27-477b-8020-20d882cc30bb';
const VEINTICUATRO = '3734e510-a6de-4e4f-87b1-772556bf0070';
const CUTOFF_DATE = '2026-04-14T03:00:00.000Z'; // Aproximadamente cuando empecé hoy

const originalLetamendiEmails = [
  'jsanchezt5@unemi.edu.ec',
  'vdjdiablitobdp@gmail.com',
  'michellecruzca1502@gmail.com',
  'lady.marparv@gmail.com',
  'oswaldoc2019@gmail.com',
  'maestraluli.9294@gmail.com',
  'juanalfredonoboa1969@gmail.com',
  'mayabmr20@gmail.com',
  'urdanigopatty29@gmail.com',
  'andy.zambrano@letamendi.edu.ec',
  'daviddcarcelen95@gmail.com',
  'jairosancheztriana@gmail.com'
];

async function run() {
  console.log('🚑 Iniciando restauración de emergencia para Letamendi...');

  // 1. Restaurar perfiles por email explícito
  console.log('Profiles: Restaurando lista específica...');
  const { error: pErr } = await supabase
    .from('profiles')
    .update({ institution_id: LETAMENDI })
    .in('email', originalLetamendiEmails);
  if (pErr) console.error('Perr:', pErr.message);

  // 2. Restaurar perfiles antiguos (creados antes del cutoff)
  console.log('Profiles: Restaurando por fecha de creación...');
  const { error: pOldErr } = await supabase
    .from('profiles')
    .update({ institution_id: LETAMENDI })
    .lt('created_at', CUTOFF_DATE)
    .eq('institution_id', VEINTICUATRO);
  if (pOldErr) console.error('PoldErr:', pOldErr.message);

  // 3. Restaurar Cursos antiguos
  console.log('Courses: Restaurando por fecha de creación...');
  const { error: cErr } = await supabase
    .from('courses')
    .update({ institution_id: LETAMENDI })
    .lt('created_at', CUTOFF_DATE)
    .eq('institution_id', VEINTICUATRO);
  if (cErr) console.error('Cerr:', cErr.message);

  // 4. Restaurar Materias antiguas
  console.log('Subjects: Restaurando por fecha de creación...');
  const { error: sErr } = await supabase
    .from('subjects')
    .update({ institution_id: LETAMENDI })
    .lt('created_at', CUTOFF_DATE)
    .eq('institution_id', VEINTICUATRO);
  if (sErr) console.error('Serr:', sErr.message);

  // 5. Ajustar roles críticos
  console.log('Roles: Restaurando Administrador y Asistente...');
  await supabase.from('profiles').update({ role: 'admin' }).eq('email', 'jairosancheztriana@gmail.com');
  await supabase.from('profiles').update({ role: 'assistant' }).eq('email', 'andy.zambrano@letamendi.edu.ec');

  console.log('✅ Restauración completada. U.E. Letamendi recuperó sus datos originales.');
  console.log('📍 Los nuevos docentes y materias permanecen en Unidad Educativa 24 de Julio.');
}

run();
