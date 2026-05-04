import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ notifications: [], unreadTotal: 0 }, { status: 401 })

  const limitParam = Number(req.nextUrl.searchParams.get('limit') || 20)
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 50) : 20

  const { data: notifications, error } = await (supabase as any)
    .from('app_notifications')
    .select('id, category, title, body, href, metadata, read_at, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) return NextResponse.json({ error: error.message, notifications: [], unreadTotal: 0 }, { status: 500 })

  const admin = createAdminClient()
  const { count } = await (admin as any)
    .from('app_notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .is('read_at', null)

  return NextResponse.json({
    notifications: notifications || [],
    unreadTotal: count || 0,
  })
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const admin = createAdminClient()
  const now = new Date().toISOString()

  if (body?.markAll) {
    const { error } = await (admin as any)
      .from('app_notifications')
      .update({ read_at: now })
      .eq('user_id', user.id)
      .is('read_at', null)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (!body?.id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

  const { error } = await (admin as any)
    .from('app_notifications')
    .update({ read_at: now })
    .eq('id', body.id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
