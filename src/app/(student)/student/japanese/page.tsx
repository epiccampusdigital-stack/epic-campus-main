'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { collection, doc, getDoc, getDocs, orderBy, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { useStudentPortal } from '@/components/student/StudentContext'
import { resolveStudentAccess } from '@/lib/access/studentAccess'
import { getJpEnrollment } from '@/lib/jp/enrollments'
import { getNextReleaseDate, isLessonReleased } from '@/lib/jp/drip'
import { computeCourseProgress, listCourseProgress } from '@/lib/jp/progress'
import { getJpSessionRsvp, listJpCampusSessions, setJpSessionRsvp } from '@/lib/jp/campusSessions'
import type {
  JpCampusSession,
  JpCourse,
  JpEnrollment,
  JpLesson,
  JpLessonProgress,
  JpModule,
  JpSessionRsvp,
} from '@/types'

interface JpExamPaperLite {
  id: string
  title: string
  description?: string
  paperType?: 'practice' | 'exam'
  timeLimitSeconds?: number
  passMark?: number
}

// Course builder (and a real course catalog) arrives in a later phase — for
// now every JP student page targets this single hard-coded course, matching
// the management side (src/app/(management)/japanese-online/page.tsx).
const JP_COURSE_ID = 'jft-foundation'

