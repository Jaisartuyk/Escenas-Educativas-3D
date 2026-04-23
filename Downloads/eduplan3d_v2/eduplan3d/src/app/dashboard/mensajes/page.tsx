// src/app/dashboard/mensajes/page.tsx
// Módulo de Comunicaciones — mensajería directa + boletines.
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { MensajesClient } from '@/components/mensajes/MensajesClient'
import { resolveStudentsForTutor } from '@/lib/mensajes/access'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const revalidate = 0

export const metadata = { title: 'Mensajes' }

export default async function MensajesPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('id, full_name, role, institution_id, institutions(id, name)')
    .eq('id', user.id)
    .single()
  if (!profile?.institution_id) redirect('/dashboard')

  // Cursos disponibles para boletines (sólo para teacher/admin)
  let broadcastCourses: Array<{ id: string; name: string; parallel: string | null }> = []
  if (profile.role === 'teacher') {
    const list = await resolveStudentsForTutor(admin as any, profile.id)
    const seen = new Set<string>()
    for (const s of list) {
      if (seen.has(s.courseId)) continue
      seen.add(s.courseId)
      broadcastCourses.push({ id: s.courseId, name: s.courseName, parallel: null })
    }
  } else if (profile.role === 'admin' || profile.role === 'assistant' || profile.role === 'rector') {
    const { data: courses } = await admin
      .from('courses')
      .select('id, name, parallel')
      .eq('institution_id', profile.institution_id)
      .order('name')
    broadcastCourses = (courses || []).map((c: any) => ({ id: c.id, name: c.name, parallel: c.parallel }))
  }

  return (
    <div className="animate-fade-in">
      <MensajesClient
        me={{ id: profile.id, fullName: profile.full_name || 'Usuario', role: profile.role }}
        institutionName={(profile as any).institutions?.name || ''}
        broadcastCourses={broadcastCourses}
      />
    </div>
  )
}
