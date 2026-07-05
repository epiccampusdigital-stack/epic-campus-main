import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase/admin'
import { sendOTP, generateOTP } from '@/lib/twilio/helpers'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { phone, userId } = await req.json() as { phone: string; userId: string }
    if (!phone || !userId) return NextResponse.json({ error: 'phone and userId required' }, { status: 400 })

    const otp = generateOTP()
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()

    await adminDb.collection('otpVerifications').doc(userId).set({
      otp,
      phone,
      userId,
      expiresAt,
      verified: false,
      createdAt: new Date().toISOString(),
    })

    const sent = await sendOTP(phone, otp)
    if (!sent) {
      return NextResponse.json({ error: 'Failed to send OTP' }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'OTP sent' })
  } catch (err) {
    console.error('[SendOTP]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
