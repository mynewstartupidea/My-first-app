// Shown instantly the moment a dashboard nav link is tapped, while the next
// page's server data is still in flight — without this, Next.js has no
// Suspense fallback here, so a tap just sits frozen until the full response
// lands, which reads as a slow website rather than an app. This wraps every
// route under /dashboard (Sidebar/MobileHeader/MobileBottomNav live in the
// persisted layout above {children}, so only the content area pulses).
export default function DashboardLoading() {
  return (
    <div className="p-4 md:p-6 lg:p-8 animate-pulse">
      <div className="h-3 w-24 bg-slate-200 rounded-full mb-3" />
      <div className="h-7 w-48 bg-slate-200 rounded-lg mb-6" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white rounded-2xl p-4 md:p-5 h-[110px] md:h-[128px]">
            <div className="h-3 w-16 bg-slate-100 rounded-full mb-4" />
            <div className="h-6 w-10 bg-slate-100 rounded-md" />
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl p-5 h-64" />
        <div className="bg-white rounded-2xl p-5 h-64" />
      </div>
    </div>
  )
}
