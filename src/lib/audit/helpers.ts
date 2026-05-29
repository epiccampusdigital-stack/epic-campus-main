import { Timestamp } from 'firebase/firestore'
import type { AuditAction, AuditLog, Role } from '@/types'

export const AUDIT_ACTIONS: AuditAction[] = [
  'created',
  'updated',
  'deleted',
  'approved',
  'login',
  'logout',
  'payment_recorded',
  'student_registered',
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

export function parseAuditLog(id: string, data: Record<string, unknown>): AuditLog {
  const created = toDate(data.createdAt ?? data.timestamp)
  return {
    id,
    userId: String(data.userId ?? ''),
    userEmail: String(data.userEmail ?? ''),
    userRole: (data.userRole as Role) ?? 'admin',
    action: String(data.action ?? 'updated'),
    entityType: String(data.entityType ?? data.module ?? 'system'),
    entityId: String(data.entityId ?? data.targetId ?? ''),
    details: String(data.details ?? ''),
    ipAddress: data.ipAddress ? String(data.ipAddress) : undefined,
    createdAt: created?.toISOString() ?? new Date().toISOString(),
  }
}

const ACTION_COLORS: Record<string, string> = {
  created: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  updated: 'bg-blue-50 text-blue-700 border-blue-200',
  deleted: 'bg-red-50 text-red-700 border-red-200',
  approved: 'bg-amber-50 text-amber-800 border-amber-200',
  login: 'bg-slate-100 text-slate-600 border-slate-200',
  logout: 'bg-slate-100 text-slate-600 border-slate-200',
  payment_recorded: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  student_registered: 'bg-emerald-50 text-emerald-700 border-emerald-200',
}

export function getActionColor(action: string): string {
  return ACTION_COLORS[action] ?? 'bg-[#F5F7FB] text-[#5A6A7A] border-[#DDE3EC]'
}

export function getActionLabel(action: string): string {
  return action.replace(/_/g, ' ')
}

export function formatAuditTimestamp(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('en-LK', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export interface LogAuditParams {
  userId: string
  userEmail: string
  userRole: Role
  action: AuditAction | string
  entityType: string
  entityId: string
  details: string
}

/** Client-side audit logger — POSTs to API to capture IP address */
export async function logAuditEvent(params: LogAuditParams): Promise<void> {
  try {
    await fetch('/api/audit/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    })
  } catch (err) {
    console.error('[logAuditEvent]', err)
  }
}
