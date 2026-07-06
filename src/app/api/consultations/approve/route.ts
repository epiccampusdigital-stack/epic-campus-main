import { NextResponse } from 'next/server'
import {
  formatConsultationDate,
  formatTimeRange,
  parseConsultationBooking,
} from '@/lib/consultations/helpers'
import { adminDb } from '@/lib/firebase/admin'
import { sendWhatsApp } from '@/lib/twilio'

export async function POST(request: Request) {
  try {
    const { bookingId } = (await request.json()) as { bookingId?: string }
    if (!bookingId) {
      return NextResponse.json({ error: 'bookingId required' }, { status: 400 })
    }

    const snap = await adminDb.collection('roomBookings').doc(bookingId).get()
    if (!snap.exists) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    const booking = parseConsultationBooking(
      snap.id,
      snap.data() as Record<string, unknown>,
    )

    await adminDb.collection('roomBookings').doc(bookingId).update({
      status: 'approved',
    })

    let whatsappSent = false
    if (booking.studentPhone) {
      const dateLabel = formatConsultationDate(booking.date)
      const timeLabel = formatTimeRange(booking.startTime, booking.endTime)
      const sendResult = await sendWhatsApp(
        booking.studentPhone,
        `Hi ${booking.studentName}, your EPIC Campus consultation on ${dateLabel} at ${timeLabel} with ${booking.staffName} has been confirmed. See you then! — epiccampus.live`,
      )
      whatsappSent = sendResult.ok
    }

    return NextResponse.json({ ok: true, whatsappSent })
  } catch (err) {
    console.error('[consultations/approve]', err)
    return NextResponse.json({ error: 'Approval failed' }, { status: 500 })
  }
}
