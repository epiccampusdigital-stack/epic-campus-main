import { formatLKR } from '@/lib/payments/helpers'
import { filterStudentsByLocation, isInMonth } from '@/lib/locations/helpers'
import { LOCATION_LABELS } from '@/lib/students/helpers'
import type { Payment, Student, StudentLocation } from '@/types'

export interface AgentReportRow {
  agentId: string
  agentName: string
  agentRole?: string
  location: StudentLocation | ''
  locationLabel: string
  totalStudents: number
  studentsThisMonth: number
  totalCollected: number
  outstanding: number
  students: Student[]
}

export function computeStudentOutstanding(student: Student): number {
  const fs = student.feeSchedule
  if (!fs) return 0
  let total = 0
  if (!fs.registration.paid) total += fs.registration.amount
  if (!fs.course.paid) total += fs.course.amount
  for (const exp of fs.otherExpenses) {
    if (!exp.paid) total += exp.amount
  }
  return total
}

export function computeAgentReports(
  students: Student[],
  payments: Payment[],
  monthKey: string,
  locationFilter: StudentLocation | '',
  agentRoles: Map<string, string>,
): AgentReportRow[] {
  const scopedStudents = filterStudentsByLocation(students, locationFilter)
  const scopedIds = new Set(scopedStudents.map((s) => s.id))

  const byAgent = new Map<string, Student[]>()
  for (const s of scopedStudents) {
    const key = s.agentId || '__unassigned__'
    const list = byAgent.get(key) ?? []
    list.push(s)
    byAgent.set(key, list)
  }

  const rows: AgentReportRow[] = []

  const agentEntries = Array.from(byAgent.entries()) as [string, Student[]][]
  for (const [agentId, agentStudents] of agentEntries) {
    const first = agentStudents[0]
    const agentName =
      agentId === '__unassigned__'
        ? 'Unassigned'
        : first.agentName || 'Unknown agent'
    const agentRole = agentId === '__unassigned__' ? undefined : agentRoles.get(agentId)

    const studentsThisMonth = agentStudents.filter((s) => {
      const date = s.enrollmentDate || s.createdAt
      return isInMonth(date, monthKey)
    }).length

    const studentIds = new Set(agentStudents.map((s) => s.id))
    let totalCollected = 0
    for (const p of payments) {
      if (!studentIds.has(p.studentId) || !scopedIds.has(p.studentId)) continue
      if (p.status !== 'paid' && p.status !== 'partial') continue
      if (monthKey && !isInMonth(p.paymentDate, monthKey)) continue
      const lkr = p.currency === 'USD' ? p.amount * 320 : p.amount
      totalCollected += lkr
    }

    const outstanding = agentStudents.reduce(
      (sum, s) => sum + computeStudentOutstanding(s),
      0,
    )

    const locations = new Set(
      agentStudents.map((s) => s.location).filter(Boolean) as StudentLocation[],
    )
    const location =
      locations.size === 1 ? (Array.from(locations)[0] as StudentLocation) : ''
    const locationLabel =
      location ? LOCATION_LABELS[location] : locations.size > 1 ? 'Multiple' : '—'

    rows.push({
      agentId,
      agentName,
      agentRole,
      location,
      locationLabel,
      totalStudents: agentStudents.length,
      studentsThisMonth,
      totalCollected,
      outstanding,
      students: agentStudents.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    })
  }

  return rows.sort((a, b) => {
    if (a.agentId === '__unassigned__') return 1
    if (b.agentId === '__unassigned__') return -1
    return a.agentName.localeCompare(b.agentName)
  })
}

export function formatAgentMoney(amount: number): string {
  return formatLKR(amount)
}
