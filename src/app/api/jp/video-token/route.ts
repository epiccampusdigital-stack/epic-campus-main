import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase/admin'
import { signBunnyEmbedToken, buildBunnyEmbedUrl } from '@/lib/jp/bunny'
import { findJpLessonById } from '@/lib/jp/courses'
import { buildJpEnrollmentId, isJpEnrollmentActive, parseJpEnrollment } from '@/lib/jp/enrollments'
import { isLessonReleased } from '@/lib/jp/drip'
import { resolveStudentId, verifySignedIn } from '@/lib/jp/serverAuth'
import type { JpEnrollment } from '@/types'

export const dynamic = 'force-dynamic'

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
