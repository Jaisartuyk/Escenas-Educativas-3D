import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// ── CONFIG ──────────────────────────────────────────────────────────────────
const envFile = fs.readFileSync('.env.local', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const [key, ...val] = line.split('=');
  if (key && val.length) env[key.trim()] = val.join('=').trim().replace(/"/g, '');
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const institutionId = '52572a7d-ba27-477b-8020-20d882cc30bb';

// ── DATA FETCHING ───────────────────────────────────────────────────────────
async function run() {
  console.log('🚀 Iniciando asignación masiva de materias...');

  // 1. Obtener datos actuales
  const { data: courses } = await supabase.from('courses').select('*').eq('institution_id', institutionId);
  const { data: teachers } = await supabase.from('profiles').select('*').eq('institution_id', institutionId).eq('role', 'teacher');
  const { data: existingSubjects } = await supabase.from('subjects').select('*').eq('institution_id', institutionId);

  const getCourse = (name) => courses.find(c => c.name.trim().toUpperCase() === name.toUpperCase());
  const getTeacher = (namePart) => teachers.find(t => t.full_name.includes(namePart));

  const assignments = [];

  // ── LOGICA DE ASIGNACIÓN ───────────────────────────────────────────────────

  // 1. HERBERT BORBOR -> INSTRUCCIÓN MILITAR (3ro a 7mo)
  const borbor = getTeacher('BORBOR');
  if (borbor) {
    ['3RO BÁSICA', '4TO BÁSICA', '5TO BÁSICA', '6TO BÁSICA', '7MO BÁSICA'].forEach(courseName => {
      const course = getCourse(courseName);
      if (course) assignments.push({ courseId: course.id, teacherId: borbor.id, subject: 'INSTRUCCIÓN MILITAR', hours: 2 });
    });
  }

  // 2. ESPECIALISTAS DE GRUPO (TODAS LAS MATERIAS)
  const groupTeachers = [
    { teacher: 'MARURI',  levels: ['INICIAL 1', 'INICIAL 2'] },
    { teacher: 'MALDONADO', levels: ['1RO BÁSICA'] },
    { teacher: 'CRUZ',      levels: ['2DO BÁSICA'] },
    { teacher: 'VALLE',     levels: ['3RO BÁSICA'] },
  ];

  const genericSubjects = [
    { name: 'MATEMÁTICA', hours: 7 },
    { name: 'LENGUA', hours: 8 },
    { name: 'CC.NN', hours: 3 },
    { name: 'ESTUDIOS SOCIALES', hours: 3 },
    { name: 'ECA', hours: 2 },
    { name: 'ED. FÍSICA', hours: 2 },
    { name: 'INGLES', hours: 2 },
    { name: 'COMPUTACION', hours: 1 },
  ];

  groupTeachers.forEach(gt => {
    const teacher = getTeacher(gt.teacher);
    if (!teacher) return;
    gt.levels.forEach(levelName => {
      const course = getCourse(levelName);
      if (!course) return;
      
      // Para inicial es distinto, suelen ser menos materias o integradas
      if (levelName.startsWith('INICIAL')) {
         assignments.push({ courseId: course.id, teacherId: teacher.id, subject: 'ÁMBITOS DE APRENDIZAJE', hours: 25 });
      } else {
        genericSubjects.forEach(s => {
          assignments.push({ courseId: course.id, teacherId: teacher.id, subject: s.name, hours: s.hours });
        });
      }
    });
  });

  // ── EJECUCIÓN ──────────────────────────────────────────────────────────────
  let created = 0, updated = 0;

  for (const as of assignments) {
    const existing = existingSubjects.find(s => 
      s.course_id === as.courseId && 
      s.name.trim().toUpperCase() === as.subject.toUpperCase()
    );

    if (existing) {
      // Actualizar docente si no lo tiene
      if (existing.teacher_id !== as.teacherId) {
        await supabase.from('subjects').update({ teacher_id: as.teacherId }).eq('id', existing.id);
        updated++;
      }
    } else {
      // Crear materia
      await supabase.from('subjects').insert({
        institution_id: institutionId,
        course_id: as.courseId,
        name: as.subject,
        weekly_hours: as.hours,
        teacher_id: as.teacherId
      });
      created++;
    }
  }

  console.log(`✅ Finalizado: ${created} materias creadas, ${updated} actualizadas.`);
}

run();
