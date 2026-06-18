import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envContent = fs.readFileSync('.env.local', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const [key, ...val] = line.split('=');
  if (key && val) env[key.trim()] = val.join('=').trim().replace(/\"/g, '');
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const OLD_INST = '52572a7d-ba27-477b-8020-20d882cc30bb'; // Letamendi
const NEW_INST = '3734e510-a6de-4e4f-87b1-772556bf0070'; // 24 de Julio

async function run() {
  console.log(`🔄 Migrando datos de Letamendi (${OLD_INST}) a 24 de Julio (${NEW_INST})...`);

  // 1. Mover Perfiles (Docentes creados + Andy)
  console.log('👥 Moviendo perfiles...');
  const { error: err1 } = await supabase
    .from('profiles')
    .update({ institution_id: NEW_INST })
    .eq('institution_id', OLD_INST);
  
  if (err1) console.error('Error Profiles:', err1.message);

  // 2. Mover Cursos
  console.log('🏫 Moviendo cursos...');
  const { error: err2 } = await supabase
    .from('courses')
    .update({ institution_id: NEW_INST })
    .eq('institution_id', OLD_INST);
    
  if (err2) console.error('Error Courses:', err2.message);

  // 3. Mover Materias
  console.log('📚 Moviendo materias...');
  const { error: err3 } = await supabase
    .from('subjects')
    .update({ institution_id: NEW_INST })
    .eq('institution_id', OLD_INST);
    
  if (err3) console.error('Error Subjects:', err3.message);

  // 4. Mover Configuraciones de Horario
  console.log('📅 Moviendo schedule_configs...');
  const { error: err4 } = await supabase
    .from('schedule_configs')
    .update({ institution_id: NEW_INST })
    .eq('institution_id', OLD_INST);
    
  if (err4) console.error('Error Schedule Configs:', err4.message);

  // 5. Ajustar rol de Andy Zambrano
  console.log('🎭 Ajustando rol de Andy Zambrano...');
  const { error: err5 } = await supabase
    .from('profiles')
    .update({ role: 'horarios_only' })
    .eq('email', 'andy.zambrano@letamendi.edu.ec');
    
  if (err5) console.error('Error Role Andy:', err5.message);

  console.log('✅ Migración institucional completada.');
}

run().catch(console.error);
