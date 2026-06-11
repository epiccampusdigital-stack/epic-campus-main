import {
  collection,
  doc,
  getDocs,
  getDoc,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  Timestamp,
} from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import type { Student } from '@/types'

// ---------------------------------------------------------------------------
// Agent Commission Records  (stored in `agentCommissions` collection)
// ---------------------------------------------------------------------------

export interface AgentCommissionRecord {
  agentId: string
  agentName: string
  studentId: string
  studentName: string
  enrollmentDate: string
  registrationFee: number
  commissionRate: number
  commissionAmount: number
  status: 'pending' | 'paid' | 'cancelled'
  paidAt?: Timestamp
  paidBy?: string
  paidByName?: string
  location: string
  paymentId?: string
  createdAt?: Timestamp
}

export function parseAgentCommission(
  id: string,
  data: Record<string, unknown>,
): AgentCommissionRecord & { id: string } {
  return {
    id,
    agentId: String(data.agentId ?? ''),
    agentName: String(data.agentName ?? ''),
    studentId: String(data.studentId ?? ''),
    studentName: String(data.studentName ?? ''),
    enrollmentDate: String(data.enrollmentDate ?? ''),
    registrationFee: Number(data.registrationFee ?? 0),
    commissionRate: Number(data.commissionRate ?? 0),
    commissionAmount: Number(data.commissionAmount ?? 0),
    status: (data.status as AgentCommissionRecord['status']) ?? 'pending',
    paidAt: data.paidAt instanceof Timestamp ? data.paidAt : undefined,
    paidBy: data.paidBy ? String(data.paidBy) : undefined,
    paidByName: data.paidByName ? String(data.paidByName) : undefined,
    location: String(data.location ?? ''),
    paymentId: data.paymentId ? String(data.paymentId) : undefined,
    createdAt: data.createdAt instanceof Timestamp ? data.createdAt : undefined,
  }
}

export function formatCommissionStatus(status: string): string {
  switch (status) {
    case 'pending': return 'Pending'
    case 'paid': return 'Paid'
    case 'cancelled': return 'Cancelled'
    default: return status
  }
}

export function getCommissionStatusClasses(status: string): string {
  switch (status) {
    case 'pending':
      return 'bg-amber-50 text-amber-700 border-amber-200'
    case 'paid':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200'
    case 'cancelled':
      return 'bg-red-50 text-red-700 border-red-200'
    default:
      return 'bg-gray-50 text-gray-600 border-gray-200'
  }
}

export async function markCommissionPaid(
  commissionId: string,
  paidByUid: string,
  paidByName?: string,
): Promise<void> {
  await updateDoc(doc(db, 'agentCommissions', commissionId), {
    status: 'paid',
    paidAt: serverTimestamp(),
    paidBy: paidByUid,
    paidByName: paidByName ?? null,
  })
}

export async function markCommissionCancelled(commissionId: string): Promise<void> {
  await updateDoc(doc(db, 'agentCommissions', commissionId), {
    status: 'cancelled',
    cancelledAt: serverTimestamp(),
  })
}

export async function markCommissionsPaidBulk(
  commissionIds: string[],
  paidByUid: string,
  paidByName?: string,
): Promise<void> {
  await Promise.all(
    commissionIds.map((id) =>
      updateDoc(doc(db, 'agentCommissions', id), {
        status: 'paid',
        paidAt: serverTimestamp(),
        paidBy: paidByUid,
        paidByName: paidByName ?? null,
      }),
    ),
  )
}

// ---------------------------------------------------------------------------
// processPaymentCommissions
// Called when a payment is recorded as paid.
// Writes to `agentCommissions` for agent, and `commissions` for staff referrals.
// Idempotent: skips if doc for that student already exists.
// ---------------------------------------------------------------------------

interface PaymentContext {
  type: string
  amount: number
  status: string
  agentId?: string
  agentName?: string
  paymentDate: string
  location?: string
}

