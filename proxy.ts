import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export default async function proxy(request: NextRequest) {
  const host       = request.headers.get('host') ?? ''
  const { pathname } = request.nextUrl

  // ── Admin domain — route EVERYTHING to /admin/* ────────────────────────────
  if (host === 'admin.wapaci.com') {
    // Public: admin login page
    if (pathname === '/login' || pathname === '/admin/login') {
      return NextResponse.rewrite(new URL('/admin/login', request.url))
    }
    // Root → /admin
    if (pathname === '/') {
      return NextResponse.redirect(new URL('/admin', request.url))
    }
    // Anything not already under /admin → prefix it
    if (!pathname.startsWith('/admin')) {
      return NextResponse.rewrite(new URL(`/admin${pathname}`, request.url))
    }
    // Falls through to auth check below
  }

  // ── App domain — redirect root to /login ──────────────────────────────────
  if (host === 'app.wapaci.com' && pathname === '/') {
    return NextResponse.redirect(new URL('/login', request.url))
  }

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

  // ── Admin routes: require login only — admin page checks email itself ─────
  if (pathname.startsWith('/admin') && !pathname.startsWith('/admin/login')) {
    if (!user) {
      return NextResponse.redirect(new URL('/admin/login', request.url))
    }
  }

  // ── App routes: require any authenticated user ─────────────────────────────
  if (!user && (pathname.startsWith('/dashboard') || pathname.startsWith('/onboarding'))) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // ── Redirect logged-in users away from login/signup ───────────────────────
  if (user && (pathname === '/login' || pathname === '/signup')) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/shopify/webhooks|api/cron|api/razorpay/webhook|api/meta/webhook).*)'],
}
