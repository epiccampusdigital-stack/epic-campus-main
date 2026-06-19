'use client'

import { useEffect, useState } from 'react'
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { useStudentPortal } from '@/components/student/StudentContext'
import Link from 'next/link'

export default function MySchedulePage() {
  const { student } = useStudentPortal()
  const [sessions, setSessions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!student) return
    let cancelled = false
    async function load() {
      try {
        const snap = await getDocs(
          query(
            collection(db, 'sessions'),
            where('studentIds', 'array-contains', student!.id),
            orderBy('date', 'asc')
          )
        ).catch(() => ({ docs: [] as any[] }))
        if (!cancelled) {
          setSessions(snap.docs.map((d: any) => ({ id: d.id, ...d.data() })))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [student])

  if (loading) return (
    <div className="animate-pulse space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-20 rounded-2xl bg-[#DDE3EC] dark:bg-white/10" />
      ))}
    </div>
  )

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-jakarta text-2xl font-bold text-[#0D1B2A] dark:text-white">
          My Schedule
        </h1>
        <p className="text-sm text-[#5A6A7A] dark:text-white/50">
          Upcoming classes and sessions
        </p>
      </div>

      {sessions.length === 0 ? (
        <div className="rounded-2xl border border-[#DDE3EC] dark:border-white/[0.08] bg-white dark:bg-white/[0.04] py-16 text-center">
          <span className="ti ti-calendar-off text-4xl text-[#DDE3EC] dark:text-white/20" />
          <p className="mt-3 text-sm text-[#5A6A7A] dark:text-white/50">
            No upcoming sessions scheduled
          </p>
          <Link
            href="/book-consultation"
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#E8A020] px-5 py-2.5 text-sm font-bold text-[#0B3D6B]"
          >
            <span className="ti ti-calendar-plus" />
            Book a Consultation
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map((s: any) => (
            <div
              key={s.id}
              className="rounded-2xl border border-[#DDE3EC] dark:border-white/[0.08] bg-white dark:bg-white/[0.04] p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-[#0D1B2A] dark:text-white">
                    {s.title ?? 'Class Session'}
                  </p>
                  <p className="text-sm text-[#5A6A7A] dark:text-white/50">
                    {s.date}{s.time ? ` · ${s.time}` : ''}
                  </p>
                  {s.teacherName && (
                    <p className="mt-1 text-xs text-[#5A6A7A] dark:text-white/40">
                      Teacher: {s.teacherName}
                    </p>
                  )}
                </div>
                <span className="rounded-full bg-[#0B3D6B]/10 dark:bg-[#E8A020]/10 px-3 py-1 text-xs font-medium text-[#0B3D6B] dark:text-[#E8A020]">
                  {s.type ?? 'Class'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
