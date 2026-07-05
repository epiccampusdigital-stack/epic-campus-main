'use client'

import { useEffect, useState } from 'react'
import { collection, getDocs, query, where, doc, getDoc, setDoc } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase/client'
import { parseAttendance } from '@/lib/attendance/helpers'
import { parsePayment } from '@/lib/payments/helpers'
import CourseDashboard from '@/components/student/CourseDashboard'
import StudentSessionsWidget from '@/components/sessions/StudentSessionsWidget'
import StudyStatsWidget from '@/components/student/StudyStatsWidget'
import DashboardHero from '@/components/student/DashboardHero'
import QuickActions from '@/components/student/QuickActions'
import { useStudentPortal } from '@/components/student/StudentContext'
import type { AttendanceRecord, Payment } from '@/types'

interface ExamMilestone {
  day: number
  title: string
  unlocked: boolean
  completed: boolean
  isFinal: boolean
}

export default function MyDashboardPage() {
  const { student } = useStudentPortal()
  const [fallbackStudent, setFallbackStudent] = useState<any | null>(null)
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [examCount, setExamCount] = useState(0)
  const [milestones, setMilestones] = useState<ExamMilestone[]>([])
  const [houseInfo, setHouseInfo] = useState<{
    name: string
    address: string
    landlordPhone: string
  } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const uid = auth.currentUser?.uid

    if (!student && !uid && !fallbackStudent) return

    let cancelled = false

    async function load() {
      setLoading(true)
      try {
        const studentId = student?.id ?? fallbackStudent?.id

        const [attSnap, paySnap, examSnap] = await Promise.all([
          getDocs(
            query(
              collection(db, 'attendance'),
              where('studentId', '==', studentId),
            ),
          ).catch(() => ({ docs: [] })),
          getDocs(
            query(
              collection(db, 'payments'),
              where('studentId', '==', studentId),
            ),
          ).catch(() => ({ docs: [] })),
          getDocs(
            query(
              collection(db, 'examResults'),
              where('studentId', '==', studentId),
            ),
          ).catch(() => ({ docs: [] })),
        ])

        if (cancelled) return

        const att = attSnap.docs
          .map((d) => parseAttendance(d.id, d.data() as Record<string, unknown>))
          .sort((a, b) => b.date.localeCompare(a.date))

        setAttendance(att)
        setPayments(
          paySnap.docs.map((d) =>
            parsePayment(d.id, d.data() as Record<string, unknown>),
          ),
        )
        setExamCount(examSnap.docs.length)

        const activeStudentId = student?.id ?? fallbackStudent?.id
        if (activeStudentId) {
          const studSnap = await getDoc(
            doc(db, 'students', activeStudentId)
          ).catch(() => null)
          if (studSnap?.exists()) {
            const houseId = studSnap.data()?.houseId
            if (houseId) {
              const houseSnap = await getDoc(
                doc(db, 'accommodation', houseId)
              ).catch(() => null)
              if (houseSnap?.exists() && !cancelled) {
                const h = houseSnap.data()
                setHouseInfo({
                  name: String(h?.name ?? ''),
                  address: String(h?.address ?? ''),
                  landlordPhone: String(
                    h?.landlordPhone ?? ''),
                })
              }
            }
          }
        }

        const activeStudentForCourse = student ?? fallbackStudent
        if (activeStudentForCourse?.courseId === 'japan-ssw') {
          const paperSnap = await getDocs(
            query(collection(db, 'examPapers'), where('categoryId', '==', 'japan-ssw-45day')),
          ).catch(() => ({ docs: [] as { id: string; data: () => Record<string, unknown> }[] }))
          const milestonePapers = paperSnap.docs
            .map((d) => ({ id: d.id, ...d.data() } as {
              id: string
              unlockDay?: number
              title?: string
              isFinalExam?: boolean
            }))
            .sort((a, b) => (a.unlockDay ?? 0) - (b.unlockDay ?? 0))

          const attSnap = await getDocs(
            query(
              collection(db, 'examAttempts'),
              where('studentId', '==', activeStudentForCourse.id),
              where('status', '==', 'completed'),
            ),
          ).catch(() => ({ docs: [] as { data: () => Record<string, unknown> }[] }))
          const attemptedPaperIds = new Set(attSnap.docs.map((d) => d.data().paperId as string))

          const startStr = activeStudentForCourse.enrollmentDate ?? activeStudentForCourse.batchStartDate
          const start = startStr ? new Date(startStr) : null
          const daysSince =
            start && !Number.isNaN(start.getTime())
              ? Math.floor((Date.now() - start.getTime()) / (1000 * 60 * 60 * 24))
              : null

          if (!cancelled) {
            setMilestones(
              milestonePapers.map((p) => ({
                day: p.unlockDay ?? 0,
                title: p.title ?? `Day ${p.unlockDay}`,
                unlocked: daysSince !== null && (p.unlockDay ?? 0) <= daysSince,
                completed: attemptedPaperIds.has(p.id),
                isFinal: !!p.isFinalExam,
              })),
            )
          }
        }
      } catch (err) {
        if (!cancelled) {
          console.error('[MyDashboard]', err)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    // If there's no context student, try to hydrate a minimal student record from auth/users
    async function ensureStudentFromAuth() {
      const uid = auth.currentUser?.uid
      if (!uid) return

      try {
        const studSnap = await getDoc(doc(db, 'students', uid)).catch(() => null)
        if (studSnap && studSnap.exists()) {
          if (!cancelled) {
            setFallbackStudent({ id: uid, ...(studSnap.data() ?? {}) })
          }
          return
        }

        const userSnap = await getDoc(doc(db, 'users', uid)).catch(() => null)
        if (userSnap && userSnap.exists()) {
          const udata = userSnap.data() ?? {}
          const minimal = {
            id: uid,
            name: String(udata.displayName ?? udata.email ?? ''),
            uid,
            courseId: udata.courseId ?? undefined,
          }
          // create minimal students doc (merge)
          await setDoc(doc(db, 'students', uid), minimal, { merge: true }).catch(() => null)
          if (!cancelled) {
            setFallbackStudent(minimal)
          }
          return
        }
      } catch (err) {
        if (!cancelled) {
          console.error('[MyDashboard] ensureStudentFromAuth error', err)
        }
      }
    }

    // Kick off ensure first so load() has studentId available
    if (!student && !fallbackStudent) {
      ensureStudentFromAuth().then(() => load())
    } else {
      load()
    }

    return () => {
      cancelled = true
    }
  }, [student, fallbackStudent])

  const activeStudent = student ?? fallbackStudent
  if (!activeStudent) {
    if (loading) {
      return (
        <div className="space-y-4 p-4">
          <div className="animate-pulse h-32 rounded-2xl bg-[#DDE3EC] dark:bg-white/10" />
          <div className="animate-pulse h-20 rounded-2xl bg-[#DDE3EC] dark:bg-white/10" />
          <div className="animate-pulse h-20 rounded-2xl bg-[#DDE3EC] dark:bg-white/10" />
        </div>
      )
    }
    return null
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse h-10 w-64 rounded-2xl bg-[#DDE3EC] dark:bg-white/10" />
        <div className="animate-pulse h-24 rounded-2xl bg-[#DDE3EC] dark:bg-white/10" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="animate-pulse h-20 rounded-2xl bg-[#DDE3EC] dark:bg-white/10" />
          ))}
        </div>
      </div>
    )
  }

  const COURSE_DURATIONS: Record<string, number> = {
    'japan-ssw': 45,
    'korea': 365,
    'china': 365,
    'ielts': 90,
    'nvq': 180,
  }

  const courseId = activeStudent?.courseId ?? ''
  const duration = COURSE_DURATIONS[courseId] ?? 45
  const startRaw = (activeStudent as Record<string, unknown>)?.enrollmentDate ??
    (activeStudent as Record<string, unknown>)?.batchStartDate ??
    (activeStudent as Record<string, unknown>)?.createdAt
  const startMs = startRaw
    ? (typeof startRaw === 'object' && startRaw !== null && 'toDate' in startRaw
        ? (startRaw as { toDate: () => Date }).toDate().getTime()
        : new Date(String(startRaw)).getTime())
    : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).getTime()
  const daysElapsed = startMs ? Math.max(0, Math.floor((Date.now() - startMs) / (1000 * 60 * 60 * 24))) : 0
  const daysRemaining = Math.max(0, duration - daysElapsed)
  const progressPct = Math.min(100, Math.round((daysElapsed / duration) * 100))

  const COURSE_LABELS: Record<string, string> = {
    'japan-ssw': '🇯🇵 Japan SSW',
    'korea': '🇰🇷 Korea',
    'china': '🇨🇳 China',
    'ielts': '📝 IELTS',
    'nvq': '🎓 NVQ',
  }

  return (
    <div className="space-y-4">
      <DashboardHero
        student={activeStudent}
        attendance={attendance}
        payments={payments}
        examCount={examCount}
      />

      {startMs && (
        <div className="rounded-2xl bg-gradient-to-r from-[#0B3D6B] to-[#1A6BAD] p-5 text-white">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="text-xs text-white/60 font-bold uppercase tracking-wider">Course Progress</p>
              <p className="font-jakarta text-3xl font-black mt-1">
                {daysRemaining > 0 ? `${daysRemaining} days left` : '🎓 Course Complete!'}
              </p>
              <p className="text-sm text-white/70 mt-0.5">
                Day {Math.min(daysElapsed, duration)} of {duration} · {progressPct}% complete
              </p>
            </div>
            <p className="text-sm text-white/60">{COURSE_LABELS[courseId] ?? courseId}</p>
          </div>
          <div className="mt-4 h-2 rounded-full bg-white/20 overflow-hidden">
            <div className="h-full rounded-full bg-[#E8A020] transition-all duration-1000"
              style={{ width: `${progressPct}%` }} />
          </div>
        </div>
      )}

      <QuickActions />
      {milestones.length > 0 && (
        <div className="rounded-2xl border border-[#DDE3EC] dark:border-white/[0.08] bg-white dark:bg-white/[0.04] p-5">
          <h3 className="font-jakarta font-bold text-[#0B3D6B] dark:text-white mb-4">
            Course Progress
          </h3>
          <div className="flex items-center">
            {milestones.map((m, i) => (
              <div key={m.day} className="flex flex-1 items-center last:flex-none">
                <div className="flex flex-col items-center">
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      m.completed
                        ? 'bg-emerald-500 text-white'
                        : m.unlocked
                          ? 'bg-gray-200 dark:bg-white/10 text-gray-500'
                          : 'bg-gray-100 dark:bg-white/[0.04] text-gray-400'
                    }`}
                  >
                    {m.completed ? (
                      <span className="ti ti-check" />
                    ) : m.unlocked ? (
                      <span className="ti ti-hourglass" />
                    ) : (
                      <span className="ti ti-lock" />
                    )}
                  </div>
                  <p className="mt-1 whitespace-nowrap text-[10px] font-medium text-[#5A6A7A] dark:text-white/40">
                    Day {m.day}{m.isFinal ? ' (Final)' : ''}
                  </p>
                </div>
                {i < milestones.length - 1 && (
                  <div
                    className={`mx-1 mb-4 h-0.5 flex-1 ${
                      m.completed ? 'bg-emerald-500' : 'bg-gray-200 dark:bg-white/10'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      <StudyStatsWidget studentId={activeStudent.id} />
      <StudentSessionsWidget studentId={activeStudent.id} />
      <CourseDashboard
        student={activeStudent}
        attendance={attendance}
        examCount={examCount}
        payments={payments}
      />
      {houseInfo && (
        <div className="rounded-2xl border border-[#DDE3EC] dark:border-white/[0.08] bg-white dark:bg-white/[0.04] p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="ti ti-home text-lg text-[#0B3D6B] dark:text-[#E8A020]" aria-hidden="true" />
            <h3 className="font-jakarta font-bold text-[#0B3D6B] dark:text-white">
              My Accommodation
            </h3>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2 text-[#0D1B2A] dark:text-white">
              <span className="ti ti-building text-[#5A6A7A] dark:text-white/40" aria-hidden="true" />
              <span className="font-medium">
                {houseInfo.name}
              </span>
            </div>
            {houseInfo.address && (
              <div className="flex items-center gap-2 text-[#5A6A7A] dark:text-white/50">
                <span className="ti ti-map-pin" aria-hidden="true" />
                {houseInfo.address}
              </div>
            )}
            {houseInfo.landlordPhone && (
              <div className="flex items-center gap-2 text-[#5A6A7A] dark:text-white/50">
                <span className="ti ti-phone" aria-hidden="true" />
                <a href={`tel:${houseInfo.landlordPhone}`}
                  className="hover:text-[#0B3D6B] dark:hover:text-[#E8A020] hover:underline">
                  {houseInfo.landlordPhone}
                </a>
              </div>
            )}
            <p className="text-xs text-[#5A6A7A] dark:text-white/40 mt-2">
              For accommodation issues contact
              Epic Campus: 076 254 8383
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
