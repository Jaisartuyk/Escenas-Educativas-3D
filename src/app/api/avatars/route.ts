import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File
    const fileName = formData.get('fileName') as string

    if (!file || !fileName) {
      return NextResponse.json({ error: 'Falta archivo o nombre de archivo' }, { status: 400 })
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Bypass RLS using the service role key
    const { error: uploadError } = await supabaseAdmin.storage
      .from('avatars')
      .upload(fileName, file, { upsert: true })

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 })
    }

    const { data: { publicUrl } } = supabaseAdmin.storage
      .from('avatars')
      .getPublicUrl(fileName)

    return NextResponse.json({ publicUrl })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
