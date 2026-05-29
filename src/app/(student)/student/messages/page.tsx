'use client'

import { useEffect, useRef, useState } from 'react'
import {
  collection,
  onSnapshot,
  orderBy,
  query,
} from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { useStudentPortal } from '@/components/student/StudentContext'
import {
  formatMessageTime,
  getOrCreateStudentThread,
  markReadByStudent,
  parseMessage,
  sendThreadMessage,
  type ThreadMessage,
} from '@/lib/messaging/helpers'

export default function StudentMessagesPage() {
  const { user, student } = useStudentPortal()
  const [threadId, setThreadId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ThreadMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const studentId = student?.id ?? user?.uid ?? ''

  useEffect(() => {
    if (!student || !user) return

    let cancelled = false

    async function initThread() {
      setLoading(true)
      try {
        const thread = await getOrCreateStudentThread(studentId, student!.name)
        if (!cancelled) {
          setThreadId(thread.id)
          await markReadByStudent(thread.id)
        }
      } catch (err) {
        console.error('[StudentMessages]', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    initThread()
    return () => {
      cancelled = true
    }
  }, [student, user, studentId])

  useEffect(() => {
    if (!threadId) return

    markReadByStudent(threadId).catch(console.error)

    const q = query(
      collection(db, 'messageThreads', threadId, 'messages'),
      orderBy('createdAt', 'asc'),
    )

    const unsubscribe = onSnapshot(q, (snap) => {
      setMessages(
        snap.docs.map((d) => parseMessage(d.id, d.data() as Record<string, unknown>)),
      )
    })

    return () => unsubscribe()
  }, [threadId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend() {
    if (!input.trim() || sending || !threadId || !user || !student) return

    setSending(true)
    try {
      await sendThreadMessage({
        threadId,
        senderId: user.uid,
        senderName: student.name,
        senderRole: 'student',
        content: input,
        notifyAdmin: true,
      })
      setInput('')
    } catch (err) {
      console.error('[StudentMessages] send', err)
    } finally {
      setSending(false)
    }
  }

  if (!student || !user) return null

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-10rem)] animate-pulse flex-col rounded-2xl border border-[#DDE3EC] bg-white">
        <div className="border-b border-[#DDE3EC] px-6 py-4">
          <div className="h-5 w-40 rounded bg-[#DDE3EC]" />
        </div>
        <div className="flex-1 bg-[#F5F7FB] p-4" />
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-10rem)] flex-col overflow-hidden rounded-2xl border border-[#DDE3EC] bg-white shadow-sm">
      <div className="border-b border-[#DDE3EC] px-6 py-4">
        <h2 className="font-jakarta text-lg font-bold text-[#0B3D6B]">Messages</h2>
        <p className="text-sm text-[#5A6A7A]">Chat with EPIC Campus admin</p>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto bg-[#F5F7FB] p-4">
        {messages.length === 0 && (
          <p className="py-8 text-center text-sm text-[#5A6A7A]">
            No messages yet. Send a message to get started.
          </p>
        )}
        {messages.map((m) => {
          const isStudent = m.senderRole === 'student'
          return (
            <div key={m.id} className={`flex ${isStudent ? 'justify-end' : 'justify-start'}`}>
              <div className="max-w-[80%]">
                <div
                  className={`rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                    isStudent
                      ? 'rounded-br-sm bg-[#0B3D6B] text-white'
                      : 'rounded-bl-sm border border-gray-100 bg-gray-100 text-gray-800'
                  }`}
                >
                  {m.content}
                </div>
                <p className={`mt-1 text-xs text-gray-400 ${isStudent ? 'text-right' : ''}`}>
                  {formatMessageTime(m.createdAt)}
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
          placeholder="Type your message..."
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
    </div>
  )
}
