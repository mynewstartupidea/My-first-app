'use client'

// Wapaci already ships a valid manifest.json + apple-mobile-web-app-capable
// meta tag (app/layout.tsx), so it's technically installable everywhere —
// nothing in the UI ever told anyone. This surfaces it per-platform:
//
// - Android / Desktop Chrome & Edge (incl. Chrome/Edge on a Mac): the browser
//   fires `beforeinstallprompt` when its own criteria are met; a click on our
//   button calls .prompt() on that captured event — one tap, native install
//   dialog, done.
// - iOS / iPadOS (Safari, and every other iOS browser — Apple forces them
//   all onto Safari's engine): there is NO API for a website to trigger
//   "Add to Home Screen" programmatically. Hard platform restriction, not a
//   gap here — every installable web app hits it. Shows the manual steps.
// - macOS Safari specifically does NOT support beforeinstallprompt at all
//   (unlike Chrome/Edge on the same machine), so it needs its own branch —
//   without this, a MacBook user on Safari (the default browser on every
//   Mac) would silently see nothing. Safari's own mechanism is File > Add to
//   Dock, added in macOS Sonoma (14+); older Safari/macOS has no equivalent,
//   and there's no reliable way to detect the exact OS version from
//   JavaScript anymore (Safari freezes it for privacy), so the copy hedges
//   rather than asserting it'll always be there.
// - Anything else (Firefox, or a browser that hasn't fired the event yet):
//   render nothing rather than show instructions that might not apply.

import { useEffect, useState } from 'react'
import { Download, Share, MousePointerClick, CheckCircle2 } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

type Platform = 'ios' | 'android' | 'mac-safari' | 'desktop'

export default function InstallAppCard() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [platform, setPlatform] = useState<Platform | null>(null)
  const [installed, setInstalled] = useState(false)
  const [installing, setInstalling] = useState(false)

  useEffect(() => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true
    setInstalled(standalone)

    const ua = navigator.userAgent
    const isIPad = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1 // iPadOS 13+ reports as Mac
    const isIOS = /iPad|iPhone|iPod/.test(ua) || isIPad
    const isAndroid = /Android/.test(ua)
    // "Safari" appears in Chrome/Edge's UA too — exclude those explicitly.
    const isSafariEngine = /^((?!chrome|android|crios|edg).)*safari/i.test(ua)
    const isMacSafari = !isIOS && /Macintosh/.test(ua) && isSafariEngine

    const detectedPlatform: Platform = isIOS ? 'ios' : isAndroid ? 'android' : isMacSafari ? 'mac-safari' : 'desktop'
    setPlatform(detectedPlatform)

    const onPrompt = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }
    const onInstalled = () => { setInstalled(true); setDeferredPrompt(null) }

    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    setInstalling(true)
    try {
      await deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      if (outcome === 'accepted') setInstalled(true)
    } finally {
      setDeferredPrompt(null)
      setInstalling(false)
    }
  }

  if (platform === null) return null // not yet determined client-side — avoids a flash

  if (installed) {
    return (
      <div className="flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-100 rounded-xl">
        <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
        <p className="text-sm text-emerald-800 font-medium">Wapaci is installed on this device</p>
      </div>
    )
  }

  if (deferredPrompt) {
    return (
      <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl">
        <div className="w-10 h-10 bg-[#25D366]/10 rounded-xl flex items-center justify-center flex-shrink-0">
          <Download className="w-5 h-5 text-[#25D366]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-slate-800 text-sm">Install Wapaci as an app</p>
          <p className="text-slate-400 text-xs mt-0.5">
            {platform === 'android' ? 'Launch instantly from your home screen, no browser tabs' : 'Launch instantly from your desktop, no browser tabs'}
          </p>
        </div>
        <button
          onClick={handleInstall}
          disabled={installing}
          className="flex-shrink-0 text-xs font-semibold text-white bg-[#25D366] hover:bg-[#1aad54] disabled:opacity-60 px-3.5 py-2 rounded-lg transition"
        >
          {installing ? 'Installing…' : 'Install'}
        </button>
      </div>
    )
  }

  if (platform === 'ios') {
    return (
      <div className="p-4 bg-slate-50 rounded-xl">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-[#25D366]/10 rounded-xl flex items-center justify-center flex-shrink-0">
            <Share className="w-4.5 h-4.5 text-[#25D366]" />
          </div>
          <p className="font-medium text-slate-800 text-sm">Add Wapaci to your Home Screen</p>
        </div>
        <p className="text-slate-500 text-xs leading-relaxed">
          Tap the <span className="font-semibold text-slate-700">Share</span> icon in Safari, then{' '}
          <span className="font-semibold text-slate-700">Add to Home Screen</span>. Apple only allows this manually — no app can trigger it for you.
        </p>
      </div>
    )
  }

  if (platform === 'mac-safari') {
    return (
      <div className="p-4 bg-slate-50 rounded-xl">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-[#25D366]/10 rounded-xl flex items-center justify-center flex-shrink-0">
            <MousePointerClick className="w-4.5 h-4.5 text-[#25D366]" />
          </div>
          <p className="font-medium text-slate-800 text-sm">Add Wapaci to your Dock</p>
        </div>
        <p className="text-slate-500 text-xs leading-relaxed">
          In Safari's menu bar, go to <span className="font-semibold text-slate-700">File → Add to Dock</span>. Safari doesn't let websites trigger this — if you're on an older macOS without that option, Chrome or Edge on this same Mac can install Wapaci directly instead.
        </p>
      </div>
    )
  }

  // No beforeinstallprompt (yet, or unsupported browser) and not iOS/mac-safari
  // — nothing reliable to show rather than instructions that might not apply.
  return null
}
