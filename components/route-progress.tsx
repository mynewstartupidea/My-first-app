'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'

// Measured the actual nav timing on this app: tapping a nav link left the OLD
// screen completely frozen for 700-800ms before jump-cutting straight to the
// new one — no loading.tsx skeleton in between, because most dashboard pages
// are 'use client' components that fetch their own data after mount, so
// Next's Suspense fallback doesn't reliably cover the gap. A frozen tap
// followed by a jump-cut is exactly what makes a page feel like a website
// instead of an app, so this gives guaranteed instant feedback on tap,
// independent of how Next schedules the actual transition underneath it.
export default function RouteProgress() {
  const pathname = usePathname()
  const [active, setActive] = useState(false)
  const prevPathname = useRef(pathname)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const anchor = (e.target as HTMLElement | null)?.closest?.('a')
      if (!anchor) return
      const href = anchor.getAttribute('href')
      if (!href || !href.startsWith('/') || anchor.target === '_blank') return
      if (href === pathname) return
      setActive(true)
    }
    // Capture phase, not bubble: next/link's own onClick (which calls
    // preventDefault to stop the browser's native navigation) runs during the
    // bubble phase and fires before a bubble-phase document listener ever
    // sees the event, at which point e.defaultPrevented is already true.
    // Capture runs on the way down, ahead of that, so this always sees it.
    document.addEventListener('click', handleClick, true)
    return () => document.removeEventListener('click', handleClick, true)
  }, [pathname])

  useEffect(() => {
    if (prevPathname.current !== pathname) {
      prevPathname.current = pathname
      setActive(false)
    }
  }, [pathname])

  if (!active) return null
  return (
    <div className="fixed top-0 left-0 right-0 z-[60] h-[3px] pointer-events-none">
      <div className="h-full w-full bg-[#25D366] animate-route-progress origin-left" />
    </div>
  )
}
