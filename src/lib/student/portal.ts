import { COURSE_MAP } from '@/lib/constants/courses'
import type { AttendanceRecord, CourseId, ExamResult, Payment, Student } from '@/types'

export interface MaterialItem {
  id: string
  title: string
  description: string
  type: 'PDF' | 'Video' | 'Link'
  url: string
}

export interface VisaChecklistItem {
  id: string
  label: string
  status: 'submitted' | 'missing' | 'review'
}

export interface VisaMilestone {
  label: string
  date: string
}

const JAPAN_MATERIALS: MaterialItem[] = [
  {
    id: 'irodori-a1',
    title: 'Irodori A1 — Starter',
    description: 'Official Japan Foundation coursebook for beginners',
    type: 'Link',
    url: 'https://www.jpf.go.jp/j/project/japanese/education/irodori/',
  },
  {
    id: 'jlpt-n5',
    title: 'JLPT N5 Practice Tests',
    description: 'Sample questions and vocabulary lists for N5',
    type: 'PDF',
    url: '#',
  },
  {
    id: 'ssw-guide',
    title: 'SSW Skill Exam Guide',
    description: 'Overview of specified skilled worker assessments',
    type: 'PDF',
    url: '#',
  },
]

const KOREA_MATERIALS: MaterialItem[] = [
  {
    id: 'topik-guide',
    title: 'TOPIK Preparation Guide',
    description: 'Reading, listening, and writing strategies',
    type: 'PDF',
    url: '#',
  },
  {
    id: 'uni-app',
    title: 'Korean University Application Pack',
    description: 'Document checklist and timeline',
    type: 'PDF',
    url: '#',
  },
  {
    id: 'korean-video',
    title: 'Hangul Basics Video Series',
    description: 'Epic Campus recorded lessons',
    type: 'Video',
    url: '#',
  },
]

const CHINA_MATERIALS: MaterialItem[] = [
  {
    id: 'hsk-1',
    title: 'HSK Level 1 Resources',
    description: 'Vocabulary and practice tests',
    type: 'PDF',
    url: '#',
  },
  {
    id: 'scholarship',
    title: 'CSC Scholarship Guide',
    description: 'Application steps and required documents',
    type: 'PDF',
    url: '#',
  },
  {
    id: 'china-portal',
    title: 'University Portal Links',
    description: 'Partner university application portals',
    type: 'Link',
    url: '#',
  },
]

const IELTS_MATERIALS: MaterialItem[] = [
  {
    id: 'ielts-live',
    title: 'Epic IELTS Portal',
    description: 'Access your residential IELTS training',
    type: 'Link',
    url: 'https://epicielts.live',
  },
  {
    id: 'band-descriptors',
    title: 'IELTS Band Descriptors',
    description: 'Official scoring criteria reference',
    type: 'PDF',
    url: '#',
  },
]

const NVQ_MATERIALS: MaterialItem[] = [
  {
    id: 'nvq-handbook',
    title: 'NVQ Student Handbook',
    description: 'Assessment rules and module structure',
    type: 'PDF',
    url: '#',
  },
  {
    id: 'tvec',
    title: 'TVEC Registration Info',
    description: 'National vocational qualification overview',
    type: 'Link',
    url: '#',
  },
]

export function getMaterialsForCourse(courseId: CourseId): MaterialItem[] {
  if (courseId === 'japan-ssw') return JAPAN_MATERIALS
  if (courseId === 'korea-d2d4') return KOREA_MATERIALS
  if (courseId === 'china') return CHINA_MATERIALS
  if (courseId === 'ielts') return IELTS_MATERIALS
  if (courseId.startsWith('nvq-')) return NVQ_MATERIALS
  return [
    {
      id: 'welcome',
      title: 'Welcome Pack',
      description: 'General Epic Campus student resources',
      type: 'PDF',
      url: '#',
    },
  ]
}

export function getCourseBadge(courseId: CourseId): string {
  return COURSE_MAP[courseId]?.label ?? courseId
}

export function getAttendanceRate(records: AttendanceRecord[]): string {
  if (records.length === 0) return '0%'
  const attended = records.filter((r) => r.status === 'present' || r.status === 'late').length
  return `${Math.round((attended / records.length) * 100)}%`
}

export function computePaymentSummary(payments: Payment[]) {
  const paid = payments.filter((p) => p.status === 'paid')
  const pending = payments.filter((p) => p.status === 'pending' || p.status === 'partial')
  const totalPaidLkr = paid.filter((p) => p.currency === 'LKR').reduce((s, p) => s + p.amount, 0)
  const totalPendingLkr = pending.filter((p) => p.currency === 'LKR').reduce((s, p) => s + p.amount, 0)
  const nextDue = pending.sort((a, b) => a.paymentDate.localeCompare(b.paymentDate))[0]

  return { totalPaidLkr, totalPendingLkr, nextDue, paidCount: paid.length, pendingCount: pending.length }
}

export function scoreToGrade(total: number): string {
  if (total >= 90) return 'S'
  if (total >= 80) return 'A'
  if (total >= 70) return 'B'
  if (total >= 60) return 'C'
  return 'D'
}

