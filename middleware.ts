// middleware.ts  (raíz del proyecto)
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value)
          })
          // rebuild response with the updated request cookies
          response = NextResponse.next({ request: { headers: request.headers } })
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  // IMPORTANT: Do NOT write code between createServerClient and getUser
  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Rutas protegidas → redirigir al login si no hay sesión
  if (pathname.startsWith('/dashboard') && !user) {
    return NextResponse.redirect(new URL('/auth/login', request.url))
  }

  // Si ya está autenticado y visita auth → redirigir al dashboard
  if (pathname.startsWith('/auth') && user) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // Control de acceso por email (asistente)
  if (user && user.email === 'israferaldascarlett15@gmail.com' && pathname.startsWith('/dashboard')) {
    const allowed =
      pathname === '/dashboard' ||
      pathname.startsWith('/dashboard/horarios') ||
      pathname.startsWith('/dashboard/configuracion')
    if (!allowed) {
      return NextResponse.redirect(new URL('/dashboard/horarios', request.url))
    }
  }

  // ─ Planner_solo (docente externo): solo puede acceder a sus rutas permitidas ─
  if (user && pathname.startsWith('/dashboard')) {
    // Rutas explícitamente permitidas para planner_solo
    const plannerSoloAllowed =
      pathname === '/dashboard' ||
      pathname.startsWith('/dashboard/planificador') ||
      pathname.startsWith('/dashboard/biblioteca') ||
      pathname.startsWith('/dashboard/configuracion') ||
      pathname.startsWith('/dashboard/historial')

    if (!plannerSoloAllowed) {
      // Consultar plan del usuario solo cuando la ruta no esté en la whitelist
      const { data: profile } = await supabase
        .from('profiles')
        .select('plan')
        .eq('id', user.id)
        .single()
      if ((profile as any)?.plan === 'planner_solo') {
        return NextResponse.redirect(new URL('/dashboard/planificador', request.url))
      }
    }
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
