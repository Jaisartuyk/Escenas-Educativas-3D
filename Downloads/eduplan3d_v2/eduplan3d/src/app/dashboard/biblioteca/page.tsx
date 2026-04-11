import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { BibliotecaClient } from '@/components/biblioteca/BibliotecaClient'

export const metadata: Metadata = { title: 'Mi Biblioteca' }
export const dynamic = 'force-dynamic'

export default async function BibliotecaPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const admin = createAdminClient()

  // Load teacher's real subjects with course info
  const { data: subjects } = await admin
    .from('subjects' as any)
    .select('id, name, course_id, course:courses(id, name, parallel, level)')
    .eq('teacher_id', user.id)
    .order('name', { ascending: true })

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold tracking-tight">Mi Biblioteca</h1>
        <p className="text-ink3 text-sm mt-1">
          Sube tus libros y documentos curriculares. La IA los usara como referencia en tus planificaciones.
        </p>
      </div>
      <BibliotecaClient subjects={subjects || []} />
    </div>
  )
}
