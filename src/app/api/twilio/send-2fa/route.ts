import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase/admin'
import { send2FACode, generateOTP } from '@/lib/twilio/helpers'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { userId, phone, name } = await req.json() as { userId: string; phone: string; name: string }
    if (!userId || !phone) return NextResponse.json({ error: 'userId and phone required' }, { status: 400 })

    const code = generateOTP()
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString()

    await adminDb.collection('twoFactorCodes').doc(userId).set({
      code,
      userId,
      expiresAt,
      used: false,
      createdAt: new Date().toISOString(),
    })

    const sent = await send2FACode(phone, name, code)
    if (!sent) return NextResponse.json({ error: 'Failed to send 2FA code' }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[Send2FA]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
