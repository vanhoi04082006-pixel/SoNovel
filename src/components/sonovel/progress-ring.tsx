'use client'

// Reading progress ring — SVG circle với stroke-dashoffset animation
// Dùng trên StoryCard / StoryDetail để hiển thị % đã nghe

export function ProgressRing({
  percent,
  size = 36,
  strokeWidth = 3,
  className,
}: {
  percent: number // 0-100
  size?: number
  strokeWidth?: number
  className?: string
}) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const clamped = Math.max(0, Math.min(100, percent))
  const offset = circumference - (clamped / 100) * circumference

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={className}
      aria-label={`Đã nghe ${Math.round(clamped)}%`}
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        className="text-muted/40"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        className="text-primary progress-ring-circle"
        style={{
          transform: 'rotate(-90deg)',
          transformOrigin: '50% 50%',
          transition: 'stroke-dashoffset 0.35s ease',
        }}
      />
      <text
        x="50%"
        y="50%"
        dominantBaseline="central"
        textAnchor="middle"
        className="fill-foreground font-semibold"
        style={{ fontSize: size * 0.28 }}
      >
        {Math.round(clamped)}%
      </text>
    </svg>
  )
}
