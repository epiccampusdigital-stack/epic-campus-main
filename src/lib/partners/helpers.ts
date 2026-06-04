import {
  Timestamp,
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { getCourseBatchStatus, toDate } from '@/lib/students/helpers'
import type {
  CandidateShortlist,
  CandidateShortlistStatus,
  CourseBatchStatus,
  ExamResult,
  PartnerCompany,
  PartnerFeeCurrency,
  PartnerFeeStatus,
  PartnerNotification,
  Student,
} from '@/types'

export const CANDIDATE_STATUS_LABELS: Record<CandidateShortlistStatus, string> = {
  viewing: 'Viewing',
  shortlisted: 'Shortlisted',
  interview_requested: 'Interview Requested',
  interview_confirmed: 'Interview Confirmed',
  placed: 'Placed',
  rejected: 'Rejected',
}

export const CANDIDATE_STATUS_STYLES: Record<CandidateShortlistStatus, string> = {
  viewing: 'bg-slate-100 text-slate-700 border-slate-200',
  shortlisted: 'bg-blue-50 text-blue-800 border-blue-200',
  interview_requested: 'bg-amber-50 text-amber-800 border-amber-200',
  interview_confirmed: 'bg-indigo-50 text-indigo-800 border-indigo-200',
  placed: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  rejected: 'bg-red-50 text-red-800 border-red-200',
}

export const PIPELINE_STATUSES: CandidateShortlistStatus[] = [
  'viewing',
  'shortlisted',
  'interview_requested',
  'interview_confirmed',
  'placed',
  'rejected',
]

export function parsePartnerCompany(
  id: string,
  data: Record<string, unknown>,
): PartnerCompany {
  const created = toDate(data.createdAt)
  return {
    id,
    name: String(data.name ?? ''),
    country: (data.country as PartnerCompany['country']) ?? 'japan',
    industry: String(data.industry ?? ''),
    contactName: String(data.contactName ?? ''),
    contactEmail: String(data.contactEmail ?? ''),
    contactPhone: String(data.contactPhone ?? ''),
    logoUrl: data.logoUrl ? String(data.logoUrl) : undefined,
    placementFee: Number(data.placementFee ?? 0),
    placementFeeCurrency: (data.placementFeeCurrency as PartnerFeeCurrency) ?? 'LKR',
    feeStatus: (data.feeStatus as PartnerFeeStatus) ?? 'unpaid',
    status: (data.status as PartnerCompany['status']) ?? 'active',
    loginUid: data.loginUid ? String(data.loginUid) : undefined,
    createdAt: created?.toISOString() ?? new Date().toISOString(),
    createdBy: String(data.createdBy ?? ''),
  }
}

export function parseCandidateShortlist(
  id: string,
  data: Record<string, unknown>,
): CandidateShortlist {
  const created = toDate(data.createdAt)
  const updated = toDate(data.updatedAt)
  const interview = toDate(data.interviewDate)
  const placed = toDate(data.placedAt)

  return {
    id,
    companyId: String(data.companyId ?? ''),
    companyName: String(data.companyName ?? ''),
    studentId: String(data.studentId ?? ''),
    studentName: String(data.studentName ?? ''),
    status: (data.status as CandidateShortlistStatus) ?? 'viewing',
    interviewDate: interview?.toISOString(),
    notes: String(data.notes ?? ''),
    placementFee: Number(data.placementFee ?? 0),
    feePaid: Boolean(data.feePaid),
    studentAge: data.studentAge != null ? Number(data.studentAge) : undefined,
    japaneseLevel: data.japaneseLevel ? String(data.japaneseLevel) : undefined,
    examScoreSummary: data.examScoreSummary ? String(data.examScoreSummary) : undefined,
    batchStatus: data.batchStatus as CourseBatchStatus | undefined,
    placedAt: placed?.toISOString(),
    createdAt: created?.toISOString() ?? new Date().toISOString(),
    updatedAt: updated?.toISOString() ?? new Date().toISOString(),
  }
}

export function parsePartnerNotification(
  id: string,
  data: Record<string, unknown>,
): PartnerNotification {
  const created = toDate(data.createdAt)
  return {
    id,
    type: 'partner_interview_request',
    title: String(data.title ?? ''),
    message: String(data.message ?? ''),
    companyId: String(data.companyId ?? ''),
    companyName: String(data.companyName ?? ''),
    studentId: String(data.studentId ?? ''),
    studentDisplayName: String(data.studentDisplayName ?? ''),
    candidateShortlistId: String(data.candidateShortlistId ?? ''),
    read: Boolean(data.read),
    createdAt: created?.toISOString() ?? new Date().toISOString(),
  }
}

export function parseExamResultDoc(id: string, data: Record<string, unknown>): ExamResult {
  return {
    id,
    examId: String(data.examId ?? ''),
    studentId: String(data.studentId ?? ''),
    score: data.score != null ? Number(data.score) : undefined,
    band: data.band ? String(data.band) : undefined,
    level: data.level ? String(data.level) : undefined,
    status: (data.status as ExamResult['status']) ?? 'pending',
    notes: data.notes ? String(data.notes) : undefined,
    createdAt: String(data.createdAt ?? new Date().toISOString()),
    createdBy: String(data.createdBy ?? ''),
  }
}

export function calcAge(dateOfBirth?: string): number | null {
  if (!dateOfBirth) return null
  const birth = new Date(dateOfBirth)
  if (Number.isNaN(birth.getTime())) return null
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return age >= 0 ? age : null
}

export function isJapanStudent(student: Student): boolean {
  return (
    student.courseId === 'japan-ssw' ||
    String(student.courseId).toLowerCase().includes('japan')
  )
}

const JLPT_ORDER = ['N1', 'N2', 'N3', 'N4', 'N5'] as const

export function detectJapaneseLevel(
  results: ExamResult[],
  examMeta: Map<string, { title: string; officialExamType?: string; level?: string }>,
  rawResults?: Array<Record<string, unknown>>,
): string | null {
  let best: string | null = null

  results.forEach((r, idx) => {
    if (r.status !== 'pass') return
    const raw = rawResults?.[idx]
    const meta = examMeta.get(r.examId)
    const title = String(
      raw?.examTitle ?? meta?.title ?? r.notes ?? '',
    ).toUpperCase()
    const level = String(r.level ?? meta?.level ?? raw?.grade ?? '').toUpperCase()

    if (/JFT/.test(title) || meta?.officialExamType === 'JFT') {
      if (!best) best = 'JFT'
      return
    }

    for (const lv of JLPT_ORDER) {
      if (title.includes(lv) || level === lv) {
        if (!best || JLPT_ORDER.indexOf(lv) < JLPT_ORDER.indexOf(best as (typeof JLPT_ORDER)[number])) {
          best = lv
        }
        break
      }
    }
    if (/JLPT/.test(title) || meta?.officialExamType === 'JLPT') {
      if (!best) best = 'JLPT'
    }
  })

  return best
}

export function studentMeetsJapaneseExamRequirement(
  results: ExamResult[],
  examMeta: Map<string, { title: string; officialExamType?: string; level?: string }>,
  rawResults?: Array<Record<string, unknown>>,
): boolean {
  const level = detectJapaneseLevel(results, examMeta, rawResults)
  if (level === 'JFT') return true
  if (level && JLPT_ORDER.includes(level as (typeof JLPT_ORDER)[number])) {
    return true
  }

  return results.some((r, idx) => {
    if (r.status !== 'pass') return false
    const raw = rawResults?.[idx]
    const meta = examMeta.get(r.examId)
    const title = String(raw?.examTitle ?? meta?.title ?? '').toUpperCase()
    return /JFT|JLPT/.test(title) && (/N5|N4|N3|N2|N1/.test(title) || meta?.officialExamType === 'JFT')
  })
}

export function buildExamScoreSummary(
  results: ExamResult[],
  rawResults?: Array<Record<string, unknown>>,
): string {
  const passed = results.filter((r) => r.status === 'pass')
  if (passed.length === 0) return 'No passing scores yet'

  const parts = passed.slice(0, 3).map((r) => {
    const raw = rawResults?.[results.indexOf(r)]
    const title = String(raw?.examTitle ?? r.examId).slice(0, 24)
    const total =
      raw?.total != null
        ? Number(raw.total)
        : r.score != null
          ? r.score
          : null
    return total != null ? `${title}: ${total}` : title
  })

  return parts.join(' · ')
}

export function privacyDisplayName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/)
  if (parts.length === 0) return 'Student'
  if (parts.length === 1) return parts[0]
  const last = parts[parts.length - 1]
  const initial = last.charAt(0).toUpperCase()
  return `${parts[0]} ${initial}.`
}

