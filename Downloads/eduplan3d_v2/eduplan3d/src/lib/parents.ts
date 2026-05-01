import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'

export interface LinkedChild {
  childId: string
  fullName: string
  institutionId: string | null
  relationship: string
  isPrimary: boolean
}

function normalizeRows(rows: any[]): LinkedChild[] {
  return (rows || [])
    .map((row: any) => {
      const child = Array.isArray(row.child) ? row.child[0] : row.child
      if (!child?.id) return null
      return {
        childId: child.id,
        fullName: child.full_name || 'Estudiante',
        institutionId: child.institution_id || null,
        relationship: row.relationship || 'OTRO',
        isPrimary: !!row.is_primary,
      } satisfies LinkedChild
    })
    .filter(Boolean) as LinkedChild[]
}

export async function getLinkedChildrenForParent(
  admin: SupabaseClient | null,
  parentId: string,
): Promise<LinkedChild[]> {
  if (!parentId) return []
  const client = admin || createAdminClient()
  const { data } = await (client as any)
    .from('parent_links')
    .select('child_id, relationship, is_primary, child:profiles!parent_links_child_id_fkey(id, full_name, institution_id)')
    .eq('parent_id', parentId)
    .order('is_primary', { ascending: false })
    .order('created_at', { ascending: true })

  return normalizeRows((data || []) as any[])
}

export async function getPrimaryLinkedChildForParent(
  admin: SupabaseClient | null,
  parentId: string,
  requestedChildId?: string | null,
): Promise<LinkedChild | null> {
  const children = await getLinkedChildrenForParent(admin, parentId)
  if (children.length === 0) return null
  if (requestedChildId) {
    const exact = children.find(c => c.childId === requestedChildId)
    if (exact) return exact
  }
  return children.find(c => c.isPrimary) || children[0]
}

export async function parentLinkedToStudent(
  admin: SupabaseClient | null,
  parentId: string,
  studentId: string,
): Promise<boolean> {
  if (!parentId || !studentId) return false
  const child = await getPrimaryLinkedChildForParent(admin, parentId, studentId)
  return !!child && child.childId === studentId
}
