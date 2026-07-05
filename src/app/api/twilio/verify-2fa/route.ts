import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase/admin'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { userId, code } = await req.json() as { userId: string; code: string }
    if (!userId || !code) return NextResponse.json({ error: 'userId and code required' }, { status: 400 })

    const docSnap = await adminDb.collection('twoFactorCodes').doc(userId).get()
    if (!docSnap.exists) return NextResponse.json({ error: 'No 2FA code found' }, { status: 404 })

    const data = docSnap.data()!
    const now = new Date().toISOString()

    if (data.used) return NextResponse.json({ error: 'Code already used' }, { status: 400 })
    if (data.expiresAt < now) return NextResponse.json({ error: 'Code expired' }, { status: 400 })
    if (data.code !== code) return NextResponse.json({ error: 'Invalid code' }, { status: 400 })

    await adminDb.collection('twoFactorCodes').doc(userId).update({ used: true, usedAt: now })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[Verify2FA]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
