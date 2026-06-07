import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export default async function proxy(request: NextRequest) {
  const host     = request.headers.get('host') ?? ''
  const { pathname } = request.nextUrl

  // ── Multi-domain routing ────────────────────────────────────────────────────
  // admin.wapaci.com → redirect root to /admin
  if (host === 'admin.wapaci.com' && pathname === '/') {
    return NextResponse.redirect(new URL('/admin', request.url))
  }
  // app.wapaci.com → redirect root to /login (proxy handles auth below)
  if (host === 'app.wapaci.com' && pathname === '/') {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  // wapaci.com / www.wapaci.com → serve landing as-is, no auto-redirect to dashboard

  // ── Supabase auth session refresh ──────────────────────────────────────────
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder',
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // Redirect unauthenticated users away from protected routes
  if (!user && (pathname.startsWith('/dashboard') || pathname.startsWith('/admin') || pathname.startsWith('/onboarding'))) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Redirect authenticated users away from login/signup pages
  if (user && (pathname === '/login' || pathname === '/signup')) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/shopify/webhooks|api/cron).*)'],
}
