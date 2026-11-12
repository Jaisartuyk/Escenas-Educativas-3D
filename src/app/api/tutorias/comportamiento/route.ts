import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { resolveTutoredCoursesForTeacher } from '@/lib/mensajes/access'

export async function GET(request: Request) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const admin = createAdminClient()
    const { data: profile } = await admin
      .from('profiles')
      .select('id, role, institution_id')
      .eq('id', user.id)
      .single()

    if (!profile || !profile.institution_id) {
      return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const courseId = searchParams.get('course_id')
    const trimestreParam = searchParams.get('trimestre')

    let query = admin
      .from('libreta_tutor_notes' as any)
      .select('*')
      .eq('institution_id', profile.institution_id)

    if (courseId) {
      query = query.eq('course_id', courseId)
    }
    if (trimestreParam) {
      query = query.eq('trimestre', parseInt(trimestreParam, 10))
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ notes: data || [] })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error del servidor' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const admin = createAdminClient()
    const { data: profile } = await admin
      .from('profiles')
      .select('id, role, institution_id, institutions(settings)')
      .eq('id', user.id)
      .single()

    if (!profile || !profile.institution_id) {
      return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 })
    }

    const body = await request.json()
    const { course_id, trimestre, items } = body

    if (!course_id || !trimestre || !Array.isArray(items)) {
      return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 })
    }

    const trimestreNum = parseInt(String(trimestre), 10)
    if (![1, 2, 3].includes(trimestreNum)) {
      return NextResponse.json({ error: 'Trimestre inválido' }, { status: 400 })
    }

    const isTeacher = profile.role === 'teacher'
    const isAdminOrRector = ['admin', 'rector'].includes(profile.role)

    if (!isTeacher && !isAdminOrRector) {
      return NextResponse.json({ error: 'No tienes permisos para calificar comportamiento' }, { status: 403 })
    }

    // Si es docente tutor, validar que sea tutor de este curso y que las libretas no estén publicadas
    if (isTeacher) {
      const tutoredCourses = await resolveTutoredCoursesForTeacher(admin as any, user.id)
      const isTutorOfCourse = tutoredCourses.some((c: any) => c.id === course_id)
      if (!isTutorOfCourse) {
        return NextResponse.json({ error: 'No eres el tutor asignado de este curso' }, { status: 403 })
      }

      const settings = (profile as any).institutions?.settings || {}
      if (settings.libretas_published === true) {
        return NextResponse.json({
          error: 'Las libretas ya están publicadas. No se pueden editar notas u observaciones.'
        }, { status: 403 })
      }
    }

    // Upsert notes per student
    const rowsToUpsert = items.map((item: any) => {
      const bGrade = item.behavior_grade ? String(item.behavior_grade).toUpperCase().trim() : null
      const validGrade = ['S', 'F', 'U', 'N'].includes(bGrade || '') ? bGrade : null
      const obs = item.observation !== undefined ? String(item.observation || '').trim() : null

      return {
        institution_id: profile.institution_id,
        course_id,
        student_id: item.student_id,
        trimestre: trimestreNum,
        behavior_grade: validGrade,
        observation: obs,
        created_by: user.id,
        updated_at: new Date().toISOString(),
      }
    })

    const { data, error } = await admin
      .from('libreta_tutor_notes' as any)
      .upsert(rowsToUpsert, {
        onConflict: 'institution_id,course_id,student_id,trimestre',
      })
      .select()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true, count: data?.length || 0, notes: data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error al guardar notas de comportamiento' }, { status: 500 })
  }
}
