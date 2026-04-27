import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { TutorHorarioClient } from '@/components/horarios/TutorHorarioClient'

export const dynamic = 'force-dynamic'

export default async function TutoriasHorariosPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  const admin = createAdminClient()
  
  // Validar rol y obtener institution_id y full_name del docente
  const { data: profile } = await admin
    .from('profiles')
    .select('role, institution_id, full_name')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'teacher' && profile?.role !== 'admin' && profile?.role !== 'rector') {
    redirect('/dashboard') // Redirigir si no tiene permisos
  }

  const instId = profile?.institution_id
  if (!instId) {
    return <div className="p-8 text-center text-ink3">No tienes una institución asignada.</div>
  }

  const teacherName = (profile?.full_name || '').trim().toLowerCase()

  // Buscar en los settings de la institución los horarios donde este docente es tutor
  const { data: inst } = await admin
    .from('institutions')
    .select('settings')
    .eq('id', instId)
    .single()

  const settings = inst?.settings || {}
  const tutoredSchedules: any[] = []

  // Recorrer todas las llaves de configuración de horario (e.g. horarios_escuela_matutina)
  Object.keys(settings).forEach(key => {
    if (key.startsWith('horarios')) {
      const slotData = settings[key]
      const config = slotData.config
      const grid = slotData.horario
      if (config && config.tutores) {
        Object.entries(config.tutores).forEach(([cursoName, tutorName]) => {
          if (typeof tutorName === 'string' && tutorName.trim().toLowerCase() === teacherName) {
            // El docente es tutor de este curso
            tutoredSchedules.push({
              curso: cursoName,
              nivel: config.nivel,
              jornada: config.jornada,
              nPeriodos: config.nPeriodos || 8,
              periodos: config.horarios || [],
              recesos: config.recesos || [4],
              horarioGrid: grid ? grid[cursoName] : null
            })
          }
        })
      }
    }
  })

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-6 animate-fade-in pb-24">
      <div className="flex flex-col gap-2 border-b border-[rgba(120,100,255,0.14)] pb-4">
        <h1 className="text-3xl font-bold text-ink">Horario de Tutoría</h1>
        <p className="text-ink3 text-sm">Visualiza el horario de clases de los cursos donde eres tutor o dirigente.</p>
      </div>

      <TutorHorarioClient schedules={tutoredSchedules} />
    </div>
  )
}