export interface ParsedExamAttempt {
  id: string
  exam: string
  date: string
  reading?: number
  listening?: number
  writing?: number
  speaking?: number
  total: number
  grade: string
  status: ExamResult['status']
}

export function parseExamAttempt(
  id: string,
  data: Record<string, unknown>,
  examTitle?: string,
): ParsedExamAttempt {
  const reading = data.reading != null ? Number(data.reading) : undefined
  const listening = data.listening != null ? Number(data.listening) : undefined
  const writing = data.writing != null ? Number(data.writing) : undefined
  const speaking = data.speaking != null ? Number(data.speaking) : undefined
  const total =
    data.total != null
      ? Number(data.total)
      : data.score != null
        ? Number(data.score)
        : [reading, listening, writing, speaking].filter((v) => v != null).length > 0
          ? (reading ?? 0) + (listening ?? 0) + (writing ?? 0) + (speaking ?? 0)
          : 0

  return {
    id,
    exam: examTitle ?? String(data.examTitle ?? data.examId ?? 'Exam'),
    date: String(data.examDate ?? data.createdAt ?? '').slice(0, 10),
    reading,
    listening,
    writing,
    speaking,
    total,
    grade: String(data.grade ?? data.band ?? data.level ?? scoreToGrade(total)),
    status: (data.status as ExamResult['status']) ?? 'pending',
  }
}

export function getVisaStageIndex(status?: Student['visaStatus']): number {
  switch (status) {
    case 'approved':
      return 4
    case 'in-progress':
      return 2
    case 'rejected':
      return 2
    default:
      return 0
  }
}

export function buildVisaChecklist(
  student: Student,
  docNames: string[],
): VisaChecklistItem[] {
  const has = (keyword: string) =>
    docNames.some((n) => n.toLowerCase().includes(keyword.toLowerCase()))

  const items: VisaChecklistItem[] = [
    { id: 'passport', label: 'Passport', status: has('passport') ? 'submitted' : 'missing' },
    { id: 'nic', label: 'NIC', status: student.nic ? 'submitted' : 'missing' },
    { id: 'photos', label: 'Photos', status: has('photo') ? 'submitted' : 'missing' },
    {
      id: 'bank',
      label: 'Bank Statement',
      status: has('bank') ? 'submitted' : 'missing',
    },
    {
      id: 'offer',
      label: 'Offer Letter',
      status: has('offer') ? 'review' : 'missing',
    },
    {
      id: 'lang',
      label: 'Language Certificate',
      status: has('language') || has('jlpt') || has('topik') ? 'submitted' : 'missing',
    },
  ]

  if (student.visaStatus === 'in-progress') {
    return items.map((i) =>
      i.status === 'submitted' ? { ...i, status: 'review' as const } : i,
    )
  }

  return items
}

export function buildVisaTimeline(student: Student): VisaMilestone[] {
  const milestones: VisaMilestone[] = []
  if (student.enrollmentDate) {
    milestones.push({
      label: 'Enrolled at Epic Campus',
      date: student.enrollmentDate.slice(0, 10),
    })
  }
  if (student.visaStatus && student.visaStatus !== 'not-started') {
    milestones.push({
      label: `Visa status: ${student.visaStatus.replace('-', ' ')}`,
      date: student.expectedCompletionDate?.slice(0, 10) ?? student.createdAt.slice(0, 10),
    })
  }
  if (student.visaStatus === 'approved') {
    milestones.push({
      label: 'Visa approved',
      date: student.expectedCompletionDate?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
    })
  }
  return milestones
}

export function daysUntil(dateIso?: string): number | null {
  if (!dateIso) return null
  const target = new Date(dateIso.slice(0, 10) + 'T12:00:00')
  const today = new Date()
  today.setHours(12, 0, 0, 0)
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

export type DashboardKind = 'japan' | 'korea' | 'china' | 'ielts' | 'nvq' | 'default'

export function getDashboardKind(courseId: CourseId): DashboardKind {
  if (courseId === 'japan-ssw') return 'japan'
  if (courseId === 'korea-d2d4') return 'korea'
  if (courseId === 'china') return 'china'
  if (courseId === 'ielts') return 'ielts'
  if (courseId.startsWith('nvq-')) return 'nvq'
  return 'default'
}

export function getJapanStep(student: Student): number {
  if (student.visaStatus === 'approved') return 4
  if (student.visaStatus === 'in-progress') return 3
  if (student.status === 'active') return 1
  return 0
}

export function getKoreaStep(student: Student): number {
  if (student.visaStatus === 'approved') return 4
  if (student.visaStatus === 'in-progress') return 3
  if (student.status === 'active') return 1
  return 0
}

export function getChinaStep(student: Student): number {
  if (student.visaStatus === 'approved') return 4
  if (student.visaStatus === 'in-progress') return 2
  return student.status === 'active' ? 1 : 0
}

export function getNvqStep(student: Student): number {
  if (student.status === 'completed') return 4
  if (student.status === 'active') return 2
  return student.status === 'pending' ? 0 : 1
}
