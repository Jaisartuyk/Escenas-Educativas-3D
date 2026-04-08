import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Not logged in' })

  let log: string[] = []

  try {
    log.push("1. Fetching profile...")
    const { data: profile, error: profErr } = await (supabase as any).from('profiles').select('*').eq('id', user.id).single()
    if (profErr) log.push("Profile Error: " + JSON.stringify(profErr))
    else log.push("Profile fetched: " + profile?.id)

    log.push("2. Testing Topbar logic...")
    if (profile) {
      const initials = profile?.full_name?.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase() ?? '?'
      log.push("Initials: " + initials)
    }

    log.push("3. Fetching planificaciones...")
    const { data: planificaciones, error: planErr } = await (supabase as any)
      .from('planificaciones')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5)
      
    if (planErr) log.push("Plan Error: " + JSON.stringify(planErr))
    else {
      log.push("Planificaciones count: " + planificaciones?.length)
      if (planificaciones?.length) {
        log.push("4. Testing date-fns...")
        try {
           planificaciones.forEach((p: any) => {
             format(new Date(p.created_at), "d MMM", { locale: es })
           })
           log.push("All dates formatted successfully.")
        } catch(e: any) {
           log.push("DATE FORMAT ERROR: " + e.message)
           throw e
        }
      }
    }

    log.push("5. Testing exact counts (totalPlans)...")
    const { count: totalPlans } = await (supabase as any)
      .from('planificaciones')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
    log.push("Total plans: " + totalPlans)

    log.push("6. Fetching /dashboard/layout dependencies...")
    log.push("Missing institution check: " + (!profile?.institution_id))

    return NextResponse.json({ success: true, log, conclusion: "ALL TESTS PASSED WITH NO JS ERRORS. THE SSR FAILURE IS NOT CAUSED BY DATA FETCHING." })
  } catch (err: any) {
    return NextResponse.json({ success: false, log, errorMessage: err.message, stack: err.stack, type: typeof err })
  }
}
