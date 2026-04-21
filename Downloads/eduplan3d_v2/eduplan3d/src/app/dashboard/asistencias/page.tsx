import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { AsistenciasClient } from '@/components/asistencias/AsistenciasClient'

export const dynamic = 'force-dynamic'

export default async function AsistenciasPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  const admin = createAdminClient()
  
  // Validar rol del usuario
  const { data: profile } = await admin
    .from('profiles')
    .select('role, institution_id')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'teacher' && profile?.role !== 'admin') {
    redirect('/dashboard') // Redirigir si no tiene permisos
  }

  return <AsistenciasClient />
}
