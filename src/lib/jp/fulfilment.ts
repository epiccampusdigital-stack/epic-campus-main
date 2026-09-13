import type { Query } from 'firebase-admin/firestore'
import { adminDb } from '@/lib/firebase/admin'
import { sendWhatsApp } from '@/lib/twilio'
import type { JpFulfilment, JpFulfilmentStatus } from '@/types'

// Admin-SDK only — see src/lib/jp/orders.ts for why. jpFulfilment/{orderId}
// write access under firestore.rules is admin/owner/reception only, so
// these are always called from staff-triggered API routes.

function fulfilmentCollection() {
  return adminDb.collection('jpFulfilment')
}

function fulfilmentRef(orderId: string) {
  return fulfilmentCollection().doc(orderId)
}

function parseFulfilment(id: string, data: Record<string, unknown>): JpFulfilment {
  return {
    id,
    orderId: String(data.orderId ?? id),
    studentId: String(data.studentId ?? ''),
    status: (data.status as JpFulfilmentStatus) ?? 'pending',
    packedBy: data.packedBy == null ? null : String(data.packedBy),
    packedAt: data.packedAt == null ? null : String(data.packedAt),
    dispatchedAt: data.dispatchedAt == null ? null : String(data.dispatchedAt),
    postalRef: data.postalRef == null ? null : String(data.postalRef),
    collectedAtCampus: Boolean(data.collectedAtCampus),
    notes: data.notes == null ? null : String(data.notes),
  }
}

export async function getJpFulfilment(orderId: string): Promise<JpFulfilment | null> {
  const snap = await fulfilmentRef(orderId).get()
  if (!snap.exists) return null
  return parseFulfilment(snap.id, snap.data() as Record<string, unknown>)
}

export async function listFulfilmentQueue(status?: JpFulfilmentStatus): Promise<JpFulfilment[]> {
  let q: Query = fulfilmentCollection()
  if (status) q = q.where('status', '==', status)
  const snap = await q.get()
  return snap.docs
    .map((d) => parseFulfilment(d.id, d.data() as Record<string, unknown>))
    .sort((a, b) => (a.dispatchedAt ?? '').localeCompare(b.dispatchedAt ?? ''))
}

export async function markPacked(orderId: string, staffUid: string): Promise<void> {
  await fulfilmentRef(orderId).set(
    { status: 'packed', packedBy: staffUid, packedAt: new Date().toISOString() },
    { merge: true },
  )
}

export async function markDispatched(orderId: string, postalRef: string): Promise<void> {
  await fulfilmentRef(orderId).set(
    { status: 'dispatched', postalRef, dispatchedAt: new Date().toISOString() },
    { merge: true },
  )

  // Best-effort — never let a notification failure block the dispatch write.
  try {
    const fulfilment = await getJpFulfilment(orderId)
    const studentSnap = fulfilment ? await adminDb.collection('students').doc(fulfilment.studentId).get() : null
    const phone = studentSnap?.exists ? String(studentSnap.data()?.mobile ?? '') : ''
    if (phone) {
      await sendWhatsApp(
        phone,
        `Hi! Your EPIC Campus JFT Foundation study pack has been dispatched 📦\n\nPostal reference: ${postalRef}\n\nThis is a registered SL Post item — there's no online tracking, but keep this reference for your records.`,
      )
    }
  } catch (err) {
    console.error('[markDispatched] notification failed', err)
  }
}

// The type has no dedicated "collected by/at" field, so — same pattern as
// rejectOrder's notes trail — who handed it over is recorded in `notes`
// rather than overloading packedBy/packedAt, which mean something different.
export async function markCollectedAtCampus(orderId: string, staffUid: string): Promise<void> {
  const existing = await getJpFulfilment(orderId)
  const note = `Collected at campus, handed over by ${staffUid} at ${new Date().toISOString()}`
  const notes = existing?.notes ? `${existing.notes}\n${note}` : note
  await fulfilmentRef(orderId).set({ status: 'collected', collectedAtCampus: true, notes }, { merge: true })
}

export async function markDelivered(orderId: string): Promise<void> {
  await fulfilmentRef(orderId).set({ status: 'delivered' }, { merge: true })
}
