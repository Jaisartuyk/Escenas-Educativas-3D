import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Read .env.local manually
const envContent = fs.readFileSync('.env.local', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const [key, ...val] = line.split('=');
  if (key && val) env[key.trim()] = val.join('=').trim().replace(/"/g, '');
});

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  const institutionId = '52572a7d-ba27-477b-8020-20d882cc30bb';

  console.log('--- CURSOS ---');
  const { data: courses } = await supabase
    .from('courses')
    .select('id, name, parallel')
    .eq('institution_id', institutionId);
  console.log(JSON.stringify(courses, null, 2));

  console.log('\n--- DOCENTES ---');
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .eq('institution_id', institutionId)
    .eq('role', 'teacher');
  console.log(JSON.stringify(profiles, null, 2));
  console.log('\n--- MATERIAS ---');
  const { data: subjects } = await supabase
    .from('subjects')
    .select('id, name, course_id, teacher_id')
    .eq('institution_id', institutionId);
  console.log(JSON.stringify(subjects, null, 2));
}

check();
