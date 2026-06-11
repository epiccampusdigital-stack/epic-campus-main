'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { fetchRiskCache } from '@/lib/ai/riskCache'
import {
  stripFinancialFlags,
  whatsappContactUrl,
  getRiskBadgeClasses,
  getRiskLabel,
  type StudentRiskProfile,
} from '@/lib/ai/studentRisk'
import { parseTeacherSession } from '@/lib/sessions/helpers'

interface TeacherRiskWatchWidgetProps {
  teacherId: string
  maxItems?: number
}

export default function TeacherRiskWatchWidget({
  teacherId,
  maxItems = 5,
}: TeacherRiskWatchWidgetProps) {
  const [loading, setLoading] = useState(true)
  const [profiles, setProfiles] = useState<StudentRiskProfile[]>([])
  const [teacherStudentIds, setTeacherStudentIds] = useState<Set<string>>(new Set())

  const loadTeacherStudents = useCallback(async () => {
    try {
      const snap = await getDocs(
        query(collection(db, 'sessions'), where('teacherId', '==', teacherId)),
      )
      const ids = new Set<string>()
      for (const d of snap.docs) {
        const session = parseTeacherSession(d.id, d.data() as Record<string, unknown>)
        if (session.studentId) ids.add(session.studentId)
      }
      setTeacherStudentIds(ids)
    } catch (err) {
      console.error('[TeacherRiskWatchWidget] sessions', err)
      setTeacherStudentIds(new Set())
    }
  }, [teacherId])

  useEffect(() => {
    void loadTeacherStudents()
  }, [loadTeacherStudents])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const data = await fetchRiskCache()
        if (!cancelled) setProfiles(data)
      } catch (err) {
        console.error('[TeacherRiskWatchWidget]', err)
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

  const watchList = useMemo(() => {
    return [...profiles]
      .filter((p) => {
        if (p.riskLevel !== 'high' && p.riskLevel !== 'medium') return false
        if (teacherStudentIds.size === 0) return true
        return teacherStudentIds.has(p.studentId)
      })
      .sort((a, b) => b.riskScore - a.riskScore)
      .slice(0, maxItems)
  }, [profiles, teacherStudentIds, maxItems])

  return (
    <div className="rounded-xl border border-[#DDE3EC] bg-white p-5 dark:border-gray-600 dark:bg-gray-800">
      <div className="mb-4">
        <h3 className="font-jakarta text-base font-bold text-[#0B3D6B] dark:text-white">
          Students to Watch
        </h3>
        <p className="mt-0.5 text-xs text-[#5A6A7A]">
          High and medium risk from your sessions — no financial details shown
        </p>
      </div>

      {loading ? (
        <div className="animate-pulse space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-12 rounded-lg bg-gray-200 dark:bg-gray-700" />
          ))}
        </div>
      ) : watchList.length === 0 ? (
        <p className="py-6 text-center text-sm text-[#5A6A7A]">
          No students flagged for your sessions right now.
        </p>
      ) : (
        <ul className="space-y-3">
          {watchList.map((p) => {
            const flags = stripFinancialFlags(p.flags)
            const topFlag = flags[0] ?? 'Needs follow-up'
            return (
              <li
                key={p.studentId}
                className="flex flex-col gap-2 rounded-lg border border-amber-100 bg-amber-50/50 p-3 sm:flex-row sm:items-center sm:justify-between dark:border-amber-900/30 dark:bg-amber-900/10"
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
                  {p.recommendation && (
                    <p className="mt-1 truncate text-xs italic text-[#5A6A7A]">
                      {p.recommendation}
                    </p>
                  )}
                </div>
                {p.studentMobile ? (
                  <a
                    href={whatsappContactUrl(p.studentMobile, p.studentName, topFlag)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg bg-[#25D366] px-3 py-2 text-xs font-bold text-white hover:bg-[#1da851]"
                  >
                    Contact Student
                  </a>
                ) : (
                  <Link
                    href={`/students/${p.studentId}`}
                    className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg border border-[#DDE3EC] px-3 py-2 text-xs font-semibold text-[#0B3D6B] dark:border-gray-600 dark:text-white"
                  >
                    View Profile
                  </Link>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
