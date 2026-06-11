'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { COURSES } from '@/lib/constants/courses'
import { fetchRiskCache, riskCacheLastUpdated, runRiskAnalysis } from '@/lib/ai/riskCache'
import {
  getRiskBadgeClasses,
  getRiskLabel,
  whatsappContactUrl,
  type RiskLevel,
  type StudentRiskProfile,
} from '@/lib/ai/studentRisk'
import { useManagement } from '@/components/layout/ManagementContext'
import type { CourseId, StudentLocation } from '@/types'

const RISK_COLORS = {
  high: '#EF4444',
  medium: '#F59E0B',
  low: '#3B82F6',
  'on-track': '#10B981',
}

function StatCard({
  label,
  value,
  accent,
  loading,
}: {
  label: string
  value: string
  accent?: string
  loading?: boolean
}) {
  return (
    <div className="rounded-xl border border-[#DDE3EC] bg-white p-4 dark:border-gray-600 dark:bg-gray-800">
      <p className="text-xs font-medium uppercase tracking-wide text-[#5A6A7A]">{label}</p>
      {loading ? (
        <div className="mt-2 h-8 w-16 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
      ) : (
        <p className={`mt-1 font-jakarta text-2xl font-bold ${accent ?? 'text-[#0B3D6B] dark:text-white'}`}>
          {value}
        </p>
      )}
    </div>
  )
}

