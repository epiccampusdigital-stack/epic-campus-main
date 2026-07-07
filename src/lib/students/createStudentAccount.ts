import { FieldValue } from 'firebase-admin/firestore'
import { adminAuth, adminDb } from '@/lib/firebase/admin'
import { buildAutoInstallments, normalizePaymentStatus, PLAN_SOURCE } from '@/lib/payments/autoInstallments'
import type { BatchDuration, CourseId, StudentLocation } from '@/types'

const PROGRAM_COURSE_MAP: Record<string, CourseId> = {
  'japan-ssw': 'japan-ssw',
  korea: 'korea-d2d4',
  china: 'china',
  ielts: 'ielts',
  nvq: 'nvq-it',
}

export function generateEnrollmentPassword(firstName: string, phone: string): string {
  const raw = firstName.trim().split(/\s+/)[0] || 'Student'
  const name = raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase()
  const digits = phone.replace(/\D/g, '')
  const last4 = digits.slice(-4) || '0000'
  return `${name}${last4}`
}

export async function generateStudentCode(): Promise<string> {
  const year = new Date().getFullYear()
  const snap = await adminDb.collection('students').get()
  const seq = String(snap.size + 1).padStart(3, '0')
  return `EC-${year}-${seq}`
}

export interface CreateStudentAccountInput {
  email: string
  password: string
  displayName: string
  studentCode: string
  phone?: string
  address?: string
  dateOfBirth?: string
  program?: string
  location?: StudentLocation | string
  batchIntake?: string
  batchDuration?: BatchDuration | string
  batchCustomDays?: number | null
  registrationFeePaid?: boolean
  courseFeePaid?: boolean
  totalPaid?: number
  createdBy: string
  // Real enrollment data — when provided these override the legacy
  // registrationFeePaid/courseFeePaid/totalPaid-derived defaults below.
  feeAmount?: number
  paymentStatus?: string
  paidAmount?: number
  pendingAmount?: number
  courseId?: string
  batchId?: string
  agentId?: string | null
  notes?: string
}

export interface CreateStudentAccountResult {
  success: true
  uid: string
  studentDocId: string
  email: string
  password: string
  studentCode: string
  /** False when an existing account/record was matched and reused instead of
   *  creating a new one — callers should not send "here's your new password"
   *  messaging in that case, since the password wasn't actually reset. */
  created: boolean
}

/** Finds a pre-existing students/{id} doc for this email, if any. A student
 *  can already have a real, fully-filled-in record (e.g. added directly via
 *  the Students page) before ever getting a login — in that case we must
 *  reuse that doc's id rather than creating a second, disconnected one. */
async function findExistingStudentDocByEmail(
  email: string,
): Promise<{ id: string; data: FirebaseFirestore.DocumentData } | null> {
  if (!email) return null
  const snap = await adminDb.collection('students').where('email', '==', email).limit(1).get()
  if (snap.empty) return null
  return { id: snap.docs[0].id, data: snap.docs[0].data() }
}

