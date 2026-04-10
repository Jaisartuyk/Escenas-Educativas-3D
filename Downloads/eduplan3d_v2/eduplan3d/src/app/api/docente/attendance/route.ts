import { NextResponse } from 'next/server'
import { createClient }      from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// GET /api/docente/attendance?subjectId=X&weekStart=YYYY-MM-DD
export async function GET(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const subjectId = searchParams.get('subjectId')
  const weekStart = searchParams.get('weekStart') // YYYY-MM-DD (Monday)
  if (!subjectId || !weekStart)
    return NextResponse.json({ error: 'Missing params' }, { status: 400 })

  // weekEnd = Friday
  const start = new Date(weekStart)
  const end   = new Date(weekStart)
  end.setDate(end.getDate() + 4)
  const weekEnd = end.toISOString().split('T')[0]

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('attendance' as any)
    .select('id, student_id, date, status')
    .eq('subject_id', subjectId)
    .gte('date', weekStart)
    .lte('date', weekEnd)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

// POST /api/docente/attendance  → upsert one record
export async function POST(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { subject_id, student_id, date, status, institution_id } = body

  console.log('[attendance POST]', { subject_id, student_id, date, status, institution_id })

  const admin = createAdminClient()

  if (status === 'present') {
    // present = sin registro (borramos si existe)
    const { error: delErr } = await admin
      .from('attendance' as any)
      .delete()
      .eq('subject_id', subject_id)
      .eq('student_id', student_id)
      .eq('date', date)
    if (delErr) console.error('[attendance DELETE error]', delErr)
    return NextResponse.json({ success: true })
  }

  const { error } = await admin
    .from('attendance' as any)
    .upsert(
      { subject_id, student_id, date, status, institution_id },
      { onConflict: 'subject_id,student_id,date' }
    )

  if (error) {
    console.error('[attendance UPSERT error]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
