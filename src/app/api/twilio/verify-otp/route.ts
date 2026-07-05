import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase/admin'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { userId, otp } = await req.json() as { userId: string; otp: string }
    if (!userId || !otp) return NextResponse.json({ error: 'userId and otp required' }, { status: 400 })

    const docSnap = await adminDb.collection('otpVerifications').doc(userId).get()
    if (!docSnap.exists) return NextResponse.json({ error: 'No OTP found' }, { status: 404 })

    const data = docSnap.data()!
    const now = new Date().toISOString()

    if (data.verified) return NextResponse.json({ error: 'OTP already used' }, { status: 400 })
    if (data.expiresAt < now) return NextResponse.json({ error: 'OTP expired' }, { status: 400 })
    if (data.otp !== otp) return NextResponse.json({ error: 'Invalid OTP' }, { status: 400 })

    await adminDb.collection('otpVerifications').doc(userId).update({
      verified: true,
      verifiedAt: now,
    })
    await adminDb.collection('users').doc(userId).update({
      phoneVerified: true,
      phone: data.phone,
    }).catch(() => {})

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[VerifyOTP]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
