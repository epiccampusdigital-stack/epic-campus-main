import { adminDb } from '@/lib/firebase/admin'
import { FieldValue } from 'firebase-admin/firestore'
import type { AuditLog, Role } from '@/types'

interface CreateAuditLogParams {
  module:   AuditLog['module']
  action:   string
  targetId: string
  details:  string
  userId:   string
  userRole: Role
  branchId?: string
}

export async function createAuditLog(params: CreateAuditLogParams): Promise<void> {
  try {
    await adminDb.collection('auditLog').add({
      ...params,
      timestamp: FieldValue.serverTimestamp(),
    })
  } catch (error) {
    console.error('Audit log failed:', error)
  }
}
