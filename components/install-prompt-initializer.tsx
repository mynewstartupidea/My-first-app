'use client'

import { useEffect } from 'react'
import { initInstallPromptCapture } from '@/lib/install-prompt-store'

// Mounted once in app/dashboard/layout.tsx so the beforeinstallprompt
// listener is live from the first dashboard page a session touches, not
// just when InstallAppCard happens to be on screen. Renders nothing.
export default function InstallPromptInitializer() {
  useEffect(() => {
    initInstallPromptCapture()
  }, [])
  return null
}
