import { Timestamp } from 'firebase/firestore'
import type {
  CourseId,
  EnrollmentApplication,
  EnrollmentPaymentStatus,
  EnrollmentProgram,
  EnrollmentStatus,
  StudentLocation,
  BatchDuration,
} from '@/types'

export const REGISTRATION_FEE = 25_000
export const COURSE_FEE = 60_000
export const TOTAL_FEE = REGISTRATION_FEE + COURSE_FEE

export const ENROLLMENT_PROGRAMS: {
  id: EnrollmentProgram
  label: string
  subtitle: string
  flag: string
  color: string
}[] = [
  {
    id: 'japan-ssw',
    label: 'Japan SSW',
    subtitle: 'Work in Japan with Specified Skilled Worker visa',
    flag: '🇯🇵',
    color: 'border-red-200 bg-red-50',
  },
  {
    id: 'korea',
    label: 'Korea Program',
    subtitle: 'Study at Korean universities — D2/D4 visa',
    flag: '🇰🇷',
    color: 'border-blue-200 bg-blue-50',
  },
  {
    id: 'china',
    label: 'China Program',
    subtitle: 'World-class education with scholarship opportunities',
    flag: '🇨🇳',
    color: 'border-yellow-200 bg-yellow-50',
  },
  {
    id: 'ielts',
    label: 'IELTS Residential',
    subtitle: 'Intensive residential program — target band 6.0+',
    flag: '🎓',
    color: 'border-purple-200 bg-purple-50',
  },
  {
    id: 'nvq',
    label: 'NVQ Skills Program',
    subtitle: 'TVEC-approved nationally recognized qualifications',
    flag: '📜',
    color: 'border-green-200 bg-green-50',
  },
]

export const LOCATION_OPTIONS: { value: StudentLocation; label: string }[] = [
  { value: 'ahangama', label: 'Ahangama (Main Campus)' },
  { value: 'galle', label: 'Galle (Main Office)' },
  { value: 'waduraba', label: 'Waduraba' },
  { value: 'pinnaduwa', label: 'Pinnaduwa' },
]

export const BATCH_OPTIONS: { value: BatchDuration; label: string }[] = [
  { value: '45days', label: '45 Days' },
  { value: '90days', label: '90 Days' },
  { value: 'custom', label: 'Custom Duration' },
]

export const PROGRAM_LABEL_MAP: Record<EnrollmentProgram, string> = {
  'japan-ssw': 'Japan SSW',
  korea: 'Korea Program',
  china: 'China Program',
  ielts: 'IELTS Residential',
  nvq: 'NVQ Skills Program',
}

export const PROGRAM_COURSE_ID_MAP: Record<EnrollmentProgram, CourseId> = {
  'japan-ssw': 'japan-ssw',
  korea: 'korea-d2d4',
  china: 'china',
  ielts: 'ielts',
  nvq: 'nvq-it',
}

function toIso(value: unknown): string {
  if (!value) return new Date().toISOString()
  if (value instanceof Timestamp) return value.toDate().toISOString()
  if (typeof value === 'string') return value
  if (typeof value === 'object' && value !== null && 'seconds' in value) {
    return new Date((value as { seconds: number }).seconds * 1000).toISOString()
  }
  return new Date().toISOString()
}

export function parseEnrollment(
  id: string,
  data: Record<string, unknown>,
): EnrollmentApplication {
  return {
    id,
    firstName: String(data.firstName ?? ''),
    lastName: String(data.lastName ?? ''),
    email: String(data.email ?? ''),
    phone: String(data.phone ?? ''),
    dateOfBirth: String(data.dateOfBirth ?? ''),
    address: String(data.address ?? ''),
    program: (data.program as EnrollmentProgram) ?? 'japan-ssw',
    location: (data.location as StudentLocation) ?? 'galle',
    batchDuration: (data.batchDuration as BatchDuration) ?? '45days',
    batchCustomDays: data.batchCustomDays != null ? Number(data.batchCustomDays) : undefined,
    registrationFeePaid: Boolean(data.registrationFeePaid),
    courseFeePaid: Boolean(data.courseFeePaid),
    totalPaid: Number(data.totalPaid ?? 0),
    stripeSessionId: data.stripeSessionId ? String(data.stripeSessionId) : undefined,
    stripePaymentStatus: (data.stripePaymentStatus as EnrollmentPaymentStatus) ?? 'pending',
    status: (data.status as EnrollmentStatus) ?? 'pending',
    studentId: data.studentId ? String(data.studentId) : undefined,
    createdAt: toIso(data.createdAt),
  }
}

export function formatEnrollmentDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-LK', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function formatLKR(amount: number): string {
  return new Intl.NumberFormat('en-LK', {
    style: 'currency',
    currency: 'LKR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export const ENROLLMENT_STATUS_STYLES: Record<
  EnrollmentApplication['status'],
  string
> = {
  pending: 'bg-amber-50 text-amber-800 border-amber-200',
  confirmed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  rejected: 'bg-red-50 text-red-700 border-red-200',
}

export const PAYMENT_STATUS_STYLES: Record<
  EnrollmentApplication['stripePaymentStatus'],
  string
> = {
  pending: 'bg-slate-100 text-slate-700 border-slate-200',
  paid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  failed: 'bg-red-50 text-red-700 border-red-200',
}

export function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#'
  let pwd = 'Epic'
  for (let i = 0; i < 8; i++) {
    pwd += chars[Math.floor(Math.random() * chars.length)]
  }
  return pwd
}
