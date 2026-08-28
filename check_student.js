const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

function parseEnv() {
  const content = fs.readFileSync('.env.local', 'utf-8');
  const lines = content.split('\n');
  const env = {};
  for (const line of lines) {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      env[match[1]] = match[2];
    }
  }
  return env;
}

const env = parseEnv();
const url = env['NEXT_PUBLIC_SUPABASE_URL'];
const key = env['SUPABASE_SERVICE_ROLE_KEY'];

const supabase = createClient(url, key);

async function check() {
  const name = "CAMPUZANO RONQUILLO ZLATAN GAEL";
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id')
    .ilike('full_name', `%CAMPUZANO RONQUILLO%ZLATAN%`);
  
  if (!profiles || profiles.length === 0) return;
  const student = profiles[0];
  
  const { data: abonos } = await supabase
    .from('payment_abonos')
    .select('*')
    .eq('student_id', student.id);
    
  console.log("\n=== ABONOS ===");
  console.log(JSON.stringify(abonos, null, 2));
}

check().catch(console.error);
