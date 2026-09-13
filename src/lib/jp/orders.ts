import type { Query } from 'firebase-admin/firestore'
import { adminDb } from '@/lib/firebase/admin'
import { buildJpEnrollmentId } from '@/lib/jp/enrollments'
import { sendWhatsApp } from '@/lib/twilio'
import type { JpEnrollment, JpEnrollmentSource, JpFulfilment, JpOrder, JpOrderRail, JpOrderStatus } from '@/types'

// Admin-SDK only. markOrderPaid/markOrderAwaitingVerification/rejectOrder are
// staff- or webhook-privileged writes under firestore.rules (a student may
// only ever *create* a jpOrders doc, never update one), and the Stripe/PayPal
// webhooks that call markOrderPaid have no signed-in user context at all —
// so every function here runs with the Admin SDK, callable uniformly from
// API routes regardless of who/what triggered them. See src/lib/jp/courses.ts
// for the same pattern.

function ordersRef() {
  return adminDb.collection('jpOrders')
}

function orderRef(orderId: string) {
  return ordersRef().doc(orderId)
}

function fulfilmentRef(orderId: string) {
  return adminDb.collection('jpFulfilment').doc(orderId)
}

function parseOrder(id: string, data: Record<string, unknown>): JpOrder {
  return {
    id,
    studentId: String(data.studentId ?? ''),
    uid: String(data.uid ?? ''),
    courseId: String(data.courseId ?? ''),
    courseFeeLKR: Number(data.courseFeeLKR ?? 0),
    postageLKR: Number(data.postageLKR ?? 0),
    totalLKR: Number(data.totalLKR ?? 0),
    rail: (data.rail as JpOrderRail) ?? 'bank_transfer',
    status: (data.status as JpOrderStatus) ?? 'pending',
    paymentRef: data.paymentRef == null ? null : String(data.paymentRef),
    receiptUploadPath: data.receiptUploadPath == null ? null : String(data.receiptUploadPath),
    deliveryName: String(data.deliveryName ?? ''),
    deliveryAddress: String(data.deliveryAddress ?? ''),
    deliveryDistrict: String(data.deliveryDistrict ?? ''),
    deliveryPhone: String(data.deliveryPhone ?? ''),
    createdAt: String(data.createdAt ?? ''),
    paidAt: data.paidAt == null ? null : String(data.paidAt),
    verifiedBy: data.verifiedBy == null ? null : String(data.verifiedBy),
    notes: data.notes == null ? null : String(data.notes),
  }
}

export interface CreateJpOrderParams {
  studentId: string
  uid: string
  courseId: string
  courseFeeLKR: number
  postageLKR: number
  rail: JpOrderRail
  deliveryName: string
  deliveryAddress: string
  deliveryDistrict: string
  deliveryPhone: string
  /** Bank-transfer orders carry their generated reference code from creation. */
  paymentRef?: string | null
  notes?: string | null
}

export async function createJpOrder(params: CreateJpOrderParams): Promise<JpOrder> {
  const ref = ordersRef().doc()
  const order: JpOrder = {
    id: ref.id,
    studentId: params.studentId,
    uid: params.uid,
    courseId: params.courseId,
    courseFeeLKR: params.courseFeeLKR,
    postageLKR: params.postageLKR,
    totalLKR: params.courseFeeLKR + params.postageLKR,
    rail: params.rail,
    status: 'pending',
    paymentRef: params.paymentRef ?? null,
    receiptUploadPath: null,
    deliveryName: params.deliveryName,
    deliveryAddress: params.deliveryAddress,
    deliveryDistrict: params.deliveryDistrict,
    deliveryPhone: params.deliveryPhone,
    createdAt: new Date().toISOString(),
    paidAt: null,
    verifiedBy: null,
    notes: params.notes ?? null,
  }
  const { id, ...data } = order
  await ref.set(data)
  return order
}

export async function getJpOrder(orderId: string): Promise<JpOrder | null> {
  const snap = await orderRef(orderId).get()
  if (!snap.exists) return null
  return parseOrder(snap.id, snap.data() as Record<string, unknown>)
}

export interface ListJpOrdersFilters {
  status?: JpOrderStatus
  rail?: JpOrderRail
  /** students doc id */
  studentId?: string
  /** Firebase Auth uid — matches the jpOrders.uid + createdAt index (5B) */
  uid?: string
}

