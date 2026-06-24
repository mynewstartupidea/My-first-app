import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export default async function proxy(request: NextRequest) {
  const host       = request.headers.get('host') ?? ''
  const hostname   = host.split(':')[0]
  const { pathname } = request.nextUrl

  const isPublicDomain = hostname === 'wapaci.com' || hostname === 'www.wapaci.com'
  const isAppRoute =
    pathname === '/login' ||
    pathname === '/signup' ||
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/onboarding') ||
    pathname.startsWith('/auth') ||
    pathname.startsWith('/shopify') ||
    pathname.startsWith('/api/shopify')

  // ── Public domain app routes → app subdomain ──────────────────────────────
  // Marketing pages stay on wapaci.com/www; authenticated app flows use one
  // canonical host so cookies and redirects cannot bounce between domains.
  if (isPublicDomain && isAppRoute) {
    const url = request.nextUrl.clone()
    url.hostname = 'app.wapaci.com'
    url.protocol = 'https'
    return NextResponse.redirect(url)
  }

  // ── Admin domain — route EVERYTHING to /admin/* ────────────────────────────
  if (hostname === 'admin.wapaci.com') {
    // Public: admin login page
    if (pathname === '/login' || pathname === '/admin/login') {
      return NextResponse.rewrite(new URL('/admin/login', request.url))
    }
    // Root → /admin
    if (pathname === '/') {
      return NextResponse.redirect(new URL('/admin', request.url))
    }
    // API routes must not be prefixed — they live at /api/* on all domains
    if (!pathname.startsWith('/admin') && !pathname.startsWith('/api')) {
      return NextResponse.rewrite(new URL(`/admin${pathname}`, request.url))
    }
    // Falls through to auth check below
  }

  // ── App domain — redirect root to /login ──────────────────────────────────
  if (hostname === 'app.wapaci.com' && pathname === '/') {
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

  // getSession reads the JWT from cookies — no network call, works reliably on edge.
  // Route handlers and server components use getUser() for actual data-level security.
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user ?? null

  // ── Admin routes: require the configured admin email ──────────────────────
  const adminEmail = process.env.ADMIN_EMAIL ?? 'vaibhavsin9574395@gmail.com'
  if (pathname.startsWith('/admin') && !pathname.startsWith('/admin/login')) {
    if (!user || user.email !== adminEmail) {
      return NextResponse.redirect(new URL('/admin/login', request.url))
    }
  }

  // ── App routes: require any authenticated user ─────────────────────────────
  if (!user && (pathname.startsWith('/dashboard') || pathname.startsWith('/onboarding'))) {
    const returnTo = request.nextUrl.pathname + request.nextUrl.search
    return NextResponse.redirect(new URL(`/login?returnTo=${encodeURIComponent(returnTo)}`, request.url))
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
