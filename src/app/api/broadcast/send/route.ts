import { NextRequest, NextResponse } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { adminAuth, adminDb } from '@/lib/firebase/admin'
import { filterStudentsForBroadcast, parseBroadcast } from '@/lib/broadcast/helpers'
import { parseStudent } from '@/lib/students/helpers'
import { sendWhatsApp } from '@/lib/twilio'
import type { BroadcastRecipient } from '@/types'

export const dynamic = 'force-dynamic'

const ALLOWED_ROLES = ['admin', 'owner', 'reception']

async function verifyStaff(req: NextRequest) {
  const authHeader = req.headers.get('authorization') || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return null
  const decoded = await adminAuth.verifyIdToken(token)
  const userSnap = await adminDb.collection('users').doc(decoded.uid).get()
  const role = String(userSnap.data()?.role ?? '')
  if (!ALLOWED_ROLES.includes(role)) return null
  return decoded.uid
}

export async function POST(req: NextRequest) {
  try {
    const uid = await verifyStaff(req)
    if (!uid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { broadcastId, retryFailed } = await req.json()
    if (!broadcastId) {
      return NextResponse.json({ error: 'broadcastId is required' }, { status: 400 })
    }

    const broadcastRef = adminDb.collection('broadcastMessages').doc(String(broadcastId))
    const broadcastSnap = await broadcastRef.get()
    if (!broadcastSnap.exists) {
      return NextResponse.json({ error: 'Broadcast not found' }, { status: 404 })
    }

    const broadcast = parseBroadcast(
      broadcastSnap.id,
      broadcastSnap.data() as Record<string, unknown>,
    )

    let recipients: BroadcastRecipient[] = []

    if (retryFailed) {
      const failedLogs = await adminDb
        .collection('broadcastLogs')
        .where('broadcastId', '==', broadcastId)
        .where('status', '==', 'failed')
        .get()
      recipients = failedLogs.docs.map((d) => ({
        studentId: String(d.data().studentId ?? ''),
        studentName: String(d.data().studentName ?? ''),
        phone: String(d.data().phone ?? ''),
      }))
    } else {
      const studentsSnap = await adminDb.collection('students').get()
      const students = studentsSnap.docs.map((d) =>
        parseStudent(d.id, d.data() as Record<string, unknown>),
      )
      recipients = filterStudentsForBroadcast(
        students,
        broadcast.audience,
        broadcast.filters,
      )
    }

    if (recipients.length === 0) {
      return NextResponse.json({ error: 'No recipients to send to' }, { status: 400 })
    }

    let sentCount = 0
    let failedCount = 0
    const now = FieldValue.serverTimestamp()

    for (const recipient of recipients) {
      const result = await sendWhatsApp(
        recipient.phone,
        broadcast.message,
        broadcast.mediaUrl,
      )

      const logRef = adminDb.collection('broadcastLogs').doc()
      if (result.ok) {
        sentCount += 1
        await logRef.set({
          broadcastId,
          studentId: recipient.studentId,
          studentName: recipient.studentName,
          phone: recipient.phone,
          status: 'sent',
          sentAt: now,
        })
      } else {
        failedCount += 1
        await logRef.set({
          broadcastId,
          studentId: recipient.studentId,
          studentName: recipient.studentName,
          phone: recipient.phone,
          status: 'failed',
          error: result.error ?? 'Send failed',
          sentAt: now,
        })
      }
    }

    let finalStatus: 'sent' | 'failed' | 'partial' = 'sent'
    if (failedCount > 0 && sentCount === 0) finalStatus = 'failed'
    else if (failedCount > 0) finalStatus = 'partial'

    await broadcastRef.update({
      status: finalStatus,
      sentAt: now,
      recipientCount: recipients.length,
      recipientNumbers: recipients.map((r) => r.phone),
    })

    return NextResponse.json({
      ok: true,
      sent: sentCount,
      failed: failedCount,
      status: finalStatus,
    })
  } catch (err) {
    console.error('[broadcast/send]', err)
    const message = err instanceof Error ? err.message : 'Send failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
