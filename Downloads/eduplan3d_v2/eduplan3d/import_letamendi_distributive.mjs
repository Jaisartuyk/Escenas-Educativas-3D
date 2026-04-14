import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// ── CONFIG ───────────────────────────────────────────────────────────────────
const envFile = readFileSync('.env.local', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const [key, ...val] = line.split('=');
  if (key && val.length) env[key.trim()] = val.join('=').trim();
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const institutionId = '52572a7d-ba27-477b-8020-20d882cc30bb';
const defaultPassword = 'EduPlan2026!';

// ── DATA ─────────────────────────────────────────────────────────────────────
const teachers = [
  { fullName: 'BRAVO VINUEZA JEAN KENEX' },
  { fullName: 'CRUZ CASTRO LEONARDO' },
  { fullName: 'FIGUEROA PONCE NORMA PATRICIA' },
  { fullName: 'LOPEZ FIGUEROA SILVIA LORENA' },
  { fullName: 'SALAZAR VILLAMAR MARIUXI ISABEL' },
  { fullName: 'VILLAO CAICEDO LUIS EMILIO' },
  { fullName: 'PARRALES ALFREDO JUAN' },
  { fullName: 'CEDEÑO CARVAJAL JOSE LUIS' },
  { fullName: 'HAZ BERNAL BARKLY' },
  { fullName: 'YAGUAL SANCHEZ JOHNNY LUIS' },
  { fullName: 'BRONCANO PARRALES ALFREDO JUAN' }, // Refinamiento si aplica
  // Los ya existentes (Giler, Palacios, etc.) se buscarán por nombre
  { fullName: 'GILER TAPIA OSWALDO XAVIER' },
  { fullName: 'PALACIOS NIETO GEORGE STEVEN' },
  // Pendientes
  { fullName: 'DOCENTE LENGUA PENDIENTE' },
  { fullName: 'DOCENTE CCNN PENDIENTE' },
  { fullName: 'DOCENTE EEFF PENDIENTE' },
];

const coursesToCreate = [
  // Inicial
  { name: 'INICIAL 1-2', level: 'Escuela', shift: 'MATUTINA' },
  // EGB (Escuela)
  { name: '1RO EGB', level: 'Escuela', shift: 'MATUTINA' },
  { name: '2DO EGB', level: 'Escuela', shift: 'MATUTINA' },
  { name: '3RO EGB', level: 'Escuela', shift: 'MATUTINA' },
  { name: '4TO EGB', level: 'Escuela', shift: 'MATUTINA' },
  { name: '5TO EGB', level: 'Escuela', shift: 'MATUTINA' },
  { name: '6TO EGB', level: 'Escuela', shift: 'MATUTINA' },
  { name: '7MO EGB', level: 'Escuela', shift: 'MATUTINA' },
  // Superior
  { name: '8VO EGB', level: 'Colegio', shift: 'MATUTINA' },
  { name: '9NO EGB', level: 'Colegio', shift: 'MATUTINA' },
  { name: '10MO EGB', level: 'Colegio', shift: 'MATUTINA' },
  // Bachillerato
  { name: '1RO BGU', level: 'Colegio', shift: 'MATUTINA' },
  { name: '2DO BGU', level: 'Colegio', shift: 'MATUTINA' },
  { name: '3RO BGU', level: 'Colegio', shift: 'MATUTINA' },
];

// Mapeo detallado de distributivo
const distributivo = [
  // Morning/General list entries...
  { teacher: 'BRAVO VINUEZA JEAN KENEX', subjects: ['EE.SS', 'Historia', 'Filosofía', 'Ciudadanía', 'Emp. Gest'], courses: ['8VO EGB', '9NO EGB', '10MO EGB', '1RO BGU'] },
  { teacher: 'CRUZ CASTRO LEONARDO', subjects: ['Cc.nn', 'Química', 'Biología', 'Inglés'], courses: ['8VO EGB', '9NO EGB', '10MO EGB', '1RO BGU'] },
  { teacher: 'FIGUEROA PONCE NORMA PATRICIA', subjects: ['Ingles'], courses: ['INICIAL 1-2', '1RO EGB', '2DO EGB', '3RO EGB', '4TO EGB', '5TO EGB', '6TO EGB', '7MO EGB'] },
  { teacher: 'LOPEZ FIGUEROA SILVIA LORENA', subjects: ['ECA', 'Emp. Gest'], courses: ['2DO EGB', '3RO EGB', '4TO EGB', '5TO EGB', '6TO EGB', '7MO EGB', '8VO EGB', '9NO EGB', '10MO EGB', '1RO BGU'] },
  { teacher: 'PALACIOS NIETO GEORGE STEVEN', subjects: ['Robótica'], courses: ['5TO EGB', '6TO EGB', '7MO EGB', '8VO EGB', '9NO EGB', '10MO EGB', '1RO BGU', '2DO BGU', '3RO BGU'] },
  { teacher: 'SALAZAR VILLAMAR MARIUXI ISABEL', subjects: ['Computación', 'Lenguaje'], courses: ['2DO EGB', '3RO EGB', '4TO EGB', '5TO EGB', '6TO EGB', '7MO EGB', '8VO EGB', '9NO EGB', '10MO EGB', '1RO BGU'] },
  { teacher: 'VILLAO CAICEDO LUIS EMILIO', subjects: ['Inst. formal', 'Educ. Fisic'], courses: ['2DO EGB', '3RO EGB', '4TO EGB', '5TO EGB', '6TO EGB', '7MO EGB', '8VO EGB', '9NO EGB', '10MO EGB', '1RO BGU'] },
  { teacher: 'GILER TAPIA OSWALDO XAVIER', subjects: ['Matemáticas', 'Física'], courses: ['8VO EGB', '9NO EGB', '10MO EGB', '1RO BGU', '2DO BGU', '3RO BGU'] },
  // Vespertina specifis...
  { teacher: 'DOCENTE LENGUA PENDIENTE', subjects: ['Lengua'], courses: ['8VO EGB', '9NO EGB', '10MO EGB', '1RO BGU', '2DO BGU', '3RO BGU'] },
  { teacher: 'PARRALES ALFREDO JUAN', subjects: ['EE.SS', 'Historia', 'Filosofía'], courses: ['8VO EGB', '9NO EGB', '10MO EGB', '1RO BGU', '2DO BGU', '3RO BGU'] },
  { teacher: 'DOCENTE CCNN PENDIENTE', subjects: ['CC.NN', 'Biología', 'Química'], courses: ['8VO EGB', '9NO EGB', '10MO EGB', '1RO BGU', '2DO BGU', '3RO BGU'] },
  { teacher: 'CEDEÑO CARVAJAL JOSE LUIS', subjects: ['Eca', 'Ciudadanía', 'Emp. y G'], courses: ['8VO EGB', '9NO EGB', '10MO EGB', '1RO BGU', '2DO BGU', '3RO BGU'] },
  { teacher: 'HAZ BERNAL BARKLY', subjects: ['Ingles'], courses: ['8VO EGB', '9NO EGB', '10MO EGB', '1RO BGU', '2DO BGU', '3RO BGU'] },
  { teacher: 'YAGUAL SANCHEZ JOHNNY LUIS', subjects: ['Computacion'], courses: ['8VO EGB', '9NO EGB', '10MO EGB', '1RO BGU', '2DO BGU', '3RO BGU'] },
  { teacher: 'DOCENTE EEFF PENDIENTE', subjects: ['EE.FF', 'Inst. Formal'], courses: ['8VO EGB', '9NO EGB', '10MO EGB', '1RO BGU', '2DO BGU', '3RO BGU'] },
];

function buildEmail(fullName) {
  const parts = fullName.trim().split(/\s+/);
  const nombre = (parts[parts.length - 2] || parts[0]).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const apellido = parts[0].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return `${nombre}.${apellido}@letamendi.edu.ec`;
}

async function run() {
  console.log('🚀 Iniciando importación de distributivo...');

  // 1. Cargar cursos existentes
  const { data: existingCourses } = await supabase.from('courses').select('*').eq('institution_id', institutionId);
  const courseMap = {};
  existingCourses.forEach(c => courseMap[c.name] = c.id);

  // 2. Crear cursos faltantes
  for (const c of coursesToCreate) {
    if (!courseMap[c.name]) {
      const { data, error } = await supabase.from('courses').insert({
        ...c,
        parallel: 'A',
        institution_id: institutionId
      }).select();
      
      if (error) {
        console.error(`❌ Error creando curso ${c.name}: ${error.message}`);
        continue;
      }
      if (data && data[0]) {
        courseMap[c.name] = data[0].id;
        console.log(`✅ Curso creado: ${c.name}`);
      }
    }
  }

  // 3. Crear docentes/buscar sus IDs
  const teacherIdMap = {};
  for (const t of teachers) {
    // Buscar en profiles por nombre (Smart match)
    const { data: existing, error: searchErr } = await supabase.from('profiles')
      .select('id')
      .ilike('full_name', `%${t.fullName}%`)
      .eq('institution_id', institutionId)
      .limit(1);

    if (searchErr) {
      console.error(`❌ Error buscando docente ${t.fullName}: ${searchErr.message}`);
      continue;
    }

    if (existing && existing.length > 0) {
      teacherIdMap[t.fullName] = existing[0].id;
      console.log(`👤 Docente ya existe: ${t.fullName}`);
    } else {
      // Crear nuevo usuario en Auth
      const email = buildEmail(t.fullName);
      console.log(`✨ Registrando nuevo docente: ${t.fullName} (${email})`);
      const { data: authUser, error: authErr } = await supabase.auth.admin.createUser({
        email,
        password: defaultPassword,
        email_confirm: true,
        user_metadata: { full_name: t.fullName }
      });

      if (authErr) {
        if (authErr.message.includes('already registered')) {
           // Si ya existe en Auth pero no en profiles de esta inst, intentar vincular
           console.log(`   ⚠️ Auth ya existe para ${email}, intentando vincular...`);
           // Deberíamos buscar el ID de auth y crear el perfil si falta
        } else {
          console.error(`   ❌ Error Auth ${t.fullName}: ${authErr.message}`);
          continue;
        }
      }

      const uid = authUser?.user?.id;
      if (uid) {
        const { error: profErr } = await supabase.from('profiles').upsert({
          id: uid,
          email,
          full_name: t.fullName,
          role: 'teacher',
          institution_id: institutionId
        });
        if (profErr) console.error(`   ❌ Error Profile ${t.fullName}: ${profErr.message}`);
        else {
          teacherIdMap[t.fullName] = uid;
          console.log(`   ✅ OK`);
        }
      }
    }
  }

  // 4. Crear Materias y asignar
  console.log('📚 Asignando materias...');
  for (const d of distributivo) {
    const tid = teacherIdMap[d.teacher];
    if (!tid) {
      console.warn(`⚠️ Omitiendo distributivo para ${d.teacher} (sin ID)`);
      continue;
    }

    for (const cName of d.courses) {
      const cid = courseMap[cName];
      if (!cid) {
        console.warn(`⚠️ Curso no encontrado: ${cName}`);
        continue;
      }

      for (const sName of d.subjects) {
        // Upsert subject
        const { error } = await supabase.from('subjects').upsert({
          name: sName,
          course_id: cid,
          teacher_id: tid,
          institution_id: institutionId,
          weekly_hours: 1
        }, { onConflict: 'course_id, name' });

        if (error) {
          console.error(`❌ Error en materia ${sName} (${cName}): ${error.message}`);
        }
      }
    }
  }

  console.log('✅ Importación finalizada con éxito.');
}

run().catch(console.error);
