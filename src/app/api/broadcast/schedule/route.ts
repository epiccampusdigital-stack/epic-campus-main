import { NextRequest, NextResponse } from 'next/server'
import { Timestamp } from 'firebase-admin/firestore'
import { adminDb } from '@/lib/firebase/admin'
import { filterStudentsForBroadcast, parseBroadcast } from '@/lib/broadcast/helpers'
import { parseStudent } from '@/lib/students/helpers'
import { sendWhatsApp } from '@/lib/twilio'

export const dynamic = 'force-dynamic'

/** Process due scheduled broadcasts. Call via cron every 5 minutes with CRON_SECRET header. */
export async function GET(req: NextRequest) {
  try {
    const secret = req.headers.get('x-cron-secret') || req.nextUrl.searchParams.get('secret')
    const expected = process.env.BROADCAST_CRON_SECRET || process.env.CRON_SECRET
    if (expected && secret !== expected) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const now = Timestamp.now()
    const dueSnap = await adminDb
      .collection('broadcastMessages')
      .where('status', '==', 'scheduled')
      .where('scheduledAt', '<=', now)
      .get()

    if (dueSnap.empty) {
      return NextResponse.json({ processed: 0 })
    }

    const studentsSnap = await adminDb.collection('students').get()
    const students = studentsSnap.docs.map((d) =>
      parseStudent(d.id, d.data() as Record<string, unknown>),
    )

    let processed = 0

    for (const broadcastDoc of dueSnap.docs) {
      const broadcast = parseBroadcast(
        broadcastDoc.id,
        broadcastDoc.data() as Record<string, unknown>,
      )
      const recipients = filterStudentsForBroadcast(
        students,
        broadcast.audience,
        broadcast.filters,
      )

      let sentCount = 0
      let failedCount = 0

      for (const recipient of recipients) {
        const result = await sendWhatsApp(
          recipient.phone,
          broadcast.message,
          broadcast.mediaUrl,
        )

        await adminDb.collection('broadcastLogs').add({
          broadcastId: broadcastDoc.id,
          studentId: recipient.studentId,
          studentName: recipient.studentName,
          phone: recipient.phone,
          status: result.ok ? 'sent' : 'failed',
          error: result.ok ? null : result.error ?? 'Send failed',
          sentAt: Timestamp.now(),
        })

        if (result.ok) sentCount += 1
        else failedCount += 1
      }

      let finalStatus: 'sent' | 'failed' | 'partial' = 'sent'
      if (failedCount > 0 && sentCount === 0) finalStatus = 'failed'
      else if (failedCount > 0) finalStatus = 'partial'

      await broadcastDoc.ref.update({
        status: finalStatus,
        sentAt: Timestamp.now(),
        recipientCount: recipients.length,
        recipientNumbers: recipients.map((r) => r.phone),
      })

      processed += 1
    }

    return NextResponse.json({ processed })
  } catch (err) {
    console.error('[broadcast/schedule]', err)
    const message = err instanceof Error ? err.message : 'Schedule processing failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
