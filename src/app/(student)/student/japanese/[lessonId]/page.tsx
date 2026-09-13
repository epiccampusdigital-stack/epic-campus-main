'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Script from 'next/script'
import toast from 'react-hot-toast'
import { collection, getDocs, orderBy, query } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase/client'
import { useStudentPortal } from '@/components/student/StudentContext'
import { resolveStudentAccess } from '@/lib/access/studentAccess'
import { getJpEnrollment } from '@/lib/jp/enrollments'
import { isLessonReleased } from '@/lib/jp/drip'
import { getLessonProgress, markLessonComplete, markLessonIncomplete, saveWatchPosition } from '@/lib/jp/progress'
import type { JpEnrollment, JpLesson, JpModule } from '@/types'

// See src/app/(student)/student/japanese/page.tsx for why this is hard-coded.
const JP_COURSE_ID = 'jft-foundation'

// Throttle: never save a watch position more than once per this interval,
// plus once on unmount/tab-hidden regardless of the interval.
const PROGRESS_SAVE_INTERVAL_MS = 15000
const AUTO_COMPLETE_RATIO = 0.9
const PLAYERJS_SRC = 'https://assets.mediadelivery.net/playerjs/playerjs-latest.min.js'

// Minimal shape of Bunny's player.js API (https://github.com/embedly/player.js)
// that this page actually uses. Not an npm package — the library attaches
// itself to `window.playerjs` as a plain script.
interface PlayerJsPlayer {
  on(event: string, callback: (data: unknown) => void): void
  getDuration(callback: (duration: number) => void): void
  setCurrentTime(seconds: number): void
}

declare global {
  interface Window {
    playerjs?: {
      Player: new (element: HTMLIFrameElement) => PlayerJsPlayer
    }
  }
}

interface FlatLesson extends JpLesson {
  moduleId: string
  moduleOrder: number
}

