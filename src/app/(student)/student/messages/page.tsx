'use client'

import { useEffect, useRef, useState } from 'react'
import { useStudentPortal } from '@/components/student/StudentContext'
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  doc,
  setDoc,
  serverTimestamp,
  increment,
} from 'firebase/firestore'
import { db } from '@/lib/firebase/client'

export default function StudentMessagesPage() {
  const { user, student } = useStudentPortal()
  const [messages, setMessages] = useState<any[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [recipient, setRecipient] = useState<'admin' | 'teacher'>('admin')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!student) return
    let cancelled = false

    const parentRef = doc(db, 'messages', student.id)
    // mark unreadByStudent = 0 on mount
    void setDoc(parentRef, { unreadByStudent: 0 }, { merge: true }).catch(console.error)

    const q = query(collection(db, 'messages', student.id, 'thread'), orderBy('createdAt', 'asc'))
    const unsub = onSnapshot(q, (snap) => {
      if (cancelled) return
      setMessages(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, any>) })))
      setLoading(false)
    }, (err) => {
      console.error('[StudentMessages] thread snapshot error', err)
      if (!cancelled) setLoading(false)
    })

    return () => {
      cancelled = true
      unsub()
    }
  }, [student])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend() {
    if (!input.trim() || sending || !student || !user) return
    setSending(true)
    try {
      const text = input.trim()
      setInput('')

      await addDoc(collection(db, 'messages', student.id, 'thread'), {
        text,
        senderRole: 'student',
        senderName: student.name,
        senderId: student.id,
        recipient,
        createdAt: serverTimestamp(),
        read: false,
      })

      await setDoc(doc(db, 'messages', student.id), {
        studentId: student.id,
        studentName: student.name,
        studentEmail: student.email ?? '',
        lastMessage: text,
        lastAt: serverTimestamp(),
        unreadByAdmin: increment(1),
        unreadByStudent: 0,
        lastRecipient: recipient,
      }, { merge: true })
    } catch (err) {
      console.error('[StudentMessages] send error', err)
    } finally {
      setSending(false)
    }
  }

  if (!student || !user) return null

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-10rem)] animate-pulse flex-col rounded-2xl border border-[#DDE3EC] dark:border-white/[0.08] bg-white dark:bg-white/[0.04]">
        <div className="border-b border-[#DDE3EC] dark:border-white/[0.08] px-6 py-4">
          <div className="h-5 w-40 rounded bg-[#DDE3EC] dark:bg-white/10" />
        </div>
        <div className="flex-1 bg-[#F5F7FB] dark:bg-white/[0.02]" />
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-10rem)] flex-col overflow-hidden rounded-2xl border border-[#DDE3EC] dark:border-white/[0.08] bg-white dark:bg-white/[0.04] shadow-sm">
      <div className="border-b border-[#DDE3EC] dark:border-white/[0.08] px-6 py-4">
        <h2 className="font-jakarta text-lg font-bold text-[#0B3D6B] dark:text-[#E8A020]">Messages</h2>
        <p className="text-sm text-[#5A6A7A] dark:text-white/50">Chat with EPIC Campus</p>
        <div className="flex gap-2 mt-3">
          <button
            type="button"
            onClick={() => setRecipient('admin')}
            className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold transition-all ${
              recipient === 'admin'
                ? 'bg-[#0B3D6B] text-white dark:bg-[#E8A020] dark:text-[#0B3D6B]'
                : 'border border-[#DDE3EC] dark:border-white/[0.12] text-[#5A6A7A] dark:text-white/50'
            }`}
          >
            <span className="ti ti-user-shield" />
            Admin (Ishara)
          </button>
          <button
            type="button"
            onClick={() => setRecipient('teacher')}
            className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold transition-all ${
              recipient === 'teacher'
                ? 'bg-[#0B3D6B] text-white dark:bg-[#E8A020] dark:text-[#0B3D6B]'
                : 'border border-[#DDE3EC] dark:border-white/[0.12] text-[#5A6A7A] dark:text-white/50'
            }`}
          >
            <span className="ti ti-school" />
            My Teacher
          </button>
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto bg-[#F5F7FB] dark:bg-white/[0.02] p-4">
        {messages.length === 0 && (
          <p className="py-8 text-center text-sm text-[#5A6A7A] dark:text-white/50">
            No messages yet. Send a message to get started.
          </p>
        )}
        {messages.map((m) => {
          const isStudent = m.senderRole === 'student'
          return (
            <div key={m.id} className={`flex ${isStudent ? 'justify-end' : 'justify-start'}`}>
              <div className="max-w-[80%]">
                {m.type === 'payment_link' && m.paymentLink ? (
                  <div className="rounded-xl border border-[#DDE3EC] dark:border-white/[0.08] bg-white dark:bg-white/[0.06] p-4">
                    <p className="text-sm font-semibold text-[#0B3D6B] dark:text-[#E8A020]">Payment request</p>
                    {m.paymentAmount != null && (
                      <p className="mt-1 text-lg font-bold text-[#0B3D6B] dark:text-white">
                        LKR {m.paymentAmount.toLocaleString('en-LK')}
                      </p>
                    )}
                    <a
                      href={m.paymentLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 inline-block rounded-lg bg-[#E8A020] dark:bg-[#E8A020] px-4 py-2 text-xs font-bold text-[#0B3D6B] dark:text-[#0B3D6B]"
                    >
                      Pay Now
                    </a>
                  </div>
                ) : m.type === 'image' && m.fileUrl ? (
                  <a href={m.fileUrl} target="_blank" rel="noopener noreferrer">
                    <img
                      src={m.fileUrl}
                      alt=""
                      className="max-h-48 rounded-xl border border-[#DDE3EC] dark:border-white/[0.08]"
                    />
                  </a>
                ) : m.type === 'pdf' && m.fileUrl ? (
                  <a
                    href={m.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block rounded-xl bg-gray-100 dark:bg-white/[0.06] px-3 py-2 text-sm underline dark:text-white"
                  >
                    📄 {m.fileName || 'PDF'}
                  </a>
                ) : (
                  <div
                    className={`rounded-2xl px-3 py-2 text-sm ${
                      isStudent
                        ? 'rounded-br-sm bg-[#0B3D6B] text-white dark:bg-[#0B3D6B]'
                        : 'rounded-bl-sm bg-gray-200 dark:bg-white/[0.08] text-gray-900 dark:text-white'
                    }`}
                  >
                    {m.text ?? m.content}
                  </div>
                )}
                <p className={`mt-1 text-xs text-gray-400 dark:text-white/40 ${isStudent ? 'text-right' : ''}`}>
                  {m.createdAt?.toDate
                    ? new Date(m.createdAt.toDate()).toLocaleTimeString('en-US', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : ''}
                </p>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      <div className="flex gap-2 border-t border-[#DDE3EC] dark:border-white/[0.08] bg-white dark:bg-white/[0.04] p-4">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && void handleSend()}
          placeholder="Type your message..."
          className="flex-1 rounded-full border border-[#DDE3EC] dark:border-white/[0.12] px-4 py-2 text-sm outline-none focus:border-[#0B3D6B] dark:focus:border-[#E8A020] bg-white dark:bg-white/[0.06] text-[#0B3D6B] dark:text-white placeholder:text-[#5A6A7A] dark:placeholder:text-white/40"
        />
        <button
          type="button"
          onClick={() => void handleSend()}
          disabled={sending || !input.trim()}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-[#E8A020] dark:bg-[#E8A020] text-[#0B3D6B] dark:text-[#0B3D6B] disabled:opacity-50"
        >
          <span className="ti ti-send" aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
