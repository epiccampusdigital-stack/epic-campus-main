import { adminDb } from '@/lib/firebase/admin'
import { FieldValue } from 'firebase-admin/firestore'
import type { Role } from '@/types'

interface CreateAuditLogParams {
  userId: string
  userEmail: string
  userRole: Role
  action: string
  entityType: string
  entityId: string
  details: string
  ipAddress?: string
}

/** Server-side audit logger (Admin SDK) */
export async function createAuditLog(params: CreateAuditLogParams): Promise<void> {
  try {
    await adminDb.collection('auditLog').add({
      ...params,
      createdAt: FieldValue.serverTimestamp(),
    })
  } catch (error) {
    console.error('Audit log failed:', error)
  }
}

export { logAuditEvent } from '@/lib/audit/helpers'
