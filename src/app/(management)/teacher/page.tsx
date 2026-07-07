'use client'

import { useCallback, useEffect, useState } from 'react'
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { useManagement } from '@/components/layout/ManagementContext'
import Link from 'next/link'

interface Session {
  id: string
  title: string
  date: string
  startTime: string
  endTime?: string
  courseId?: string
  location?: string
  studentCount?: number
  staffId?: string
}

interface ExamAttempt {
  id: string
  studentName: string
  paperTitle: string
  percentage: number
  completedAt: unknown
}

const COURSE_LABELS: Record<string, string> = {
  'japan-ssw': '🇯🇵 Japan SSW',
  'korea-d2d4': '🇰🇷 Korea',
  'china': '🇨🇳 China',
  'ielts': '📝 IELTS',
  'nvq-it': '🎓 NVQ IT',
  'nvq-hospitality': '🎓 NVQ Hospitality',
  'nvq-caregiving': '🎓 NVQ Caregiving',
  'nvq-construction': '🎓 NVQ Construction',
  'nvq-logistics': '🎓 NVQ Logistics',
}

function today() { return new Date().toISOString().slice(0, 10) }
function formatTime(t: string) {
  if (!t) return ''
  const [h, m] = t.split(':')
  const hour = parseInt(h)
  return `${hour > 12 ? hour - 12 : hour}:${m} ${hour >= 12 ? 'PM' : 'AM'}`
}

