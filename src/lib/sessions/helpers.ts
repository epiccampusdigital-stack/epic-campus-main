import {
  Timestamp,
  addDoc,
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import type { TeacherSession, TeacherSessionStatus } from '@/types'

export function toDate(value: unknown): Date | null {
  if (!value) return null
  if (value instanceof Timestamp) return value.toDate()
  if (typeof value === 'string') return new Date(value)
  if (typeof value === 'object' && value !== null && 'seconds' in value) {
    return new Date((value as { seconds: number }).seconds * 1000)
  }
  return null
}

export function parseTeacherSession(
  id: string,
  data: Record<string, unknown>,
): TeacherSession {
  const scheduled = toDate(data.scheduledAt)
  const created = toDate(data.createdAt)
  return {
    id,
    teacherId: String(data.teacherId ?? ''),
    teacherName: String(data.teacherName ?? ''),
    studentId: String(data.studentId ?? ''),
    studentName: String(data.studentName ?? ''),
    topic: String(data.topic ?? ''),
    description: String(data.description ?? ''),
    scheduledAt: scheduled?.toISOString() ?? new Date().toISOString(),
    duration: Number(data.duration ?? 60),
    status: (data.status as TeacherSessionStatus) ?? 'scheduled',
    notes: String(data.notes ?? ''),
    createdAt: created?.toISOString() ?? new Date().toISOString(),
  }
}

export function formatSessionDateTime(iso: string): { date: string; time: string } {
  const d = new Date(iso)
  return {
    date: d.toLocaleDateString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }),
    time: d.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }),
  }
}

export function isUpcomingSession(session: TeacherSession): boolean {
  if (session.status !== 'scheduled') return false
  return new Date(session.scheduledAt) >= new Date()
}

export function sessionStatusStyle(status: TeacherSessionStatus): string {
  switch (status) {
    case 'scheduled':
      return 'bg-sky-50 text-sky-700 border-sky-200'
    case 'completed':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200'
    case 'cancelled':
      return 'bg-red-50 text-red-700 border-red-200'
    default:
      return 'bg-[#F5F7FB] text-[#5A6A7A] border-[#DDE3EC]'
  }
}

export async function fetchTeacherSessions(teacherId: string): Promise<TeacherSession[]> {
  const snap = await getDocs(
    query(collection(db, 'sessions'), where('teacherId', '==', teacherId)),
  )
  return snap.docs
    .map((d) => parseTeacherSession(d.id, d.data() as Record<string, unknown>))
    .sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt))
}

export async function fetchStudentSessions(studentId: string): Promise<TeacherSession[]> {
  const snap = await getDocs(
    query(collection(db, 'sessions'), where('studentId', '==', studentId)),
  )
  return snap.docs
    .map((d) => parseTeacherSession(d.id, d.data() as Record<string, unknown>))
    .sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt))
}

export interface CreateSessionInput {
  teacherId: string
  teacherName: string
  studentId: string
  studentName: string
  topic: string
  description: string
  scheduledAt: Date
  duration: number
}

export async function createTeacherSession(input: CreateSessionInput): Promise<string> {
  const ref = await addDoc(collection(db, 'sessions'), {
    teacherId: input.teacherId,
    teacherName: input.teacherName,
    studentId: input.studentId,
    studentName: input.studentName,
    topic: input.topic.trim(),
    description: input.description.trim(),
    scheduledAt: Timestamp.fromDate(input.scheduledAt),
    duration: input.duration,
    status: 'scheduled',
    notes: '',
    createdAt: serverTimestamp(),
  })
  return ref.id
}

export async function updateTeacherSession(
  id: string,
  patch: Partial<
    Pick<
      CreateSessionInput,
      'topic' | 'description' | 'duration' | 'studentId' | 'studentName'
    > & {
      scheduledAt?: Date
      status?: TeacherSessionStatus
      notes?: string
    }
  >,
): Promise<void> {
  const { scheduledAt, ...rest } = patch
  const data: Record<string, unknown> = { ...rest }
  if (scheduledAt) {
    data.scheduledAt = Timestamp.fromDate(scheduledAt)
  }
  await updateDoc(doc(db, 'sessions', id), data)
}

export async function completeTeacherSession(id: string, notes: string): Promise<void> {
  await updateDoc(doc(db, 'sessions', id), {
    status: 'completed',
    notes: notes.trim(),
  })
}

export async function cancelTeacherSession(id: string): Promise<void> {
  await updateDoc(doc(db, 'sessions', id), { status: 'cancelled' })
}

export const SESSION_DURATIONS = [30, 45, 60, 90] as const
