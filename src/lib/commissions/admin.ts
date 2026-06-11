import { FieldValue } from 'firebase-admin/firestore'
import { adminDb } from '@/lib/firebase/admin'
import { REGISTRATION_FEE_LKR } from '@/lib/payments/constants'

function calculateCommission(registrationFee: number, commissionRate: number): number {
  return Math.round((registrationFee * commissionRate) / 100)
}

function isRegistrationPayment(
  type: string,
  amount: number,
  feeType?: string,
): boolean {
  return type === 'registration' || feeType === 'registration' || amount === REGISTRATION_FEE_LKR
}

function locationLabel(location?: string): string {
  if (!location) return 'Ahangama'
  const map: Record<string, string> = {
    ahangama: 'Ahangama',
    galle: 'Galle',
    waduraba: 'Waduraba',
    pinnaduwa: 'Pinnaduwa',
  }
  return map[location.toLowerCase()] ?? location
}

/**
 * Server-side commission creation for Stripe webhook (Firebase Admin SDK).
 */
export async function processPaymentCommissionsAdmin(
  paymentId: string,
  payment: {
    type: string
    amount: number
    status: string
    agentId?: string | null
    agentName?: string | null
    paymentDate?: string
    location?: string
    feeType?: string
    studentId: string
    studentName: string
  },
): Promise<void> {
  if (payment.status !== 'paid') return
  if (!isRegistrationPayment(payment.type, payment.amount, payment.feeType)) return

  const studentSnap = await adminDb.collection('students').doc(payment.studentId).get()
  const student = studentSnap.exists ? studentSnap.data()! : {}

  const today = new Date().toISOString().slice(0, 10)
  const enrollmentDate =
    String(student.enrollmentDate ?? '').slice(0, 10) ||
    payment.paymentDate?.slice(0, 10) ||
    today
  const location = locationLabel(
    payment.location ?? (student.location ? String(student.location) : undefined),
  )
  const period = enrollmentDate.slice(0, 7)

  const agentId = payment.agentId || (student.agentId ? String(student.agentId) : null)
  const agentName = payment.agentName || (student.agentName ? String(student.agentName) : null)

  if (agentId) {
    const existing = await adminDb
      .collection('agentCommissions')
      .where('paymentId', '==', paymentId)
      .limit(1)
      .get()
    if (existing.empty) {
      const agentSnap = await adminDb.collection('users').doc(agentId).get()
      if (agentSnap.exists) {
        const agentData = agentSnap.data()!
        const commissionRate = Number(agentData.commissionRate ?? 0)
        if (commissionRate > 0) {
          await adminDb.collection('agentCommissions').add({
            agentId,
            agentName: agentName ?? String(agentData.displayName ?? ''),
            studentId: payment.studentId,
            studentName: payment.studentName,
            enrollmentDate,
            paymentId,
            registrationFee: payment.amount,
            commissionRate,
            commissionAmount: calculateCommission(payment.amount, commissionRate),
            status: 'pending',
            createdAt: FieldValue.serverTimestamp(),
            location,
          })
        }
      }
    }
  }

  const referredByStaffId = student.referredByStaffId
    ? String(student.referredByStaffId)
    : null
  if (referredByStaffId) {
    const existing = await adminDb
      .collection('staffReferrals')
      .where('paymentId', '==', paymentId)
      .limit(1)
      .get()
    if (existing.empty) {
      const staffSnap = await adminDb.collection('users').doc(referredByStaffId).get()
      if (staffSnap.exists) {
        const staffData = staffSnap.data()!
        const commissionRate = Number(staffData.commissionRate ?? 0)
        if (commissionRate > 0) {
          await adminDb.collection('staffReferrals').add({
            staffId: referredByStaffId,
            staffName:
              (student.referredByStaffName ? String(student.referredByStaffName) : null) ??
              String(staffData.displayName ?? ''),
            studentId: payment.studentId,
            studentName: payment.studentName,
            paymentId,
            registrationFee: payment.amount,
            commissionRate,
            commissionAmount: calculateCommission(payment.amount, commissionRate),
            period,
            includedInPayroll: false,
            createdAt: FieldValue.serverTimestamp(),
          })
        }
      }
    }
  }
}
