'use client'

import { useEffect, useState, useCallback } from 'react'
import { UserCheck, Shield, Crown, Users, Plus, Trash2, Loader2, Mail } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

interface Member {
  id: string
  email: string
  role: string
  status: string
  invited_at: string | null
  joined_at: string | null
}

function timeAgo(d: string) {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000)
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

const ROLE_ICON: Record<string, React.ReactNode> = {
  owner:   <Crown size={12} className="text-amber-500" />,
  admin:   <Shield size={12} className="text-blue-500" />,
  manager: <Shield size={12} className="text-purple-500" />,
  support: <UserCheck size={12} className="text-emerald-500" />,
  member:  <Users size={12} className="text-slate-400" />,
}

const ROLE_COLORS: Record<string, string> = {
  owner:   'bg-amber-50 text-amber-700',
  admin:   'bg-blue-50 text-blue-700',
  manager: 'bg-purple-50 text-purple-700',
  support: 'bg-emerald-50 text-emerald-700',
  member:  'bg-slate-100 text-slate-600',
}

export default function TeamPage() {
  const [members,  setMembers]  = useState<Member[]>([])
  const [loading,  setLoading]  = useState(true)
  const [removing, setRemoving] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/team/members')
    const data = await res.json()
    setMembers(data.members ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function removeMember(id: string, email: string) {
    if (!confirm(`Remove ${email} from the team?`)) return
    setRemoving(id)
    await fetch('/api/team/members', {
      method:  'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ id }),
    })
    await load()
    setRemoving(null)
  }

  return (
    <div className="p-6 lg:p-8 max-w-4xl">
      <div className="flex items-center justify-between mb-7">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <UserCheck size={22} className="text-slate-700" /> Team
          </h1>
          <p className="text-slate-500 text-sm mt-1">Manage team members and their roles</p>
        </div>
        <Link href="/dashboard/settings?tab=team"
          className="flex items-center gap-2 bg-[#25D366] text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-[#1aad54] transition">
          <Plus size={15} /> Invite Member
        </Link>
      </div>

      {/* Role cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[
          { role: 'Admin',   desc: 'Full access, manage settings',  icon: Shield,    cls: 'text-blue-600 bg-blue-50' },
          { role: 'Manager', desc: 'Campaigns, automations, chats', icon: Shield,    cls: 'text-purple-600 bg-purple-50' },
          { role: 'Support', desc: 'Live chat and contacts only',   icon: UserCheck, cls: 'text-emerald-600 bg-emerald-50' },
          { role: 'Member',  desc: 'View-only access',              icon: Users,     cls: 'text-slate-600 bg-slate-100' },
        ].map(r => (
          <div key={r.role} className="bg-white rounded-2xl border border-slate-100 p-4">
            <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center mb-2', r.cls.split(' ')[1])}>
              <r.icon size={14} className={r.cls.split(' ')[0]} />
            </div>
            <p className="text-sm font-semibold text-slate-800">{r.role}</p>
            <p className="text-xs text-slate-500 mt-0.5">{r.desc}</p>
          </div>
        ))}
      </div>

      {/* Members table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-800">Team Members</h2>
          <span className="text-xs text-slate-400">{members.length} members</span>
        </div>

        {loading ? (
          <div className="py-16 flex items-center justify-center">
            <Loader2 size={22} className="animate-spin text-slate-300" />
          </div>
        ) : members.length === 0 ? (
          <div className="py-16 text-center">
            <Users size={32} className="text-slate-200 mx-auto mb-3" />
            <p className="font-medium text-slate-600">No team members yet</p>
            <p className="text-slate-400 text-sm mt-1">Invite your team to collaborate on WhatsApp campaigns</p>
            <Link href="/dashboard/settings?tab=team"
              className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-[#25D366] hover:underline">
              <Plus size={13} /> Invite first member
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            <div className="hidden lg:grid grid-cols-[1fr_160px_110px_100px_44px] gap-4 px-5 py-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wide bg-slate-50/50">
              <div>Member</div><div>Invited</div><div>Role</div><div>Status</div><div />
            </div>
            {members.map(m => (
              <div key={m.id} className="flex lg:grid lg:grid-cols-[1fr_160px_110px_100px_44px] items-center gap-4 px-5 py-4 hover:bg-slate-50/70 transition">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center text-slate-600 font-bold text-sm flex-shrink-0">
                    {m.email.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate flex items-center gap-1.5">
                      <Mail size={12} className="text-slate-400 flex-shrink-0" />
                      {m.email}
                    </p>
                    {m.joined_at && <p className="text-xs text-slate-400 ml-4">Joined {timeAgo(m.joined_at)}</p>}
                  </div>
                </div>
                <div className="hidden lg:block text-xs text-slate-500">
                  {m.invited_at ? timeAgo(m.invited_at) : '—'}
                </div>
                <div className="hidden lg:flex items-center gap-1.5">
                  {ROLE_ICON[m.role]}
                  <span className={cn('text-[11px] font-medium px-2 py-0.5 rounded-full capitalize', ROLE_COLORS[m.role] ?? ROLE_COLORS.member)}>
                    {m.role}
                  </span>
                </div>
                <div className="hidden lg:block">
                  <span className={cn('text-[11px] font-medium px-2 py-0.5 rounded-full capitalize',
                    m.status === 'active' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600')}>
                    {m.status}
                  </span>
                </div>
                <button
                  onClick={() => removeMember(m.id, m.email)}
                  disabled={removing === m.id}
                  className="hidden lg:flex items-center justify-center text-slate-400 hover:text-red-500 disabled:opacity-50 transition p-1 rounded-lg hover:bg-red-50">
                  {removing === m.id
                    ? <Loader2 size={14} className="animate-spin" />
                    : <Trash2 size={14} />}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