export function getPlacedStudentIds(shortlists: CandidateShortlist[]): Set<string> {
  return new Set(
    shortlists.filter((c) => c.status === 'placed').map((c) => c.studentId),
  )
}

export async function fetchPartnerCompanies(): Promise<PartnerCompany[]> {
  const snap = await getDocs(collection(db, 'partnerCompanies'))
  return snap.docs
    .map((d) => parsePartnerCompany(d.id, d.data() as Record<string, unknown>))
    .sort((a, b) => a.name.localeCompare(b.name))
}

export async function fetchCandidateShortlists(): Promise<CandidateShortlist[]> {
  const snap = await getDocs(collection(db, 'candidateShortlists'))
  return snap.docs
    .map((d) => parseCandidateShortlist(d.id, d.data() as Record<string, unknown>))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export async function fetchExamMeta(): Promise<
  Map<string, { title: string; officialExamType?: string; level?: string }>
> {
  const snap = await getDocs(collection(db, 'exams'))
  const map = new Map<string, { title: string; officialExamType?: string; level?: string }>()
  for (const d of snap.docs) {
    const data = d.data() as Record<string, unknown>
    map.set(d.id, {
      title: String(data.title ?? ''),
      officialExamType: data.officialExamType
        ? String(data.officialExamType)
        : undefined,
      level: data.level ? String(data.level) : undefined,
    })
  }
  return map
}

export async function fetchExamResultsByStudent(): Promise<{
  byStudent: Map<string, ExamResult[]>
  rawByStudent: Map<string, Array<Record<string, unknown>>>
}> {
  const snap = await getDocs(collection(db, 'examResults'))
  const byStudent = new Map<string, ExamResult[]>()
  const rawByStudent = new Map<string, Array<Record<string, unknown>>>()

  for (const d of snap.docs) {
    const raw = d.data() as Record<string, unknown>
    const parsed = parseExamResultDoc(d.id, raw)
    const list = byStudent.get(parsed.studentId) ?? []
    list.push(parsed)
    byStudent.set(parsed.studentId, list)

    const rawList = rawByStudent.get(parsed.studentId) ?? []
    rawList.push(raw)
    rawByStudent.set(parsed.studentId, rawList)
  }

  return { byStudent, rawByStudent }
}

export function countCandidatesByCompany(
  shortlists: CandidateShortlist[],
  companyId: string,
): { active: number; placed: number } {
  const forCompany = shortlists.filter((c) => c.companyId === companyId)
  return {
    active: forCompany.filter((c) => c.status !== 'placed' && c.status !== 'rejected').length,
    placed: forCompany.filter((c) => c.status === 'placed').length,
  }
}

export async function assignStudentToCompany(input: {
  company: PartnerCompany
  student: Student
  examResults: ExamResult[]
  rawExam?: Array<Record<string, unknown>>
  examMeta: Map<string, { title: string; officialExamType?: string; level?: string }>
}): Promise<string> {
  const { company, student, examResults, rawExam, examMeta } = input

  const existing = await getDocs(
    query(
      collection(db, 'candidateShortlists'),
      where('companyId', '==', company.id),
      where('studentId', '==', student.id),
    ),
  )
  if (!existing.empty) {
    throw new Error('Student is already on this company shortlist.')
  }

  const ref = await addDoc(collection(db, 'candidateShortlists'), {
    companyId: company.id,
    companyName: company.name,
    studentId: student.id,
    studentName: student.name,
    status: 'viewing',
    notes: '',
    placementFee: company.placementFee,
    feePaid: false,
    studentAge: calcAge(student.dateOfBirth) ?? null,
    japaneseLevel: detectJapaneseLevel(examResults, examMeta, rawExam) ?? '—',
    examScoreSummary: buildExamScoreSummary(examResults, rawExam),
    batchStatus: getCourseBatchStatus(student),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })

  return ref.id
}

export async function updateCandidateShortlist(
  id: string,
  patch: Partial<{
    status: CandidateShortlistStatus
    interviewDate: string | null
    notes: string
    feePaid: boolean
    placedAt: string | null
  }>,
): Promise<void> {
  const payload: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  }

  if (patch.status != null) payload.status = patch.status
  if (patch.notes != null) payload.notes = patch.notes
  if (patch.feePaid != null) payload.feePaid = patch.feePaid

  if (patch.interviewDate === null) {
    payload.interviewDate = null
  } else if (patch.interviewDate) {
    payload.interviewDate = Timestamp.fromDate(new Date(patch.interviewDate))
  }

  if (patch.placedAt === null) {
    payload.placedAt = null
  } else if (patch.placedAt) {
    payload.placedAt = Timestamp.fromDate(new Date(patch.placedAt))
  }

  await updateDoc(doc(db, 'candidateShortlists', id), payload)
}

