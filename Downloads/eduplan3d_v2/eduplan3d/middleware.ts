// middleware.ts  (raíz del proyecto)
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet: any[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

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

  // Control de acceso por email
  if (user && pathname.startsWith('/dashboard')) {
    if (user.email === 'israferaldascarlett15@gmail.com') {
      const allowed =
        pathname === '/dashboard' ||
        pathname.startsWith('/dashboard/horarios') ||
        pathname.startsWith('/dashboard/configuracion')

      if (!allowed) {
        return NextResponse.redirect(new URL('/dashboard/horarios', request.url))
      }
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
