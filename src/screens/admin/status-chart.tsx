'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, Cell, ResponsiveContainer } from 'recharts'

const META = [
  { key: 'published', label: 'Đang ra', color: 'var(--chart-2)' },
  { key: 'completed', label: 'Hoàn thành', color: 'var(--chart-4)' },
  { key: 'draft', label: 'Nháp', color: 'var(--chart-1)' },
  { key: 'hidden', label: 'Ẩn', color: 'var(--chart-3)' },
]

export function StatusChart({ data }: { data: Record<string, number> }) {
  const chartData = META.map((m) => ({ name: m.label, value: data[m.key] ?? 0, fill: m.color }))
  return (
    <div className="h-44 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
          <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
          <Tooltip
            cursor={{ fill: 'var(--muted)' }}
            contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12, color: 'var(--foreground)' }}
          />
          <Bar dataKey="value" radius={[6, 6, 0, 0]}>
            {chartData.map((d, i) => <Cell key={i} fill={d.fill} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
