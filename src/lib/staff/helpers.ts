import { Timestamp } from 'firebase/firestore'
import type { Role, SalaryType, StaffMember, StaffRole, StaffStatus } from '@/types'

export const STAFF_ROLES: StaffRole[] = [
  'admin',
  'owner',
  'reception',
  'accountant',
  'teacher',
  'examCoordinator',
  'agent',
  'kitchen',
]

export function toDate(value: unknown): Date | null {
  if (!value) return null
  if (value instanceof Timestamp) return value.toDate()
  if (typeof value === 'string') return new Date(value)
  if (typeof value === 'object' && value !== null && 'seconds' in value) {
    return new Date((value as { seconds: number }).seconds * 1000)
  }
  return null
}

export function parseStaff(id: string, data: Record<string, unknown>): StaffMember | null {
  const hasIdentity = data.name || data.displayName || data.email || data.uid
  if (!hasIdentity) return null
  const rawRole = String(data.role ?? '')
  if (rawRole === 'student') return null
  const role = (STAFF_ROLES.includes(rawRole as StaffRole) ? rawRole : 'teacher') as Role

  const created = toDate(data.createdAt)
  const approved = toDate(data.approvedAt)
  const start = data.startDate ? String(data.startDate).slice(0, 10) : undefined

  return {
    id,
    uid: data.uid ? String(data.uid) : undefined,
    email: String(data.email ?? ''),
    displayName: String(data.displayName ?? data.name ?? ''),
    role: role as StaffRole,
    status: (data.status as StaffStatus) ?? 'active',
    phone: String(data.phone ?? data.mobile ?? ''),
    nic: String(data.nic ?? ''),
    dateOfBirth: data.dateOfBirth ? String(data.dateOfBirth).slice(0, 10) : undefined,
    address: data.address ? String(data.address) : undefined,
    photoUrl: data.photoUrl ? String(data.photoUrl) : undefined,
    branchId: String(data.branchId ?? 'galle-main'),
    locationAssigned: data.locationAssigned
      ? (String(data.locationAssigned) as StaffMember['locationAssigned'])
      : undefined,
    startDate: start,
    salaryType: (data.salaryType as SalaryType) ?? 'fixed',
    baseSalary: Number(data.baseSalary ?? 0),
    commissionRate: data.commissionRate != null ? Number(data.commissionRate) : undefined,
    createdAt: created?.toISOString() ?? new Date().toISOString(),
    approvedBy: data.approvedBy ? String(data.approvedBy) : undefined,
    approvedAt: approved?.toISOString(),
  }
}

export function getRoleLabel(role: StaffRole): string {
  const labels: Record<StaffRole, string> = {
    admin: 'Admin',
    owner: 'Owner',
    reception: 'Reception',
    accountant: 'Accountant',
    teacher: 'Teacher',
    examCoordinator: 'Exam Coordinator',
    agent: 'Enrollment Agent',
    kitchen: 'Kitchen Staff',
  }
  return labels[role] ?? role
}

const ROLE_STYLES: Record<StaffRole, string> = {
  admin: 'bg-[#0B3D6B]/10 text-[#0B3D6B] border-[#0B3D6B]/20',
  owner: 'bg-purple-50 text-purple-700 border-purple-200',
  reception: 'bg-sky-50 text-sky-700 border-sky-200',
  accountant: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  teacher: 'bg-amber-50 text-amber-800 border-amber-200',
  examCoordinator: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  agent: 'bg-teal-50 text-teal-700 border-teal-200',
  kitchen: 'bg-orange-50 text-orange-700 border-orange-200',
}

export function getRoleColor(role: StaffRole): string {
  return ROLE_STYLES[role] ?? ROLE_STYLES.teacher
}

const STATUS_STYLES: Record<StaffStatus, string> = {
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  pending: 'bg-amber-50 text-amber-800 border-amber-200',
  suspended: 'bg-red-50 text-red-700 border-red-200',
}

export function getStatusColor(status: StaffStatus): string {
  return STATUS_STYLES[status] ?? STATUS_STYLES.pending
}

export function getStatusLabel(status: StaffStatus): string {
  const labels: Record<StaffStatus, string> = {
    active: 'Active',
    pending: 'Pending',
    suspended: 'Suspended',
  }
  return labels[status] ?? status
}

export function formatSalary(amount: number, type: SalaryType): string {
  const formatted = new Intl.NumberFormat('en-LK', {
    style: 'currency',
    currency: 'LKR',
    maximumFractionDigits: 0,
  }).format(amount)

  if (type === 'fixed') return `${formatted} / month`
  if (type === 'hourly') return `${formatted} / hour`
  return `${formatted} + commission`
}

export function formatJoinDate(date: string): string {
  const d = new Date(date.slice(0, 10) + 'T12:00:00')
  return d.toLocaleDateString('en-LK', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function computeStaffStats(staff: StaffMember[]) {
  const byRole = STAFF_ROLES.reduce(
    (acc, role) => {
      acc[role] = staff.filter((s) => s.role === role).length
      return acc
    },
    {} as Record<StaffRole, number>,
  )

  return {
    total: staff.length,
    active: staff.filter((s) => s.status === 'active').length,
    pending: staff.filter((s) => s.status === 'pending').length,
    byRole,
    rolesWithStaff: STAFF_ROLES.filter((r) => byRole[r] > 0).length,
  }
}

export function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
}

/** Placeholder — wire to Twilio/WhatsApp Business API later */
export async function sendStaffWhatsApp(phone: string, message: string): Promise<void> {
  console.info('[Staff WhatsApp placeholder]', { phone, message })
}
