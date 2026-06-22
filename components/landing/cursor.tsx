'use client'

import { useEffect, useState } from 'react'
import { motion, useMotionValue, useSpring } from 'framer-motion'

export default function Cursor() {
  const [active, setActive] = useState(false)
  const [hovered, setHovered] = useState(false)

  const rawX = useMotionValue(-200)
  const rawY = useMotionValue(-200)

  const x = useSpring(rawX, { stiffness: 600, damping: 35 })
  const y = useSpring(rawY, { stiffness: 600, damping: 35 })

  const ringX = useSpring(rawX, { stiffness: 120, damping: 22 })
  const ringY = useSpring(rawY, { stiffness: 120, damping: 22 })

  useEffect(() => {
    // Only show on pointer:fine (mouse) devices
    if (!window.matchMedia('(pointer: fine)').matches) return
    setActive(true)
    document.body.classList.add('cursor-none-global')

    const move = (e: MouseEvent) => { rawX.set(e.clientX); rawY.set(e.clientY) }

    const onEnter = (e: Event) => {
      const t = e.target as HTMLElement
      if (t.closest('a, button, [role="button"], input, select, textarea')) setHovered(true)
    }
    const onLeave = (e: Event) => {
      const t = e.target as HTMLElement
      if (t.closest('a, button, [role="button"], input, select, textarea')) setHovered(false)
    }

    window.addEventListener('mousemove', move, { passive: true })
    document.addEventListener('mouseenter', onEnter, true)
    document.addEventListener('mouseleave', onLeave, true)
    return () => {
      window.removeEventListener('mousemove', move)
      document.removeEventListener('mouseenter', onEnter, true)
      document.removeEventListener('mouseleave', onLeave, true)
      document.body.classList.remove('cursor-none-global')
    }
  }, [rawX, rawY])

  if (!active) return null

  return (
    <>
      {/* Outer ring — lags behind */}
      <motion.div
        className="fixed top-0 left-0 rounded-full border border-[#25D366]/50 pointer-events-none mix-blend-difference"
        style={{
          x: ringX,
          y: ringY,
          translateX: '-50%',
          translateY: '-50%',
          width: hovered ? 48 : 32,
          height: hovered ? 48 : 32,
          transition: 'width 0.2s ease, height 0.2s ease',
          zIndex: 99999,
        }}
      />
      {/* Inner dot — instant */}
      <motion.div
        className="fixed top-0 left-0 rounded-full pointer-events-none"
        style={{
          x,
          y,
          translateX: '-50%',
          translateY: '-50%',
          width: hovered ? 6 : 5,
          height: hovered ? 6 : 5,
          background: '#25D366',
          boxShadow: '0 0 8px 2px rgba(37,211,102,0.6)',
          transition: 'width 0.15s ease, height 0.15s ease',
          zIndex: 99999,
        }}
      />
    </>
  )
}
