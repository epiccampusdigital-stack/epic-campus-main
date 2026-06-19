'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { doc, collection, query, orderBy, onSnapshot, addDoc, setDoc, serverTimestamp, increment, getDoc } from 'firebase/firestore'
import { useManagement } from '@/components/layout/ManagementContext'
import WhatsAppFollowUpModal, { type WhatsAppFollowUpStudent } from '@/components/students/WhatsAppFollowUpModal'
import { db } from '@/lib/firebase/client'
import { COURSE_MAP } from '@/lib/constants/courses'
import { parseStudent } from '@/lib/students/helpers'

type Message = {
  id: string
  text: string
  senderRole: string
  senderName: string
  senderId: string
  recipient?: 'admin' | 'teacher'
  createdAt: any
  read: boolean
}

type Conversation = {
  id: string
  studentId: string
  studentName: string
  studentEmail: string
  lastMessage: string
  lastAt: any
  unreadByAdmin: number
  unreadByStudent: number
}

export default function MessagesPage() {
  const { user } = useManagement()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'teacher'>('all')
  const [followUpStudent, setFollowUpStudent] = useState<WhatsAppFollowUpStudent | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  const selected = conversations.find((c) => c.studentId === selectedId) ?? null
  const filteredConversations = conversations.filter((c) => {
    const matchSearch = !searchQuery.trim() ||
      (c.studentName || '').toLowerCase().includes(searchQuery.trim().toLowerCase())
    const matchRole = roleFilter === 'all' ||
      (c as any).lastRecipient === roleFilter
    return matchSearch && matchRole
  })

  const openAiFollowUp = useCallback(async (conv: Conversation) => {
    let course = ''
    try {
      const snap = await getDoc(doc(db, 'students', conv.studentId))
      if (snap.exists()) {
        const s = parseStudent(snap.id, snap.data() as Record<string, unknown>)
        course = COURSE_MAP[s.courseId]?.label ?? s.courseId
      }
    } catch {
      // course optional for draft
    }
    setFollowUpStudent({
      id: conv.studentId,
      name: conv.studentName,
      phone: '',
      course,
      riskFlags: [],
      recommendation: '',
    })
  }, [])

  // Load conversations
  useEffect(() => {
    const q = query(collection(db, 'messages'), orderBy('lastAt', 'desc'))
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map(
          (d) =>
            ({
              id: d.id,
              studentId: d.id,
              ...(d.data() as Record<string, any>),
            }) as Conversation
        )
        setConversations(list)
        setLoading(false)
        if (!selectedId && list.length > 0) {
          setSelectedId(list[0].studentId)
        }
      },
      (err) => {
        console.error('[Messages Page] conversations snapshot', err)
        setLoading(false)
      }
    )
    return unsub
  }, [selectedId])

  // Load thread and mark as read
  useEffect(() => {
    if (!selectedId) {
      setMessages([])
      return
    }

    // Mark unreadByAdmin = 0
    void setDoc(doc(db, 'messages', selectedId), { unreadByAdmin: 0 }, { merge: true }).catch(
      console.error
    )

    const q = query(
      collection(db, 'messages', selectedId, 'thread'),
      orderBy('createdAt', 'asc')
    )
    const unsub = onSnapshot(
      q,
      (snap) => {
        setMessages(
          snap.docs.map(
            (d) =>
              ({
                id: d.id,
                ...(d.data() as Record<string, any>),
              }) as Message
          )
        )
      },
      (err) => console.error('[Messages Page] thread snapshot', err)
    )

    return unsub
  }, [selectedId])

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSendAsStaff(text: string) {
    if (!selectedId || !text.trim()) return
    if (!user) return

    const role = user.role === 'teacher' ? 'teacher' : 'admin'

    try {
      await addDoc(collection(db, 'messages', selectedId, 'thread'), {
        text,
        senderRole: role,
        senderName: user.displayName || user.email || '',
        senderId: user.uid,
        createdAt: serverTimestamp(),
        read: false,
      })

      await setDoc(
        doc(db, 'messages', selectedId),
        {
          lastMessage: text,
          lastAt: serverTimestamp(),
          unreadByAdmin: 0,
          unreadByStudent: increment(1),
        },
        { merge: true }
      )
    } catch (err) {
      console.error('[MessagesPage] send error', err)
    }
  }

  if (!user) return null

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-jakarta text-2xl font-bold text-[#0B3D6B] dark:text-white">Messages</h1>
        <div className="mt-1 h-1 w-16 rounded bg-[#E8A020]" />
        <p className="mt-2 text-sm text-[#5A6A7A] dark:text-white/50">In-app chat with students</p>
      </div>

      <div className="flex h-[calc(100vh-14rem)] overflow-hidden rounded-2xl border border-[#DDE3EC] dark:border-white/[0.08] bg-white dark:bg-white/[0.04] shadow-sm">
        {/* LEFT PANEL: Inbox */}
        <div className="flex h-full w-full flex-col border-r border-[#DDE3EC] dark:border-white/[0.08] md:w-1/3 lg:w-1/4">
          {/* Search */}
          <div className="space-y-3 border-b border-[#DDE3EC] dark:border-white/[0.08] p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-jakarta font-bold text-[#0B3D6B] dark:text-white text-sm">Conversations</h2>
            </div>
            <input
              type="search"
              placeholder="Search student…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-[#DDE3EC] dark:border-white/[0.12] dark:bg-white/[0.06] px-3 py-2 text-sm text-[#0B3D6B] dark:text-white placeholder:text-[#5A6A7A] dark:placeholder:text-white/40 outline-none focus:border-[#0B3D6B] dark:focus:border-[#E8A020]"
            />
            <div className="flex gap-1 mt-2">
              {(['all', 'admin', 'teacher'] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRoleFilter(r)}
                  className={`flex-1 rounded-lg py-1 text-xs font-semibold transition-all capitalize ${
                    roleFilter === r
                      ? 'bg-[#0B3D6B] text-white dark:bg-[#E8A020] dark:text-[#0B3D6B]'
                      : 'border border-[#DDE3EC] dark:border-white/[0.12] text-[#5A6A7A] dark:text-white/50'
                  }`}
                >
                  {r === 'all' ? 'All' : r === 'admin' ? 'Admin' : 'Teacher'}
                </button>
              ))}
            </div>
          </div>

          {/* Conversation List */}
          <div className="flex-1 overflow-y-auto">
            {loading && (
              <div className="space-y-2 p-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-16 animate-pulse rounded-lg bg-[#DDE3EC] dark:bg-white/10" />
                ))}
              </div>
            )}
            {!loading && filteredConversations.length === 0 && (
              <p className="p-6 text-center text-sm text-[#5A6A7A] dark:text-white/50">
                {searchQuery ? 'No students found' : 'No messages'}
              </p>
            )}
            {filteredConversations.map((c) => (
              <button
                key={c.studentId}
                type="button"
                onClick={() => setSelectedId(c.studentId)}
                className={`w-full border-l-4 px-4 py-3 text-left transition-colors ${
                  selectedId === c.studentId
                    ? 'border-l-[#E8A020] bg-[#0B3D6B]/10 dark:bg-white/[0.06]'
                    : 'border-l-transparent hover:bg-[#F5F7FB] dark:hover:bg-white/[0.02]'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="truncate font-medium text-[#0D1B2A] dark:text-white">{c.studentName}</p>
                  {Number(c.unreadByAdmin) > 0 && (
                    <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#E8A020] px-1.5 text-xs font-bold text-[#0B3D6B]">
                      {c.unreadByAdmin}
                    </span>
                  )}
                </div>
                <p className="mt-0.5 truncate text-xs text-[#5A6A7A] dark:text-white/50">
                  {c.lastMessage || 'No messages yet'}
                </p>
                {(c as any).lastRecipient === 'teacher' && (
                  <span className="text-[10px] text-[#E8A020] font-medium">
                    → For Teacher
                  </span>
                )}
                {(c as any).lastRecipient === 'admin' && (
                  <span className="text-[10px] text-[#0B3D6B] dark:text-white/40 font-medium">
                    → For Admin
                  </span>
                )}
                <p className="mt-1 text-xs text-gray-400 dark:text-white/30">
                  {c.lastAt
                    ? new Date(
                        c.lastAt.toDate ? c.lastAt.toDate() : c.lastAt
                      ).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : '—'}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* RIGHT PANEL: Thread */}
        <div className="flex flex-1 flex-col">
          {!selectedId || !selected ? (
            <div className="flex flex-1 items-center justify-center">
              <div className="text-center">
                <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-[#E8A020]/20 flex items-center justify-center">
                  <span className="ti ti-message-circle text-2xl text-[#E8A020]" />
                </div>
                <p className="text-sm text-[#5A6A7A] dark:text-white/50">
                  Select a student to view messages
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="border-b border-[#DDE3EC] dark:border-white/[0.08] bg-white dark:bg-white/[0.02] px-6 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-jakarta text-lg font-bold text-[#0B3D6B] dark:text-white">
                      {selected.studentName}
                    </h2>
                    <p className="text-xs text-[#5A6A7A] dark:text-white/50">{selected.studentEmail}</p>
                  </div>
                  <Link
                    href={`/admin/students/${selected.studentId}`}
                    className="rounded-lg bg-[#0B3D6B] dark:bg-[#0B3D6B] px-3 py-1.5 text-xs font-semibold text-white dark:text-white hover:bg-[#0A2A4F] dark:hover:bg-[#0A2A4F]"
                  >
                    View Profile
                  </Link>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 space-y-3 overflow-y-auto bg-[#F5F7FB] dark:bg-white/[0.02] p-4">
                {messages.length === 0 && (
                  <p className="py-8 text-center text-sm text-[#5A6A7A] dark:text-white/50">
                    No messages yet. Send a message to start the conversation.
                  </p>
                )}
                {messages.map((m) => {
                  const isStudent = m.senderRole === 'student'
                  return (
                    <div key={m.id} className={`flex ${isStudent ? 'justify-start' : 'justify-end'}`}>
                      <div className="max-w-[85%]">
                        <div
                          className={`rounded-2xl px-3 py-2 text-sm ${
                            isStudent
                              ? 'rounded-bl-sm border border-[#DDE3EC] dark:border-white/[0.12] bg-white dark:bg-white/[0.06] text-[#0B3D6B] dark:text-white'
                              : 'rounded-br-sm bg-[#0B3D6B] dark:bg-[#0B3D6B] text-white'
                          }`}
                        >
                          {m.text}
                        </div>
                        {m.recipient && (
                          <span className={`text-[10px] text-gray-400 dark:text-white/30 ${
                            isStudent ? '' : 'text-right block'
                          }`}>
                            → {m.recipient === 'teacher' ? 'To: Teacher' : 'To: Admin'}
                          </span>
                        )}
                        <p
                          className={`mt-1 text-xs text-gray-400 dark:text-white/40 ${
                            isStudent ? '' : 'text-right'
                          }`}
                        >
                          {m.senderRole === 'student'
                            ? m.senderName
                            : m.senderRole === 'teacher'
                              ? `${m.senderName} (Teacher)`
                              : `${m.senderName} (Admin)`} ·{' '}
                          {m.createdAt?.toDate
                            ? new Date(m.createdAt.toDate()).toLocaleString()
                            : ''}
                        </p>
                      </div>
                    </div>
                  )
                })}
                <div ref={bottomRef} />
              </div>

              {/* Reply Bar */}
              <div className="flex items-center gap-2 border-t border-[#DDE3EC] dark:border-white/[0.08] bg-white dark:bg-white/[0.04] p-3">
                <ThreadReplyBar onSend={handleSendAsStaff} disabled={!selectedId} />
              </div>
            </>
          )}
        </div>
      </div>

      <WhatsAppFollowUpModal
        student={followUpStudent}
        staffName={user.displayName || user.email || 'Epic Campus'}
        open={!!followUpStudent}
        onClose={() => setFollowUpStudent(null)}
        defaultMessageType="general"
      />
    </div>
  )
}

function ThreadReplyBar({ onSend, disabled }: { onSend: (text: string) => void; disabled?: boolean }) {
  const [text, setText] = useState('')

  return (
    <>
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            onSend(text)
            setText('')
          }
        }}
        placeholder="Type a message…"
        className="min-w-0 flex-1 rounded-full border border-[#DDE3EC] dark:border-white/[0.12] dark:bg-white/[0.06] px-4 py-2 text-sm text-[#0B3D6B] dark:text-white placeholder:text-[#5A6A7A] dark:placeholder:text-white/40 outline-none focus:border-[#0B3D6B] dark:focus:border-[#E8A020]"
      />
      <button
        type="button"
        onClick={() => {
          if (!text.trim()) return
          onSend(text)
          setText('')
        }}
        disabled={disabled || !text.trim()}
        className="flex h-10 w-10 items-center justify-center rounded-full bg-[#E8A020] dark:bg-[#E8A020] text-[#0B3D6B] dark:text-[#0B3D6B] disabled:opacity-50 hover:bg-[#F5B942] dark:hover:bg-[#F5B942]"
      >
        <span className="ti ti-send" />
      </button>
    </>
  )
}
