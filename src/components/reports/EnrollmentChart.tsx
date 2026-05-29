'use client'

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

interface EnrollmentChartProps {
  data: { course: string; fullName: string; count: number; fill: string }[]
  loading?: boolean
}

function ChartSkeleton() {
  return <div className="h-72 animate-pulse rounded-lg bg-[#DDE3EC]" />
}

export default function EnrollmentChart({ data, loading }: EnrollmentChartProps) {
  if (loading) return <ChartSkeleton />

  const hasData = data.some((d) => d.count > 0)
  if (!hasData) {
    return (
      <div className="flex h-72 items-center justify-center rounded-lg border border-dashed border-[#DDE3EC] text-sm text-[#5A6A7A]">
        No enrollment data yet
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={288}>
      <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#DDE3EC" vertical={false} />
        <XAxis
          dataKey="course"
          tick={{ fill: '#5A6A7A', fontSize: 10 }}
          tickLine={false}
          axisLine={{ stroke: '#DDE3EC' }}
          interval={0}
          angle={-20}
          textAnchor="end"
          height={60}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fill: '#5A6A7A', fontSize: 11 }}
          tickLine={false}
          axisLine={{ stroke: '#DDE3EC' }}
        />
        <Tooltip
          contentStyle={{
            borderRadius: 8,
            border: '1px solid #DDE3EC',
            fontSize: 13,
          }}
          formatter={(value, _name, item) => [
            Number(value ?? 0),
            (item as { payload?: { fullName?: string } }).payload?.fullName ?? 'Students',
          ]}
        />
        <Bar dataKey="count" radius={[6, 6, 0, 0]}>
          {data.map((entry) => (
            <Cell key={entry.fullName} fill={entry.fill} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