function exportAtRiskCsv(profiles: StudentRiskProfile[]) {
  const rows = profiles.filter(
    (p) => p.riskLevel === 'high' || p.riskLevel === 'medium',
  )
  const header = [
    'Student',
    'Course',
    'Location',
    'Risk Level',
    'Score',
    'Flags',
    'Recommendation',
    'Attendance %',
    'Exam Avg',
    'Payment',
    'Days Inactive',
  ]
  const lines = rows.map((p) =>
    [
      p.studentName,
      p.course,
      p.location,
      p.riskLevel,
      p.riskScore,
      p.flags.join('; '),
      p.recommendation,
      p.attendancePercent,
      p.examAverage,
      p.paymentStatus,
      p.daysSinceLastLogin,
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(','),
  )
  const csv = [header.join(','), ...lines].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `epic-campus-at-risk-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function StudentRiskPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useManagement()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [profiles, setProfiles] = useState<StudentRiskProfile[]>([])
  const [riskFilter, setRiskFilter] = useState<RiskLevel | ''>('')
  const [courseFilter, setCourseFilter] = useState<CourseId | ''>('')
  const [locationFilter, setLocationFilter] = useState<StudentLocation | ''>('')

  useEffect(() => {
    if (authLoading) return
    if (!user) return
    if (user.role !== 'admin' && user.role !== 'owner') {
      router.replace('/dashboard')
    }
  }, [user, authLoading, router])

  const loadCache = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchRiskCache()
      setProfiles(data)
    } catch (err) {
      console.error('[StudentRiskPage] load', err)
      setProfiles([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (authLoading || !user || (user.role !== 'admin' && user.role !== 'owner')) return
    void loadCache()
  }, [authLoading, user, loadCache])

  async function handleRefresh() {
    setRefreshing(true)
    try {
      const updated = await runRiskAnalysis(async (atRisk) => {
        const res = await fetch('/api/student-risk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ profiles: atRisk }),
        })
        const data = (await res.json()) as {
          recommendations?: { studentId: string; recommendation: string }[]
        }
        const map = new Map<string, string>()
        for (const item of data.recommendations ?? []) {
          if (item.studentId && item.recommendation) {
            map.set(item.studentId, item.recommendation)
          }
        }
        return map
      })
      setProfiles(updated)
      toast.success(`Risk analysis updated for ${updated.length} students`)
    } catch (err) {
      console.error('[StudentRiskPage] refresh', err)
      toast.error('Something went wrong. Please try again.')
    } finally {
      setRefreshing(false)
    }
  }

  const lastUpdated = useMemo(() => riskCacheLastUpdated(profiles), [profiles])

  const counts = useMemo(() => {
    const c = { high: 0, medium: 0, low: 0, 'on-track': 0 }
    for (const p of profiles) c[p.riskLevel]++
    return c
  }, [profiles])

  const chartData = useMemo(() => {
    return COURSES.map((course) => {
      const courseProfiles = profiles.filter((p) => p.course === course.label)
      return {
        course: course.label,
        high: courseProfiles.filter((p) => p.riskLevel === 'high').length,
        medium: courseProfiles.filter((p) => p.riskLevel === 'medium').length,
        low: courseProfiles.filter((p) => p.riskLevel === 'low').length,
        onTrack: courseProfiles.filter((p) => p.riskLevel === 'on-track').length,
      }
    }).filter((row) => row.high + row.medium + row.low + row.onTrack > 0)
  }, [profiles])

  const filtered = useMemo(() => {
    return [...profiles]
      .filter((p) => {
        if (riskFilter && p.riskLevel !== riskFilter) return false
        if (courseFilter) {
          const label = COURSES.find((c) => c.id === courseFilter)?.label
          if (label && p.course !== label) return false
        }
        if (locationFilter && !p.location.toLowerCase().includes(locationFilter)) {
          return false
        }
        return true
      })
      .sort((a, b) => b.riskScore - a.riskScore)
  }, [profiles, riskFilter, courseFilter, locationFilter])

  if (authLoading || !user) {
    return (
      <div className="animate-pulse space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-xl bg-gray-200 dark:bg-gray-700" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-jakarta text-xl font-bold text-[#0D1B2A] sm:text-2xl dark:text-white">
            Student Risk Monitor
          </h1>
          <p className="mt-1 text-sm text-[#5A6A7A]">AI-powered early warning system</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => exportAtRiskCsv(profiles)}
            disabled={profiles.length === 0}
            className="inline-flex min-h-11 items-center justify-center rounded-lg border border-[#DDE3EC] px-4 py-2.5 text-sm font-semibold text-[#0B3D6B] hover:bg-[#F5F7FB] disabled:opacity-50 dark:border-gray-600 dark:text-white"
          >
            Export Report
          </button>
          <button
            type="button"
            onClick={() => void handleRefresh()}
            disabled={refreshing}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#E8A020] px-5 py-2.5 font-jakarta text-sm font-bold text-[#0B3D6B] hover:bg-[#F5B942] disabled:opacity-60"
          >
            {refreshing ? (
              <span className="ti ti-loader-2 animate-spin" aria-hidden="true" />
            ) : (
              <span className="ti ti-refresh" aria-hidden="true" />
            )}
            Refresh Analysis
          </button>
        </div>
      </div>

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="High risk"
          value={String(counts.high)}
          accent="text-red-600 dark:text-red-400"
          loading={loading}
        />
        <StatCard
          label="Medium risk"
          value={String(counts.medium)}
          accent="text-amber-600 dark:text-amber-400"
          loading={loading}
        />
        <StatCard
          label="On track"
          value={String(counts['on-track'])}
          accent="text-emerald-600 dark:text-emerald-400"
          loading={loading}
        />
        <StatCard
          label="Last updated"
          value={
            lastUpdated
              ? new Date(lastUpdated).toLocaleString('en-GB', {
                  day: '2-digit',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : 'Never'
          }
          loading={loading}
        />
      </section>

      <div className="rounded-xl border border-[#DDE3EC] bg-white p-5 dark:border-gray-600 dark:bg-gray-800">
        <h2 className="font-jakarta mb-4 text-base font-bold text-[#0B3D6B] dark:text-white">
          Risk by course
        </h2>
        {loading ? (
          <div className="h-64 animate-pulse rounded-lg bg-gray-200 dark:bg-gray-700" />
        ) : chartData.length === 0 ? (
          <div className="py-12 text-center">
            <span className="ti ti-chart-bar text-4xl text-gray-300 dark:text-gray-600" aria-hidden="true" />
            <p className="mt-3 font-semibold text-[#0B3D6B] dark:text-white">No analysis yet</p>
            <p className="mt-1 text-sm text-gray-500">
              Click Refresh Analysis to generate risk data for all students.
            </p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={288}>
            <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#DDE3EC" />
              <XAxis type="number" allowDecimals={false} />
              <YAxis type="category" dataKey="course" width={120} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="high" name="High" stackId="risk" fill={RISK_COLORS.high} />
              <Bar dataKey="medium" name="Watch" stackId="risk" fill={RISK_COLORS.medium} />
              <Bar dataKey="low" name="Low" stackId="risk" fill={RISK_COLORS.low} />
              <Bar dataKey="onTrack" name="On track" stackId="risk" fill={RISK_COLORS['on-track']} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <select
          value={riskFilter}
          onChange={(e) => setRiskFilter(e.target.value as RiskLevel | '')}
          className="min-h-11 rounded-lg border border-[#DDE3EC] bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
        >
          <option value="">All risk levels</option>
          <option value="high">High risk</option>
          <option value="medium">Watch</option>
          <option value="low">Low risk</option>
          <option value="on-track">On track</option>
        </select>
        <select
          value={courseFilter}
          onChange={(e) => setCourseFilter(e.target.value as CourseId | '')}
          className="min-h-11 rounded-lg border border-[#DDE3EC] bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
        >
          <option value="">All courses</option>
          {COURSES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
        <select
          value={locationFilter}
          onChange={(e) => setLocationFilter(e.target.value as StudentLocation | '')}
          className="min-h-11 rounded-lg border border-[#DDE3EC] bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
        >
          <option value="">All locations</option>
          <option value="ahangama">Ahangama</option>
          <option value="galle">Galle</option>
          <option value="waduraba">Waduraba</option>
          <option value="pinnaduwa">Pinnaduwa</option>
        </select>
      </div>

      <div className="overflow-hidden rounded-xl border border-[#DDE3EC] bg-white dark:border-gray-600 dark:bg-gray-800">
        {loading ? (
          <div className="animate-pulse space-y-3 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-14 rounded-lg bg-gray-200 dark:bg-gray-700" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <span className="ti ti-alert-triangle text-4xl text-gray-300 dark:text-gray-600" aria-hidden="true" />
            <p className="mt-3 font-semibold text-[#0B3D6B] dark:text-white">No students match filters</p>
            <p className="mt-1 text-sm text-gray-500">
              Run Refresh Analysis or adjust your filters.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <table className="w-full min-w-[960px] text-left text-sm">
              <thead>
                <tr className="border-b border-[#DDE3EC] bg-[#F5F7FB] dark:border-gray-600 dark:bg-gray-900">
                  {['Student', 'Course', 'Risk', 'Score', 'Flags', 'Recommendation', 'Actions'].map(
                    (h) => (
                      <th
                        key={h}
                        className="px-4 py-3 text-xs font-semibold uppercase text-[#5A6A7A]"
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const visibleFlags = p.flags.slice(0, 2)
                  const extra = p.flags.length - visibleFlags.length
                  return (
                    <tr
                      key={p.studentId}
                      className={`border-b border-[#DDE3EC] dark:border-gray-600 ${
                        p.riskLevel === 'high' ? 'bg-red-50/70 dark:bg-red-900/10' : ''
                      }`}
                    >
                      <td className="px-4 py-3 font-medium dark:text-white">{p.studentName}</td>
                      <td className="px-4 py-3 text-[#5A6A7A]">{p.course}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${getRiskBadgeClasses(p.riskLevel)}`}
                        >
                          {getRiskLabel(p.riskLevel)}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-semibold dark:text-white">{p.riskScore}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {visibleFlags.map((f) => (
                            <span
                              key={f}
                              className="rounded-full bg-[#F5F7FB] px-2 py-0.5 text-[10px] text-[#5A6A7A] dark:bg-gray-700"
                            >
                              {f}
                            </span>
                          ))}
                          {extra > 0 && (
                            <span className="rounded-full bg-[#F5F7FB] px-2 py-0.5 text-[10px] text-[#5A6A7A] dark:bg-gray-700">
                              +{extra} more
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="max-w-[200px] truncate px-4 py-3 italic text-[#5A6A7A]">
                        {p.recommendation}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          {p.studentMobile ? (
                            <a
                              href={whatsappContactUrl(
                                p.studentMobile,
                                p.studentName,
                                p.flags[0],
                              )}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex min-h-11 items-center rounded-lg bg-[#25D366] px-3 py-2 text-xs font-bold text-white"
                            >
                              Contact
                            </a>
                          ) : null}
                          <Link
                            href={`/students/${p.studentId}`}
                            className="inline-flex min-h-11 items-center rounded-lg border border-[#DDE3EC] px-3 py-2 text-xs font-semibold text-[#0B3D6B] dark:border-gray-600 dark:text-white"
                          >
                            View Profile
                          </Link>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
