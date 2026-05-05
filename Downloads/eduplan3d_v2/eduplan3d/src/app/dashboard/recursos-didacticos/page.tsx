// src/app/dashboard/recursos-didacticos/page.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { RecursosDidacticosClient } from '@/components/recursos/RecursosDidacticosClient'

export const dynamic = 'force-dynamic'

function collectTopicsFromPlan(plan: any): string[] {
  const values = new Set<string>()

  const pushTopic = (value: string | null | undefined) => {
    const normalized = value?.replace(/\s+/g, ' ').trim()
    if (!normalized) return

    const lowered = normalized.toLowerCase()
    if (
      lowered === 'temas' ||
      lowered === 'tema' ||
      lowered === 'topic' ||
      lowered === 'tema por completar'
    ) {
      return
    }

    values.add(normalized)
  }

  pushTopic(plan?.topic)

  const content = typeof plan?.content === 'string' ? plan.content : ''
  if (!content) return Array.from(values)

  const sectionMatch = content.match(/#{3,4}\s*2\.1[^\n]*\n([\s\S]*?)(?=\n#{3,4}\s*2\.2|\n#{3,4}\s*3\.|\n---|$)/i)
  const section = sectionMatch?.[1] || ''

  if (section) {
    for (const rawLine of section.split('\n')) {
      const line = rawLine.trim()
      if (!line.startsWith('|')) continue
      if (/^\|\s*-+\s*\|/.test(line)) continue

      const cells = line
        .split('|')
        .map((cell: string) => cell.trim())
        .filter(Boolean)

      if (cells.length === 0) continue

      const firstCell = cells[0]
      if (/^temas?$/i.test(firstCell)) continue
      pushTopic(firstCell)
    }
  }

  const regexes = [
    /Tema\s*\d+\s*:\s*([^\n|]+)/gi,
    /Tema\s*:\s*([^\n|]+)/gi,
    /Experiencia de aprendizaje\s*:\s*([^\n|]+)/gi,
  ]

  for (const regex of regexes) {
    let match: RegExpExecArray | null
    while ((match = regex.exec(content)) !== null) {
      pushTopic(match[1])
    }
  }

  return Array.from(values)
}

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
      .select('topic, title, content, created_at')
      .eq('user_id', user.id)
      .eq('subject', s.materia)
      .eq('grade', s.curso)
      .order('created_at', { ascending: false })
      .limit(5)

    const topics = new Set<string>()
    for (const plan of (recentPlans as any[]) || []) {
      for (const topic of collectTopicsFromPlan(plan)) {
        topics.add(topic)
        if (topics.size >= 8) break
      }
      if (topics.size >= 8) break
    }

    return {
      ...s,
      recentTopics: Array.from(topics).join(', ') || null
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
