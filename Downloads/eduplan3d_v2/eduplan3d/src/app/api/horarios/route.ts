import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getEmptyConfig, DEFAULT_HORAS } from '@/types/horarios'

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

  return NextResponse.json(horariosConfig)
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

  return NextResponse.json({ success: true })
}
