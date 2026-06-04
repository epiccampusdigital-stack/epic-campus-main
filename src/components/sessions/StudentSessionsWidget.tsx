'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  fetchStudentSessions,
  formatSessionDateTime,
  isUpcomingSession,
  sessionStatusStyle,
} from '@/lib/sessions/helpers'
import type { TeacherSession } from '@/types'

interface StudentSessionsWidgetProps {
  studentId: string
}

export default function StudentSessionsWidget({ studentId }: StudentSessionsWidgetProps) {
  const [sessions, setSessions] = useState<TeacherSession[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setSessions(await fetchStudentSessions(studentId))
    } catch (err) {
      console.error('[StudentSessionsWidget]', err)
      setSessions([])
    } finally {
      setLoading(false)
    }
  }, [studentId])

  useEffect(() => {
    void load()
  }, [load])

  const upcoming = useMemo(
    () =>
      sessions
        .filter(isUpcomingSession)
        .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
        .slice(0, 3),
    [sessions],
  )

  const past = useMemo(
    () =>
      sessions
        .filter((s) => !isUpcomingSession(s))
        .sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt))
        .slice(0, 5),
    [sessions],
  )

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-xl border border-[#DDE3EC] bg-white">
        <div className="border-b border-[#DDE3EC] px-5 py-4">
          <h2 className="font-jakarta text-base font-bold text-[#0B3D6B]">Upcoming sessions</h2>
        </div>
        {loading ? (
          <div className="animate-pulse space-y-3 p-5">
            <div className="h-14 rounded bg-[#DDE3EC]/60" />
            <div className="h-14 rounded bg-[#DDE3EC]/60" />
          </div>
        ) : upcoming.length === 0 ? (
          <p className="p-6 text-center text-sm text-[#5A6A7A]">No upcoming sessions.</p>
        ) : (
          <ul className="divide-y divide-[#DDE3EC]">
            {upcoming.map((s) => {
              const { date, time } = formatSessionDateTime(s.scheduledAt)
              return (
                <li key={s.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-[#0D1B2A]">{s.teacherName}</p>
                      <p className="text-sm text-[#5A6A7A]">{s.topic}</p>
                      <p className="mt-1 text-xs text-[#5A6A7A]">
                        {date} · {time} · {s.duration} min
                      </p>
                    </div>
                    <span
                      className={`rounded-full border px-2.5 py-0.5 text-xs capitalize ${sessionStatusStyle(s.status)}`}
                    >
                      {s.status}
                    </span>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {!loading && past.length > 0 && (
        <section className="overflow-hidden rounded-xl border border-[#DDE3EC] bg-white">
          <div className="border-b border-[#DDE3EC] px-5 py-4">
            <h2 className="font-jakarta text-base font-bold text-[#0B3D6B]">Past sessions</h2>
          </div>
          <ul className="divide-y divide-[#DDE3EC]">
            {past.map((s) => {
              const { date, time } = formatSessionDateTime(s.scheduledAt)
              return (
                <li key={s.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-[#0D1B2A]">{s.teacherName}</p>
                      <p className="text-sm text-[#5A6A7A]">{s.topic}</p>
                      <p className="mt-1 text-xs text-[#5A6A7A]">
                        {date} · {time}
                      </p>
                      {s.notes && (
                        <p className="mt-2 rounded-lg bg-[#F5F7FB] px-3 py-2 text-sm text-[#0D1B2A]">
                          {s.notes}
                        </p>
                      )}
                    </div>
                    <span
                      className={`rounded-full border px-2.5 py-0.5 text-xs capitalize ${sessionStatusStyle(s.status)}`}
                    >
                      {s.status}
                    </span>
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </div>
  )
}
