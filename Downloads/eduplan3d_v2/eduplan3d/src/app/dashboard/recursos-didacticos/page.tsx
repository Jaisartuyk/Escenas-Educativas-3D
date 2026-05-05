// src/app/dashboard/recursos-didacticos/page.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { RecursosDidacticosClient } from '@/components/recursos/RecursosDidacticosClient'

export const dynamic = 'force-dynamic'

export default async function RecursosDidacticosPage() {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) redirect('/auth/login')

  const { data: profile } = await (supabase as any)
    .from('profiles')
    .select('plan')
    .eq('id', user.id)
    .single()

  // Solo accesible para docentes externos (planner_solo)
  if ((profile as any)?.plan !== 'planner_solo') {
    redirect('/dashboard')
  }

  // Obtener las materias del docente
  const { data: subjects } = await (supabase as any)
    .from('planner_subjects')
    .select('*')
    .eq('user_id', user.id)
    .order('materia', { ascending: true })

  // Para cada materia, buscar si tiene planificaciones para obtener temas de referencia
  const subjectsWithContext = await Promise.all(((subjects as any[]) || []).map(async (s: any) => {
    const { data: recentPlans } = await (supabase as any)
      .from('planificaciones')
      .select('topic, created_at')
      .eq('user_id', user.id)
      .eq('subject', s.materia)
      .eq('grade', s.curso)
      .order('created_at', { ascending: false })
      .limit(3)

    return {
      ...s,
      recentTopics: ((recentPlans as any[]) || []).map((p: any) => p.topic).join(', ') || null
    }
  }))

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-ink">Recursos Didácticos</h1>
        <p className="text-ink3 text-sm">
          Material de apoyo personalizado basado en tus materias y planificaciones generadas.
        </p>
      </header>

      <RecursosDidacticosClient initialSubjects={subjectsWithContext} />
    </div>
  )
}
