'use client'

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

interface RevenueChartProps {
  data: { date: string; amount: number; label: string }[]
  loading?: boolean
}

function ChartSkeleton() {
  return <div className="h-72 animate-pulse rounded-lg bg-[#DDE3EC]" />
}

export default function RevenueChart({ data, loading }: RevenueChartProps) {
  if (loading) return <ChartSkeleton />

  if (data.length === 0) {
    return (
      <div className="flex h-72 items-center justify-center rounded-lg border border-dashed border-[#DDE3EC] text-sm text-[#5A6A7A]">
        No revenue data for this period
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={288}>
      <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#DDE3EC" />
        <XAxis
          dataKey="label"
          tick={{ fill: '#5A6A7A', fontSize: 11 }}
          tickLine={false}
          axisLine={{ stroke: '#DDE3EC' }}
        />
        <YAxis
          tick={{ fill: '#5A6A7A', fontSize: 11 }}
          tickLine={false}
          axisLine={{ stroke: '#DDE3EC' }}
          tickFormatter={(v: number) =>
            v >= 1000 ? `${Math.round(v / 1000)}k` : String(v)
          }
        />
        <Tooltip
          contentStyle={{
            borderRadius: 8,
            border: '1px solid #DDE3EC',
            fontSize: 13,
          }}
          formatter={(value) => [
            new Intl.NumberFormat('en-LK', {
              style: 'currency',
              currency: 'LKR',
              maximumFractionDigits: 0,
            }).format(Number(value ?? 0)),
            'Revenue',
          ]}
        />
        <Line
          type="monotone"
          dataKey="amount"
          stroke="#0B3D6B"
          strokeWidth={2.5}
          dot={{ fill: '#E8A020', strokeWidth: 2, r: 4 }}
          activeDot={{ r: 6, fill: '#E8A020' }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
