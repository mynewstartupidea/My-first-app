'use client'

import { usePathname } from 'next/navigation'

// Remounting the subtree on each route change (key=pathname) re-triggers the
// existing .animate-fade-in CSS animation, so new content eases in instead of
// snapping in — the difference between a page "loading" and a screen
// "opening". Pure CSS, no animation library, so no new bundle weight added
// to the dashboard. Keyed on pathname only (not search params), so filter/tab
// state changes via query strings don't re-trigger it.
export default function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  return (
    <div key={pathname} className="animate-fade-in">
      {children}
    </div>
  )
}
