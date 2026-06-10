import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { AlumnoClient } from '@/components/alumno/AlumnoClient'
import { ChildScopeSelector } from '@/components/family/ChildScopeSelector'
import { getLinkedChildrenForParent, getPrimaryLinkedChildForParent } from '@/lib/parents'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const revalidate = 0

export default async function AlumnoPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined>
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const admin = createAdminClient()

  const { data: profile } = await admin
    .from('profiles')
    .select('*, institutions(name, settings)')
    .eq('id', user.id)
    .single()

  const linkedChildren = await getLinkedChildrenForParent(admin as any, user.id)
  const isParentMode = profile?.role === 'parent' || linkedChildren.length > 0

  if (!profile || (!['student'].includes(profile.role) && !isParentMode)) {
    redirect('/dashboard')
  }

  const params = await Promise.resolve(searchParams || {})
  const requestedChildId = typeof params.child_id === 'string' ? params.child_id : undefined

  const instId = profile.institution_id
  let effectiveStudentId = user.id
  let studentProfile = profile
  let selectedChildId: string | null = null

  if (isParentMode) {

    // SERVER-SIDE DEBUG WRITE
    try {
      const { data: allLinks } = await admin.from('parent_links').select('*')
      const { data: allProfiles } = await admin.from('profiles').select('id, full_name, email, role')
      const fs = require('fs')
      const path = require('path')
      fs.writeFileSync(
        path.join(process.cwd(), 'debug_parent_output.json'),
        JSON.stringify({
          currentUser: { id: user.id, email: user.email, profile },
          linkedChildren,
          allLinks,
          allProfiles: allProfiles?.filter(p => p.role === 'parent' || p.full_name?.toLowerCase().includes('marquez') || p.full_name?.toLowerCase().includes('sandy'))
        }, null, 2)
      )
    } catch (err: any) {
      console.error('Error writing debug file:', err)
    }

    const linkedChild = await getPrimaryLinkedChildForParent(admin as any, user.id, requestedChildId)
    if (!linkedChild) {
      return (
        <div className="max-w-3xl mx-auto p-8 text-center">
          <h1 className="font-display text-3xl font-bold">Seguimiento Académico</h1>
          <p className="text-ink3 mt-3">Tu cuenta de representante todavía no tiene un estudiante vinculado. Pide a la institución que complete ese enlace.</p>
        </div>
      )
    }
    effectiveStudentId = linkedChild.childId
    selectedChildId = linkedChild.childId

    const { data: childProfile } = await admin
      .from('profiles')
      .select('id, full_name, institution_id, role')
      .eq('id', effectiveStudentId)
      .single()

    if (!childProfile) {
      return (
        <div className="max-w-3xl mx-auto p-8 text-center">
          <h1 className="font-display text-3xl font-bold">Seguimiento Académico</h1>
          <p className="text-ink3 mt-3">No pudimos cargar la ficha del estudiante vinculado. Revisa el vínculo con la institución.</p>
        </div>
      )
    }
    studentProfile = childProfile as any
  }

  // ── 1. Matrícula del Alumno ────────────────────────────────────────────────
  // Para saber en qué curso está
  const { data: enrollments } = await admin
    .from('enrollments')
    .select('course_id')
    .eq('student_id', effectiveStudentId)

  const courseIds = (enrollments || []).map((e: any) => e.course_id)

  // ── 2. Curso y Materias ─────────────────────────────────────────────────────
  let courses: any[] = []
  let subjects: any[] = []
  let subjectIds: string[] = []

  if (courseIds.length > 0) {
    const { data: courseData } = await admin
      .from('courses')
      .select('*')
      .in('id', courseIds)
    courses = courseData || []

    const { data: subData } = await admin
      .from('subjects')
      .select('*, teacher:profiles(full_name)')
      .in('course_id', courseIds)
      .order('name', { ascending: true })
    subjects = subData || []
    subjectIds = subjects.map((s: any) => s.id)
  }

  // ── 3. Tareas Asignadas (Assignments) ──────────────────────────────────────
  let assignments: any[] = []
  if (subjectIds.length > 0) {
    const { data } = await admin
      .from('assignments')
      .select('*')
      .in('subject_id', subjectIds)
      .order('created_at', { ascending: false })
    assignments = data || []
  }

  // ── 4. Calificaciones del Alumno (Grades) ──────────────────────────────────
  let grades: any[] = []
  const assignmentIds = assignments.map((a: any) => a.id)
  if (assignmentIds.length > 0) {
    const { data } = await admin
      .from('grades')
      .select('*')
      .in('assignment_id', assignmentIds)
      .eq('student_id', effectiveStudentId)
    grades = data || []
  }

  // ── 5. Categorías de calificación ──────────────────────────────────────────
  let categories: any[] = []
  if (instId) {
    const { data } = await admin
      .from('grade_categories' as any)
      .select('*')
      .eq('institution_id', instId)
      .order('sort_order', { ascending: true })
    categories = data || []
  }

  // ── 6. Asistencia del Alumno ───────────────────────────────────────────────
  let attendance: any[] = []
  if (subjectIds.length > 0) {
    const { data } = await admin
      .from('attendance')
      .select('*')
      .eq('student_id', effectiveStudentId)
      .in('subject_id', subjectIds)
      .order('date', { ascending: false })
    attendance = data || []
  }

  // ── 7. Comportamiento del Alumno ───────────────────────────────────────────
  let behaviors: any[] = []
  if (subjectIds.length > 0) {
      const { data } = await admin
      .from('behaviors')
      .select('*')
      .eq('student_id', effectiveStudentId)
      .in('subject_id', subjectIds)
      .order('created_at', { ascending: false })
    behaviors = data || []
  }

  // ── 8. Config de horario e Institución (para el personal grid) ────────────
  const scheduleConfig = instId 
    ? await admin.from('schedule_configs' as any).select('*').eq('institution_id', instId).maybeSingle().then(r => r.data)
    : null

  const instSettings = (profile as any)?.institutions?.settings || {}
  const allHorarios: Record<string, any> = {}
  Object.keys(instSettings).forEach(key => {
    if (key.startsWith('horarios_') || key === 'horarios') {
      const slot = instSettings[key]
      if (slot?.horario) allHorarios[key] = slot
    }
  })

  // ── 9. Diagnóstico para multi-hijos (se activa con ?debug=true en la URL) ──
  let debugData: any = null
  if (params.debug === 'true') {
    const { data: links } = await admin
      .from('parent_links')
      .select('parent_id, child_id, relationship, is_primary, child:profiles!parent_links_child_id_fkey(id, full_name, email)')
      .eq('parent_id', user.id)
    
    const { data: potentialChildren } = await admin
      .from('profiles')
      .select('id, full_name, email, role')
      .eq('role', 'student')
      .ilike('full_name', '%MARQUEZ%')

    // Debug duplicate parent profiles
    const { data: duplicateGmailParents } = await admin
      .from('profiles')
      .select('id, full_name, email, role')
      .eq('email', 'briggittezavala39@gmail.com')

    // Find Edrick's metadata specifically
    const edrickId = '313902b9-71ee-4090-a172-c9cf0cd9da81'
    const { data: edrickProfile } = await admin
      .from('profiles')
      .select('id, full_name, metadata')
      .eq('id', edrickId)
      .maybeSingle()

    // Find links specifically for Edrick
    const { data: edrickLinks } = await admin
      .from('parent_links')
      .select('*')
      .eq('child_id', edrickId)

    debugData = {
      parentId: user.id,
      parentName: profile.full_name,
      parentEmail: profile.email,
      links: links || [],
      potentialChildren: potentialChildren || [],
      duplicateGmailParents: duplicateGmailParents || [],
      edrickMetadata: edrickProfile?.metadata || {},
      edrickLinks: edrickLinks || []
    }
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Diagnóstico condicional */}
      {debugData && (
        <div className="p-6 mb-6 border-2 border-dashed border-blue-400 bg-blue-50 text-blue-900 rounded-2xl">
          <h3 className="text-lg font-bold flex items-center gap-2 mb-2">🔍 Diagnóstico de Hijos Vinculados</h3>
          <p className="text-sm"><strong>Representante:</strong> {debugData.parentName} ({debugData.parentEmail})</p>
          <p className="text-sm"><strong>ID Representante:</strong> {debugData.parentId}</p>
          
          <h4 className="mt-4 font-bold text-sm text-blue-800">1. Vinculaciones en la tabla 'parent_links':</h4>
          {debugData.links.length === 0 ? (
            <p className="text-xs text-red-600 italic">No hay vinculaciones registradas para este ID.</p>
          ) : (
            <ul className="list-disc pl-5 text-xs mt-1 space-y-1">
              {debugData.links.map((link: any, idx: number) => (
                <li key={idx}>
                  <strong>Estudiante:</strong> {link.child?.full_name || 'Desconocido'} ({link.child?.email})<br/>
                  <span className="text-blue-700">ID Estudiante: {link.child_id} | Rol: {link.relationship} | Principal: {link.is_primary ? 'Sí' : 'No'}</span>
                </li>
              ))}
            </ul>
          )}

          <h4 className="mt-4 font-bold text-sm text-blue-800">2. Cuentas de representante registradas con el correo 'briggittezavala39@gmail.com':</h4>
          <ul className="list-disc pl-5 text-xs mt-1 space-y-1">
            {debugData.duplicateGmailParents.map((p: any, idx: number) => (
              <li key={idx}>
                <strong>ID:</strong> {p.id} | Nombre: {p.full_name} | Rol: {p.role}
              </li>
            ))}
          </ul>

          <h4 className="mt-4 font-bold text-sm text-blue-800">3. Datos de Vinculación de Edrick Jose en Metadata:</h4>
          <pre className="text-xs bg-white p-2 rounded border mt-1 overflow-auto max-h-40">
            {JSON.stringify({
              mother_parent_user_id: debugData.edrickMetadata?.mother_parent_user_id,
              mother_parent_login: debugData.edrickMetadata?.mother_parent_login,
              edrickLinks: debugData.edrickLinks
            }, null, 2)}
          </pre>

          <h4 className="mt-4 font-bold text-sm text-blue-800">4. Estudiantes en la base de datos con apellido 'MARQUEZ':</h4>
          {debugData.potentialChildren.length === 0 ? (
            <p className="text-xs text-gray-500 italic">No se encontraron estudiantes con apellido MARQUEZ.</p>
          ) : (
            <ul className="list-disc pl-5 text-xs mt-1 space-y-1">
              {debugData.potentialChildren.map((student: any, idx: number) => (
                <li key={idx}>
                  <strong>{student.full_name}</strong> ({student.email || 'Sin correo'}) - <span className="font-mono text-[10px]">{student.id}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {isParentMode && selectedChildId && (
        <ChildScopeSelector
          childrenOptions={linkedChildren}
          selectedChildId={selectedChildId}
          title="Seguimiento por estudiante"
          description="Cambia el hijo que quieres revisar en seguimiento, tareas, asistencia y comportamiento."
        />
      )}

      <AlumnoClient
        profile={{ ...profile, role: isParentMode ? 'parent' : profile.role }}
        studentProfile={studentProfile}
        courses={courses}
        subjects={subjects}
        assignments={assignments}
        grades={grades}
        categories={categories}
        attendance={attendance}
        behaviors={behaviors}
        scheduleConfig={scheduleConfig}
        horariosData={allHorarios}
      />
    </div>
  )
}
