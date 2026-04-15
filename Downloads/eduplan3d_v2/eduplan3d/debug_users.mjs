import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envContent = fs.readFileSync('.env.local', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const [key, ...val] = line.split('=');
  if (key && val) env[key.trim()] = val.join('=').trim().replace(/\"/g, '');
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const emails = [
    'andy.zambrano@letamendi.edu.ec',
    'israferaldascarlett15@gmail.com'
  ];
  
  const { data: users } = await supabase.from('profiles').select('email, role, institution_id').in('email', emails);
  const { data: inst } = await supabase.from('institutions').select('id, name');
  
  const result = {
    users,
    all_institutions: inst
  };
  
  fs.writeFileSync('debug_users.json', JSON.stringify(result, null, 2));
  console.log('OK - debug_users.json created');
}

run();