export async function createStudentAccount(
  input: CreateStudentAccountInput,
): Promise<CreateStudentAccountResult> {
  const {
    email,
    password,
    displayName,
    studentCode,
    phone = '',
    address = '',
    dateOfBirth = '',
    program,
    location,
    batchIntake,
    batchDuration,
    batchCustomDays,
    registrationFeePaid = false,
    courseFeePaid = false,
    totalPaid = 0,
    createdBy,
  } = input

  const existingDoc = await findExistingStudentDocByEmail(email)
  const existingAuthUser = await adminAuth.getUserByEmail(email).catch(() => null)

  let uid: string
  let created: boolean
  if (existingAuthUser) {
    uid = existingAuthUser.uid
    created = false
  } else {
    const userRecord = await adminAuth.createUser({ email, password, displayName, emailVerified: true })
    uid = userRecord.uid
    created = true
  }
  await adminAuth.setCustomUserClaims(uid, { role: 'student' })

  // Was real course/location/batch/fee data actually sent, or is this a bare
  // "create a login" request (e.g. StudentForm's optional step for a student
  // whose real record — with its own real course/fee data — already exists)?
  // Only the former should ever overwrite fields on a pre-existing doc.
  const hasExplicitCourseData = input.courseId != null || program != null
  const hasExplicitLocation = location != null
  const hasExplicitBatch = input.batchId != null || batchIntake != null
  const hasExplicitFeeData =
    input.feeAmount != null || input.paymentStatus != null || totalPaid > 0 || registrationFeePaid || courseFeePaid

  const resolvedProgram = program || 'japan-ssw'
  const courseId = input.courseId?.trim() || PROGRAM_COURSE_MAP[resolvedProgram] || 'japan-ssw'
  const resolvedLocation = location || 'galle'
  const resolvedBatchDuration = batchDuration || '45days'
  const resolvedBatchCustomDays = batchCustomDays ?? null
  const year = new Date().getFullYear()
  const batchId = input.batchId?.trim() || batchIntake?.trim() || `${courseId}-${year}`
  const parentAccessCode = String(Math.floor(100000 + Math.random() * 900000))

  const resolvedFeeAmount = input.feeAmount != null ? input.feeAmount : (totalPaid > 0 ? totalPaid : 85_000)
  const legacyStatus = courseFeePaid ? 'paid' : registrationFeePaid ? 'partial' : 'pending'
  const resolvedPaymentStatus = normalizePaymentStatus(input.paymentStatus ?? legacyStatus)
  const resolvedPaidAmount =
    input.paidAmount != null
      ? input.paidAmount
      : resolvedPaymentStatus === 'paid'
        ? resolvedFeeAmount
        : 0
  const resolvedPendingAmount =
    input.pendingAmount != null
      ? input.pendingAmount
      : resolvedPaymentStatus === 'paid'
        ? 0
        : resolvedPaymentStatus === 'partial'
          ? Math.max(0, resolvedFeeAmount - resolvedPaidAmount)
          : resolvedFeeAmount

  // Reuse a pre-existing student doc's id (and don't touch its other real
  // fields) rather than always writing a fresh doc keyed by the auth uid —
  // that mismatch was the source of the duplicate-record bug.
  const studentDocId = existingDoc?.id ?? uid
  const resolvedStudentCode = existingDoc ? String(existingDoc.data.studentCode ?? studentCode) : studentCode

  if (existingDoc) {
    // Merge — only touch fields we have genuine data for. A bare "create
    // login" request must never overwrite a real record's course, location,
    // batch or fee data with generic fallback defaults.
    const mergeFields: Record<string, unknown> = { uid, updatedAt: FieldValue.serverTimestamp() }
    if (hasExplicitCourseData) mergeFields.courseId = courseId
    if (hasExplicitLocation) mergeFields.location = resolvedLocation
    if (hasExplicitBatch) {
      mergeFields.batchId = batchId
      mergeFields.batchDuration = resolvedBatchDuration
      mergeFields.batchCustomDays = resolvedBatchCustomDays
    }
    if (hasExplicitFeeData) {
      mergeFields.feeAmount = resolvedFeeAmount
      mergeFields.feeCurrency = 'LKR'
      mergeFields.paymentStatus = resolvedPaymentStatus
      mergeFields.paidAmount = resolvedPaidAmount
      mergeFields.pendingAmount = resolvedPendingAmount
    }
    if (input.agentId != null) mergeFields.agentId = input.agentId
    if (input.notes != null) mergeFields.notes = input.notes

    await adminDb.collection('students').doc(studentDocId).set(mergeFields, { merge: true })
  } else {
    await adminDb.collection('students').doc(studentDocId).set({
      studentCode,
      idNumber: studentCode,
      uid,
      name: displayName,
      nic: '',
      email,
      mobile: phone,
      address,
      dateOfBirth,
      courseId,
      batchId,
      branchId: 'galle-main',
      location: resolvedLocation,
      batchDuration: resolvedBatchDuration,
      batchCustomDays: resolvedBatchCustomDays,
      registrationFee: 25_000,
      feeAmount: resolvedFeeAmount,
      feeCurrency: 'LKR',
      paymentStatus: resolvedPaymentStatus,
      paidAmount: resolvedPaidAmount,
      pendingAmount: resolvedPendingAmount,
      agentId: input.agentId ?? null,
      notes: input.notes ?? null,
      status: 'active',
      enrollmentStatus: 'active',
      visaStatus: 'not-started',
      parentAccessCode,
      parentAccessEnabled: true,
      createdAt: FieldValue.serverTimestamp(),
      createdBy,
    })
  }

  await adminDb.collection('users').doc(uid).set({
    uid,
    email,
    displayName,
    role: 'student',
    studentId: studentDocId,
    createdAt: new Date().toISOString(),
  }, { merge: true })

  // Only (re)write the payment plan when we have real fee data — never for a
  // bare "create login" request on a doc that already has its own real fee info.
  if (resolvedFeeAmount > 0 && (!existingDoc || hasExplicitFeeData)) {
    const planRef = adminDb.collection('payments').doc(studentDocId)
    const existingPlan = await planRef.get()
    if (!existingPlan.exists || existingPlan.data()?.source === PLAN_SOURCE.ENROLLMENT) {
      await planRef.set({
        studentId: studentDocId,
        studentName: displayName,
        studentCode: resolvedStudentCode,
        courseId,
        location: resolvedLocation,
        branch: 'galle-main',
        totalFee: resolvedFeeAmount,
        currency: 'LKR',
        installments: buildAutoInstallments(resolvedFeeAmount, resolvedPaymentStatus, resolvedPaidAmount),
        source: PLAN_SOURCE.ENROLLMENT,
        createdAt: existingPlan.exists ? (existingPlan.data()?.createdAt ?? FieldValue.serverTimestamp()) : FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      })
    }
  }

  return {
    success: true,
    uid,
    studentDocId,
    email,
    password,
    studentCode: resolvedStudentCode,
    created,
  }
}
