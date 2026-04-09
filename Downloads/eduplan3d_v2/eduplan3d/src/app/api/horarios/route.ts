import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getEmptyConfig, DEFAULT_HORAS } from '@/types/horarios'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  // Obtener la institución del usuario actual
  const { data: profile } = await (supabase as any)
    .from('profiles')
    .select('institution_id')
    .eq('id', user.id)
    .single()

  if (!profile?.institution_id) return NextResponse.json({ error: 'No tienes una institución asignada' }, { status: 400 })

  const { data: inst } = await (supabase as any)
    .from('institutions')
    .select('name, settings')
    .eq('id', profile.institution_id)
    .single()

  if (!inst) return NextResponse.json({ error: 'Institución no encontrada' }, { status: 404 })

  // Extraer configuración de horarios del campo settings JSON, o crear predeterminado
  const horariosConfig = inst.settings?.horarios || {
    config: getEmptyConfig(inst.name),
    docentes: [],
    horasPorCurso: DEFAULT_HORAS, // Horas base Mineduc
    horario: {},
    step: 0
  }

  // Auto-inyección: Leer perfiles reales de docentes de la DB y agregarlos/fusionarlos si no existen
  const { data: dbTeachers } = await (supabase as any).from('profiles').select('id, full_name').eq('institution_id', profile.institution_id).eq('role', 'teacher')
  
  if (dbTeachers) {
    const existingWorkerIds = horariosConfig.docentes.map((d: any) => d.id)
    
    dbTeachers.forEach((dbT: any) => {
       if (!existingWorkerIds.includes(dbT.id)) {
          // Inyectar maestro faltante
          horariosConfig.docentes.push({
            id: dbT.id, 
            titulo: '', 
            nombre: dbT.full_name,
            materias: [],
            jornada: 'AMBAS',
            nivel: 'AMBOS'
          })
       } else {
          // Si ya existe en horarios, podemos asegurar que su metadata esté en sincronía pero respetamos los bindings locales
          const idx = horariosConfig.docentes.findIndex((d:any) => d.id === dbT.id)
          if(idx !== -1) {
            horariosConfig.docentes[idx].nombre = dbT.full_name // Sincroniza el nombre base
          }
       }
    })
  }

  // Prevenir cache client-side
  return NextResponse.json({
    ...horariosConfig,
    directory: inst?.settings?.directory || {}
  }, {
    headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate' }
  })
}

export async function POST(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = await req.json()

  const { data: profile } = await (supabase as any)
    .from('profiles')
    .select('institution_id')
    .eq('id', user.id)
    .single()

  if (!profile?.institution_id) return NextResponse.json({ error: 'Sin institución' }, { status: 400 })

  // Obtener settings actuales para preservarlos y solo pisar la llave 'horarios'
  const { data: inst } = await (supabase as any)
    .from('institutions')
    .select('settings')
    .eq('id', profile.institution_id)
    .single()

  const newSettings = {
    ...(inst?.settings || {}),
    horarios: body // Se asume que el frontend pasa el HorariosState completo
  }

  const { error } = await (supabase as any)
    .from('institutions')
    .update({ settings: newSettings })
    .eq('id', profile.institution_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // SYNC: Automáticamente crear los "Cursos" relacionales en la base de datos si no existen
  // Esto permite que Gestión Académica / Secretaría matriculen alumnos a cursos oficiales del Horario.
  let currentCourseDbMap: Record<string, string> = {}
  try {
     const { data: existingCourses } = await (supabase as any).from('courses').select('id, name').eq('institution_id', profile.institution_id)
     const currentCourseNames = existingCourses?.map((c: any) => c.name) || []
     
     existingCourses?.forEach((c:any) => currentCourseDbMap[c.name] = c.id)

     const coursesToConfig = body.config?.cursos || []
     const newCourseNames = coursesToConfig.filter((c: string) => !currentCourseNames.includes(c))
     
     if (newCourseNames.length > 0) {
        const crypto = require('crypto')
        const coursesToInsert = newCourseNames.map((c: string) => {
           const nid = crypto.randomUUID()
           currentCourseDbMap[c] = nid
           return {
             id: nid,
             institution_id: profile.institution_id,
             name: c,
             created_at: new Date().toISOString(),
             updated_at: new Date().toISOString()
           }
        })
        await (supabase as any).from('courses').insert(coursesToInsert)
     }
     
     // SYNC: Sincronizar las Materias de los Docentes
     // Iteramos sobre horarios.docentes.
     // NOTA DE SCHEMA: La tabla `subjects` REQUIERE obligatoriamente `course_id`.
     // Como el Asistente de Horarios asocia profesores a materias DE MANERA ABSOLUTA y no por curso específico hasta el Step 3,
     // y el usuario reclama que se borran si falla la DB, vamos a atar la materia generada al PRIMER curso creado para
     // evitar que el CONSTRAINT violado descarte silenciosamente partes del API.
     
     const courseIdFallback = Object.values(currentCourseDbMap)[0]

     if (courseIdFallback) {
         const { data: existingSubjects } = await (supabase as any).from('subjects').select('id, name, teacher_id').eq('institution_id', profile.institution_id)
         const subjectsToInsert: any[] = []
         
         const teacherRecords = body.docentes || []
         teacherRecords.forEach((d:any) => {
           const mats = d.materias || []
           mats.forEach((mName: string) => {
             const exists = existingSubjects?.some((sub:any) => sub.name === mName && sub.teacher_id === d.id)
             if(!exists) {
                subjectsToInsert.push({
                  id: crypto.randomUUID(),
                  institution_id: profile.institution_id,
                  course_id: courseIdFallback, // Cumplimos el Constraint NOT NULL
                  name: mName,
                  teacher_id: d.id,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString()
                })
             }
           })
         })

         if(subjectsToInsert.length > 0) {
           await (supabase as any).from('subjects').insert(subjectsToInsert)
         }
     }

  } catch (err) {
     console.error('Error syncing correlational data to DB:', err)
  }

  return NextResponse.json({ success: true })
}
