export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { adminAuth, adminDb } from '@/lib/firebase/admin'

const STAFF_ROLES = ['admin', 'owner', 'reception', 'ai_manager']

async function verifyStaff(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get('authorization') || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return null
  try {
    const decoded = await adminAuth.verifyIdToken(token)
    const snap = await adminDb.collection('users').doc(decoded.uid).get()
    const role = String(snap.data()?.role ?? '')
    return STAFF_ROLES.includes(role) ? decoded.uid : null
  } catch {
    return null
  }
}

/**
 * Human takeover switch: pauses the AI on a lead, or hands the conversation
 * back to it.
 *
 * Goes through the Admin SDK rather than a client write so the audit trail
 * (who paused, when) is stamped server-side and can't be spoofed by whoever
 * happens to hold a staff token — the webhook reads aiPaused to decide whether
 * to answer at all, so it is a meaningful control.
 */
export async function POST(req: NextRequest) {
  const uid = await verifyStaff(req)
  if (!uid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { leadId, aiPaused } = (await req.json()) as {
      leadId?: string
      aiPaused?: unknown
    }
    if (!leadId) {
      return NextResponse.json({ error: 'Missing leadId' }, { status: 400 })
    }
    if (typeof aiPaused !== 'boolean') {
      return NextResponse.json({ error: 'aiPaused must be true or false' }, { status: 400 })
    }

    const leadRef = adminDb.collection('leads').doc(leadId)
    const snap = await leadRef.get()
    if (!snap.exists) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    }

    await leadRef.update({
      aiPaused,
      // Kept (not cleared) when handing back to the AI, so the doc still
      // records who last took the conversation over.
      aiPausedBy: aiPaused ? uid : (snap.data()?.aiPausedBy ?? null),
      aiPausedAt: aiPaused ? FieldValue.serverTimestamp() : (snap.data()?.aiPausedAt ?? null),
      aiResumedBy: aiPaused ? null : uid,
      aiResumedAt: aiPaused ? null : FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    })

    return NextResponse.json({ ok: true, aiPaused })
  } catch (err) {
    console.error('[leads/toggle-ai]', err)
    return NextResponse.json({ error: 'Failed to update the AI takeover state' }, { status: 500 })
  }
}
