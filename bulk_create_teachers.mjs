// bulk_create_teachers.mjs
// Crea las cuentas de los 12 docentes en Supabase Auth + Profiles
// Institución: UNIDAD EDUCATIVA PARTICULAR CORONEL MIGUEL DE LETAMENDI
// Usuario: nombre.apellido@letamendi.edu.ec  |  Clave: 0 + cédula
// Usa: node bulk_create_teachers.mjs

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// Parse .env.local manually (no dotenv needed)
const envFile = readFileSync('.env.local', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const [key, ...val] = line.split('=');
  if (key && val.length) env[key.trim()] = val.join('=').trim();
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Faltan credenciales en .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const institutionId = '52572a7d-ba27-477b-8020-20d882cc30bb';

// ── Lista de docentes (sin CACERES ni MORENO por ahora) ──────────────────────
const teachers = [
  { fullName: 'BORBOR SOTAMINGA HERBERT ENRIQUE',       dni: '0925953127' },
  { fullName: 'CELLERY RUIZ MARIA ISABEL',              dni: '0902234186' },
  { fullName: 'CRUZ CARDENAS MICHELL VANESSA',           dni: '0954222089' },
  { fullName: 'MARURI VERA LADY SHIRLEY',                dni: '0952486983' },
  { fullName: 'RIVADENEIRA BAJAÑA MARIO ENRIQUE',        dni: '0908441405' },
  { fullName: 'VALLE REZABALA LOURDES YESENIA',          dni: '0915571780' },
  { fullName: 'QUIMIS CALLE MARIA FERNANDA',             dni: '0924365026' },
  { fullName: 'NOBOA CRUZ JUAN ALFREDO',                 dni: '0912146339' },
  { fullName: 'MALDONADO RODRIGUEZ MAYERLY BRIGGITH',    dni: '0955658729' },
  { fullName: 'URDANIGO RAMIREZ MONICA PATRICIA',        dni: '0924395676' },
  { fullName: 'ZAMBRANO NUÑEZ ANDY JAVIER',              dni: '0958567901' },
  { fullName: 'DIAZ CARCELEN MARCOS DAVID',              dni: '0953254778' },
];

// Genera email: nombre.apellido@24dejulio.edu.ec
function buildEmail(fullName) {
  // "BORBOR SOTAMINGA HERBERT ENRIQUE" → nombre=herbert, apellido=borbor
  const parts = fullName.trim().split(/\s+/);
  // Formato típico ecuatoriano: APELLIDO1 APELLIDO2 NOMBRE1 NOMBRE2
  // Tomamos: primer nombre (parts[2]) + primer apellido (parts[0])
  const nombre   = (parts[2] || parts[0]).toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, ''); // quitar tildes
  const apellido = parts[0].toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return `${nombre}.${apellido}@letamendi.edu.ec`;
}

async function run() {
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('  REGISTRO MASIVO — UE CORONEL MIGUEL DE LETAMENDI');
  console.log('  Usuario: nombre.apellido@letamendi.edu.ec  |  Clave: cédula');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  const results = [];

  for (const t of teachers) {
    const email    = buildEmail(t.fullName);
    const password = t.dni; // La cédula con 0 al inicio es la contraseña
    
    console.log(`➡️  ${t.fullName}`);
    console.log(`    📧 ${email}  |  🔑 ${t.dni}`);

    // 1. Crear usuario en Auth
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: t.fullName, dni: t.dni }
    });

    if (authError) {
      if (authError.message.includes('already registered')) {
        console.log(`    ⚠️  Ya existe — omitiendo\n`);
        results.push({ name: t.fullName, email, password, status: 'YA EXISTE' });
        continue;
      }
      console.error(`    ❌ Error: ${authError.message}\n`);
      results.push({ name: t.fullName, email, password, status: 'ERROR: ' + authError.message });
      continue;
    }

    const userId = authUser.user.id;

    // 2. Insertar en Profiles
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: userId,
        email,
        full_name: t.fullName,
        role: 'teacher',
        institution_id: institutionId,
        plan: 'free'
      }, { onConflict: 'id' });

    if (profileError) {
      console.error(`    ❌ Profile: ${profileError.message}\n`);
      results.push({ name: t.fullName, email, password, status: 'PROFILE ERROR' });
      continue;
    }

    console.log(`    ✅ OK (${userId})\n`);
    results.push({ name: t.fullName, email, password, status: 'CREADO' });
  }

  // ── Resumen ────────────────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('  CREDENCIALES FINALES');
  console.log('═══════════════════════════════════════════════════════════════════\n');
  console.log('DOCENTE'.padEnd(45) + 'USUARIO (EMAIL)'.padEnd(35) + 'CONTRASEÑA'.padEnd(15) + 'ESTADO');
  console.log('─'.repeat(110));
  
  for (const r of results) {
    console.log(
      r.name.padEnd(45) +
      r.email.padEnd(35) +
      r.password.padEnd(15) +
      r.status
    );
  }
  
  const ok = results.filter(r => r.status === 'CREADO').length;
  console.log(`\n📊 ${ok}/${teachers.length} creados exitosamente.`);
}

run().catch(err => {
  console.error('Error fatal:', err);
  process.exit(1);
});
