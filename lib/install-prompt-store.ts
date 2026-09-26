'use client'

// beforeinstallprompt fires once, early, the moment the browser decides the
// page qualifies for installation — not when any particular UI is clicked.
// Previously InstallAppCard registered its own listener, but it only mounts
// on the More/Settings pages; if the event fired earlier (landing on the
// Dashboard, Leads, anywhere else first), nothing was listening yet, so
// preventDefault() never ran and the browser's own native install banner
// showed up on its own — which reads as "it started installing by itself"
// even though no button was involved. Capturing this as a module-level
// singleton, initialized once from the dashboard layout (so it's live from
// the very first page of any session), means our own "Get App" button is
// the only thing that can ever actually trigger the prompt.

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let capturedPrompt: BeforeInstallPromptEvent | null = null
let installed = false
const listeners = new Set<() => void>()

function notify() {
  for (const fn of listeners) fn()
}

export function initInstallPromptCapture() {
  if (typeof window === 'undefined') return
  const w = window as unknown as { __wapaciInstallCaptureInit?: boolean }
  if (w.__wapaciInstallCaptureInit) return // Strict Mode / remounts shouldn't double-register
  w.__wapaciInstallCaptureInit = true

  installed =
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    capturedPrompt = e as BeforeInstallPromptEvent
    notify()
  })
  window.addEventListener('appinstalled', () => {
    installed = true
    capturedPrompt = null
    notify()
  })
}

// useSyncExternalStore requires getSnapshot to return a STABLE reference when
// nothing has actually changed — a fresh object literal on every call (as
// this used to do) makes React see a "new" snapshot on every render, which
// throws an infinite-loop error and crashes any page rendering InstallAppCard.
let cachedSnapshot: { prompt: BeforeInstallPromptEvent | null; installed: boolean } = { prompt: null, installed: false }

export function getSnapshot() {
  if (cachedSnapshot.prompt !== capturedPrompt || cachedSnapshot.installed !== installed) {
    cachedSnapshot = { prompt: capturedPrompt, installed }
  }
  return cachedSnapshot
}

export function subscribe(onChange: () => void) {
  listeners.add(onChange)
  return () => listeners.delete(onChange)
}

export function clearCapturedPrompt() {
  capturedPrompt = null
  notify()
}

export function markInstalled() {
  installed = true
  capturedPrompt = null
  notify()
}
