'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

// A plain <select>'s open-state dropdown is rendered entirely by the OS/
// browser, not CSS — on mobile that shows up as an unstyled native overlay
// that clashes with everything else on a custom-built page, and can open in
// whichever direction the browser picks, sometimes covering the field above
// it. This is the shared replacement: a button + absolute-positioned menu,
// fully styled, same pattern already used in a few places in this app
// (e.g. leads/page.tsx's PageDropdown) before this existed as one component.
export interface SelectOption {
  value: string
  label: string
}

interface CustomSelectProps {
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  placeholder?: string
  className?: string
  buttonClassName?: string
  compact?: boolean
  disabled?: boolean
  // The admin dashboard uses a dark theme (bg-white/5, white text) — the
  // default light styling would clash there same as a native <select> did
  // everywhere else, just inverted.
  dark?: boolean
}

export default function CustomSelect({
  value, onChange, options, placeholder = 'Select…', className, buttonClassName, compact = false, disabled = false, dark = false,
}: CustomSelectProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const selected = options.find(o => o.value === value)

  return (
    <div className={cn('relative', className)} ref={ref}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(o => !o)}
        className={cn(
          'w-full flex items-center justify-between gap-2 rounded-xl focus:outline-none focus:ring-2 transition disabled:opacity-50 disabled:cursor-not-allowed',
          compact ? 'px-2.5 py-1.5 text-sm' : 'px-3 py-2.5 text-base',
          dark
            ? 'bg-white/5 border border-white/10 focus:ring-[#25D366]'
            : 'bg-white border border-slate-200 focus:ring-[#25D366]',
          buttonClassName,
        )}
      >
        <span className={cn(
          'truncate text-left',
          selected ? (dark ? 'text-white' : 'text-slate-900') : (dark ? 'text-slate-500' : 'text-slate-400')
        )}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown className={cn('w-4 h-4 flex-shrink-0 transition-transform', dark ? 'text-slate-500' : 'text-slate-400', open && 'rotate-180')} />
      </button>
      {open && (
        <div className={cn(
          'absolute z-20 top-full mt-1.5 w-full min-w-max rounded-xl shadow-lg overflow-hidden py-1 max-h-64 overflow-y-auto',
          dark ? 'bg-[#0a0f1e] border border-white/10' : 'bg-white border border-slate-200'
        )}>
          {options.map(o => (
            <button
              key={o.value}
              type="button"
              onClick={() => { onChange(o.value); setOpen(false) }}
              className={cn(
                'block w-full px-4 py-2.5 text-left text-sm transition whitespace-nowrap',
                o.value === value
                  ? (dark ? 'bg-[#25D366]/10 text-[#25D366] font-medium' : 'bg-[#25D366]/5 text-[#128C7E] font-medium')
                  : (dark ? 'text-slate-300 hover:bg-white/5' : 'text-slate-700 hover:bg-slate-50'),
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
