import { FieldValue } from 'firebase-admin/firestore'
import { adminAuth, adminDb } from '@/lib/firebase/admin'
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
}

export interface CreateStudentAccountResult {
  success: true
  uid: string
  email: string
  password: string
  studentCode: string
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
    program = 'japan-ssw',
    location = 'galle',
    batchIntake,
    batchDuration = '45days',
    batchCustomDays = null,
    registrationFeePaid = false,
    courseFeePaid = false,
    totalPaid = 0,
    createdBy,
  } = input

  const userRecord = await adminAuth.createUser({
    email,
    password,
    displayName,
    emailVerified: true,
  })

  await adminAuth.setCustomUserClaims(userRecord.uid, { role: 'student' })

  const courseId = PROGRAM_COURSE_MAP[program] ?? 'japan-ssw'
  const year = new Date().getFullYear()
  const batchId = batchIntake?.trim() || `${courseId}-${year}`
  const parentAccessCode = String(Math.floor(100000 + Math.random() * 900000))

  const studentDoc = {
    studentCode,
    idNumber: studentCode,
    uid: userRecord.uid,
    name: displayName,
    nic: '',
    email,
    mobile: phone,
    address,
    dateOfBirth,
    courseId,
    batchId,
    branchId: 'galle-main',
    location,
    batchDuration,
    batchCustomDays,
    registrationFee: 25_000,
    feeAmount: totalPaid > 0 ? totalPaid : 85_000,
    feeCurrency: 'LKR',
    paymentStatus: courseFeePaid ? 'paid' : registrationFeePaid ? 'partial' : 'pending',
    status: 'active',
    enrollmentStatus: 'active',
    visaStatus: 'not-started',
    parentAccessCode,
    parentAccessEnabled: true,
    createdAt: FieldValue.serverTimestamp(),
    createdBy,
  }

  await adminDb.collection('students').doc(userRecord.uid).set(studentDoc)

  await adminDb.collection('users').doc(userRecord.uid).set({
    uid: userRecord.uid,
    email,
    displayName,
    role: 'student',
    studentId: userRecord.uid,
    createdAt: new Date().toISOString(),
  })

  return {
    success: true,
    uid: userRecord.uid,
    email,
    password,
    studentCode,
  }
}
