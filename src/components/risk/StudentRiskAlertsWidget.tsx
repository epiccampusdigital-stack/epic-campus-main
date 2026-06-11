'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { fetchRiskCache } from '@/lib/ai/riskCache'
import {
  getRiskBadgeClasses,
  getRiskLabel,
  stripFinancialFlags,
  whatsappContactUrl,
  type StudentRiskProfile,
} from '@/lib/ai/studentRisk'

interface StudentRiskAlertsWidgetProps {
  maxItems?: number
  showFinancialFlags?: boolean
  seeAllHref?: string
}

export default function StudentRiskAlertsWidget({
  maxItems = 5,
  showFinancialFlags = true,
  seeAllHref = '/admin/student-risk',
}: StudentRiskAlertsWidgetProps) {
  const [loading, setLoading] = useState(true)
  const [profiles, setProfiles] = useState<StudentRiskProfile[]>([])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const data = await fetchRiskCache()
        if (!cancelled) setProfiles(data)
      } catch (err) {
        console.error('[StudentRiskAlertsWidget]', err)
        if (!cancelled) setProfiles([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const highRisk = useMemo(
    () =>
      [...profiles]
        .filter((p) => p.riskLevel === 'high')
        .sort((a, b) => b.riskScore - a.riskScore),
    [profiles],
  )

  const visible = highRisk.slice(0, maxItems)

  return (
    <div className="rounded-xl border border-[#DDE3EC] bg-white p-5 dark:border-gray-600 dark:bg-gray-800">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div>
          <h3 className="font-jakarta text-base font-bold text-[#0B3D6B] dark:text-white">
            Student Risk Alerts
          </h3>
          <p className="mt-0.5 text-xs text-[#5A6A7A]">High-risk students from latest analysis</p>
        </div>
        {highRisk.length > maxItems && (
          <Link
            href={seeAllHref}
            className="shrink-0 text-xs font-semibold text-[#0B3D6B] hover:underline dark:text-[#E8A020]"
          >
            See all {highRisk.length}
          </Link>
        )}
      </div>

      {loading ? (
        <div className="animate-pulse space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-12 rounded-lg bg-gray-200 dark:bg-gray-700" />
          ))}
        </div>
      ) : highRisk.length === 0 ? (
        <p className="py-6 text-center text-sm font-medium text-emerald-700 dark:text-emerald-300">
          All students on track 🎉
        </p>
      ) : (
        <ul className="space-y-3">
          {visible.map((p) => {
            const flags = showFinancialFlags ? p.flags : stripFinancialFlags(p.flags)
            const topFlag = flags[0] ?? 'Needs attention'
            return (
              <li
                key={p.studentId}
                className="flex flex-col gap-2 rounded-lg border border-red-100 bg-red-50/60 p-3 sm:flex-row sm:items-center sm:justify-between dark:border-red-900/40 dark:bg-red-900/10"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-jakarta font-semibold text-[#0D1B2A] dark:text-white">
                      {p.studentName}
                    </span>
                    <span
                      className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${getRiskBadgeClasses(p.riskLevel)}`}
                    >
                      {getRiskLabel(p.riskLevel)}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-xs text-[#5A6A7A]">
                    {p.course} · {topFlag}
                  </p>
                </div>
                {p.studentMobile ? (
                  <a
                    href={whatsappContactUrl(p.studentMobile, p.studentName, topFlag)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg bg-[#25D366] px-3 py-2 text-xs font-bold text-white hover:bg-[#1da851]"
                  >
                    Contact
                  </a>
                ) : (
                  <Link
                    href={`/students/${p.studentId}`}
                    className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg border border-[#DDE3EC] px-3 py-2 text-xs font-semibold text-[#0B3D6B] dark:border-gray-600 dark:text-white"
                  >
                    View
                  </Link>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {highRisk.length > 0 && highRisk.length <= maxItems && (
        <Link
          href={seeAllHref}
          className="mt-4 block text-center text-xs font-semibold text-[#0B3D6B] hover:underline dark:text-[#E8A020]"
        >
          Open Student Risk Monitor →
        </Link>
      )}
    </div>
  )
}
