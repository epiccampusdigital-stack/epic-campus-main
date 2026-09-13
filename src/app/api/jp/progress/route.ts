import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase/admin'
import { verifyJpRole } from '@/lib/jp/serverAuth'
import type { JpLessonProgress } from '@/types'

export const dynamic = 'force-dynamic'

const STAFF_ROLES = ['admin', 'owner', 'teacher']

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

// Staff-only, Admin SDK read. Students read their own jpProgress directly
// under the client rules (request.auth.uid == studentId), but that same
// rule means a teacher/admin viewing another student's progress from the
// browser would be denied — so this route reads it server-side instead.
// Pass ?uids=uid1,uid2,... to batch-fetch multiple students at once (e.g.
// for a table of rows) instead of firing one request per row.
export async function GET(req: NextRequest) {
  const staff = await verifyJpRole(req, STAFF_ROLES)
  if (!staff) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const uidsParam = req.nextUrl.searchParams.get('uids') ?? req.nextUrl.searchParams.get('uid') ?? ''
  const uids = Array.from(new Set(uidsParam.split(',').map((u) => u.trim()).filter(Boolean)))
  if (uids.length === 0) {
    return NextResponse.json({ error: 'uid or uids is required' }, { status: 400 })
  }

  try {
    const entries = await Promise.all(
      uids.map(async (uid) => {
        const snap = await adminDb.collection('jpProgress').doc(uid).collection('lessons').get()
        return [uid, snap.docs.map((d) => parseProgress(d.id, d.data()))] as const
      }),
    )
    return NextResponse.json({ progress: Object.fromEntries(entries) })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to load progress'
    console.error('[api/jp/progress]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
