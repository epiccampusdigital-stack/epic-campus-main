import { collection, doc, deleteDoc, getDoc, getDocs, orderBy, query, setDoc, where } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import type { JpCampusSession, JpSessionRsvp } from '@/types'

// Client SDK — every write here is one firestore.rules already lets the
// caller do directly: admin/owner/teacher manage sessions, and a student
// only ever reads/writes their own rsvps/{uid} doc.

function sessionsRef() {
  return collection(db, 'jpCampusSessions')
}

function sessionRef(sessionId: string) {
  return doc(db, 'jpCampusSessions', sessionId)
}

function rsvpsRef(sessionId: string) {
  return collection(db, 'jpCampusSessions', sessionId, 'rsvps')
}

function rsvpRef(sessionId: string, uid: string) {
  return doc(db, 'jpCampusSessions', sessionId, 'rsvps', uid)
}

function parseSession(id: string, data: Record<string, unknown>): JpCampusSession {
  return {
    id,
    courseId: String(data.courseId ?? ''),
    title: String(data.title ?? ''),
    date: String(data.date ?? ''),
    startTime: String(data.startTime ?? ''),
    endTime: String(data.endTime ?? ''),
    venue: String(data.venue ?? ''),
    capacity: data.capacity == null ? null : Number(data.capacity),
    notes: data.notes == null ? null : String(data.notes),
    createdAt: String(data.createdAt ?? ''),
  }
}

function parseRsvp(uid: string, data: Record<string, unknown>): JpSessionRsvp {
  return {
    uid,
    studentId: String(data.studentId ?? ''),
    rsvp: (data.rsvp as JpSessionRsvp['rsvp']) ?? null,
    attended: Boolean(data.attended),
    rsvpAt: data.rsvpAt == null ? null : String(data.rsvpAt),
    markedBy: data.markedBy == null ? null : String(data.markedBy),
  }
}

export async function listJpCampusSessions(courseId: string): Promise<JpCampusSession[]> {
  const snap = await getDocs(query(sessionsRef(), where('courseId', '==', courseId), orderBy('date', 'asc')))
  return snap.docs.map((d) => parseSession(d.id, d.data()))
}

export async function getJpCampusSession(sessionId: string): Promise<JpCampusSession | null> {
  const snap = await getDoc(sessionRef(sessionId))
  if (!snap.exists()) return null
  return parseSession(snap.id, snap.data())
}

export interface UpsertJpCampusSessionParams {
  id?: string
  courseId: string
  title: string
  date: string
  startTime: string
  endTime: string
  venue: string
  capacity: number | null
  notes: string | null
}

export async function upsertJpCampusSession(params: UpsertJpCampusSessionParams): Promise<JpCampusSession> {
  const ref = params.id ? sessionRef(params.id) : doc(sessionsRef())
  const existing = params.id ? await getDoc(ref) : null
  const session: JpCampusSession = {
    id: ref.id,
    courseId: params.courseId,
    title: params.title,
    date: params.date,
    startTime: params.startTime,
    endTime: params.endTime,
    venue: params.venue,
    capacity: params.capacity,
    notes: params.notes,
    createdAt: existing?.exists() ? String(existing.data()?.createdAt ?? '') : new Date().toISOString(),
  }
  const { id, ...data } = session
  await setDoc(ref, data)
  return session
}

export async function deleteJpCampusSession(sessionId: string): Promise<void> {
  await deleteDoc(sessionRef(sessionId))
}

export async function listJpSessionRsvps(sessionId: string): Promise<JpSessionRsvp[]> {
  const snap = await getDocs(rsvpsRef(sessionId))
  return snap.docs.map((d) => parseRsvp(d.id, d.data()))
}

export async function getJpSessionRsvp(sessionId: string, uid: string): Promise<JpSessionRsvp | null> {
  const snap = await getDoc(rsvpRef(sessionId, uid))
  if (!snap.exists()) return null
  return parseRsvp(snap.id, snap.data())
}

export async function setJpSessionRsvp(
  sessionId: string,
  uid: string,
  studentId: string,
  rsvp: JpSessionRsvp['rsvp'],
): Promise<void> {
  const existing = await getJpSessionRsvp(sessionId, uid)
  await setDoc(
    rsvpRef(sessionId, uid),
    {
      uid,
      studentId,
      rsvp,
      attended: existing?.attended ?? false,
      rsvpAt: new Date().toISOString(),
      markedBy: existing?.markedBy ?? null,
    },
    { merge: true },
  )
}

export async function markJpSessionAttendance(
  sessionId: string,
  uid: string,
  studentId: string,
  attended: boolean,
  markedBy: string,
): Promise<void> {
  await setDoc(
    rsvpRef(sessionId, uid),
    { uid, studentId, attended, markedBy },
    { merge: true },
  )
}
