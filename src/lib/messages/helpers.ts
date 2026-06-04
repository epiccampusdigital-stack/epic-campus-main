import {
  addDoc,
  collection,
  doc,
  getDocs,
  increment,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Timestamp,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from '@/lib/firebase/client'

export type MessageSenderRole = 'staff' | 'student'
export type MessageType = 'text' | 'image' | 'pdf' | 'payment_link'

export interface Conversation {
  id: string
  studentId: string
  studentName: string
  studentPhone: string
  staffId: string
  staffName: string
  lastMessage: string
  lastMessageAt: string
  unreadCount: number
  unreadByStudent: number
  createdAt: string
}

export interface ChatMessage {
  id: string
  conversationId: string
  senderId: string
  senderName: string
  senderRole: MessageSenderRole
  type: MessageType
  content: string
  fileUrl?: string
  fileName?: string
  paymentLink?: string
  paymentAmount?: number
  read: boolean
  createdAt: string
}

function timestampToIso(value: unknown): string {
  const ts = value as Timestamp | undefined
  if (ts?.toDate) return ts.toDate().toISOString()
  if (typeof value === 'string') return value
  return new Date().toISOString()
}

export function parseConversation(id: string, data: Record<string, unknown>): Conversation {
  return {
    id,
    studentId: String(data.studentId ?? ''),
    studentName: String(data.studentName ?? ''),
    studentPhone: String(data.studentPhone ?? ''),
    staffId: String(data.staffId ?? ''),
    staffName: String(data.staffName ?? ''),
    lastMessage: String(data.lastMessage ?? ''),
    lastMessageAt: timestampToIso(data.lastMessageAt),
    unreadCount: Number(data.unreadCount ?? 0),
    unreadByStudent: Number(data.unreadByStudent ?? 0),
    createdAt: timestampToIso(data.createdAt),
  }
}

export function parseChatMessage(id: string, data: Record<string, unknown>): ChatMessage {
  return {
    id,
    conversationId: String(data.conversationId ?? ''),
    senderId: String(data.senderId ?? ''),
    senderName: String(data.senderName ?? ''),
    senderRole: (data.senderRole as MessageSenderRole) ?? 'student',
    type: (data.type as MessageType) ?? 'text',
    content: String(data.content ?? ''),
    fileUrl: data.fileUrl ? String(data.fileUrl) : undefined,
    fileName: data.fileName ? String(data.fileName) : undefined,
    paymentLink: data.paymentLink ? String(data.paymentLink) : undefined,
    paymentAmount: data.paymentAmount != null ? Number(data.paymentAmount) : undefined,
    read: Boolean(data.read ?? false),
    createdAt: timestampToIso(data.createdAt),
  }
}

export function formatMessageTime(iso: string): string {
  const date = new Date(iso)
  const now = new Date()
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }
  return date.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function staffRoleToSender(role: string): MessageSenderRole {
  return role === 'student' ? 'student' : 'staff'
}

export function previewForMessage(type: MessageType, content: string, fileName?: string): string {
  if (type === 'image') return '📷 Image'
  if (type === 'pdf') return `📄 ${fileName || 'Document'}`
  if (type === 'payment_link') return '💳 Payment link'
  return content.slice(0, 80)
}

export async function getOrCreateConversation(params: {
  studentId: string
  studentName: string
  studentPhone: string
  staffId: string
  staffName: string
}): Promise<Conversation> {
  const existing = await getDocs(
    query(collection(db, 'conversations'), where('studentId', '==', params.studentId)),
  )
  if (!existing.empty) {
    const d = existing.docs[0]
    return parseConversation(d.id, d.data() as Record<string, unknown>)
  }

  const ref = doc(collection(db, 'conversations'))
  await setDoc(ref, {
    studentId: params.studentId,
    studentName: params.studentName,
    studentPhone: params.studentPhone,
    staffId: params.staffId,
    staffName: params.staffName,
    lastMessage: '',
    lastMessageAt: serverTimestamp(),
    unreadCount: 0,
    unreadByStudent: 0,
    createdAt: serverTimestamp(),
  })

  return parseConversation(ref.id, {
    ...params,
    lastMessage: '',
    lastMessageAt: new Date().toISOString(),
    unreadCount: 0,
    unreadByStudent: 0,
    createdAt: new Date().toISOString(),
  })
}

export async function getConversationForStudent(studentId: string): Promise<Conversation | null> {
  const snap = await getDocs(
    query(collection(db, 'conversations'), where('studentId', '==', studentId)),
  )
  if (snap.empty) return null
  const d = snap.docs[0]
  return parseConversation(d.id, d.data() as Record<string, unknown>)
}

export async function sendChatMessage(params: {
  conversationId: string
  senderId: string
  senderName: string
  senderRole: MessageSenderRole
  type: MessageType
  content: string
  fileUrl?: string
  fileName?: string
  paymentLink?: string
  paymentAmount?: number
  notifyStaff?: boolean
  notifyStudent?: boolean
}): Promise<string> {
  const preview = previewForMessage(params.type, params.content, params.fileName)
  const msgRef = await addDoc(collection(db, 'messages'), {
    conversationId: params.conversationId,
    senderId: params.senderId,
    senderName: params.senderName,
    senderRole: params.senderRole,
    type: params.type,
    content: params.content,
    fileUrl: params.fileUrl ?? null,
    fileName: params.fileName ?? null,
    paymentLink: params.paymentLink ?? null,
    paymentAmount: params.paymentAmount ?? null,
    read: false,
    createdAt: serverTimestamp(),
  })

  await updateDoc(doc(db, 'conversations', params.conversationId), {
    lastMessage: preview,
    lastMessageAt: serverTimestamp(),
    ...(params.notifyStaff ? { unreadCount: increment(1) } : {}),
    ...(params.notifyStudent ? { unreadByStudent: increment(1) } : {}),
  })

  return msgRef.id
}

export async function markConversationReadByStaff(conversationId: string): Promise<void> {
  await updateDoc(doc(db, 'conversations', conversationId), { unreadCount: 0 })
}

export async function markConversationReadByStudent(conversationId: string): Promise<void> {
  await updateDoc(doc(db, 'conversations', conversationId), { unreadByStudent: 0 })
}

export function subscribeConversations(
  onData: (list: Conversation[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const q = query(collection(db, 'conversations'), orderBy('lastMessageAt', 'desc'))
  return onSnapshot(
    q,
    (snap) => {
      onData(
        snap.docs.map((d) => parseConversation(d.id, d.data() as Record<string, unknown>)),
      )
    },
    (err) => onError?.(err),
  )
}

export function subscribeMessages(
  conversationId: string,
  onData: (list: ChatMessage[]) => void,
): Unsubscribe {
  const q = query(
    collection(db, 'messages'),
    where('conversationId', '==', conversationId),
    orderBy('createdAt', 'asc'),
  )
  return onSnapshot(q, (snap) => {
    onData(snap.docs.map((d) => parseChatMessage(d.id, d.data() as Record<string, unknown>)))
  })
}
