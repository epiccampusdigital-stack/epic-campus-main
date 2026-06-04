import { NextRequest, NextResponse } from 'next/server'
import { sendWhatsApp } from '@/lib/twilio'

export async function POST(req: NextRequest) {
  try {
    const { phone, message, studentName, paymentAmount, paymentLink } = await req.json()

    if (!phone || !message) {
      return NextResponse.json({ error: 'Missing phone or message' }, { status: 400 })
    }

    let body = String(message)
    if (paymentLink && paymentAmount != null) {
      const name = studentName ? String(studentName) : 'there'
      body = `Hi ${name}, your payment of LKR ${Number(paymentAmount).toLocaleString('en-LK')} is ready. Pay here: ${paymentLink}`
    }

    const result = await sendWhatsApp(String(phone), body)
    return NextResponse.json({ ok: true, sent: result.ok })
  } catch (err) {
    console.error('[messages/whatsapp]', err)
    return NextResponse.json({ error: 'Failed to send WhatsApp message' }, { status: 500 })
  }
}
