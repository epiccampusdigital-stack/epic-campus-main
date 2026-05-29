'use client'

import { useEffect, useRef, useState } from 'react'
import {
  collection,
  onSnapshot,
  orderBy,
  query,
} from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { useManagement } from '@/components/layout/ManagementContext'
import {
  formatMessageTime,
  markReadByAdmin,
  parseMessage,
  parseThread,
  sendThreadMessage,
  type MessageThread,
  type ThreadMessage,
} from '@/lib/messaging/helpers'

export default function AdminMessagesPage() {
  const { user } = useManagement()
  const [threads, setThreads] = useState<MessageThread[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ThreadMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const selectedThread = threads.find((t) => t.id === selectedId) ?? null

  useEffect(() => {
    const q = query(
      collection(db, 'messageThreads'),
      orderBy('lastMessageAt', 'desc'),
    )

    const unsubscribe = onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) =>
        parseThread(d.id, d.data() as Record<string, unknown>),
      )
      setThreads(list)
      setLoading(false)
      setSelectedId((prev) => prev ?? list[0]?.id ?? null)
    })

    return () => unsubscribe()
  }, [])

  useEffect(() => {
    if (!selectedId) {
      setMessages([])
      return
    }

    markReadByAdmin(selectedId).catch(console.error)

    const q = query(
      collection(db, 'messageThreads', selectedId, 'messages'),
      orderBy('createdAt', 'asc'),
    )

    const unsubscribe = onSnapshot(q, (snap) => {
      setMessages(
        snap.docs.map((d) => parseMessage(d.id, d.data() as Record<string, unknown>)),
      )
    })

    return () => unsubscribe()
  }, [selectedId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, selectedId])

  async function handleSend() {
    if (!input.trim() || sending || !selectedId || !user || !selectedThread) return

    setSending(true)
    try {
      await sendThreadMessage({
        threadId: selectedId,
        senderId: user.uid,
        senderName: user.displayName || 'Admin',
        senderRole: user.role === 'teacher' ? 'teacher' : 'admin',
        content: input,
        notifyAdmin: false,
      })
      setInput('')
    } catch (err) {
      console.error('[AdminMessages] send', err)
    } finally {
      setSending(false)
    }
  }

  function selectThread(id: string) {
    setSelectedId(id)
    markReadByAdmin(id).catch(console.error)
  }

  if (!user) return null

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-jakarta text-2xl font-bold text-[#0B3D6B]">Messages</h1>
        <div className="mt-1 h-1 w-16 rounded bg-[#E8A020]" />
        <p className="mt-2 text-sm text-[#5A6A7A]">Student conversations</p>
      </div>

      <div className="flex h-[calc(100vh-14rem)] overflow-hidden rounded-2xl border border-[#DDE3EC] bg-white shadow-sm">
        {/* Thread list */}
        <div className="flex w-full flex-col border-r border-[#DDE3EC] md:w-80 lg:w-96">
          <div className="border-b border-[#DDE3EC] px-4 py-3">
            <p className="text-sm font-semibold text-[#0D1B2A]">
              {threads.length} conversation{threads.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading && (
              <div className="space-y-2 p-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-16 animate-pulse rounded-lg bg-[#F5F7FB]" />
                ))}
              </div>
            )}
            {!loading && threads.length === 0 && (
              <p className="p-6 text-center text-sm text-[#5A6A7A]">No conversations yet</p>
            )}
            {threads.map((thread) => {
              const active = thread.id === selectedId
              return (
                <button
                  key={thread.id}
                  type="button"
                  onClick={() => selectThread(thread.id)}
                  className={`w-full border-b border-[#DDE3EC]/60 px-4 py-3 text-left transition-colors hover:bg-[#F5F7FB] ${
                    active ? 'bg-[#F5F7FB]' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate font-medium text-[#0D1B2A]">{thread.studentName}</p>
                    {thread.unreadByAdmin > 0 && (
                      <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#E8A020] px-1.5 text-xs font-bold text-white">
                        {thread.unreadByAdmin}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-[#5A6A7A]">
                    {thread.lastMessage || 'No messages yet'}
                  </p>
                  <p className="mt-1 text-xs text-gray-400">
                    {formatMessageTime(thread.lastMessageAt)}
                  </p>
                </button>
              )
            })}
          </div>
        </div>

        {/* Chat panel — hidden on mobile when no selection handled via always showing on md+ */}
        <div className="hidden flex-1 flex-col md:flex">
          {!selectedThread ? (
            <div className="flex flex-1 items-center justify-center text-sm text-[#5A6A7A]">
              Select a conversation
            </div>
          ) : (
            <>
              <div className="border-b border-[#DDE3EC] px-6 py-4">
                <h2 className="font-jakarta font-bold text-[#0B3D6B]">
                  {selectedThread.studentName}
                </h2>
                <p className="text-xs text-[#5A6A7A]">Student ID: {selectedThread.studentId}</p>
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto bg-[#F5F7FB] p-4">
                {messages.map((m) => {
                  const isStaff = m.senderRole !== 'student'
                  return (
                    <div key={m.id} className={`flex ${isStaff ? 'justify-end' : 'justify-start'}`}>
                      <div className="max-w-[80%]">
                        <div
                          className={`rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                            isStaff
                              ? 'rounded-br-sm bg-[#0B3D6B] text-white'
                              : 'rounded-bl-sm border border-gray-100 bg-gray-100 text-gray-800'
                          }`}
                        >
                          {m.content}
                        </div>
                        <p className={`mt-1 text-xs text-gray-400 ${isStaff ? 'text-right' : ''}`}>
                          {m.senderName} · {formatMessageTime(m.createdAt)}
                        </p>
                      </div>
                    </div>
                  )
                })}
                <div ref={bottomRef} />
              </div>

              <div className="flex gap-2 border-t border-[#DDE3EC] bg-white p-4">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                  placeholder="Reply to student..."
                  className="flex-1 rounded-full border border-[#DDE3EC] px-4 py-2 text-sm outline-none transition-colors focus:border-[#0B3D6B]"
                />
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={sending || !input.trim()}
                  className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#E8A020] text-white transition-colors hover:bg-[#d4911c] disabled:opacity-50"
                >
                  ➤
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