export default function TeacherDashboardPage() {
  const { user } = useManagement()
  const [todaySessions, setTodaySessions] = useState<Session[]>([])
  const [upcomingSessions, setUpcomingSessions] = useState<Session[]>([])
  const [recentAttempts, setRecentAttempts] = useState<ExamAttempt[]>([])
  const [studentCount, setStudentCount] = useState(0)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const todayStr = today()

      // Sessions today
      const sessSnap = await getDocs(
        query(collection(db, 'sessions'), where('date', '==', todayStr), orderBy('startTime', 'asc'))
      ).catch(() => getDocs(query(collection(db, 'sessions'), where('date', '==', todayStr))))
      const allSessions = sessSnap.docs.map(d => ({ id: d.id, ...d.data() } as Session))
      setTodaySessions(allSessions.filter(s => !s.staffId || s.staffId === user.uid))

      // Upcoming sessions (next 7 days)
      const nextWeek = new Date()
      nextWeek.setDate(nextWeek.getDate() + 7)
      const nextWeekStr = nextWeek.toISOString().slice(0, 10)
      const upSnap = await getDocs(
        query(collection(db, 'sessions'), where('date', '>', todayStr), orderBy('date', 'asc'))
      ).catch(() => ({ docs: [] }))
      setUpcomingSessions(
        upSnap.docs
          .map(d => ({ id: d.id, ...d.data() } as Session))
          .filter(s => s.date <= nextWeekStr)
          .slice(0, 5)
      )

      // Students
      const studSnap = await getDocs(collection(db, 'students')).catch(() => ({ docs: [] }))
      setStudentCount(studSnap.docs.length)

      // Recent exam attempts
      const attSnap = await getDocs(
        query(collection(db, 'examAttempts'), orderBy('completedAt', 'desc'))
      ).catch(() => ({ docs: [] }))
      setRecentAttempts(attSnap.docs.slice(0, 10).map(d => ({ id: d.id, ...d.data() } as ExamAttempt)))
    } catch (err) {
      console.error('[TeacherDashboard]', err)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => { void load() }, [load])

  if (!user) return null

  return (
    <div className="space-y-6">
      {/* Welcome header */}
      <div className="rounded-2xl bg-gradient-to-r from-[#0B3D6B] to-[#1A6BAD] p-6 text-white">
        <h1 className="font-jakarta text-2xl font-bold">
          Welcome, {user.displayName?.split(' ')[0] ?? 'Teacher'} 👋
        </h1>
        <p className="mt-1 text-sm text-white/70">
          {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
        <div className="mt-4 grid grid-cols-3 gap-3">
          <div className="rounded-xl bg-white/10 p-3 text-center">
            <p className="text-2xl font-black text-[#E8A020]">{todaySessions.length}</p>
            <p className="text-xs text-white/60">Today&apos;s Sessions</p>
          </div>
          <div className="rounded-xl bg-white/10 p-3 text-center">
            <p className="text-2xl font-black text-[#E8A020]">{studentCount}</p>
            <p className="text-xs text-white/60">Total Students</p>
          </div>
          <div className="rounded-xl bg-white/10 p-3 text-center">
            <p className="text-2xl font-black text-[#E8A020]">{recentAttempts.length}</p>
            <p className="text-xs text-white/60">Recent Exams</p>
          </div>
        </div>
      </div>

      {/* Today's sessions */}
      <div className="rounded-2xl border border-[#DDE3EC] dark:border-white/[0.08] bg-white dark:bg-white/[0.04] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#DDE3EC] dark:border-white/[0.08]">
          <h2 className="font-jakarta font-bold text-[#0B3D6B] dark:text-white">Today&apos;s Sessions</h2>
          <Link href="/schedule" className="text-xs font-semibold text-[#E8A020]">View Schedule →</Link>
        </div>
        {loading ? (
          <div className="p-5 space-y-2">{[1,2].map(i => <div key={i} className="h-14 animate-pulse rounded-xl bg-[#DDE3EC] dark:bg-white/10" />)}</div>
        ) : todaySessions.length === 0 ? (
          <div className="py-10 text-center">
            <span className="ti ti-calendar-off text-3xl text-[#DDE3EC] dark:text-white/20" />
            <p className="mt-2 text-sm text-[#5A6A7A] dark:text-white/50">No sessions today</p>
          </div>
        ) : (
          <div className="divide-y divide-[#DDE3EC] dark:divide-white/[0.06]">
            {todaySessions.map(s => (
              <div key={s.id} className="flex items-center gap-3 px-5 py-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#0B3D6B]/10 dark:bg-[#0B3D6B]/30">
                  <span className="ti ti-chalkboard text-[#0B3D6B] dark:text-blue-300" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[#0D1B2A] dark:text-white truncate">{s.title}</p>
                  <p className="text-xs text-[#5A6A7A] dark:text-white/40">
                    {formatTime(s.startTime)}{s.endTime ? ` — ${formatTime(s.endTime)}` : ''} · {s.location ?? 'Campus'}
                  </p>
                </div>
                {s.courseId && (
                  <span className="shrink-0 text-xs text-[#5A6A7A] dark:text-white/40">{COURSE_LABELS[s.courseId] ?? s.courseId}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Upcoming sessions */}
      {upcomingSessions.length > 0 && (
        <div className="rounded-2xl border border-[#DDE3EC] dark:border-white/[0.08] bg-white dark:bg-white/[0.04] overflow-hidden">
          <div className="px-5 py-4 border-b border-[#DDE3EC] dark:border-white/[0.08]">
            <h2 className="font-jakarta font-bold text-[#0B3D6B] dark:text-white">Upcoming This Week</h2>
          </div>
          <div className="divide-y divide-[#DDE3EC] dark:divide-white/[0.06]">
            {upcomingSessions.map(s => (
              <div key={s.id} className="flex items-center gap-3 px-5 py-3">
                <div className="shrink-0 text-center w-10">
                  <p className="text-xs font-bold text-[#0B3D6B] dark:text-blue-300">{new Date(s.date + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</p>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[#0D1B2A] dark:text-white truncate">{s.title}</p>
                  <p className="text-xs text-[#5A6A7A] dark:text-white/40">{formatTime(s.startTime)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent exam activity */}
      <div className="rounded-2xl border border-[#DDE3EC] dark:border-white/[0.08] bg-white dark:bg-white/[0.04] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#DDE3EC] dark:border-white/[0.08]">
          <h2 className="font-jakarta font-bold text-[#0B3D6B] dark:text-white">Recent Exam Results</h2>
          <Link href="/admin-exams" className="text-xs font-semibold text-[#E8A020]">Manage Exams →</Link>
        </div>
        {loading ? (
          <div className="p-5 space-y-2">{[1,2,3].map(i => <div key={i} className="h-12 animate-pulse rounded-xl bg-[#DDE3EC] dark:bg-white/10" />)}</div>
        ) : recentAttempts.length === 0 ? (
          <div className="py-10 text-center">
            <span className="ti ti-file-off text-3xl text-[#DDE3EC] dark:text-white/20" />
            <p className="mt-2 text-sm text-[#5A6A7A] dark:text-white/50">No exam attempts yet</p>
          </div>
        ) : (
          <div className="divide-y divide-[#DDE3EC] dark:divide-white/[0.06]">
            {recentAttempts.map(a => (
              <div key={a.id} className="flex items-center gap-3 px-5 py-3">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-bold text-sm ${a.percentage >= 80 ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400' : a.percentage >= 60 ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400' : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'}`}>
                  {a.percentage}%
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[#0D1B2A] dark:text-white truncate">{a.studentName}</p>
                  <p className="text-xs text-[#5A6A7A] dark:text-white/40 truncate">{a.paperTitle}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold border ${a.percentage >= 80 ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800' : 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800'}`}>
                  {a.percentage >= 80 ? 'Passed' : 'Failed'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Students', href: '/students', icon: 'ti-users' },
          { label: 'Materials', href: '/materials', icon: 'ti-book' },
          { label: 'Attendance', href: '/attendance', icon: 'ti-calendar-check' },
          { label: 'Exam Manager', href: '/admin-exams', icon: 'ti-writing' },
        ].map(link => (
          <Link key={link.href} href={link.href}
            className="card-hover flex flex-col items-center gap-2 rounded-2xl border border-[#DDE3EC] dark:border-white/[0.08] bg-white dark:bg-white/[0.04] p-6 text-center hover:border-[#E8A020]">
            <span className={`ti ${link.icon} text-2xl text-[#0B3D6B] dark:text-[#E8A020]`} />
            <span className="text-xs font-semibold text-[#5A6A7A] dark:text-white/60">{link.label}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
