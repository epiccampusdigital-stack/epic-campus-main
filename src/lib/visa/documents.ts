import { Timestamp } from 'firebase/firestore'

export type VisaDocSide = 'staff' | 'student'
export type VisaDocStatus = 'pending' | 'approved' | 'rejected'

export interface VisaDocumentRecord {
  id: string
  studentId: string
  side: VisaDocSide
  fileName: string
  fileUrl: string
  uploadedAt: string
  uploadedBy: string
  uploadedByName: string
  status: VisaDocStatus
  notes: string
}

function timestampToIso(value: unknown): string {
  if (!value) return new Date().toISOString()
  if (value instanceof Timestamp) return value.toDate().toISOString()
  if (typeof value === 'string') return value
  return new Date().toISOString()
}

export function parseVisaDocument(id: string, data: Record<string, unknown>): VisaDocumentRecord {
  return {
    id,
    studentId: String(data.studentId ?? ''),
    side: (data.side as VisaDocSide) ?? 'staff',
    fileName: String(data.fileName ?? 'Document'),
    fileUrl: String(data.fileUrl ?? ''),
    uploadedAt: timestampToIso(data.uploadedAt),
    uploadedBy: String(data.uploadedBy ?? ''),
    uploadedByName: String(data.uploadedByName ?? ''),
    status: (data.status as VisaDocStatus) ?? 'pending',
    notes: String(data.notes ?? ''),
  }
}

export const VISA_STATUS_STYLES: Record<VisaDocStatus, string> = {
  pending: 'bg-amber-50 text-amber-800 border-amber-200',
  approved: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  rejected: 'bg-red-50 text-red-800 border-red-200',
}

export function formatVisaDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-LK', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}
