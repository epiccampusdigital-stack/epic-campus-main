import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { Timestamp } from 'firebase/firestore'

/**
 * processEnrollmentCommissions
 *
 * Called when a student's registration fee is confirmed as paid.
 * - If the student has an agentId, creates an agent commission record in
 *   the `commissions` collection (status: pending).
 * - If the student has a referredByStaffId, creates a staff-referral commission
 *   record in the `commissions` collection (status: pending). These are picked
 *   up when processing that staff member's payroll.
 *
 * Idempotent: checks for existing docs before creating.
 */
export async function processEnrollmentCommissions(
  studentId: string,
  studentName: string,
  registrationFee: number,
  agentId: string | null,
  referredByStaffId: string | null,
  enrollmentDate: Date,
  location: string,
): Promise<void> {
  const dateStr = enrollmentDate.toISOString().slice(0, 10)

  // --- Agent commission ---
  if (agentId) {
    const existing = await getDocs(
      query(
        collection(db, 'commissions'),
        where('studentId', '==', studentId),
        where('type', '==', 'agent'),
      ),
    )
    if (existing.empty) {
      const agentSnap = await getDoc(doc(db, 'users', agentId))
      if (agentSnap.exists()) {
        const agentData = agentSnap.data() as Record<string, unknown>
        const commissionRate = Number(agentData.commissionRate ?? 0)
        if (commissionRate > 0) {
          const commissionAmount = Math.round(registrationFee * (commissionRate / 100))
          const newId = doc(collection(db, 'commissions')).id
          await setDoc(doc(db, 'commissions', newId), {
            type: 'agent',
            agentId,
            agentName: String(agentData.displayName ?? agentData.name ?? ''),
            studentId,
            studentName,
            enrollmentDate: dateStr,
            registrationFee,
            commissionRate,
            commissionAmount,
            status: 'pending',
            location: location || null,
            createdAt: serverTimestamp(),
          })
        }
      }
    }
  }

  // --- Staff referral commission ---
  if (referredByStaffId) {
    const existing = await getDocs(
      query(
        collection(db, 'commissions'),
        where('studentId', '==', studentId),
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
            agentName: String(staffData.displayName ?? staffData.name ?? ''),
            studentId,
            studentName,
            enrollmentDate: dateStr,
            registrationFee,
            commissionRate,
            commissionAmount,
            status: 'pending',
            location: location || null,
            createdAt: serverTimestamp(),
          })
        }
      }
    }
  }
}

/**
 * parseCommission — deserialise a raw Firestore document.
 */
export function parseCommission(
  id: string,
  data: Record<string, unknown>,
): import('@/types').CommissionRecord {
  let createdAt = new Date().toISOString()
  if (data.createdAt instanceof Timestamp) {
    createdAt = data.createdAt.toDate().toISOString()
  } else if (typeof data.createdAt === 'string') {
    createdAt = data.createdAt
  }

  return {
    id,
    type: (data.type as import('@/types').CommissionType) ?? 'agent',
    agentId: String(data.agentId ?? ''),
    agentName: String(data.agentName ?? ''),
    studentId: String(data.studentId ?? ''),
    studentName: String(data.studentName ?? ''),
    enrollmentDate: String(data.enrollmentDate ?? ''),
    registrationFee: Number(data.registrationFee ?? 0),
    commissionRate: Number(data.commissionRate ?? 0),
    commissionAmount: Number(data.commissionAmount ?? 0),
    status: (data.status as import('@/types').CommissionStatus) ?? 'pending',
    paidAt: data.paidAt ? String(data.paidAt) : undefined,
    paidBy: data.paidBy ? String(data.paidBy) : undefined,
    notes: data.notes ? String(data.notes) : undefined,
    location: data.location ? String(data.location) : undefined,
    createdAt,
  }
}
