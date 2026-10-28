// Shared between components/facebook-pixel.tsx (client) and lib/meta-capi.ts
// (server) — kept in its own file with zero other imports so neither side
// ever risks pulling the other's runtime (Node's crypto into the browser
// bundle, or next/script/next/navigation into an API route) in just for
// this one constant.
export const FB_PIXEL_ID = '1482890805828892'
