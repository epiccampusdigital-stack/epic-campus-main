import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminDb } from '@/lib/firebase/admin'
import { createBunnyVideo, buildBunnyUploadTarget } from '@/lib/jp/bunny'

export const dynamic = 'force-dynamic'

async function verifyAdmin(req: NextRequest): Promise<boolean> {
  const authHeader = req.headers.get('authorization') || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return false
  try {
    const decoded = await adminAuth.verifyIdToken(token)
    const snap = await adminDb.collection('users').doc(decoded.uid).get()
    const role = String(snap.data()?.role ?? '')
    return role === 'admin' || role === 'owner'
  } catch {
    return false
  }
}

// Admin/owner only — the response includes the Bunny AccessKey so the client
// can PUT the file straight to Bunny without routing it through our server.
// Never expose this route to any other role.
export async function POST(req: NextRequest) {
  if (!(await verifyAdmin(req))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const { title } = await req.json()
    if (!title || typeof title !== 'string') {
      return NextResponse.json({ error: 'title is required' }, { status: 400 })
    }

    const { guid } = await createBunnyVideo(title)
    const { uploadUrl, accessKey } = buildBunnyUploadTarget(guid)

    return NextResponse.json({ guid, uploadUrl, accessKey })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Video creation failed'
    console.error('[api/jp/video-upload]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
