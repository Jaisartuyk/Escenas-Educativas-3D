import { NextResponse } from 'next/server'
import { createClient }      from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// POST /api/enrollments  body: { student_id, course_id }  → insert
// DELETE /api/enrollments?student_id=X&course_id=Y       → delete

export async function POST(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { student_id, course_id } = await req.json()
  if (!student_id || !course_id)
    return NextResponse.json({ error: 'Missing params' }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await admin
    .from('enrollments')
    .insert({ student_id, course_id })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

export async function DELETE(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const student_id = searchParams.get('student_id')
  const course_id  = searchParams.get('course_id')
  if (!student_id || !course_id)
    return NextResponse.json({ error: 'Missing params' }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await admin
    .from('enrollments')
    .delete()
    .match({ student_id, course_id })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
