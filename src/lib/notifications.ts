type AdminLike = any

export type AppNotificationInput = {
  userId: string
  category: 'message' | 'finance' | 'assignment' | 'grade' | 'attendance' | 'planning' | 'system'
  title: string
  body?: string | null
  href?: string | null
  metadata?: Record<string, any>
}

function uniq<T>(items: T[]): T[] {
  return Array.from(new Set(items))
}

export async function createAppNotifications(admin: AdminLike, notifications: AppNotificationInput[]) {
  const rows = notifications
    .filter((n) => n.userId && n.title)
    .map((n) => ({
      user_id: n.userId,
      category: n.category,
      title: n.title,
      body: n.body || null,
      href: n.href || null,
      metadata: n.metadata || {},
    }))

  if (rows.length === 0) return
  await admin.from('app_notifications').insert(rows)
}

export async function getParentUserIdsForStudents(admin: AdminLike, studentIds: string[]) {
  const cleanIds = uniq(studentIds.filter(Boolean))
  if (cleanIds.length === 0) return [] as string[]

  const { data: links } = await admin
    .from('parent_links')
    .select('parent_id, child_id')
    .in('child_id', cleanIds)

  return uniq(((links || []) as any[]).map((link) => link.parent_id).filter(Boolean))
}

export async function createStudentFamilyNotifications(
  admin: AdminLike,
  studentIds: string[],
  base: Omit<AppNotificationInput, 'userId'>,
) {
  const cleanIds = uniq(studentIds.filter(Boolean))
  if (cleanIds.length === 0) return

  const parentIds = await getParentUserIdsForStudents(admin, cleanIds)
  const recipients = uniq([...cleanIds, ...parentIds])
  await createAppNotifications(
    admin,
    recipients.map((userId) => ({
      userId,
      ...base,
    })),
  )
}
