import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminDb } from '@/lib/firebase/admin'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { staffId, uid } = await req.json()
    if (!staffId) return NextResponse.json({ error: 'staffId required' }, { status: 400 })

    if (uid) {
      await adminAuth.deleteUser(uid).catch((err) => console.error('[DeleteAuth]', err))
    }

    await adminDb.collection('users').doc(staffId).delete().catch(() => {})
    await adminDb.collection('staff').doc(staffId).delete().catch(() => {})

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[DeleteAccount]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