export async function processPaymentCommissions(
  paymentDocId: string,
  ctx: PaymentContext,
  student: Student,
): Promise<void> {
  if (ctx.type !== 'registration' || ctx.status !== 'paid') return

  const enrollmentDate = ctx.paymentDate
  const registrationFee = ctx.amount

  // --- Agent commission (agentCommissions collection) ---
  if (ctx.agentId) {
    const existing = await getDocs(
      query(
        collection(db, 'agentCommissions'),
        where('studentId', '==', student.id),
      ),
    )
    if (existing.empty) {
      const agentSnap = await getDoc(doc(db, 'users', ctx.agentId))
      if (agentSnap.exists()) {
        const agentData = agentSnap.data() as Record<string, unknown>
        const commissionRate = Number(agentData.commissionRate ?? 0)
        if (commissionRate > 0) {
          const commissionAmount = Math.round(registrationFee * (commissionRate / 100))
          const newId = doc(collection(db, 'agentCommissions')).id
          await setDoc(doc(db, 'agentCommissions', newId), {
            agentId: ctx.agentId,
            agentName: ctx.agentName ?? String(agentData.displayName ?? ''),
            studentId: student.id,
            studentName: student.name,
            enrollmentDate,
            registrationFee,
            commissionRate,
            commissionAmount,
            status: 'pending',
            location: ctx.location ?? student.location ?? '',
            paymentId: paymentDocId,
            createdAt: serverTimestamp(),
          })
        }
      }
    }
  }

  // --- Staff referral commission (commissions collection, type='staff-referral') ---
  const referredByStaffId = student.referredByStaffId
  if (referredByStaffId) {
    const existing = await getDocs(
      query(
        collection(db, 'commissions'),
        where('studentId', '==', student.id),
        where('type', '==', 'staff-referral'),
      ),
    )
    if (existing.empty) {
      const staffSnap = await getDoc(doc(db, 'users', referredByStaffId))
      if (staffSnap.exists()) {
        const staffData = staffSnap.data() as Record<string, unknown>
        const commissionRate = Number(staffData.commissionRate ?? 0)
        if (commissionRate > 0) {
          const commissionAmount = Math.round(registrationFee * (commissionRate / 100))
          const newId = doc(collection(db, 'commissions')).id
          await setDoc(doc(db, 'commissions', newId), {
            type: 'staff-referral',
            agentId: referredByStaffId,
            agentName: student.referredByStaffName ?? String(staffData.displayName ?? ''),
            studentId: student.id,
            studentName: student.name,
            enrollmentDate,
            registrationFee,
            commissionRate,
            commissionAmount,
            status: 'pending',
            location: ctx.location ?? student.location ?? '',
            createdAt: serverTimestamp(),
          })
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Staff Referral Records  (stored in `commissions` collection, type='staff-referral')
// Used by PayrollForm to pre-populate referral commissions.
// ---------------------------------------------------------------------------

export interface StaffReferralRecord {
  agentId: string
  agentName: string
  studentId: string
  studentName: string
  enrollmentDate: string
  registrationFee: number
  commissionRate: number
  commissionAmount: number
  status: string
  includedInPayrollId?: string
}

export async function fetchPendingStaffReferrals(
  staffId: string,
  _periodKey?: string,
): Promise<(StaffReferralRecord & { id: string })[]> {
  const snap = await getDocs(
    query(
      collection(db, 'commissions'),
      where('agentId', '==', staffId),
      where('type', '==', 'staff-referral'),
      where('status', '==', 'pending'),
    ),
  )
  return snap.docs.map((d) => {
    const data = d.data() as Record<string, unknown>
    return {
      id: d.id,
      agentId: String(data.agentId ?? ''),
      agentName: String(data.agentName ?? ''),
      studentId: String(data.studentId ?? ''),
      studentName: String(data.studentName ?? ''),
      enrollmentDate: String(data.enrollmentDate ?? ''),
      registrationFee: Number(data.registrationFee ?? 0),
      commissionRate: Number(data.commissionRate ?? 0),
      commissionAmount: Number(data.commissionAmount ?? 0),
      status: String(data.status ?? 'pending'),
      includedInPayrollId: data.includedInPayrollId
        ? String(data.includedInPayrollId)
        : undefined,
    }
  })
}

export async function markStaffReferralsIncludedInPayroll(
  commissionIds: string[],
  payrollId: string,
): Promise<void> {
  await Promise.all(
    commissionIds.map((id) =>
      updateDoc(doc(db, 'commissions', id), {
        status: 'paid',
        includedInPayrollId: payrollId,
        paidAt: new Date().toISOString().slice(0, 10),
        updatedAt: serverTimestamp(),
      }),
    ),
  )
}
