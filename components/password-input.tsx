'use client'

import { useState, forwardRef } from 'react'
import { Eye, EyeOff } from 'lucide-react'

// Drop-in replacement for <input type="password">, used wherever a
// password/new-password/confirm-password field appears across signup and
// login — same props, same className (the eye button is just overlaid via
// a relative wrapper, extra right padding added so typed text never runs
// under it). tabIndex={-1} on the toggle keeps Tab moving through the real
// form fields instead of stopping on it.
const PasswordInput = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function PasswordInput({ className, ...props }, ref) {
    const [show, setShow] = useState(false)
    return (
      <div className="relative">
        <input
          {...props}
          ref={ref}
          type={show ? 'text' : 'password'}
          className={`${className ?? ''} pr-11`}
        />
        <button
          type="button"
          onClick={() => setShow(s => !s)}
          tabIndex={-1}
          aria-label={show ? 'Hide password' : 'Show password'}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
        >
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    )
  }
)

export default PasswordInput
