import { Timestamp } from 'firebase/firestore'
import { COURSE_MAP } from '@/lib/constants/courses'
import type { CourseId, Lead, LeadSource, LeadStatus } from '@/types'

export function toDate(value: unknown): Date | null {
  if (!value) return null
  if (value instanceof Timestamp) return value.toDate()
  if (typeof value === 'string') return new Date(value)
  if (typeof value === 'object' && value !== null && 'seconds' in value) {
    return new Date((value as { seconds: number }).seconds * 1000)
  }
  return null
}

const LEGACY_SOURCE_MAP: Record<string, LeadSource> = {
  'walk-in': 'walk-in',
  referral: 'referral',
  social: 'facebook',
  agent: 'agent',
  website: 'website',
}

const LEGACY_STATUS_MAP: Record<string, LeadStatus> = {
  new: 'new',
  contacted: 'contacted',
  enrolled: 'enrolled',
  lost: 'lost',
}

export function parseLead(id: string, data: Record<string, unknown>): Lead {
  const created = toDate(data.createdAt)
  const rawSource = String(data.source ?? 'other')
  const rawStatus = String(data.status ?? 'new')
  const courseId =
    (data.courseId as CourseId) ??
    (data.courseInterest as CourseId) ??
    'ielts'

  return {
    id,
    name: String(data.name ?? ''),
    phone: String(data.phone ?? data.mobile ?? ''),
    email: data.email ? String(data.email) : undefined,
    address: data.address ? String(data.address) : undefined,
    courseId,
    intakeDate: data.intakeDate ? String(data.intakeDate).slice(0, 10) : undefined,
    budget: data.budget ? String(data.budget) : undefined,
    educationLevel: data.educationLevel ? String(data.educationLevel) : undefined,
    source: (LEGACY_SOURCE_MAP[rawSource] ?? rawSource) as LeadSource,
    agentName: data.agentName
      ? String(data.agentName)
      : data.agentId
        ? String(data.agentId)
        : undefined,
    commissionRate:
      data.commissionRate != null ? Number(data.commissionRate) : undefined,
    referralName: data.referralName ? String(data.referralName) : undefined,
    status: (LEGACY_STATUS_MAP[rawStatus] ?? rawStatus) as LeadStatus,
    lastContact: data.lastContact
      ? String(data.lastContact).slice(0, 10)
      : undefined,
    nextFollowUp: data.nextFollowUp
      ? String(data.nextFollowUp).slice(0, 10)
      : undefined,
    inquiryDate: data.inquiryDate
      ? String(data.inquiryDate).slice(0, 10)
      : created?.toISOString().slice(0, 10),
    notes: data.notes ? String(data.notes) : undefined,
    convertedToStudentId: data.convertedToStudentId
      ? String(data.convertedToStudentId)
      : undefined,
    branchId: String(data.branchId ?? 'galle-main'),
    createdAt: created?.toISOString() ?? new Date().toISOString(),
    createdBy: String(data.createdBy ?? ''),
  }
}

export function getPipelineStages(): {
  status: LeadStatus
  label: string
}[] {
  return [
    { status: 'new', label: 'New Inquiry' },
    { status: 'contacted', label: 'Contacted' },
    { status: 'interested', label: 'Interested' },
    { status: 'applied', label: 'Applied' },
    { status: 'enrolled', label: 'Enrolled' },
    { status: 'lost', label: 'Lost' },
  ]
}

export function getStatusColor(status: LeadStatus): string {
  switch (status) {
    case 'new':
      return 'bg-sky-50 text-sky-700 border-sky-200'
    case 'contacted':
      return 'bg-indigo-50 text-indigo-700 border-indigo-200'
    case 'interested':
      return 'bg-violet-50 text-violet-700 border-violet-200'
    case 'applied':
      return 'bg-amber-50 text-amber-800 border-amber-200'
    case 'enrolled':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200'
    case 'lost':
      return 'bg-red-50 text-red-700 border-red-200'
    default:
      return 'bg-[#F5F7FB] text-[#5A6A7A] border-[#DDE3EC]'
  }
}

export function getStatusLabel(status: LeadStatus): string {
  const stage = getPipelineStages().find((s) => s.status === status)
  return stage?.label ?? status
}

export function getSourceLabel(source: LeadSource): string {
  const labels: Record<LeadSource, string> = {
    'walk-in': 'Walk-in',
    facebook: 'Facebook',
    instagram: 'Instagram',
    tiktok: 'TikTok',
    whatsapp: 'WhatsApp',
    referral: 'Referral',
    agent: 'Agent',
    website: 'Website',
    other: 'Other',
  }
  return labels[source] ?? source
}

export const LEAD_SOURCES: LeadSource[] = [
  'walk-in',
  'facebook',
  'instagram',
  'tiktok',
  'whatsapp',
  'referral',
  'agent',
  'website',
  'other',
]

export function calculateCommission(fee: number, rate: number): number {
  if (!fee || !rate) return 0
  return Math.round(fee * (rate / 100))
}

export function parseBudgetFee(budget?: string): number {
  if (!budget) return 25000
  const nums = budget.match(/\d[\d,]*/g)?.map((n) => Number(n.replace(/,/g, ''))) ?? []
  if (nums.length === 0) return 25000
  if (nums.length === 1) return nums[0]
  return Math.round((nums[0] + nums[1]) / 2)
}

export function getDaysInStage(createdAt: string, lastContact?: string): number {
  const ref = lastContact ?? createdAt.slice(0, 10)
  const start = new Date(ref + 'T12:00:00')
  const now = new Date()
  const diff = now.getTime() - start.getTime()
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)))
}

export function formatContactDate(iso?: string): string {
  if (!iso) return '—'
  const d = new Date(iso.slice(0, 10) + 'T12:00:00')
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function getCourseLabel(courseId: CourseId): string {
  return COURSE_MAP[courseId]?.label ?? courseId
}

export function computeCrmStats(leads: Lead[]) {
  const enrolled = leads.filter((l) => l.status === 'enrolled').length
  const inProgress = leads.filter((l) =>
    ['contacted', 'interested', 'applied'].includes(l.status),
  ).length
  const lost = leads.filter((l) => l.status === 'lost').length

  return {
    total: leads.length,
    converted: enrolled,
    inProgress,
    lost,
  }
}

export interface AgentStats {
  agentName: string
  totalLeads: number
  enrolled: number
  conversionRate: number
  commissionOwed: number
}

export function computeAgentStats(leads: Lead[]): AgentStats[] {
  const map = new Map<string, AgentStats>()

  for (const lead of leads) {
    if (!lead.agentName) continue
    const key = lead.agentName.trim()
    if (!map.has(key)) {
      map.set(key, {
        agentName: key,
        totalLeads: 0,
        enrolled: 0,
        conversionRate: 0,
        commissionOwed: 0,
      })
    }
    const stat = map.get(key)!
    stat.totalLeads += 1
    if (lead.status === 'enrolled') {
      stat.enrolled += 1
      const fee = parseBudgetFee(lead.budget)
      stat.commissionOwed += calculateCommission(
        fee,
        lead.commissionRate ?? 0,
      )
    }
  }

  return Array.from(map.values())
    .map((s) => ({
      ...s,
      conversionRate:
        s.totalLeads > 0 ? Math.round((s.enrolled / s.totalLeads) * 100) : 0,
    }))
    .sort((a, b) => b.totalLeads - a.totalLeads)
}

export function getUniqueAgents(leads: Lead[]): string[] {
  const set = new Set<string>()
  for (const l of leads) {
    if (l.agentName?.trim()) set.add(l.agentName.trim())
  }
  return Array.from(set).sort()
}
