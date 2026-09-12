import { NextRequest, NextResponse } from 'next/server'
import { adminAuth } from '@/lib/firebase/admin'
import { signBunnyEmbedToken, buildBunnyEmbedUrl } from '@/lib/jp/bunny'
import { findJpLessonById } from '@/lib/jp/courses'

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

    // TODO(Phase 3/4): before issuing a token, verify `uid` holds an active
    // JpEnrollment for found.courseId and that found.lesson.releaseWeek has
    // been reached. Right now any signed-in user can play any lesson.

    const { token, expires } = signBunnyEmbedToken(found.lesson.bunnyVideoId)
    const embedUrl = buildBunnyEmbedUrl(found.lesson.bunnyVideoId, token, expires)

    return NextResponse.json({ embedUrl, expires })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to sign video token'
    console.error('[api/jp/video-token]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
