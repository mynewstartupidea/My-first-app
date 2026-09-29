'use client'

import { LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function SignOutButton() {
  const supabase = createClient()

  async function handleSignOut() {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <button
      onClick={handleSignOut}
      className="flex items-center gap-3 w-full bg-white rounded-2xl border border-red-100 shadow-sm p-4 active:bg-red-50 transition"
    >
      <div className="w-9 h-9 bg-red-50 rounded-lg flex items-center justify-center flex-shrink-0">
        <LogOut className="w-4 h-4 text-red-500" />
      </div>
      <p className="text-sm font-semibold text-red-600">Sign out</p>
    </button>
  )
}
