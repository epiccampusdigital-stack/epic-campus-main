// Shared, framework-agnostic logic for auto-generating a payments/{studentId}
// installment plan from a simple fee/paid-amount/status triple. Used by both
// the client-side student form (firebase/firestore) and the server-side
// account-creation helper (firebase-admin) — kept free of any Firestore SDK
// import so it works in both contexts.

export type AutoPaymentStatus = 'paid' | 'partial' | 'pending'

export interface AutoInstallment {
  id: string
  label: string
  amount: number
  dueDate: string
  paidAt?: string
}

/** Tags applied to auto-generated plan docs so a later sync from a different
 *  origin never clobbers a plan it didn't create (e.g. a manually configured
 *  multi-installment schedule set up via the Payments Tracker). */
export const PLAN_SOURCE = {
  STUDENT_FORM: 'student-form-auto',
  ENROLLMENT: 'enrollment-auto',
} as const

/** Normalizes any incoming payment-status spelling (including the legacy
 *  'unpaid' some external callers use) to the canonical Student.paymentStatus values. */
export function normalizePaymentStatus(status: unknown): AutoPaymentStatus {
  if (status === 'paid') return 'paid'
  if (status === 'partial') return 'partial'
  return 'pending'
}

export function buildAutoInstallments(
  feeAmount: number,
  paymentStatus: AutoPaymentStatus,
  paidAmount: number,
): AutoInstallment[] {
  const now = new Date().toISOString()
  // Unpaid installments default 30 days out — a due date of "now" would read as
  // already overdue the instant the tracker page renders it.
  const futureDue = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

  if (paymentStatus === 'paid') {
    return [{ id: 'inst-1', label: 'Full Payment', amount: feeAmount, dueDate: now, paidAt: now }]
  }
  if (paymentStatus === 'partial') {
    const paid = Math.min(Math.max(0, paidAmount), feeAmount)
    const pending = Math.max(0, feeAmount - paid)
    const installments: AutoInstallment[] = []
    if (paid > 0) installments.push({ id: 'inst-1', label: 'Amount Paid', amount: paid, dueDate: now, paidAt: now })
    if (pending > 0) {
      installments.push({ id: `inst-${installments.length + 1}`, label: 'Balance Due', amount: pending, dueDate: futureDue })
    }
    return installments
  }
  return [{ id: 'inst-1', label: 'Course Fee', amount: feeAmount, dueDate: futureDue }]
}