function formatUnlockDate(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function lessonIcon(type: JpLesson['type']): string {
  if (type === 'video') return 'ti-player-play'
  if (type === 'quiz') return 'ti-help-circle'
  return 'ti-file-text'
}

export default function JapaneseCoursePage() {
  const { user, student } = useStudentPortal()
  const [loading, setLoading] = useState(true)
  const [hasAccess, setHasAccess] = useState(false)
  const [course, setCourse] = useState<JpCourse | null>(null)
  const [modules, setModules] = useState<JpModule[]>([])
  const [lessonsByModule, setLessonsByModule] = useState<Record<string, JpLesson[]>>({})
  const [enrollment, setEnrollment] = useState<JpEnrollment | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [progressDocs, setProgressDocs] = useState<JpLessonProgress[]>([])
  const [campusSessions, setCampusSessions] = useState<JpCampusSession[]>([])
  const [rsvpBySessionId, setRsvpBySessionId] = useState<Record<string, JpSessionRsvp>>({})
  const [rsvpBusyId, setRsvpBusyId] = useState<string | null>(null)
  const [examPapers, setExamPapers] = useState<JpExamPaperLite[]>([])
  const [certLoading, setCertLoading] = useState(false)
  const [certNumber, setCertNumber] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!student || !user) return
    setLoading(true)
    try {
      const access = await resolveStudentAccess(student, user)
      if (!access.hasActiveJpEnrollment) {
        setHasAccess(false)
        return
      }
      setHasAccess(true)

      const [courseSnap, modulesSnap, enrollmentResult, progressResult, sessions, examPapersSnap] = await Promise.all([
        getDoc(doc(db, 'jpCourses', JP_COURSE_ID)),
        getDocs(query(collection(db, 'jpCourses', JP_COURSE_ID, 'modules'), orderBy('order'))),
        getJpEnrollment(student.id, JP_COURSE_ID),
        listCourseProgress(user.uid),
        listJpCampusSessions(JP_COURSE_ID),
        getDocs(query(collection(db, 'examPapers'), where('courseIds', 'array-contains', JP_COURSE_ID))),
      ])

      setCourse(courseSnap.exists() ? { id: courseSnap.id, ...(courseSnap.data() as Omit<JpCourse, 'id'>) } : null)
      setEnrollment(enrollmentResult)
      setProgressDocs(progressResult)
      setCampusSessions(sessions)
      setExamPapers(examPapersSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<JpExamPaperLite, 'id'>) })))

      const rsvpEntries = await Promise.all(
        sessions.map(async (s) => [s.id, await getJpSessionRsvp(s.id, user.uid)] as const),
      )
      const rsvpMap: Record<string, JpSessionRsvp> = {}
      rsvpEntries.forEach(([sessionId, rsvp]) => {
        if (rsvp) rsvpMap[sessionId] = rsvp
      })
      setRsvpBySessionId(rsvpMap)

      const moduleList = modulesSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<JpModule, 'id'>) }))
      setModules(moduleList)

      const lessonEntries = await Promise.all(
        moduleList.map(async (m) => {
          const snap = await getDocs(
            query(collection(db, 'jpCourses', JP_COURSE_ID, 'modules', m.id, 'lessons'), orderBy('order')),
          )
          return [m.id, snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<JpLesson, 'id'>) }))] as const
        }),
      )
      setLessonsByModule(Object.fromEntries(lessonEntries))
    } catch (err) {
      console.error('[JapaneseCoursePage] load', err)
      setHasAccess(false)
    } finally {
      setLoading(false)
    }
  }, [student, user])

  useEffect(() => {
    void load()
  }, [load])

  const releasedLessons = useMemo(() => {
    if (!enrollment) return []
    return Object.values(lessonsByModule)
      .flat()
      .filter((l) => isLessonReleased(l, enrollment))
  }, [lessonsByModule, enrollment])

  const { completedCount, releasedCount, percent } = useMemo(
    () => computeCourseProgress(releasedLessons, progressDocs),
    [releasedLessons, progressDocs],
  )

  const progressByLessonId = useMemo(() => {
    const map: Record<string, JpLessonProgress> = {}
    progressDocs.forEach((p) => {
      map[p.lessonId] = p
    })
    return map
  }, [progressDocs])

  // Eligible once every released lesson is completed AND the course's own
  // duration has actually elapsed since the student started — completing
  // early (e.g. via free-preview lessons) shouldn't unlock a certificate
  // before the course's nominal length is up.
  const isCertificateEligible = useMemo(() => {
    if (!course || !enrollment || releasedLessons.length === 0) return false
    if (completedCount < releasedLessons.length) return false
    const startIso = enrollment.startedAt ?? enrollment.grantedAt
    if (!startIso) return false
    const start = new Date(startIso)
    if (Number.isNaN(start.getTime())) return false
    const msPerMonth = 1000 * 60 * 60 * 24 * 30.44
    const monthsElapsed = (Date.now() - start.getTime()) / msPerMonth
    return monthsElapsed >= course.durationMonths
  }, [course, enrollment, releasedLessons, completedCount])

  async function handleDownloadCertificate() {
    if (!student) return
    setCertLoading(true)
    try {
      const res = await fetch('/api/certificates/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: student.id }),
      })
      const data = (await res.json()) as { pdfBase64?: string; certificateNumber?: string; error?: string }
      if (!data.pdfBase64) throw new Error(data.error ?? 'Could not generate certificate')
      const bytes = Uint8Array.from(atob(data.pdfBase64), (c) => c.charCodeAt(0))
      const blob = new Blob([bytes], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `EPIC-Certificate-${data.certificateNumber ?? 'certificate'}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      setCertNumber(data.certificateNumber ?? null)
    } catch (err) {
      console.error('[JapaneseCoursePage] download certificate', err)
    } finally {
      setCertLoading(false)
    }
  }

  async function handleRsvp(sessionId: string, value: 'yes' | 'no') {
    if (!user || !student) return
    setRsvpBusyId(sessionId)
    try {
      await setJpSessionRsvp(sessionId, user.uid, student.id, value)
      const updated = await getJpSessionRsvp(sessionId, user.uid)
      setRsvpBySessionId((prev) => ({ ...prev, [sessionId]: updated as JpSessionRsvp }))
    } catch (err) {
      console.error('[JapaneseCoursePage] rsvp', err)
    } finally {
      setRsvpBusyId(null)
    }
  }

  function toggleModule(moduleId: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(moduleId)) next.delete(moduleId)
      else next.add(moduleId)
      return next
    })
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-[#0B3D6B] border-t-[#E8A020]" />
      </div>
    )
  }

  if (!hasAccess) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[#DDE3EC] text-center dark:border-white/10">
        <span className="ti ti-lock text-3xl text-[#5A6A7A]" aria-hidden="true" />
        <p className="font-jakarta text-lg font-bold text-[#0B3D6B] dark:text-white">
          You don&apos;t have access to this course
        </p>
        <p className="max-w-sm font-inter text-sm text-[#5A6A7A] dark:text-white/60">
          Contact your coordinator if you believe this is a mistake.
        </p>
        <Link
          href="/student/japanese/enroll"
          className="mt-2 rounded-lg bg-[#E8A020] px-4 py-2 font-jakarta text-sm font-bold text-[#0B3D6B] hover:bg-[#F5B942]"
        >
          Enroll now
        </Link>
      </div>
    )
  }

  const now = new Date()
  const upcomingSessions = campusSessions.filter((s) => new Date(s.date) >= now)
  const pastSessions = campusSessions.filter((s) => new Date(s.date) < now)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-jakarta text-2xl font-bold text-[#0B3D6B] dark:text-white">
            {course?.title ?? 'Japanese Online'}
          </h1>
          {course?.level && (
            <p className="mt-1 font-inter text-sm text-[#5A6A7A] dark:text-white/60">{course.level}</p>
          )}
        </div>
        <Link
          href="/student/japanese/support"
          className="flex items-center gap-1.5 rounded-lg border border-[#DDE3EC] px-3 py-2 font-inter text-xs font-semibold text-[#0B3D6B] hover:bg-[#F5F7FB] dark:border-white/10 dark:text-white dark:hover:bg-white/5"
        >
          <span className="ti ti-help-circle" aria-hidden="true" />
          Help &amp; Ask
        </Link>
      </div>

      <div className="rounded-xl border border-[#DDE3EC] bg-white p-5 dark:border-white/10 dark:bg-slate-800">
        <p className="font-jakarta text-sm font-bold text-[#0B3D6B] dark:text-white">Your progress</p>
        <p className="mt-1 font-inter text-sm text-[#5A6A7A] dark:text-white/60">
          {completedCount} of {releasedCount} released lessons completed
        </p>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[#DDE3EC] dark:bg-white/10">
          <div className="h-full rounded-full bg-[#E8A020]" style={{ width: `${percent}%` }} />
        </div>
        {isCertificateEligible && (
          <button
            type="button"
            disabled={certLoading}
            onClick={() => void handleDownloadCertificate()}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#0B3D6B] px-4 py-2 font-jakarta text-sm font-bold text-white hover:bg-[#0a3660] disabled:opacity-50"
          >
            <span className="ti ti-certificate" aria-hidden="true" />
            {certLoading ? 'Generating…' : 'Download Certificate'}
          </button>
        )}
        {certNumber && (
          <p className="mt-2 font-inter text-xs text-[#5A6A7A] dark:text-white/50">
            Certificate #{certNumber} — verify at epiccampus.live/verify/{certNumber}
          </p>
        )}
      </div>

      {(upcomingSessions.length > 0 || pastSessions.length > 0) && (
        <div className="rounded-xl border border-[#DDE3EC] bg-white p-5 dark:border-white/10 dark:bg-slate-800">
          <p className="font-jakarta text-sm font-bold text-[#0B3D6B] dark:text-white">Campus day</p>
          {upcomingSessions.length === 0 ? (
            <p className="mt-2 font-inter text-sm text-[#5A6A7A] dark:text-white/50">No upcoming campus day scheduled.</p>
          ) : (
            <div className="mt-2 space-y-2">
              {upcomingSessions.map((s) => {
                const rsvp = rsvpBySessionId[s.id]
                return (
                  <div key={s.id} className="rounded-lg bg-[#F5F7FB] p-3 dark:bg-white/5">
                    <p className="font-inter text-sm font-medium text-[#0D1B2A] dark:text-white">{s.title}</p>
                    <p className="font-inter text-xs text-[#5A6A7A] dark:text-white/50">
                      {formatUnlockDate(s.date)} · {s.startTime}–{s.endTime} · {s.venue}
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        type="button"
                        disabled={rsvpBusyId === s.id}
                        onClick={() => void handleRsvp(s.id, 'yes')}
                        className={`rounded-lg px-3 py-1.5 font-jakarta text-xs font-bold disabled:opacity-50 ${
                          rsvp?.rsvp === 'yes'
                            ? 'bg-[#E8A020] text-[#0B3D6B]'
                            : 'border border-[#DDE3EC] text-[#0B3D6B] hover:bg-white dark:border-white/10 dark:text-white'
                        }`}
                      >
                        I&apos;ll be there
                      </button>
                      <button
                        type="button"
                        disabled={rsvpBusyId === s.id}
                        onClick={() => void handleRsvp(s.id, 'no')}
                        className={`rounded-lg px-3 py-1.5 font-jakarta text-xs font-bold disabled:opacity-50 ${
                          rsvp?.rsvp === 'no'
                            ? 'bg-gray-200 text-[#0D1B2A] dark:bg-white/20 dark:text-white'
                            : 'border border-[#DDE3EC] text-[#5A6A7A] hover:bg-white dark:border-white/10 dark:text-white/60'
                        }`}
                      >
                        Can&apos;t make it
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          {pastSessions.length > 0 && (
            <div className="mt-3 space-y-1.5 border-t border-[#DDE3EC] pt-3 dark:border-white/10">
              {pastSessions.map((s) => {
                const rsvp = rsvpBySessionId[s.id]
                return (
                  <div key={s.id} className="flex items-center justify-between font-inter text-xs text-[#5A6A7A] dark:text-white/50">
                    <span>{s.title} · {formatUnlockDate(s.date)}</span>
                    <span>{rsvp?.attended ? 'Attended' : 'Not marked attended'}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {examPapers.length > 0 && (
        <div className="rounded-xl border border-[#DDE3EC] bg-white p-5 dark:border-white/10 dark:bg-slate-800">
          <p className="font-jakarta text-sm font-bold text-[#0B3D6B] dark:text-white">Practice &amp; mock tests</p>
          <div className="mt-2 space-y-2">
            {examPapers.map((paper) => {
              const isSupervised = (paper.paperType ?? 'practice') === 'exam'
              return (
                <Link
                  key={paper.id}
                  href={isSupervised ? '/exam-code' : `/exams/${paper.id}`}
                  className="flex items-center justify-between gap-3 rounded-lg bg-[#F5F7FB] px-3 py-2.5 hover:bg-[#eef1f6] dark:bg-white/5 dark:hover:bg-white/10"
                >
                  <div className="min-w-0">
                    <p className="truncate font-inter text-sm font-medium text-[#0D1B2A] dark:text-white">{paper.title}</p>
                    {paper.description && (
                      <p className="truncate font-inter text-xs text-[#5A6A7A] dark:text-white/50">{paper.description}</p>
                    )}
                  </div>
                  <span className="shrink-0 font-inter text-xs font-semibold text-[#1A6BAD]">
                    {isSupervised ? 'Enter exam code' : 'Start'}
                  </span>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      <div className="space-y-3">
        {modules.map((module) => {
          const lessons = lessonsByModule[module.id] ?? []
          const isOpen = expanded.has(module.id)
          return (
            <div key={module.id} className="rounded-xl border border-[#DDE3EC] bg-white dark:border-white/10 dark:bg-slate-800">
              <button
                type="button"
                onClick={() => toggleModule(module.id)}
                className="flex w-full items-center gap-2 px-5 py-4 text-left"
              >
                <span
                  className={`ti ${isOpen ? 'ti-chevron-down' : 'ti-chevron-right'} text-[#5A6A7A]`}
                  aria-hidden="true"
                />
                <span className="font-jakarta text-sm font-semibold text-[#0D1B2A] dark:text-white">
                  {module.order}. {module.title}
                </span>
              </button>

              {isOpen && (
                <div className="space-y-1.5 border-t border-[#DDE3EC] px-3 py-3 dark:border-white/10">
                  {lessons.length === 0 && (
                    <p className="px-2 py-2 font-inter text-sm text-[#5A6A7A] dark:text-white/50">No lessons yet.</p>
                  )}
                  {lessons.map((lesson) => {
                    const released = enrollment ? isLessonReleased(lesson, enrollment) : lesson.isFreePreview
                    const unlockDate = enrollment ? getNextReleaseDate(lesson, enrollment) : null
                    const lessonProgress = progressByLessonId[lesson.id]
                    const completed = lessonProgress?.completed ?? false
                    const state: 'available' | 'completed' | 'locked' = completed
                      ? 'completed'
                      : released
                        ? 'available'
                        : 'locked'
                    const watchPercent =
                      !completed && lessonProgress && lessonProgress.durationSec > 0
                        ? Math.min(100, Math.round((lessonProgress.watchedSec / lessonProgress.durationSec) * 100))
                        : 0

                    const row = (
                      <div className="rounded-lg px-3 py-2.5">
                        <div className="flex items-center gap-3">
                          <span className={`ti ${lessonIcon(lesson.type)} text-[#5A6A7A]`} aria-hidden="true" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-inter text-sm font-medium text-[#0D1B2A] dark:text-white">
                              {lesson.order}. {lesson.title}
                            </p>
                            <p className="font-inter text-xs text-[#5A6A7A] dark:text-white/50">
                              {lesson.durationSec ? `${Math.round(lesson.durationSec / 60)} min` : lesson.type}
                            </p>
                          </div>
                          {state === 'completed' && (
                            <span className="ti ti-circle-check text-emerald-500" aria-hidden="true" />
                          )}
                          {state === 'available' && (
                            <span className="ti ti-player-play text-[#1A6BAD]" aria-hidden="true" />
                          )}
                          {state === 'locked' && (
                            <span className="font-inter text-xs text-[#5A6A7A] dark:text-white/50">
                              Unlocks {formatUnlockDate(unlockDate)}
                            </span>
                          )}
                        </div>
                        {watchPercent > 0 && (
                          <div className="ml-7 mt-1.5 h-1 w-24 overflow-hidden rounded-full bg-[#DDE3EC] dark:bg-white/10">
                            <div className="h-full rounded-full bg-[#1A6BAD]" style={{ width: `${watchPercent}%` }} />
                          </div>
                        )}
                      </div>
                    )

                    if (state === 'locked') {
                      return (
                        <div key={lesson.id} className="cursor-not-allowed opacity-60" aria-disabled="true">
                          {row}
                        </div>
                      )
                    }

                    return (
                      <Link
                        key={lesson.id}
                        href={`/student/japanese/${lesson.id}`}
                        className="block rounded-lg hover:bg-[#F5F7FB] dark:hover:bg-white/5"
                      >
                        {row}
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