function formatMMSS(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds))
  const m = Math.floor(safe / 60)
  const s = safe % 60
  return `${m}:${String(s).padStart(2, '0')}`
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

  // player.js must be loaded before we attach it to the iframe. There's no
  // root-layout-safe way to force a true `beforeInteractive` load from a
  // nested page (Next only allows that strategy in app/layout.tsx), so the
  // equivalent here is: don't mount the <iframe> until the script has
  // settled one way or the other (loaded, or failed — see below).
  const [playerjsLoaded, setPlayerjsLoaded] = useState(false)
  const [playerjsFailed, setPlayerjsFailed] = useState(false)

  const [completed, setCompleted] = useState(false)
  const [markBusy, setMarkBusy] = useState(false)
  const [resumePosition, setResumePosition] = useState<number | null>(null)

  // Mutable tracking state that must survive across player.js event ticks
  // without re-subscribing the effect on every update.
  const watchedSecRef = useRef(0)
  const durationSecRef = useRef(0)
  const lastSavedAtRef = useRef(0)
  const autoCompletedRef = useRef(false)
  const completedRef = useRef(false)
  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const playerRef = useRef<PlayerJsPlayer | null>(null)

  useEffect(() => {
    completedRef.current = completed
  }, [completed])

  // If a previous lesson page already loaded player.js, window.playerjs is
  // already there — don't wait on another <Script> onLoad that may never
  // re-fire for an already-loaded src.
  useEffect(() => {
    if (typeof window !== 'undefined' && window.playerjs) {
      setPlayerjsLoaded(true)
    }
  }, [])

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

  // Fetch the video embed token. A timestamp is appended to the URL because
  // player.js is known to misbehave when multiple players share the same
  // src (its internal message channel is keyed off it) — this guarantees a
  // fresh, unique src every time a video lesson is opened.
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
        setEmbedUrl(`${data.embedUrl}&_t=${Date.now()}`)
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

  // Load any previously saved progress for this lesson (resume position +
  // completed state) once we know who's watching and which lesson it is.
  useEffect(() => {
    if (!allowed || !lesson || !user) return
    let cancelled = false
    watchedSecRef.current = 0
    durationSecRef.current = lesson.durationSec ?? 0
    autoCompletedRef.current = false
    setResumePosition(null)
    setCompleted(false)
    ;(async () => {
      try {
        const progress = await getLessonProgress(user.uid, lesson.id)
        if (cancelled || !progress) return
        setCompleted(progress.completed)
        watchedSecRef.current = progress.watchedSec
        if (progress.durationSec) durationSecRef.current = progress.durationSec
        // Not worth offering to "resume" a few seconds in.
        if (lesson.type === 'video' && progress.watchedSec > 5 && !progress.completed) {
          setResumePosition(progress.watchedSec)
        }
      } catch (err) {
        console.error('[JapaneseLessonPage] load progress', err)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [allowed, lesson, user])

  // Player progress tracking via Bunny's player.js integration.
  //
  // Only runs once the iframe is mounted (which itself waits on embedUrl +
  // playerjsLoaded, see the render below) and player.js hasn't failed to
  // load. If it did fail, this effect simply never attaches — the video
  // still plays (it's a plain iframe), progress just isn't tracked and the
  // student relies on the manual Mark complete button.
  useEffect(() => {
    if (!allowed || !lesson || lesson.type !== 'video' || !user) return
    if (!embedUrl || playerjsFailed || !playerjsLoaded) return
    const iframe = iframeRef.current
    if (!iframe || typeof window === 'undefined' || !window.playerjs) return

    const uid = user.uid
    const currentLessonId = lesson.id
    let cancelled = false

    function persist(watchedSec: number, durationSec: number) {
      void saveWatchPosition(uid, currentLessonId, Math.round(watchedSec), Math.round(durationSec)).catch((err) => {
        console.error('[JapaneseLessonPage] saveWatchPosition', err)
      })
    }

    function maybeAutoComplete(watchedSec: number, durationSec: number) {
      if (autoCompletedRef.current || completedRef.current) return
      if (durationSec > 0 && watchedSec / durationSec >= AUTO_COMPLETE_RATIO) {
        autoCompletedRef.current = true
        void markLessonComplete(uid, currentLessonId)
          .then(() => setCompleted(true))
          .catch((err) => console.error('[JapaneseLessonPage] auto-complete', err))
      }
    }

    const player = new window.playerjs.Player(iframe)
    playerRef.current = player

    player.on('ready', () => {
      if (cancelled) return

      player.getDuration((duration) => {
        if (!cancelled && Number.isFinite(duration) && duration > 0) {
          durationSecRef.current = duration
        }
      })

      player.on('timeupdate', (raw) => {
        if (cancelled) return
        const data = raw as { seconds?: number; duration?: number } | null
        const seconds = Number(data?.seconds)
        if (!Number.isFinite(seconds)) return
        watchedSecRef.current = Math.max(watchedSecRef.current, seconds)
        const duration = Number(data?.duration)
        if (Number.isFinite(duration) && duration > 0) durationSecRef.current = duration

        const now = Date.now()
        if (now - lastSavedAtRef.current >= PROGRESS_SAVE_INTERVAL_MS) {
          lastSavedAtRef.current = now
          persist(watchedSecRef.current, durationSecRef.current)
        }
        maybeAutoComplete(watchedSecRef.current, durationSecRef.current)
      })

      player.on('ended', () => {
        if (cancelled) return
        if (durationSecRef.current > 0) watchedSecRef.current = durationSecRef.current
        persist(watchedSecRef.current, durationSecRef.current)
        if (!autoCompletedRef.current && !completedRef.current) {
          autoCompletedRef.current = true
          void markLessonComplete(uid, currentLessonId)
            .then(() => setCompleted(true))
            .catch((err) => console.error('[JapaneseLessonPage] ended-complete', err))
        }
      })
    })

    function handleVisibilityChange() {
      if (document.visibilityState === 'hidden' && watchedSecRef.current > 0) {
        persist(watchedSecRef.current, durationSecRef.current)
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      if (playerRef.current === player) playerRef.current = null
      if (watchedSecRef.current > 0) {
        persist(watchedSecRef.current, durationSecRef.current)
      }
    }
  }, [allowed, lesson, user, embedUrl, playerjsLoaded, playerjsFailed])

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

  function handleResume() {
    if (resumePosition == null) return
    try {
      playerRef.current?.setCurrentTime(resumePosition)
    } catch (err) {
      console.error('[JapaneseLessonPage] resume seek', err)
    }
    setResumePosition(null)
  }

  async function handleToggleComplete() {
    if (!user || !lesson) return
    setMarkBusy(true)
    try {
      if (completed) {
        await markLessonIncomplete(user.uid, lesson.id)
        setCompleted(false)
        autoCompletedRef.current = false
        toast.success('Marked as not complete')
      } else {
        await markLessonComplete(user.uid, lesson.id)
        setCompleted(true)
        autoCompletedRef.current = true
        toast.success('Lesson marked complete')
      }
    } catch (err) {
      console.error('[JapaneseLessonPage] toggle complete', err)
      toast.error('Could not update progress.')
    } finally {
      setMarkBusy(false)
    }
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
  const scriptSettled = playerjsLoaded || playerjsFailed
  const showIframe = Boolean(embedUrl) && scriptSettled

  return (
    <div className="space-y-5">
      {lesson.type === 'video' && (
        <Script
          src={PLAYERJS_SRC}
          strategy="afterInteractive"
          onLoad={() => setPlayerjsLoaded(true)}
          onError={() => setPlayerjsFailed(true)}
        />
      )}

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
        <>
          {resumePosition != null && (
            <div className="flex items-center justify-between rounded-lg border border-[#1A6BAD]/30 bg-[#1A6BAD]/5 px-4 py-2.5">
              <p className="font-inter text-sm text-[#0B3D6B] dark:text-white">
                You left off at {formatMMSS(resumePosition)}
              </p>
              <button
                type="button"
                onClick={handleResume}
                className="rounded-lg bg-[#1A6BAD] px-3 py-1.5 font-jakarta text-xs font-bold text-white hover:bg-[#155a94]"
              >
                Resume from {formatMMSS(resumePosition)}
              </button>
            </div>
          )}

          <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black">
            {showIframe && embedUrl && (
              <iframe
                ref={iframeRef}
                src={embedUrl}
                className="h-full w-full"
                allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
                allowFullScreen
              />
            )}
            {(videoLoading || (embedUrl && !scriptSettled)) && (
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
        </>
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
          disabled={markBusy}
          onClick={handleToggleComplete}
          className={
            completed
              ? 'rounded-lg border border-emerald-400 px-4 py-2 font-jakarta text-sm font-bold text-emerald-600 hover:bg-emerald-50 disabled:opacity-50 dark:border-emerald-600 dark:text-emerald-300 dark:hover:bg-emerald-900/20'
              : 'rounded-lg bg-[#E8A020] px-4 py-2 font-jakarta text-sm font-bold text-[#0B3D6B] hover:bg-[#F5B942] disabled:opacity-50'
          }
        >
          {completed ? (
            <>
              <span className="ti ti-circle-check mr-1.5" aria-hidden="true" />
              Completed — mark incomplete
            </>
          ) : (
            'Mark complete'
          )}
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