export async function createPartnerNotification(input: {
  companyId: string
  companyName: string
  studentId: string
  studentDisplayName: string
  candidateShortlistId: string
}): Promise<void> {
  await addDoc(collection(db, 'notifications'), {
    type: 'partner_interview_request',
    title: 'Interview requested',
    message: `${input.companyName} requested an interview for ${input.studentDisplayName}.`,
    companyId: input.companyId,
    companyName: input.companyName,
    studentId: input.studentId,
    studentDisplayName: input.studentDisplayName,
    candidateShortlistId: input.candidateShortlistId,
    read: false,
    createdAt: serverTimestamp(),
  })
}

export async function fetchUnreadPartnerNotifications(): Promise<PartnerNotification[]> {
  const snap = await getDocs(
    query(
      collection(db, 'notifications'),
      where('type', '==', 'partner_interview_request'),
      where('read', '==', false),
    ),
  )
  return snap.docs
    .map((d) => parsePartnerNotification(d.id, d.data() as Record<string, unknown>))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function markNotificationRead(id: string): Promise<void> {
  await updateDoc(doc(db, 'notifications', id), { read: true })
}

export async function savePartnerCompany(
  id: string | null,
  data: Omit<PartnerCompany, 'id' | 'createdAt' | 'createdBy'> & { createdBy: string },
): Promise<string> {
  const payload = {
    name: data.name,
    country: data.country,
    industry: data.industry,
    contactName: data.contactName,
    contactEmail: data.contactEmail,
    contactPhone: data.contactPhone,
    logoUrl: data.logoUrl ?? null,
    placementFee: data.placementFee,
    placementFeeCurrency: data.placementFeeCurrency,
    feeStatus: data.feeStatus,
    status: data.status,
    loginUid: data.loginUid ?? null,
    ...(id ? { updatedAt: serverTimestamp() } : { createdAt: serverTimestamp(), createdBy: data.createdBy }),
  }

  if (id) {
    await updateDoc(doc(db, 'partnerCompanies', id), payload)
    return id
  }

  const ref = await addDoc(collection(db, 'partnerCompanies'), payload)
  return ref.id
}

export async function getPartnerCompany(id: string): Promise<PartnerCompany | null> {
  const snap = await getDoc(doc(db, 'partnerCompanies', id))
  if (!snap.exists()) return null
  return parsePartnerCompany(snap.id, snap.data() as Record<string, unknown>)
}

export function formatPartnerFee(amount: number, currency: PartnerFeeCurrency): string {
  if (currency === 'JPY') {
    return `¥${amount.toLocaleString('en-US')}`
  }
  return `LKR ${amount.toLocaleString('en-LK')}`
}

export function computePlacementSummary(placements: CandidateShortlist[]) {
  const placed = placements.filter((c) => c.status === 'placed')
  const feesCollected = placed.filter((c) => c.feePaid).length
  const feesOutstanding = placed.filter((c) => !c.feePaid).length
  const totalFees = placed.reduce((s, c) => s + c.placementFee, 0)
  return {
    totalPlaced: placed.length,
    feesCollected,
    feesOutstanding,
    totalFees,
  }
}
