'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { collection, doc, getDoc, getDocs, orderBy, query } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { useStudentPortal } from '@/components/student/StudentContext'
import { resolveStudentAccess } from '@/lib/access/studentAccess'
import { getJpEnrollment } from '@/lib/jp/enrollments'
import { getNextReleaseDate, isLessonReleased } from '@/lib/jp/drip'
import { computeCourseProgress, listCourseProgress } from '@/lib/jp/progress'
import type { JpCourse, JpEnrollment, JpLesson, JpLessonProgress, JpModule } from '@/types'

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

      const [courseSnap, modulesSnap, enrollmentResult, progressResult] = await Promise.all([
        getDoc(doc(db, 'jpCourses', JP_COURSE_ID)),
        getDocs(query(collection(db, 'jpCourses', JP_COURSE_ID, 'modules'), orderBy('order'))),
        getJpEnrollment(student.id, JP_COURSE_ID),
        listCourseProgress(user.uid),
      ])

      setCourse(courseSnap.exists() ? { id: courseSnap.id, ...(courseSnap.data() as Omit<JpCourse, 'id'>) } : null)
      setEnrollment(enrollmentResult)
      setProgressDocs(progressResult)

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-jakarta text-2xl font-bold text-[#0B3D6B] dark:text-white">
          {course?.title ?? 'Japanese Online'}
        </h1>
        {course?.level && (
          <p className="mt-1 font-inter text-sm text-[#5A6A7A] dark:text-white/60">{course.level}</p>
        )}
      </div>

      <div className="rounded-xl border border-[#DDE3EC] bg-white p-5 dark:border-white/10 dark:bg-slate-800">
        <p className="font-jakarta text-sm font-bold text-[#0B3D6B] dark:text-white">Your progress</p>
        <p className="mt-1 font-inter text-sm text-[#5A6A7A] dark:text-white/60">
          {completedCount} of {releasedCount} released lessons completed
        </p>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[#DDE3EC] dark:bg-white/10">
          <div className="h-full rounded-full bg-[#E8A020]" style={{ width: `${percent}%` }} />
        </div>
      </div>

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
