import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminDb } from '@/lib/firebase/admin'
import { getBunnyVideo } from '@/lib/jp/bunny'

export const dynamic = 'force-dynamic'

// Read-only status check — also allowed for teacher so the Course builder's
// view-only mode can still show transcoding status (upload/delete/edit stay
// admin/owner only via the other jp/* routes).
async function verifyViewer(req: NextRequest): Promise<boolean> {
  const authHeader = req.headers.get('authorization') || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return false
  try {
    const decoded = await adminAuth.verifyIdToken(token)
    const snap = await adminDb.collection('users').doc(decoded.uid).get()
    const role = String(snap.data()?.role ?? '')
    return role === 'admin' || role === 'owner' || role === 'teacher'
  } catch {
    return false
  }
}

export async function GET(req: NextRequest) {
  if (!(await verifyViewer(req))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const guid = req.nextUrl.searchParams.get('guid')
  if (!guid) {
    return NextResponse.json({ error: 'guid is required' }, { status: 400 })
  }

  try {
    const video = await getBunnyVideo(guid)
    return NextResponse.json(video)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch video status'
    console.error('[api/jp/video-status]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
