// Revisión de horas por curso en Unidas Educativa "24 de Julio"
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = join(__dirname, '..', '.env.local')
const envText = readFileSync(envPath, 'utf-8')
const env = {}
envText.split('\n').forEach(line => {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
})

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const INST_ID = '229d3fe2-abc4-4499-a240-4fc5d18c9f41'

async function main() {
  console.log('\n===============================================')
  console.log('  Unidas Educativa "24 de Julio"')
  console.log('===============================================\n')

  // 1) Courses
  const { data: courses } = await supabase
    .from('courses')
    .select('id, name, parallel, level, shift')
    .eq('institution_id', INST_ID)
    .order('name')

  // 2) Subjects with teacher
  const { data: subjects } = await supabase
    .from('subjects')
    .select('id, name, weekly_hours, course_id, teacher_id, teacher:profiles!subjects_teacher_id_fkey(full_name)')
    .in('course_id', (courses || []).map(c => c.id))

  // 3) Schedule config (to know nPeriodos + recesos)
  const { data: scfg } = await supabase
    .from('schedule_configs')
    .select('*')
    .eq('institution_id', INST_ID)
    .maybeSingle()

  // 4) Institution settings (multi-slot horarios)
  const { data: inst } = await supabase
    .from('institutions')
    .select('settings')
    .eq('id', INST_ID)
    .single()

  const settings = inst?.settings || {}

  // Build horario slots map from settings
  const slotsMap = {}
  Object.keys(settings).forEach(k => {
    if (k.startsWith('horarios_') || k === 'horarios') {
      const s = settings[k]
      if (s?.config) {
        const key = `${s.config.nivel || ''}_${s.config.jornada || ''}`
        const nPeriodos = s.config.nPeriodos || 7
        const recesos = s.config.recesos || [4]
        slotsMap[key] = {
          nPeriodos,
          recesos: recesos.length,
          totalSlotsPerWeek: (nPeriodos - recesos.length) * 5, // 5 days
          slotsForSubjects: (nPeriodos - recesos.length) * 5 - 1, // minus 1 ACOMPAÑAMIENTO
        }
      }
    }
  })

  console.log('📅 CONFIGURACIÓN DE HORARIOS:\n')
  Object.entries(slotsMap).forEach(([key, v]) => {
    console.log(`   ${key}: ${v.nPeriodos} períodos/día, ${v.recesos} receso(s) → ${v.totalSlotsPerWeek} slots/semana (${v.slotsForSubjects} para materias + 1 acomp.)`)
  })
  if (Object.keys(slotsMap).length === 0) {
    console.log('   (No se encontraron configs guardadas — usa default 7 períodos · 1 receso · 29 slots)')
  }

  console.log('\n===============================================')
  console.log('  ANÁLISIS POR CURSO')
  console.log('===============================================\n')

  // Group subjects by course
  const bycourse = {}
  for (const c of courses || []) bycourse[c.id] = { course: c, subs: [] }
  for (const s of subjects || []) {
    if (bycourse[s.course_id]) bycourse[s.course_id].subs.push(s)
  }

  const summary = []

  for (const c of courses || []) {
    const cs = bycourse[c.id]
    if (!cs) continue
    const totalHoras = cs.subs.reduce((sum, s) => sum + (s.weekly_hours || 0), 0)
    const sinDocente = cs.subs.filter(s => !s.teacher_id).length

    const key = `${c.level || ''}_${c.shift || ''}`
    const slot = slotsMap[key] || { slotsForSubjects: 29, totalSlotsPerWeek: 30 }
    const diff = totalHoras - slot.slotsForSubjects

    summary.push({
      courseName: `${c.name} ${c.parallel || ''}`.trim(),
      level: c.level,
      shift: c.shift,
      materias: cs.subs.length,
      totalHoras,
      sinDocente,
      slotsDisponibles: slot.slotsForSubjects,
      diff,
      estado: diff === 0 ? '✅ EXACTO' : diff > 0 ? `❌ +${diff} de más` : `⚠️  ${diff} de menos (huecos)`
    })
  }

  // Print table
  const header = ['Curso', 'Nivel/Jornada', 'Materias', 'Horas', 'Disp.', 'Dif.', 'Sin doc.', 'Estado']
  const widths = [22, 20, 9, 6, 6, 6, 9, 26]
  console.log(header.map((h, i) => h.padEnd(widths[i])).join(''))
  console.log('─'.repeat(widths.reduce((a, b) => a + b, 0)))
  for (const s of summary) {
    console.log(
      s.courseName.padEnd(22),
      `${s.level || '-'}/${s.shift || '-'}`.padEnd(20),
      String(s.materias).padEnd(9),
      String(s.totalHoras).padEnd(6),
      String(s.slotsDisponibles).padEnd(6),
      (s.diff > 0 ? `+${s.diff}` : String(s.diff)).padEnd(6),
      String(s.sinDocente).padEnd(9),
      s.estado
    )
  }

  console.log('\n===============================================')
  console.log('  DETALLE POR CURSO (materias + horas)')
  console.log('===============================================\n')

  for (const c of courses || []) {
    const cs = bycourse[c.id]
    if (!cs) continue
    const totalHoras = cs.subs.reduce((sum, s) => sum + (s.weekly_hours || 0), 0)
    console.log(`\n📘 ${c.name} ${c.parallel || ''} [${c.level}/${c.shift}] — ${totalHoras}h total\n`)
    for (const s of cs.subs.sort((a, b) => b.weekly_hours - a.weekly_hours)) {
      const teacher = s.teacher?.full_name || '❌ SIN DOCENTE'
      console.log(`   · ${s.name.padEnd(25)} ${String(s.weekly_hours || 0).padStart(2)}h   ${teacher}`)
    }
  }

  // Teacher conflict detection: teachers appearing in multiple courses
  console.log('\n\n===============================================')
  console.log('  DOCENTES COMPARTIDOS (potenciales conflictos)')
  console.log('===============================================\n')

  const teacherCourses = {}
  for (const s of subjects || []) {
    if (!s.teacher_id) continue
    const key = s.teacher_id
    if (!teacherCourses[key]) {
      teacherCourses[key] = { name: s.teacher?.full_name, assignments: [] }
    }
    const course = (courses || []).find(c => c.id === s.course_id)
    teacherCourses[key].assignments.push({
      course: `${course?.name || '?'} ${course?.parallel || ''}`.trim(),
      subject: s.name,
      hours: s.weekly_hours || 0
    })
  }

  Object.values(teacherCourses)
    .filter(t => t.assignments.length > 1)
    .sort((a, b) => b.assignments.length - a.assignments.length)
    .forEach(t => {
      const totalH = t.assignments.reduce((s, a) => s + a.hours, 0)
      console.log(`👨‍🏫 ${t.name} — ${t.assignments.length} asignaciones, ${totalH}h total:`)
      t.assignments.forEach(a => console.log(`     · ${a.course.padEnd(15)} ${a.subject.padEnd(20)} ${a.hours}h`))
      console.log('')
    })
}

main().catch(e => { console.error(e); process.exit(1) })
