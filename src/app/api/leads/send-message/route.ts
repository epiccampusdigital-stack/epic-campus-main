export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { adminAuth, adminDb } from '@/lib/firebase/admin'
import { sendWhatsApp } from '@/lib/twilio'

/** Twilio rejects an empty body, and a WhatsApp message caps out at 1600 chars. */
const MAX_MESSAGE_LENGTH = 1600

async function verifyAdmin(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get('authorization') || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return null
  try {
    const decoded = await adminAuth.verifyIdToken(token)
    const snap = await adminDb.collection('users').doc(decoded.uid).get()
    const role = String(snap.data()?.role ?? '')
    return role === 'admin' || role === 'owner' || role === 'ai_manager'
      ? decoded.uid
      : null
  } catch {
    return null
  }
}

/**
 * Sends a staff-written WhatsApp reply on a lead the AI has been paused on.
 *
 * The messages subcollection is write-denied to clients (it is the compliance
 * transcript), so the human reply has to be logged here via the Admin SDK — the
 * same way the AI's own replies and the payment link are logged.
 */
export async function POST(req: NextRequest) {
  const uid = await verifyAdmin(req)
  if (!uid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { leadId, text } = (await req.json()) as { leadId?: string; text?: string }
    if (!leadId) {
      return NextResponse.json({ error: 'Missing leadId' }, { status: 400 })
    }

    const message = String(text ?? '').trim()
    if (!message) {
      return NextResponse.json({ error: 'Message cannot be empty' }, { status: 400 })
    }
    if (message.length > MAX_MESSAGE_LENGTH) {
      return NextResponse.json(
        { error: `Message is too long (max ${MAX_MESSAGE_LENGTH} characters)` },
        { status: 400 },
      )
    }

    const leadRef = adminDb.collection('leads').doc(leadId)
    const snap = await leadRef.get()
    if (!snap.exists) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    }

    const lead = snap.data()!
    const phone = String(lead.phone ?? '')
    if (!phone) {
      return NextResponse.json({ error: 'Lead has no phone number' }, { status: 400 })
    }

    // Guard against a human and the AI both replying to the same turn: staff
    // must take over (aiPaused) before they can type into the thread.
    if (lead.aiPaused !== true) {
      return NextResponse.json(
        { error: 'Take over this conversation before replying — the AI is still handling it.' },
        { status: 409 },
      )
    }

    const sent = await sendWhatsApp(phone, message)
    if (!sent.ok) {
      console.error('[leads/send-message] Twilio send failed:', sent.error)
      return NextResponse.json({ error: 'Could not send WhatsApp message' }, { status: 502 })
    }

    await leadRef.collection('messages').add({
      channel: 'whatsapp',
      direction: 'outbound',
      text: message,
      sender: 'human',
      sentBy: uid,
      timestamp: FieldValue.serverTimestamp(),
    })

    await leadRef.update({
      lastMessageAt: FieldValue.serverTimestamp(),
      lastHumanReplyBy: uid,
      lastHumanReplyAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[leads/send-message]', err)
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 })
  }
}
