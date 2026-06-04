'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  fetchTeacherSessions,
  formatSessionDateTime,
  isUpcomingSession,
} from '@/lib/sessions/helpers'
import type { TeacherSession } from '@/types'

interface TeacherSessionsWidgetProps {
  teacherId: string
  teacherName: string
  limit?: number
}

export default function TeacherSessionsWidget({
  teacherId,
  limit = 3,
}: TeacherSessionsWidgetProps) {
  const [sessions, setSessions] = useState<TeacherSession[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setSessions(await fetchTeacherSessions(teacherId))
    } catch (err) {
      console.error('[TeacherSessionsWidget]', err)
      setSessions([])
    } finally {
      setLoading(false)
    }
  }, [teacherId])

  useEffect(() => {
    void load()
  }, [load])

  const upcoming = useMemo(
    () =>
      sessions
        .filter(isUpcomingSession)
        .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
        .slice(0, limit),
    [sessions, limit],
  )

  return (
    <section className="overflow-hidden rounded-xl border border-[#DDE3EC] bg-white dark:border-gray-600 dark:bg-gray-800">
      <div className="flex items-center justify-between border-b border-[#DDE3EC] px-5 py-4 dark:border-gray-600">
        <h2 className="font-jakarta text-base font-bold text-[#0D1B2A] dark:text-white">
          Upcoming sessions
        </h2>
        <Link href="/sessions" className="text-sm font-semibold text-[#0B3D6B] hover:text-[#E8A020]">
          View all →
        </Link>
      </div>
      {loading ? (
        <div className="animate-pulse space-y-3 p-5">
          {Array.from({ length: limit }).map((_, i) => (
            <div key={i} className="h-16 rounded-lg bg-[#DDE3EC]/60" />
          ))}
        </div>
      ) : upcoming.length === 0 ? (
        <p className="p-8 text-center text-sm text-[#5A6A7A]">No upcoming sessions scheduled.</p>
      ) : (
        <ul className="divide-y divide-[#DDE3EC] dark:divide-gray-600">
          {upcoming.map((s) => {
            const { date, time } = formatSessionDateTime(s.scheduledAt)
            return (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <div>
                  <p className="font-medium text-[#0D1B2A] dark:text-white">{s.studentName}</p>
                  <p className="text-sm text-[#5A6A7A]">{s.topic}</p>
                  <p className="mt-1 text-xs text-[#5A6A7A]">
                    {date} · {time} · {s.duration} min
                  </p>
                </div>
                <Link
                  href={`/sessions?start=${s.id}`}
                  className="rounded-lg bg-[#E8A020] px-4 py-2 text-xs font-bold text-[#0B3D6B] hover:bg-[#F5B942]"
                >
                  Start Session
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
