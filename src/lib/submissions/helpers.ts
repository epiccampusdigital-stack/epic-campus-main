import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  where,
  serverTimestamp,
  type Unsubscribe,
} from 'firebase/firestore'
import { deleteObject, getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage'
import { db, storage } from '@/lib/firebase/client'

/** Firestore collection backing student-uploaded submissions ("My Submissions"). */
export const SUBMISSIONS_COLLECTION = 'studentSubmissions'

/** Storage prefix — mirrors the studentSubmissions/{studentId}/... path used by storage.rules. */
export const SUBMISSIONS_STORAGE_PREFIX = 'studentSubmissions'

export const SUBMISSION_TAGS = ['Exam Paper', 'Homework', 'Certificate', 'Document', 'Other'] as const
export type SubmissionTag = (typeof SUBMISSION_TAGS)[number]

export const SUBMISSION_ALLOWED_TYPES = ['application/pdf', 'image/png', 'image/jpeg'] as const
export const SUBMISSION_MAX_SIZE_BYTES = 10 * 1024 * 1024
export const SUBMISSION_NOTE_MAX_LENGTH = 500

export interface StudentSubmission {
  id: string
  studentId: string
  studentName: string
  batchId: string
  courseId: string
  title: string
  tag: string
  note: string
  fileUrl: string
  fileName: string
  fileType: string
  fileSize: number
  createdAt: string
  status: 'sent'
  readByTeacher: boolean
  teacherId: string | null
}

export function parseStudentSubmission(id: string, data: Record<string, unknown>): StudentSubmission {
  return {
    id,
    studentId: String(data.studentId ?? ''),
    studentName: String(data.studentName ?? ''),
    batchId: String(data.batchId ?? ''),
    courseId: String(data.courseId ?? ''),
    title: String(data.title ?? ''),
    tag: String(data.tag ?? 'Other'),
    note: String(data.note ?? ''),
    fileUrl: String(data.fileUrl ?? ''),
    fileName: String(data.fileName ?? ''),
    fileType: String(data.fileType ?? ''),
    fileSize: Number(data.fileSize ?? 0),
    createdAt: String(data.createdAt ?? new Date().toISOString()),
    status: 'sent',
    readByTeacher: Boolean(data.readByTeacher),
    teacherId: data.teacherId != null ? String(data.teacherId) : null,
  }
}

/** Client-side gate on the file picker — mirrored by storage.rules server-side. */
export function validateSubmissionFile(file: File): string | null {
  if (!(SUBMISSION_ALLOWED_TYPES as readonly string[]).includes(file.type)) {
    return 'Only PDF, PNG, or JPEG files are allowed.'
  }
  if (file.size > SUBMISSION_MAX_SIZE_BYTES) {
    return 'File must be 10MB or smaller.'
  }
  return null
}

export function subscribeStudentSubmissions(
  studentId: string,
  onData: (list: StudentSubmission[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, SUBMISSIONS_COLLECTION),
    where('studentId', '==', studentId),
    orderBy('createdAt', 'desc'),
  )
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => parseStudentSubmission(d.id, d.data() as Record<string, unknown>))),
    (err) => onError?.(err),
  )
}

/** Same uploadBytesResumable pattern WallComposer uses for Epic Wall photos. */
export async function uploadSubmissionFile(
  studentId: string,
  file: File,
  onProgress: (pct: number) => void,
): Promise<string> {
  const path = `${SUBMISSIONS_STORAGE_PREFIX}/${studentId}/${Date.now()}_${file.name}`
  const storageRef = ref(storage, path)
  const task = uploadBytesResumable(storageRef, file)
  await new Promise<void>((resolve, reject) => {
    task.on(
      'state_changed',
      (snap) => onProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
      reject,
      resolve,
    )
  })
  return getDownloadURL(storageRef)
}

export async function createStudentSubmission(input: {
  studentId: string
  studentName: string
  batchId: string
  courseId: string
  title: string
  tag: string
  note: string
  fileUrl: string
  fileName: string
  fileType: string
  fileSize: number
  teacherId: string | null
}): Promise<string> {
  const submissionRef = await addDoc(collection(db, SUBMISSIONS_COLLECTION), {
    studentId: input.studentId,
    studentName: input.studentName,
    batchId: input.batchId,
    courseId: input.courseId,
    title: input.title,
    tag: input.tag,
    note: input.note,
    fileUrl: input.fileUrl,
    fileName: input.fileName,
    fileType: input.fileType,
    fileSize: input.fileSize,
    // Project rule: no serverTimestamp() here — plain ISO string instead.
    createdAt: new Date().toISOString(),
    status: 'sent',
    readByTeacher: false,
    teacherId: input.teacherId,
  })
  return submissionRef.id
}

export async function deleteStudentSubmission(submission: StudentSubmission): Promise<void> {
  if (submission.fileUrl) {
    try {
      await deleteObject(ref(storage, submission.fileUrl))
    } catch {
      // Storage object may already be gone — the Firestore doc delete below is authoritative.
    }
  }
  await deleteDoc(doc(db, SUBMISSIONS_COLLECTION, submission.id))
}

/**
 * Broadcasts into the existing admin/owner notification bell (same collection +
 * shape as createPartnerNotification in lib/partners/helpers.ts). The app has no
 * batch → teacher assignment table, so submissions can't be targeted at one
 * teacher's uid — admin/owner see the alert and can route it, same as other
 * cross-portal notifications today.
 */
export async function notifyOfStudentSubmission(input: {
  studentId: string
  studentName: string
  title: string
  tag: string
}): Promise<void> {
  await addDoc(collection(db, 'notifications'), {
    type: 'student_submission',
    title: 'New file submission',
    message: `${input.studentName} sent a file: ${input.title} (${input.tag})`,
    studentId: input.studentId,
    studentDisplayName: input.studentName,
    read: false,
    createdAt: serverTimestamp(),
  })
}
