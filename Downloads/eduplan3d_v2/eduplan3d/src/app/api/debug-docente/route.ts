import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not logged in' })

  const admin = createAdminClient()
  const log: Record<string, any> = {}

  // 1. Perfil del docente logueado
  const { data: profile } = await admin.from('profiles').select('id, role, institution_id').eq('id', user.id).single()
  log.teacherProfile = profile

  // 2. Materias del docente
  const { data: subjects } = await admin.from('subjects' as any).select('id, name, course_id').eq('teacher_id', user.id)
  log.subjects = subjects
  log.subjectsCount = subjects?.length ?? 0

  const courseIds = (subjects || []).map((s: any) => s.course_id).filter(Boolean)
  log.courseIds = courseIds

  // 3. Matrículas de esos cursos
  const { data: enrollments, error: enrErr } = courseIds.length > 0
    ? await admin.from('enrollments').select('course_id, student_id').in('course_id', courseIds)
    : { data: [], error: null }
  log.enrollments = enrollments
  log.enrollmentsCount = enrollments?.length ?? 0
  log.enrollmentsError = enrErr?.message ?? null

  const studentIds = [...new Set((enrollments || []).map((e: any) => e.student_id as string))]
  log.studentIds = studentIds

  // 4. Perfiles de esos estudiantes con admin client
  let profilesResult: any = null
  let profilesError: any = null
  if (studentIds.length > 0) {
    const { data: profs, error: pe } = await admin
      .from('profiles')
      .select('id, full_name, role, institution_id')
      .in('id', studentIds)
    profilesResult = profs
    profilesError = pe?.message ?? null
  }
  log.studentProfiles = profilesResult
  log.studentProfilesCount = profilesResult?.length ?? 0
  log.studentProfilesError = profilesError

  // 5. Intentar buscar el perfil directamente por ID (primer studentId)
  if (studentIds.length > 0) {
    const { data: direct, error: de } = await admin
      .from('profiles')
      .select('id, full_name, role')
      .eq('id', studentIds[0])
      .maybeSingle()
    log.directLookup = { id: studentIds[0], result: direct, error: de?.message ?? null }
  }

  // 6. Ver si el service role key está definido
  log.serviceRoleKeyDefined = !!process.env.SUPABASE_SERVICE_ROLE_KEY
  log.serviceRoleKeyPrefix = process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(0, 20) ?? 'MISSING'

  return NextResponse.json(log, { status: 200 })
}
