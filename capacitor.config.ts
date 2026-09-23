import type { CapacitorConfig } from '@capacitor/cli'

// Remote-URL mode: this app is server-rendered (API routes, cookie-based Supabase
// auth, force-dynamic pages) and can't be statically exported the way Capacitor's
// default bundled-webDir mode expects. Instead the native shell loads the live,
// already-deployed site directly — same pattern used for wrapping any existing
// server-rendered web app as a native shell. `webDir` is still required by the
// Capacitor config schema even though nothing in it is actually rendered; it's
// only consulted for `npx cap sync`'s asset-copy step, not for what the app shows.
const config: CapacitorConfig = {
  appId: 'com.wapaci.app',
  appName: 'Wapaci',
  webDir: 'public',
  server: {
    url: 'https://app.wapaci.com',
    // The live site is already served over TLS — never allow a plaintext fallback.
    cleartext: false,
    // Keep Android's system status bar styling in sync with the site's own dark
    // header instead of the OS default, matching what the PWA manifest already sets.
    androidScheme: 'https',
  },
  android: {
    // On for now so chrome://inspect works while you're first building/testing this
    // in Android Studio. Flip to false before a production release build/submission.
    webContentsDebuggingEnabled: true,
  },
}

export default config
