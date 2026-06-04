'use client'

import { useEffect, useRef, useState } from 'react'
import { useStudentPortal } from '@/components/student/StudentContext'
import {
  formatMessageTime,
  getOrCreateConversation,
  markConversationReadByStudent,
  sendChatMessage,
  subscribeMessages,
  type ChatMessage,
} from '@/lib/messages/helpers'

export default function StudentMessagesPage() {
  const { user, student } = useStudentPortal()
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!student || !user) return
    let cancelled = false
    async function init() {
      setLoading(true)
      try {
        const conv = await getOrCreateConversation({
          studentId: student!.id,
          studentName: student!.name,
          studentPhone: student!.mobile,
          staffId: 'admin',
          staffName: 'Epic Campus',
        })
        if (!cancelled) {
          setConversationId(conv.id)
          await markConversationReadByStudent(conv.id)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void init()
    return () => {
      cancelled = true
    }
  }, [student, user])

  useEffect(() => {
    if (!conversationId) return
    markConversationReadByStudent(conversationId).catch(console.error)
    return subscribeMessages(conversationId, setMessages)
  }, [conversationId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend() {
    if (!input.trim() || sending || !conversationId || !student || !user) return
    setSending(true)
    try {
      await sendChatMessage({
        conversationId,
        senderId: user.uid,
        senderName: student.name,
        senderRole: 'student',
        type: 'text',
        content: input.trim(),
        notifyStaff: true,
      })
      setInput('')
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
        <div className="flex-1 bg-[#F5F7FB]" />
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-10rem)] flex-col overflow-hidden rounded-2xl border border-[#DDE3EC] bg-white shadow-sm">
      <div className="border-b border-[#DDE3EC] px-6 py-4">
        <h2 className="font-jakarta text-lg font-bold text-[#0B3D6B]">Messages</h2>
        <p className="text-sm text-[#5A6A7A]">Chat with EPIC Campus</p>
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
                {m.type === 'payment_link' && m.paymentLink ? (
                  <div className="rounded-xl border border-[#DDE3EC] bg-white p-4">
                    <p className="text-sm font-semibold text-[#0B3D6B]">Payment request</p>
                    {m.paymentAmount != null && (
                      <p className="mt-1 text-lg font-bold text-[#0B3D6B]">
                        LKR {m.paymentAmount.toLocaleString('en-LK')}
                      </p>
                    )}
                    <a
                      href={m.paymentLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 inline-block rounded-lg bg-[#E8A020] px-4 py-2 text-xs font-bold text-[#0B3D6B]"
                    >
                      Pay Now
                    </a>
                  </div>
                ) : m.type === 'image' && m.fileUrl ? (
                  <a href={m.fileUrl} target="_blank" rel="noopener noreferrer">
                    <img
                      src={m.fileUrl}
                      alt=""
                      className="max-h-48 rounded-xl border border-[#DDE3EC]"
                    />
                  </a>
                ) : m.type === 'pdf' && m.fileUrl ? (
                  <a
                    href={m.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block rounded-xl bg-gray-100 px-3 py-2 text-sm underline"
                  >
                    📄 {m.fileName || 'PDF'}
                  </a>
                ) : (
                  <div
                    className={`rounded-2xl px-3 py-2 text-sm ${
                      isStudent
                        ? 'rounded-br-sm bg-[#0B3D6B] text-white'
                        : 'rounded-bl-sm bg-gray-200 text-gray-900'
                    }`}
                  >
                    {m.content}
                  </div>
                )}
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
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && void handleSend()}
          placeholder="Type your message..."
          className="flex-1 rounded-full border border-[#DDE3EC] px-4 py-2 text-sm outline-none focus:border-[#0B3D6B]"
        />
        <button
          type="button"
          onClick={() => void handleSend()}
          disabled={sending || !input.trim()}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-[#E8A020] text-white disabled:opacity-50"
        >
          ➤
        </button>
      </div>
    </div>
  )
}
