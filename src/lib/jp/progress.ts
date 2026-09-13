import { collection, doc, getDoc, getDocs, setDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import type { JpLesson, JpLessonProgress } from '@/types'

// jpProgress/{uid}/lessons/{lessonId} is keyed by the student's Firebase
// Auth UID — see firestore.rules (`request.auth.uid == studentId` on
// jpProgress/{studentId}) — NOT the students/{id} Firestore document ID.
// Those differ for most students in this database (154 of 210, per
// scripts/report-student-uid-mismatch.mjs), so every function below takes
// `uid` rather than `studentId` to keep that unambiguous at call sites.

function lessonProgressRef(uid: string, lessonId: string) {
  return doc(db, 'jpProgress', uid, 'lessons', lessonId)
}

function parseProgress(lessonId: string, data: Record<string, unknown>): JpLessonProgress {
  return {
    lessonId,
    watchedSec: Number(data.watchedSec ?? 0),
    durationSec: Number(data.durationSec ?? 0),
    completed: Boolean(data.completed),
    lastAt: String(data.lastAt ?? ''),
    completedAt: data.completedAt == null ? null : String(data.completedAt),
  }
}

export async function getLessonProgress(uid: string, lessonId: string): Promise<JpLessonProgress | null> {
  const snap = await getDoc(lessonProgressRef(uid, lessonId))
  if (!snap.exists()) return null
  return parseProgress(lessonId, snap.data())
}

export async function listCourseProgress(uid: string): Promise<JpLessonProgress[]> {
  const snap = await getDocs(collection(db, 'jpProgress', uid, 'lessons'))
  return snap.docs.map((d) => parseProgress(d.id, d.data()))
}

// Never overwrites completed/completedAt — a student who keeps watching
// after marking a lesson complete (or after auto-complete fires) must not
// have that reset back to false by a later position save.
export async function saveWatchPosition(
  uid: string,
  lessonId: string,
  watchedSec: number,
  durationSec: number,
): Promise<void> {
  await setDoc(
    lessonProgressRef(uid, lessonId),
    {
      watchedSec,
      durationSec,
      lastAt: new Date().toISOString(),
    },
    { merge: true },
  )
}

export async function markLessonComplete(uid: string, lessonId: string): Promise<void> {
  const now = new Date().toISOString()
  await setDoc(
    lessonProgressRef(uid, lessonId),
    {
      completed: true,
      completedAt: now,
      lastAt: now,
    },
    { merge: true },
  )
}

export async function markLessonIncomplete(uid: string, lessonId: string): Promise<void> {
  await setDoc(
    lessonProgressRef(uid, lessonId),
    {
      completed: false,
      completedAt: null,
      lastAt: new Date().toISOString(),
    },
    { merge: true },
  )
}

export interface CourseProgressSummary {
  completedCount: number
  releasedCount: number
  percent: number
}

// `lessons` should already be filtered to the lessons released to this
// student (e.g. via isLessonReleased) — this function doesn't have an
// enrollment to compute drip release from, it just counts completions
// against whatever lesson set it's given.
export function computeCourseProgress(
  lessons: JpLesson[],
  progressDocs: JpLessonProgress[],
): CourseProgressSummary {
  const completedIds = new Set(progressDocs.filter((p) => p.completed).map((p) => p.lessonId))
  const releasedCount = lessons.length
  const completedCount = lessons.filter((l) => completedIds.has(l.id)).length
  const percent = releasedCount > 0 ? Math.round((completedCount / releasedCount) * 100) : 0
  return { completedCount, releasedCount, percent }
}
