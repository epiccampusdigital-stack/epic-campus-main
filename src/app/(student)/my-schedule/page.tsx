'use client'

import { useEffect, useState } from 'react'
import { collection, getDocs, orderBy, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { useStudentPortal } from '@/components/student/StudentContext'

type SessionType = 'class' | 'exam' | 'workshop' | 'other'

interface Session {
  id: string
  title: string
  date: string
  startTime: string
  endTime: string
  type: SessionType
  location: string
  teacherName: string
  courseId: string
  notes: string
}

const TYPE_COLORS: Record<SessionType, string> = {
  class: 'bg-[#0B3D6B]/10 text-[#0B3D6B] dark:bg-[#0B3D6B]/30 dark:text-blue-300',
  exam: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  workshop: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  other: 'bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-white/60',
}

const TYPE_ICONS: Record<SessionType, string> = {
  class: 'ti-book',
  exam: 'ti-pencil',
  workshop: 'ti-tools',
  other: 'ti-calendar',
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

function isToday(dateStr: string): boolean {
  return dateStr === new Date().toISOString().slice(0, 10)
}

export default function MySchedulePage() {
  const { student } = useStudentPortal()
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'upcoming' | 'past' | 'all'>('upcoming')

  useEffect(() => {
    if (!student) return
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const snap = await getDocs(
          query(
            collection(db, 'sessions'),
            where('courseId', '==', student!.courseId),
            orderBy('date', 'asc'),
          ),
        ).catch(async () => {
          return getDocs(
            query(collection(db, 'sessions'), orderBy('date', 'asc')),
          )
        })
        if (!cancelled) {
          setSessions(
            snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Session, 'id'>) })),
          )
        }
      } catch (err) {
        console.error('[MySchedule]', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [student])

  const today = new Date().toISOString().slice(0, 10)

  const filtered = sessions.filter((s) => {
    if (filter === 'upcoming') return s.date >= today
    if (filter === 'past') return s.date < today
    return true
  })

  const grouped = filtered.reduce<Record<string, Session[]>>((acc, s) => {
    if (!acc[s.date]) acc[s.date] = []
    acc[s.date].push(s)
    return acc
  }, {})

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 w-48 rounded bg-[#DDE3EC] dark:bg-white/10" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-2xl bg-[#DDE3EC] dark:bg-white/10" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-jakarta text-2xl font-bold text-[#0D1B2A] dark:text-white">
          My Schedule
        </h1>
        <p className="text-sm text-[#5A6A7A] dark:text-white/50">
          Classes, exams and workshops
        </p>
      </div>

      <div className="flex gap-2">
        {(['upcoming', 'past', 'all'] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold capitalize transition-all ${
              filter === f
                ? 'bg-[#E8A020] text-white'
                : 'border border-[#DDE3EC] dark:border-white/20 bg-white dark:bg-white/[0.04] text-[#5A6A7A] dark:text-white/60'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {Object.keys(grouped).length === 0 ? (
        <div className="rounded-2xl border border-[#DDE3EC] dark:border-white/[0.08] bg-white dark:bg-white/[0.04] py-16 text-center">
          <span className="ti ti-calendar-off text-4xl text-[#DDE3EC] dark:text-white/20" />
          <p className="mt-3 text-sm text-[#5A6A7A] dark:text-white/50">
            {filter === 'upcoming' ? 'No upcoming sessions scheduled' : 'No sessions found'}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([date, daySessions]) => (
            <div key={date}>
              <div className={`mb-3 flex items-center gap-2 ${
                isToday(date) ? 'text-[#E8A020]' : 'text-[#5A6A7A] dark:text-white/50'
              }`}>
                {isToday(date) && (
                  <span className="rounded-full bg-[#E8A020] px-2 py-0.5 text-[10px] font-bold text-white">
                    TODAY
                  </span>
                )}
                <span className="text-sm font-semibold">{formatDate(date)}</span>
              </div>
              <div className="space-y-3">
                {daySessions.map((s) => (
                  <div
                    key={s.id}
                    className={`rounded-2xl border bg-white dark:bg-white/[0.04] p-4 transition-all ${
                      isToday(date)
                        ? 'border-[#E8A020]/40 shadow-sm'
                        : 'border-[#DDE3EC] dark:border-white/[0.08]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${TYPE_COLORS[s.type ?? 'class']}`}>
                          <span className={`ti ${TYPE_ICONS[s.type ?? 'class']} text-base`} />
                        </div>
                        <div>
                          <p className="font-semibold text-[#0D1B2A] dark:text-white">
                            {s.title}
                          </p>
                          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#5A6A7A] dark:text-white/50">
                            {s.startTime && (
                              <span className="flex items-center gap-1">
                                <span className="ti ti-clock" />
                                {s.startTime}{s.endTime ? ` — ${s.endTime}` : ''}
                              </span>
                            )}
                            {s.location && (
                              <span className="flex items-center gap-1">
                                <span className="ti ti-map-pin" />
                                {s.location}
                              </span>
                            )}
                            {s.teacherName && (
                              <span className="flex items-center gap-1">
                                <span className="ti ti-user" />
                                {s.teacherName}
                              </span>
                            )}
                          </div>
                          {s.notes && (
                            <p className="mt-1.5 text-xs text-[#5A6A7A] dark:text-white/40">
                              {s.notes}
                            </p>
                          )}
                        </div>
                      </div>
                      <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-semibold capitalize ${TYPE_COLORS[s.type ?? 'class']}`}>
                        {s.type ?? 'class'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
