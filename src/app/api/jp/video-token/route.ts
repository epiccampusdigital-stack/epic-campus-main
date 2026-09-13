import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminDb } from '@/lib/firebase/admin'
import { signBunnyEmbedToken, buildBunnyEmbedUrl } from '@/lib/jp/bunny'
import { findJpLessonById } from '@/lib/jp/courses'
import { buildJpEnrollmentId, isJpEnrollmentActive, parseJpEnrollment } from '@/lib/jp/enrollments'
import { isLessonReleased } from '@/lib/jp/drip'
import type { JpEnrollment } from '@/types'

export const dynamic = 'force-dynamic'

async function verifySignedIn(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get('authorization') || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return null
  try {
    const decoded = await adminAuth.verifyIdToken(token)
    return decoded.uid
  } catch {
    return null
  }
}

// Mirrors the client-side fallback chain in loadStudentProfile (studentId
// linked on the user doc, then a students doc keyed by uid, then a uid
// field lookup) — done with the Admin SDK so it doesn't depend on the
// caller's own Firestore security-rule context.
async function resolveStudentId(uid: string): Promise<string | null> {
  const userSnap = await adminDb.collection('users').doc(uid).get()
  const linkedStudentId = userSnap.exists ? String(userSnap.data()?.studentId ?? '') : ''
  if (linkedStudentId) {
    const linkedSnap = await adminDb.collection('students').doc(linkedStudentId).get()
    if (linkedSnap.exists) return linkedSnap.id
  }

  const byDocId = await adminDb.collection('students').doc(uid).get()
  if (byDocId.exists) return byDocId.id

  const byUid = await adminDb.collection('students').where('uid', '==', uid).limit(1).get()
  if (!byUid.empty) return byUid.docs[0].id

  return null
}

async function getActiveEnrollment(studentId: string, courseId: string): Promise<JpEnrollment | null> {
  const id = buildJpEnrollmentId(studentId, courseId)
  const snap = await adminDb.collection('jpEnrollments').doc(id).get()
  if (!snap.exists) return null
  const enrollment = parseJpEnrollment(snap.id, snap.data() as Record<string, unknown>)
  return isJpEnrollmentActive(enrollment) ? enrollment : null
}

export async function POST(req: NextRequest) {
  const uid = await verifySignedIn(req)
  if (!uid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { lessonId } = await req.json()
    if (!lessonId || typeof lessonId !== 'string') {
      return NextResponse.json({ error: 'lessonId is required' }, { status: 400 })
    }

    const found = await findJpLessonById(lessonId)
    if (!found || !found.lesson.bunnyVideoId) {
      return NextResponse.json({ error: 'Video not found for lesson' }, { status: 404 })
    }

    // Free-preview lessons are always playable, enrolled or not. Everything
    // else needs an active enrollment that has actually reached this
    // lesson's release week — this is the real protection for paid content,
    // not just the UI-side lock/unlock rendering on the course/lesson pages.
    if (!found.lesson.isFreePreview) {
      const studentId = await resolveStudentId(uid)
      const activeEnrollment = studentId ? await getActiveEnrollment(studentId, found.courseId) : null

      if (!activeEnrollment) {
        return NextResponse.json({ error: 'No active enrollment for this course' }, { status: 403 })
      }
      if (!isLessonReleased(found.lesson, activeEnrollment)) {
        return NextResponse.json({ error: 'This lesson is not released yet' }, { status: 403 })
      }
    }

    const { token, expires } = signBunnyEmbedToken(found.lesson.bunnyVideoId)
    const embedUrl = buildBunnyEmbedUrl(found.lesson.bunnyVideoId, token, expires)

    return NextResponse.json({ embedUrl, expires })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to sign video token'
    console.error('[api/jp/video-token]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
