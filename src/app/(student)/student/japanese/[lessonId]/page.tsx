'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { collection, getDocs, orderBy, query } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase/client'
import { useStudentPortal } from '@/components/student/StudentContext'
import { resolveStudentAccess } from '@/lib/access/studentAccess'
import { getJpEnrollment } from '@/lib/jp/enrollments'
import { isLessonReleased } from '@/lib/jp/drip'
import type { JpEnrollment, JpLesson, JpModule } from '@/types'

// See src/app/(student)/student/japanese/page.tsx for why this is hard-coded.
const JP_COURSE_ID = 'jft-foundation'

interface FlatLesson extends JpLesson {
  moduleId: string
  moduleOrder: number
}

export default function JapaneseLessonPage() {
  const params = useParams()
  const lessonId = params.lessonId as string
  const router = useRouter()
  const { user, student } = useStudentPortal()

  const [loading, setLoading] = useState(true)
  const [allowed, setAllowed] = useState(false)
  const [lesson, setLesson] = useState<FlatLesson | null>(null)
  const [flatLessons, setFlatLessons] = useState<FlatLesson[]>([])
  const [enrollment, setEnrollment] = useState<JpEnrollment | null>(null)

  const [embedUrl, setEmbedUrl] = useState<string | null>(null)
  const [videoLoading, setVideoLoading] = useState(false)
  const [videoError, setVideoError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!student || !user) return
    setLoading(true)
    try {
      const access = await resolveStudentAccess(student, user)
      if (!access.hasActiveJpEnrollment) {
        router.replace('/student/japanese')
        return
      }

      const enrollmentResult = await getJpEnrollment(student.id, JP_COURSE_ID)
      if (!enrollmentResult) {
        router.replace('/student/japanese')
        return
      }
      setEnrollment(enrollmentResult)

      const modulesSnap = await getDocs(query(collection(db, 'jpCourses', JP_COURSE_ID, 'modules'), orderBy('order')))
      const moduleList = modulesSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<JpModule, 'id'>) }))

      const lessonEntries = await Promise.all(
        moduleList.map(async (m) => {
          const snap = await getDocs(
            query(collection(db, 'jpCourses', JP_COURSE_ID, 'modules', m.id, 'lessons'), orderBy('order')),
          )
          return snap.docs.map((d) => ({
            id: d.id,
            moduleId: m.id,
            moduleOrder: m.order,
            ...(d.data() as Omit<JpLesson, 'id'>),
          }))
        }),
      )
      // moduleList and each lesson snapshot are already ordered by `order`,
      // so flattening in this sequence already yields the correct overall
      // (module, then lesson) sequence — no extra sort needed.
      const flat = lessonEntries.flat()
      setFlatLessons(flat)

      const target = flat.find((l) => l.id === lessonId)
      if (!target || !isLessonReleased(target, enrollmentResult)) {
        router.replace('/student/japanese')
        return
      }
      setLesson(target)
      setAllowed(true)
    } catch (err) {
      console.error('[JapaneseLessonPage] load', err)
      router.replace('/student/japanese')
    } finally {
      setLoading(false)
    }
  }, [student, user, lessonId, router])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!allowed || !lesson || lesson.type !== 'video') return
    let cancelled = false
    ;(async () => {
      setVideoLoading(true)
      setVideoError(null)
      setEmbedUrl(null)
      try {
        const token = await auth.currentUser?.getIdToken()
        const res = await fetch('/api/jp/video-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token ?? ''}` },
          body: JSON.stringify({ lessonId: lesson.id }),
        })
        const data = await res.json().catch(() => ({}))
        if (cancelled) return
        if (!res.ok) throw new Error(data?.error ?? 'Could not load video')
        setEmbedUrl(data.embedUrl)
      } catch (err) {
        if (!cancelled) {
          console.error('[JapaneseLessonPage] video token', err)
          setVideoError(err instanceof Error ? err.message : 'Could not load video.')
        }
      } finally {
        if (!cancelled) setVideoLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [allowed, lesson])

  const releasedFlat = useMemo(() => {
    if (!enrollment) return []
    return flatLessons.filter((l) => isLessonReleased(l, enrollment))
  }, [flatLessons, enrollment])

  const currentIndex = useMemo(
    () => releasedFlat.findIndex((l) => l.id === lessonId),
    [releasedFlat, lessonId],
  )
  const prevLesson = currentIndex > 0 ? releasedFlat[currentIndex - 1] : null
  const nextLesson = currentIndex >= 0 && currentIndex < releasedFlat.length - 1 ? releasedFlat[currentIndex + 1] : null

  function handleMarkComplete() {
    // TODO(Phase 4): persist completion — write to a progress collection
    // here (e.g. keyed by student.id + lessonId), then refresh the course
    // page's "completed" count. No such collection exists yet.
    toast('Progress tracking is coming in a later phase.', { icon: 'ℹ️' })
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-[#0B3D6B] border-t-[#E8A020]" />
      </div>
    )
  }

  if (!allowed || !lesson) return null

  const watermarkLabel = student?.studentCode || user?.uid || ''

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/student/japanese"
          className="font-inter text-xs font-medium text-[#5A6A7A] hover:text-[#0B3D6B] dark:text-white/50 dark:hover:text-white"
        >
          ← Back to course
        </Link>
        <h1 className="mt-2 font-jakarta text-xl font-bold text-[#0B3D6B] dark:text-white">
          {lesson.order}. {lesson.title}
        </h1>
      </div>

      {lesson.type === 'video' && (
        <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black">
          {embedUrl && (
            <iframe
              src={embedUrl}
              className="h-full w-full"
              allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
              allowFullScreen
            />
          )}
          {videoLoading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-white/30 border-t-white" />
            </div>
          )}
          {videoError && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80 p-4 text-center font-inter text-sm text-red-300">
              {videoError}
            </div>
          )}
          {watermarkLabel && (
            <div
              className="pointer-events-none absolute bottom-3 right-3 select-none font-jakarta text-sm font-semibold text-white"
              style={{ opacity: 0.35, textShadow: '0 1px 4px rgba(0,0,0,0.9)' }}
            >
              {watermarkLabel}
            </div>
          )}
        </div>
      )}

      {lesson.description && (
        <p className="font-inter text-sm leading-relaxed text-[#5A6A7A] dark:text-white/60">{lesson.description}</p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#DDE3EC] pt-4 dark:border-white/10">
        {prevLesson ? (
          <Link
            href={`/student/japanese/${prevLesson.id}`}
            className="rounded-lg border border-[#DDE3EC] px-3 py-2 font-inter text-xs font-semibold text-[#0B3D6B] hover:bg-[#F5F7FB] dark:border-white/10 dark:text-white dark:hover:bg-white/5"
          >
            ← {prevLesson.title}
          </Link>
        ) : (
          <span />
        )}

        <button
          type="button"
          onClick={handleMarkComplete}
          className="rounded-lg bg-[#E8A020] px-4 py-2 font-jakarta text-sm font-bold text-[#0B3D6B] hover:bg-[#F5B942]"
        >
          Mark complete
        </button>

        {nextLesson ? (
          <Link
            href={`/student/japanese/${nextLesson.id}`}
            className="rounded-lg border border-[#DDE3EC] px-3 py-2 font-inter text-xs font-semibold text-[#0B3D6B] hover:bg-[#F5F7FB] dark:border-white/10 dark:text-white dark:hover:bg-white/5"
          >
            {nextLesson.title} →
          </Link>
        ) : (
          <span />
        )}
      </div>
    </div>
  )
}
