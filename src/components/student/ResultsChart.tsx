'use client'

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

interface ResultsChartProps {
  data: { attempt: string; score: number; label: string }[]
  loading?: boolean
}

export default function ResultsChart({ data, loading }: ResultsChartProps) {
  if (loading) return null

  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-[#5A6A7A]">
        Complete an exam to see your progress chart
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={256}>
      <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#DDE3EC" />
        <XAxis dataKey="attempt" tick={{ fill: '#5A6A7A', fontSize: 11 }} />
        <YAxis domain={[0, 100]} tick={{ fill: '#5A6A7A', fontSize: 11 }} />
        <Tooltip
          formatter={(value) => [Number(value ?? 0), 'Score']}
          labelFormatter={(_, payload) =>
            (payload?.[0]?.payload as { label?: string })?.label ?? ''
          }
        />
        <ReferenceLine y={80} stroke="#10b981" strokeDasharray="4 4" label={{ value: 'Pass', fill: '#10b981', fontSize: 10 }} />
        <Line
          type="monotone"
          dataKey="score"
          stroke="#0B3D6B"
          strokeWidth={2}
          dot={{ fill: '#E8A020', r: 4 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
