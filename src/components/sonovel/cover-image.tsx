'use client'

import { useMemo, useState } from 'react'

// Deterministic gradient cover when no coverUrl
const PALETTES: [string, string, string][] = [
  ['#d97706', '#92400e', '#fbbf24'], // amber
  ['#059669', '#065f46', '#34d399'], // emerald
  ['#dc2626', '#7f1d1d', '#f87171'], // red
  ['#7c3aed', '#4c1d95', '#a78bfa'], // violet
  ['#0891b2', '#155e75', '#22d3ee'], // cyan
  ['#c026d3', '#701a75', '#e879f9'], // fuchsia
  ['#ea580c', '#7c2d12', '#fb923c'], // orange
  ['#65a30d', '#365314', '#a3e635'], // lime
  ['#4f46e5', '#312e81', '#818cf8'], // indigo (rare)
  ['#0d9488', '#134e4a', '#2dd4bf'], // teal
]

function hashString(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

export function CoverImage({
  title,
  coverUrl,
  className,
  rounded = 'rounded-lg',
}: {
  title: string
  coverUrl?: string | null
  className?: string
  rounded?: string
}) {
  const palette = useMemo(() => PALETTES[hashString(title) % PALETTES.length], [title])
  const initials = useMemo(() => {
    const t = title.trim()
    if (!t) return '?'
    return t.slice(0, 1).toUpperCase()
  }, [title])
  const [errored, setErrored] = useState(false)

  if (coverUrl && !errored) {
    return (
      <img
        src={coverUrl}
        alt={title}
        className={`${rounded} object-cover ${className || ''}`}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onError={() => setErrored(true)}
      />
    )
  }

  return (
    <div
      className={`${rounded} flex items-center justify-center overflow-hidden ${className || ''}`}
      style={{
        background: `linear-gradient(135deg, ${palette[0]} 0%, ${palette[1]} 100%)`,
      }}
      aria-label={`Bìa: ${title}`}
    >
      <div className="flex flex-col items-center justify-center text-center px-2">
        <span
          className="font-bold leading-none drop-shadow-lg"
          style={{ color: palette[2], fontSize: 'clamp(2rem, 8vw, 3.5rem)' }}
        >
          {initials}
        </span>
        <span
          className="mt-2 line-clamp-3 px-1 text-[10px] font-medium leading-tight"
          style={{ color: 'rgba(255,255,255,0.92)' }}
        >
          {title}
        </span>
      </div>
    </div>
  )
}
