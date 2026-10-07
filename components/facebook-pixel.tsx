'use client'

import Script from 'next/script'
import { usePathname } from 'next/navigation'

export const FB_PIXEL_ID = '1482890805828892'

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void
  }
}

// Mounted once in app/layout.tsx so every public page shares one pixel
// session/cookie (_fbp) — that's what lets Meta attribute a later
// conversion (e.g. signing up on /signup) back to whichever ad/landing
// page the visitor actually arrived from, rather than needing the
// click-to-submit to happen on the same page. Excluded from /dashboard and
// /admin: those are the authenticated product, not a marketing surface —
// there's no ad to attribute a logged-in user's session back to.
//
// Individual pages fire their own conversion events (e.g.
// window.fbq?.('track', 'Lead') right when a form submission succeeds) —
// this component only handles loading the library and firing PageView.
const EXCLUDED_PREFIXES = ['/dashboard', '/admin']

export default function FacebookPixel() {
  const pathname = usePathname()
  if (EXCLUDED_PREFIXES.some(p => pathname?.startsWith(p))) return null

  return (
    <Script id="fb-pixel" strategy="afterInteractive" dangerouslySetInnerHTML={{
      __html: `
        !function(f,b,e,v,n,t,s)
        {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
        n.callMethod.apply(n,arguments):n.queue.push(arguments)};
        if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
        n.queue=[];t=b.createElement(e);t.async=!0;
        t.src=v;s=b.getElementsByTagName(e)[0];
        s.parentNode.insertBefore(t,s)}(window, document,'script',
        'https://connect.facebook.net/en_US/fbevents.js');
        fbq('init', '${FB_PIXEL_ID}');
        fbq('track', 'PageView');
      `,
    }} />
  )
}