export async function listJpOrders(filters: ListJpOrdersFilters = {}): Promise<JpOrder[]> {
  let q: Query = ordersRef()
  if (filters.status) q = q.where('status', '==', filters.status)
  if (filters.rail) q = q.where('rail', '==', filters.rail)
  if (filters.studentId) q = q.where('studentId', '==', filters.studentId)
  if (filters.uid) q = q.where('uid', '==', filters.uid)
  const snap = await q.get()
  return snap.docs
    .map((d) => parseOrder(d.id, d.data() as Record<string, unknown>))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

// The rail's enrollment source is always a subset of JpEnrollmentSource, so
// this narrows for free — no 'admin' rail exists, that source is reserved
// for staff-granted enrollments via the management console.
async function grantJpEnrollmentFromOrder(order: JpOrder, source: JpEnrollmentSource): Promise<void> {
  const id = buildJpEnrollmentId(order.studentId, order.courseId)
  const enrollment: JpEnrollment = {
    id,
    studentId: order.studentId,
    courseId: order.courseId,
    source,
    status: 'active',
    grantedBy: 'system',
    grantedAt: new Date().toISOString(),
    expiresAt: null,
    startedAt: new Date().toISOString(),
    notes: `Granted by order ${order.id}`,
  }
  const { id: _id, ...data } = enrollment
  await adminDb.collection('jpEnrollments').doc(id).set(data, { merge: true })
}

async function createPendingFulfilment(order: JpOrder): Promise<void> {
  const fulfilment: JpFulfilment = {
    id: order.id,
    orderId: order.id,
    studentId: order.studentId,
    status: 'pending',
    packedBy: null,
    packedAt: null,
    dispatchedAt: null,
    postalRef: null,
    collectedAtCampus: false,
    notes: null,
  }
  const { id, ...data } = fulfilment
  await fulfilmentRef(order.id).set(data)
}

// The single place that grants JP course access. Every payment rail
// (Stripe webhook, PayPal capture, staff bank-transfer approval) must
// funnel through this — never write status:'paid' or create a jpEnrollment
// anywhere else.
export async function markOrderPaid(orderId: string, paymentRef: string, rail: JpOrderRail): Promise<JpOrder> {
  const order = await getJpOrder(orderId)
  if (!order) throw new Error(`jpOrders/${orderId} not found`)

  const paidAt = new Date().toISOString()
  await orderRef(orderId).set({ status: 'paid', paidAt, paymentRef, rail }, { merge: true })
  const updated: JpOrder = { ...order, status: 'paid', paidAt, paymentRef, rail }

  await grantJpEnrollmentFromOrder(updated, rail)
  await createPendingFulfilment(updated)

  // Best-effort — a notification failure must never undo a successful
  // payment/enrollment grant, so this is never allowed to throw.
  try {
    const studentSnap = await adminDb.collection('students').doc(order.studentId).get()
    const phone = studentSnap.exists ? String(studentSnap.data()?.mobile ?? '') : ''
    if (phone) {
      await sendWhatsApp(
        phone,
        `Hi ${order.deliveryName}, your EPIC Campus JFT Foundation payment was received! 🎉\n\nYour course is now unlocked — log in at epiccampus.live to start learning.\n\nWe'll be in touch about your study pack soon.`,
      )
    }
  } catch (err) {
    console.error('[markOrderPaid] notification failed', err)
  }

  return updated
}

export async function markOrderAwaitingVerification(orderId: string, receiptUploadPath: string): Promise<JpOrder> {
  const order = await getJpOrder(orderId)
  if (!order) throw new Error(`jpOrders/${orderId} not found`)

  await orderRef(orderId).set({ status: 'awaiting_verification', receiptUploadPath }, { merge: true })
  return { ...order, status: 'awaiting_verification', receiptUploadPath }
}

export async function rejectOrder(orderId: string, reason: string): Promise<JpOrder> {
  const order = await getJpOrder(orderId)
  if (!order) throw new Error(`jpOrders/${orderId} not found`)

  const note = `Rejected: ${reason}`
  const notes = order.notes ? `${order.notes}\n${note}` : note
  await orderRef(orderId).set({ status: 'failed', notes }, { merge: true })
  return { ...order, status: 'failed', notes }
}

// A short, unique-enough human-readable code the student writes on their
// bank transfer slip, e.g. EPJP-K3F9A. Includes a slice of the student's own
// id purely so two codes generated in the same millisecond for different
// students still look distinct at a glance — it's not the source of
// uniqueness (the random suffix is).
export function generateBankReference(studentId: string): string {
  const seed = studentId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 2).toUpperCase()
  const random = Math.random().toString(36).slice(2, 7).toUpperCase()
  return `EPJP-${seed}${random}`
}
