// src/lib/auth/ownership.ts
// Helpers de verificación de ownership / rol para endpoints con createAdminClient().
// Centralizan los checks para evitar fugas cross-tenant en rutas que bypassean RLS.

import { createAdminClient } from '@/lib/supabase/admin'

export type Role = 'admin' | 'teacher' | 'student' | 'assistant' | 'horarios_only' | 'parent'

export interface MinimalProfile {
  id: string
  role: Role | null
  institution_id: string | null
  plan?: string | null
}

/** Obtiene el perfil mínimo del usuario autenticado (rol + institución). */
export async function getProfile(userId: string): Promise<MinimalProfile | null> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('profiles')
    .select('id, role, institution_id, plan')
    .eq('id', userId)
    .single()
  return (data as MinimalProfile) || null
}

/** ¿El usuario es dueño (profesor) de la materia? */
export async function teacherOwnsSubject(userId: string, subjectId: string): Promise<boolean> {
  if (!userId || !subjectId) return false
  const admin = createAdminClient()
  const { data } = await admin
    .from('subjects')
    .select('teacher_id')
    .eq('id', subjectId)
    .single()
  return !!data && (data as any).teacher_id === userId
}

/** ¿El usuario es dueño de la assignment (vía subject.teacher_id)? */
export async function teacherOwnsAssignment(userId: string, assignmentId: string): Promise<boolean> {
  if (!userId || !assignmentId) return false
  const admin = createAdminClient()
  const { data } = await admin
    .from('assignments')
    .select('subject_id, subjects:subject_id(teacher_id)')
    .eq('id', assignmentId)
    .single()
  const teacherId = (data as any)?.subjects?.teacher_id
  return teacherId === userId
}

/** ¿El usuario es admin o assistant de la institución dada? */
export async function isInstitutionAdmin(userId: string, institutionId?: string): Promise<boolean> {
  const profile = await getProfile(userId)
  if (!profile) return false
  if (institutionId && profile.institution_id !== institutionId) return false
  return profile.role === 'admin' || profile.role === 'assistant'
}

/** Devuelve la institution_id del usuario o null. */
export async function getUserInstitutionId(userId: string): Promise<string | null> {
  const profile = await getProfile(userId)
  return profile?.institution_id || null
}

/** ¿Un estudiante está matriculado en la misma institución del usuario? */
export async function studentInSameInstitution(userId: string, studentId: string): Promise<boolean> {
  const admin = createAdminClient()
  const myInst = await getUserInstitutionId(userId)
  if (!myInst) return false
  const { data } = await admin
    .from('profiles')
    .select('institution_id')
    .eq('id', studentId)
    .single()
  return (data as any)?.institution_id === myInst
}

/** ¿La course pertenece a la institución del usuario? */
export async function courseInUserInstitution(userId: string, courseId: string): Promise<boolean> {
  const admin = createAdminClient()
  const myInst = await getUserInstitutionId(userId)
  if (!myInst) return false
  const { data } = await admin
    .from('courses')
    .select('institution_id')
    .eq('id', courseId)
    .single()
  return (data as any)?.institution_id === myInst
}

/** ¿El perfil pertenece a un estudiante? */
export async function isStudentUser(userId: string): Promise<boolean> {
  const profile = await getProfile(userId)
  return profile?.role === 'student'
}

/** ¿El estudiante está matriculado en el curso de la materia? */
export async function studentEnrolledInSubject(studentId: string, subjectId: string): Promise<boolean> {
  if (!studentId || !subjectId) return false
  const admin = createAdminClient()
  const { data } = await admin
    .from('subjects')
    .select('course_id')
    .eq('id', subjectId)
    .single()

  const courseId = (data as any)?.course_id
  if (!courseId) return false

  const { data: enrollment } = await admin
    .from('enrollments')
    .select('student_id')
    .eq('student_id', studentId)
    .eq('course_id', courseId)
    .maybeSingle()

  return !!enrollment
}

/** ¿El estudiante está matriculado en el curso de la tarea? */
export async function studentEnrolledInAssignment(studentId: string, assignmentId: string): Promise<boolean> {
  if (!studentId || !assignmentId) return false
  const admin = createAdminClient()
  const { data } = await admin
    .from('assignments')
    .select('subject_id')
    .eq('id', assignmentId)
    .single()

  const subjectId = (data as any)?.subject_id
  if (!subjectId) return false

  return studentEnrolledInSubject(studentId, subjectId)
}
