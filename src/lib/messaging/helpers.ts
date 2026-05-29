import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Timestamp,
} from 'firebase/firestore'
import { db } from '@/lib/firebase/client'

export const DEFAULT_ADMIN_ID = 'admin'

export type MessageSenderRole = 'student' | 'admin' | 'teacher'

export interface MessageThread {
  id: string
  studentId: string
  studentName: string
  adminId: string
  lastMessage: string
  lastMessageAt: string
  unreadByAdmin: number
  unreadByStudent: number
}

export interface ThreadMessage {
  id: string
  senderId: string
  senderName: string
  senderRole: MessageSenderRole
  content: string
  createdAt: string
  read: boolean
}

export function getThreadId(studentId: string, adminId = DEFAULT_ADMIN_ID): string {
  return `${studentId}_${adminId}`
}

function timestampToIso(value: unknown): string {
  const ts = value as Timestamp | undefined
  if (ts?.toDate) return ts.toDate().toISOString()
  if (typeof value === 'string') return value
  return new Date().toISOString()
}

export function parseThread(id: string, data: Record<string, unknown>): MessageThread {
  return {
    id,
    studentId: String(data.studentId ?? ''),
    studentName: String(data.studentName ?? ''),
    adminId: String(data.adminId ?? DEFAULT_ADMIN_ID),
    lastMessage: String(data.lastMessage ?? ''),
    lastMessageAt: timestampToIso(data.lastMessageAt),
    unreadByAdmin: Number(data.unreadByAdmin ?? 0),
    unreadByStudent: Number(data.unreadByStudent ?? 0),
  }
}

export function parseMessage(id: string, data: Record<string, unknown>): ThreadMessage {
  return {
    id,
    senderId: String(data.senderId ?? ''),
    senderName: String(data.senderName ?? ''),
    senderRole: (data.senderRole as MessageSenderRole) ?? 'student',
    content: String(data.content ?? ''),
    createdAt: timestampToIso(data.createdAt),
    read: Boolean(data.read ?? false),
  }
}

export function formatMessageTime(iso: string): string {
  const date = new Date(iso)
  const now = new Date()
  const isToday = date.toDateString() === now.toDateString()
  if (isToday) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export async function getOrCreateStudentThread(
  studentId: string,
  studentName: string,
  adminId = DEFAULT_ADMIN_ID,
): Promise<MessageThread> {
  const threadId = getThreadId(studentId, adminId)
  const threadRef = doc(db, 'messageThreads', threadId)
  const snap = await getDoc(threadRef)

  if (snap.exists()) {
    return parseThread(snap.id, snap.data() as Record<string, unknown>)
  }

  const existing = await getDocs(
    query(collection(db, 'messageThreads'), where('studentId', '==', studentId)),
  )
  if (!existing.empty) {
    const d = existing.docs[0]
    return parseThread(d.id, d.data() as Record<string, unknown>)
  }

  await setDoc(threadRef, {
    studentId,
    studentName,
    adminId,
    lastMessage: '',
    lastMessageAt: serverTimestamp(),
    unreadByAdmin: 0,
    unreadByStudent: 0,
  })

  return parseThread(threadId, {
    studentId,
    studentName,
    adminId,
    lastMessage: '',
    lastMessageAt: new Date().toISOString(),
    unreadByAdmin: 0,
    unreadByStudent: 0,
  })
}

export async function sendThreadMessage(params: {
  threadId: string
  senderId: string
  senderName: string
  senderRole: MessageSenderRole
  content: string
  notifyAdmin: boolean
}): Promise<void> {
  const { threadId, senderId, senderName, senderRole, content, notifyAdmin } = params
  const trimmed = content.trim()
  if (!trimmed) return

  await addDoc(collection(db, 'messageThreads', threadId, 'messages'), {
    senderId,
    senderName,
    senderRole,
    content: trimmed,
    createdAt: serverTimestamp(),
    read: false,
  })

  await updateDoc(doc(db, 'messageThreads', threadId), {
    lastMessage: trimmed,
    lastMessageAt: serverTimestamp(),
    ...(notifyAdmin
      ? { unreadByAdmin: increment(1) }
      : { unreadByStudent: increment(1) }),
  })
}

export async function markReadByStudent(threadId: string): Promise<void> {
  await updateDoc(doc(db, 'messageThreads', threadId), { unreadByStudent: 0 })
}

export async function markReadByAdmin(threadId: string): Promise<void> {
  await updateDoc(doc(db, 'messageThreads', threadId), { unreadByAdmin: 0 })
}
