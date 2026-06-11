import { NextRequest, NextResponse } from 'next/server'
import { sendWhatsApp, MESSAGES } from '@/lib/twilio'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { type, phone, name, data } = body

    if (!phone || !name || !type) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    let message = ''
    switch (type) {
      case 'payment':
        message = MESSAGES.paymentReceived(name, data?.amount || 'an amount')
        break
      case 'exam':
        message = MESSAGES.examResult(name, data?.paper || 'your', data?.score || 'N/A')
        break
      case 'visa':
        message = MESSAGES.visaUpdate(name, data?.status || 'updated')
        break
      case 'enrollment':
        message = MESSAGES.enrollmentConfirmed(name, data?.program || 'your program')
        break
      case 'guardian-portal':
        message = `Hi ${name}, you have been registered as a guardian for ${data?.studentName ?? 'your child'} at EPIC Campus.\n\nYour parent portal access code is: *${data?.code ?? '------'}*\n\nRegister at: ${data?.portalUrl ?? 'epiccampus.live/parent-register'} using this code to track progress, payments, and exam results.\n\nInfo: info@epiccampus.lk`
        break
      default:
        return NextResponse.json({ error: 'Unknown notification type' }, { status: 400 })
    }

    const result = await sendWhatsApp(phone, message)
    return NextResponse.json({ success: true, sent: result.ok })
  } catch (err) {
    console.error('[notify API]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
