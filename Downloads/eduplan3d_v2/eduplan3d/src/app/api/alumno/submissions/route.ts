import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

// GET — fetch submissions for the current student or for a given assignment (admin)
export async function GET(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const assignmentId = searchParams.get('assignment_id')

  const admin = createAdminClient()

  if (assignmentId) {
    // Admin/teacher fetching all submissions for an assignment
    const { data, error } = await admin
      .from('assignment_submissions')
      .select('*, student:profiles(id, full_name, email)')
      .eq('assignment_id', assignmentId)
      .order('submitted_at', { ascending: false })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ submissions: data })
  }

  // Student fetching their own submissions
  const { data, error } = await admin
    .from('assignment_submissions')
    .select('*')
    .eq('student_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ submissions: data })
}

// POST — create or update a student submission (upsert)
export async function POST(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = await req.json()
  const { assignment_id, comment, file_url } = body

  if (!assignment_id) return NextResponse.json({ error: 'Falta assignment_id' }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('assignment_submissions')
    .upsert(
      { assignment_id, student_id: user.id, comment: comment || null, file_url: file_url || null, submitted_at: new Date().toISOString() },
      { onConflict: 'assignment_id,student_id' }
    )
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ submission: data })
}
