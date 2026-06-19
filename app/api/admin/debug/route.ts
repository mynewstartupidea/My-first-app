import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'vaibhavsin9574395@gmail.com'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const service = createServiceClient()

  // Test 1: can we call listUsers at all?
  const { data: listData, error: listError } = await service.auth.admin.listUsers({ page: 1, perPage: 5 })

  // Test 2: can we read user_profiles?
  const { data: profiles, error: profilesError, count: profileCount } = await service
    .from('user_profiles')
    .select('id, email, full_name', { count: 'exact' })
    .limit(5)

  // Test 3: env var presence (never log the actual key)
  const envCheck = {
    NEXT_PUBLIC_SUPABASE_URL:    !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY:   !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    supabase_url_value:          process.env.NEXT_PUBLIC_SUPABASE_URL?.slice(0, 40),
  }

  return NextResponse.json({
    env:           envCheck,
    listUsers: {
      error:       listError ? { message: listError.message, status: (listError as { status?: number }).status } : null,
      total:       (listData as { total?: number } | null)?.total ?? null,
      returned:    listData?.users?.length ?? 0,
      sample:      listData?.users?.slice(0, 3).map(u => ({ id: u.id, email: u.email, created_at: u.created_at })) ?? [],
    },
    userProfiles: {
      error:       profilesError?.message ?? null,
      count:       profileCount,
      sample:      profiles?.slice(0, 3) ?? [],
    },
  })
}
