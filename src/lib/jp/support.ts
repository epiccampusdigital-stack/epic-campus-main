import { collection, doc, getDoc, getDocs, orderBy, query, setDoc, updateDoc, where } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import type { JpSupportMessage, JpSupportThread, JpSupportThreadStatus } from '@/types'

// Client SDK — unlike jpOrders (which needs server-computed amounts and is
// staff/webhook-write-only), every write here is something the owning
// student or staff can legitimately do straight from their own browser
// under firestore.rules (self-create/update on their own thread, staff
// read/write on any). The one exception is the AI reply, which is written
// by src/app/api/jp/support/ask/route.ts directly via the Admin SDK since
// that route has no user auth context.

function threadsRef() {
  return collection(db, 'jpSupportThreads')
}

function threadRef(threadId: string) {
  return doc(db, 'jpSupportThreads', threadId)
}

function messagesRef(threadId: string) {
  return collection(db, 'jpSupportThreads', threadId, 'messages')
}

function parseThread(id: string, data: Record<string, unknown>): JpSupportThread {
  return {
    id,
    studentId: String(data.studentId ?? ''),
    uid: String(data.uid ?? ''),
    subject: String(data.subject ?? ''),
    status: (data.status as JpSupportThreadStatus) ?? 'open',
    assignedTo: data.assignedTo == null ? null : String(data.assignedTo),
    lastMessageAt: String(data.lastMessageAt ?? ''),
    createdAt: String(data.createdAt ?? ''),
  }
}

function parseMessage(id: string, threadId: string, data: Record<string, unknown>): JpSupportMessage {
  return {
    id,
    threadId,
    author: (data.author as JpSupportMessage['author']) ?? 'student',
    authorUid: data.authorUid == null ? null : String(data.authorUid),
    body: String(data.body ?? ''),
    createdAt: String(data.createdAt ?? ''),
  }
}

export interface CreateJpSupportThreadParams {
  studentId: string
  uid: string
  subject: string
  firstMessage: string
}

export async function createJpSupportThread(params: CreateJpSupportThreadParams): Promise<JpSupportThread> {
  const ref = doc(threadsRef())
  const now = new Date().toISOString()
  const thread: JpSupportThread = {
    id: ref.id,
    studentId: params.studentId,
    uid: params.uid,
    subject: params.subject,
    status: 'open',
    assignedTo: null,
    lastMessageAt: now,
    createdAt: now,
  }
  const { id, ...data } = thread
  await setDoc(ref, data)
  await addJpSupportMessage(ref.id, { author: 'student', authorUid: params.uid, body: params.firstMessage })
  return thread
}

export async function getJpSupportThread(threadId: string): Promise<JpSupportThread | null> {
  const snap = await getDoc(threadRef(threadId))
  if (!snap.exists()) return null
  return parseThread(snap.id, snap.data())
}

export async function listJpSupportThreadsForStudent(studentId: string): Promise<JpSupportThread[]> {
  const snap = await getDocs(query(threadsRef(), where('studentId', '==', studentId)))
  return snap.docs.map((d) => parseThread(d.id, d.data())).sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt))
}

// Staff-wide listing. No Firestore orderBy here (see src/lib/jp/orders.ts for
// why) — sorted in memory instead, so this doesn't depend on an exact
// composite index for every possible status filter.
export async function listJpSupportThreads(status?: JpSupportThreadStatus): Promise<JpSupportThread[]> {
  const q = status ? query(threadsRef(), where('status', '==', status)) : threadsRef()
  const snap = await getDocs(q)
  return snap.docs.map((d) => parseThread(d.id, d.data())).sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt))
}

export async function listJpSupportMessages(threadId: string): Promise<JpSupportMessage[]> {
  const snap = await getDocs(query(messagesRef(threadId), orderBy('createdAt', 'asc')))
  return snap.docs.map((d) => parseMessage(d.id, threadId, d.data()))
}

export interface AddJpSupportMessageParams {
  author: JpSupportMessage['author']
  authorUid: string | null
  body: string
}

export async function addJpSupportMessage(threadId: string, params: AddJpSupportMessageParams): Promise<JpSupportMessage> {
  const ref = doc(messagesRef(threadId))
  const now = new Date().toISOString()
  const message: JpSupportMessage = {
    id: ref.id,
    threadId,
    author: params.author,
    authorUid: params.authorUid,
    body: params.body,
    createdAt: now,
  }
  const { id, ...data } = message
  await setDoc(ref, data)
  await updateDoc(threadRef(threadId), { lastMessageAt: now })
  return message
}

export async function escalateJpSupportThread(threadId: string): Promise<void> {
  await updateDoc(threadRef(threadId), { status: 'escalated' })
}

export async function closeJpSupportThread(threadId: string): Promise<void> {
  await updateDoc(threadRef(threadId), { status: 'closed' })
}

export async function assignJpSupportThread(threadId: string, staffUid: string): Promise<void> {
  await updateDoc(threadRef(threadId), { assignedTo: staffUid })
}
