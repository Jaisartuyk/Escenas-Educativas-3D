import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

// POST — save attachment URLs for an assignment
export async function POST(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = await req.json()
  const { assignment_id, file_urls } = body

  if (!assignment_id) return NextResponse.json({ error: 'Falta assignment_id' }, { status: 400 })

  const admin = createAdminClient()
  
  // Store file_urls as JSON in the assignments table
  // We use a JSONB column called attachment_urls
  const { error } = await admin
    .from('assignments')
    .update({ attachment_urls: file_urls } as any)
    .eq('id', assignment_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

// GET — get attachment URLs for an assignment
export async function GET(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const assignment_id = searchParams.get('assignment_id')
  if (!assignment_id) return NextResponse.json({ error: 'Falta assignment_id' }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('assignments')
    .select('attachment_urls')
    .eq('id', assignment_id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ file_urls: (data as any)?.attachment_urls || [] })
}
