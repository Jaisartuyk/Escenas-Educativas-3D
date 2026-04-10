import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ data: [] }, { status: 401 })

  const admin = createAdminClient()

  // Get teacher's subjects → course IDs
  const { data: subjects } = await admin
    .from('subjects' as any)
    .select('id, course_id')
    .eq('teacher_id', user.id)

  const courseIds = Array.from(new Set((subjects || []).map((s: any) => s.course_id).filter(Boolean)))
  if (courseIds.length === 0) return NextResponse.json({ data: [] })

  // Get enrollments
  const { data: enrollments } = await admin
    .from('enrollments')
    .select('course_id, student_id')
    .in('course_id', courseIds)

  if (!enrollments || enrollments.length === 0) return NextResponse.json({ data: [] })

  // Get student profiles
  const studentIds = Array.from(new Set(enrollments.map((e: any) => e.student_id as string)))
  const { data: profiles } = await admin
    .from('profiles')
    .select('id, full_name, email')
    .in('id', studentIds)

  // Merge: return array of { course_id, student_id, student: {...} }
  const profilesById: Record<string, any> = {}
  ;(profiles || []).forEach((p: any) => { profilesById[p.id] = p })

  const merged = enrollments.map((e: any) => ({
    course_id:  e.course_id,
    student_id: e.student_id,
    student:    profilesById[e.student_id] || null,
  }))

  return NextResponse.json({ data: merged })
}
