import { NextRequest, NextResponse } from 'next/server'
import { sendPaymentConfirmation } from '@/lib/twilio/helpers'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { phone, studentName, amount, installmentNo } = await req.json() as {
      phone: string
      studentName: string
      amount: number
      installmentNo: number
    }
    await sendPaymentConfirmation(phone, studentName, amount ?? 0, installmentNo)
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[PaymentConfirmed]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
