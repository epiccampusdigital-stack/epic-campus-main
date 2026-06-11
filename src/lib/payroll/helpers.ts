import { Timestamp } from 'firebase/firestore'
import { formatLKR } from '@/lib/payments/helpers'
import { getRoleLabel } from '@/lib/staff/helpers'
import type {
  PayrollRecord,
  PayrollStatus,
  SalaryType,
  StaffRole,
} from '@/types'

export function toDate(value: unknown): Date | null {
  if (!value) return null
  if (value instanceof Timestamp) return value.toDate()
  if (typeof value === 'string') return new Date(value)
  if (typeof value === 'object' && value !== null && 'seconds' in value) {
    return new Date((value as { seconds: number }).seconds * 1000)
  }
  return null
}

export function parsePayroll(id: string, data: Record<string, unknown>): PayrollRecord {
  const created = toDate(data.createdAt)
  const processed = toDate(data.processedAt)

  return {
    id,
    payrollId: String(data.payrollId ?? id),
    staffId: String(data.staffId ?? ''),
    staffName: String(data.staffName ?? ''),
    role: (data.role as StaffRole) ?? 'teacher',
    period: String(data.period ?? ''),
    salaryType: (data.salaryType as SalaryType) ?? 'fixed',
    baseSalary: Number(data.baseSalary ?? 0),
    hoursWorked: data.hoursWorked != null ? Number(data.hoursWorked) : undefined,
    hourlyRate: data.hourlyRate != null ? Number(data.hourlyRate) : undefined,
    salesAmount: data.salesAmount != null ? Number(data.salesAmount) : undefined,
    commissionRate:
      data.commissionRate != null ? Number(data.commissionRate) : undefined,
    commission: Number(data.commission ?? 0),
    referralCommission: Number(data.referralCommission ?? 0),
    bonus: Number(data.bonus ?? 0),
    tax: Number(data.tax ?? 0),
    advances: Number(data.advances ?? 0),
    otherDeductions: Number(data.otherDeductions ?? data.other ?? 0),
    deductions: Number(data.deductions ?? 0),
    netPay: Number(data.netPay ?? 0),
    status: (data.status as PayrollStatus) ?? 'pending',
    paymentMethod:
      (data.paymentMethod as PayrollRecord['paymentMethod']) ?? 'bank-transfer',
    bankDetails: data.bankDetails ? String(data.bankDetails) : undefined,
    notes: data.notes ? String(data.notes) : undefined,
    processedBy: String(data.processedBy ?? ''),
    processedAt: processed?.toISOString(),
    createdAt: created?.toISOString() ?? new Date().toISOString(),
  }
}

export function calculateNetPay(
  base: number,
  bonus: number,
  deductions: number,
  commission: number,
  referralCommission = 0,
): number {
  return Math.max(0, base + bonus + commission + referralCommission - deductions)
}

export function totalDeductions(
  tax: number,
  advances: number,
  other: number,
): number {
  return tax + advances + other
}

export function computeCommission(
  salesAmount: number,
  commissionRate: number,
): number {
  if (!salesAmount || !commissionRate) return 0
  return Math.round(salesAmount * (commissionRate / 100))
}

export function computeGrossBase(input: {
  salaryType: SalaryType
  baseSalary: number
  hoursWorked?: number
  hourlyRate?: number
}): number {
  if (input.salaryType === 'hourly') {
    const rate = input.hourlyRate ?? input.baseSalary
    return Math.round((input.hoursWorked ?? 0) * rate)
  }
  return input.baseSalary
}

export function formatPayPeriod(month: number, year: number): string {
  const d = new Date(year, month - 1, 1)
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

export function formatPeriodKey(month: number, year: number): string {
  return `${year}-${String(month).padStart(2, '0')}`
}

export function parsePeriodKey(key: string): { month: number; year: number } {
  const [y, m] = key.split('-').map(Number)
  return { month: m || 1, year: y || new Date().getFullYear() }
}

export function formatPeriodLabel(key: string): string {
  const { month, year } = parsePeriodKey(key)
  return formatPayPeriod(month, year)
}

export function getStatusColor(status: PayrollStatus): string {
  switch (status) {
    case 'paid':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200'
    case 'processing':
      return 'bg-amber-50 text-amber-800 border-amber-200'
    case 'pending':
      return 'bg-sky-50 text-sky-700 border-sky-200'
    default:
      return 'bg-[#F5F7FB] text-[#5A6A7A] border-[#DDE3EC]'
  }
}

export function getStatusLabel(status: PayrollStatus): string {
  switch (status) {
    case 'paid':
      return 'Paid'
    case 'processing':
      return 'Processing'
    case 'pending':
      return 'Pending'
    default:
      return status
  }
}

export function getSalaryTypeLabel(type: SalaryType): string {
  switch (type) {
    case 'fixed':
      return 'Fixed'
    case 'hourly':
      return 'Hourly'
    case 'commission':
      return 'Commission'
    default:
      return type
  }
}

export function generatePayrollId(year: number, sequence: number): string {
  return `PAY-${year}-${String(sequence).padStart(3, '0')}`
}

export function nextPayrollSequence(
  records: PayrollRecord[],
  year: number,
): number {
  const prefix = `PAY-${year}-`
  const nums = records
    .filter((r) => r.payrollId.startsWith(prefix))
    .map((r) => {
      const part = r.payrollId.slice(prefix.length)
      return parseInt(part, 10) || 0
    })
  return (nums.length ? Math.max(...nums) : 0) + 1
}

export function getPeriodOptions(count = 12): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = []
  const now = new Date()
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const month = d.getMonth() + 1
    const year = d.getFullYear()
    const value = formatPeriodKey(month, year)
    options.push({ value, label: formatPayPeriod(month, year) })
  }
  return options
}

export function currentPeriodKey(): string {
  const now = new Date()
  return formatPeriodKey(now.getMonth() + 1, now.getFullYear())
}

export function formatPayrollAmount(amount: number): string {
  return formatLKR(amount)
}

export function computePayrollStats(records: PayrollRecord[]) {
  const paid = records.filter((r) => r.status === 'paid')
  const pending = records.filter(
    (r) => r.status === 'pending' || r.status === 'processing',
  )
  const totalPayroll = paid.reduce((sum, r) => sum + r.netPay, 0)
  const averageSalary =
    paid.length > 0 ? Math.round(totalPayroll / paid.length) : 0

  return {
    totalPayroll,
    staffPaid: paid.length,
    staffPending: pending.length,
    averageSalary,
  }
}

export function getEmployeeDisplayId(staffId: string): string {
  return `EMP-${staffId.slice(0, 8).toUpperCase()}`
}

export function getRoleDisplay(role: StaffRole): string {
  return getRoleLabel(role)
}

export function getGrossEarnings(record: PayrollRecord): number {
  return computeGrossBase({
    salaryType: record.salaryType,
    baseSalary: record.baseSalary,
    hoursWorked: record.hoursWorked,
    hourlyRate: record.hourlyRate,
  })
}

export function getPaymentMethodLabel(method: PayrollRecord['paymentMethod']): string {
  return method === 'bank-transfer' ? 'Bank Transfer' : 'Cash'
}
