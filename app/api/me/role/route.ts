import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserRole } from '@/lib/get-user-role'

// GET /api/me/role — the signed-in user's role, for client components that need
// to adapt their UI (e.g. hiding owner/admin controls from a sales rep) but don't
// have it passed down from the server layout the way Sidebar does.
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = await getUserRole(user.id, user.email ?? '')
  return NextResponse.json({ role })
}
