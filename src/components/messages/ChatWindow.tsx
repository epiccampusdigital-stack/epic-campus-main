'use client'

import { useEffect, useRef, useState } from 'react'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { storage } from '@/lib/firebase/client'
import {
  formatMessageTime,
  markConversationReadByStaff,
  sendChatMessage,
  staffRoleToSender,
  type ChatMessage,
  type Conversation,
} from '@/lib/messages/helpers'
import { formatLKR } from '@/lib/payments/helpers'
import type { EpicUser } from '@/types'

interface ChatWindowProps {
  conversation: Conversation | null
  messages: ChatMessage[]
  user: EpicUser
}

export default function ChatWindow({ conversation, messages, user }: ChatWindowProps) {
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [whatsappEnabled, setWhatsappEnabled] = useState(false)
  const [paymentModal, setPaymentModal] = useState(false)
  const [paymentAmount, setPaymentAmount] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, conversation?.id])

  useEffect(() => {
    if (conversation?.id) {
      markConversationReadByStaff(conversation.id).catch(console.error)
    }
  }, [conversation?.id, messages.length])

  if (!conversation) {
    return (
      <div className="hidden flex-1 items-center justify-center text-sm text-[#5A6A7A] md:flex">
        Select a conversation
      </div>
    )
  }

  const conv = conversation

  async function deliverWhatsApp(text: string, paymentLink?: string, amount?: number) {
    if (!whatsappEnabled || !conv.studentPhone) return
    await fetch('/api/messages/whatsapp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: conv.studentPhone,
        message: text,
        studentName: conv.studentName,
        paymentAmount: amount,
        paymentLink,
      }),
    })
  }

  async function postMessage(
    type: ChatMessage['type'],
    content: string,
    extra?: {
      fileUrl?: string
      fileName?: string
      paymentLink?: string
      paymentAmount?: number
    },
  ) {
    await sendChatMessage({
      conversationId: conv.id,
      senderId: user.uid,
      senderName: user.displayName || user.email,
      senderRole: staffRoleToSender(user.role),
      type,
      content,
      notifyStudent: true,
      ...extra,
    })
    await deliverWhatsApp(
      content,
      extra?.paymentLink,
      extra?.paymentAmount,
    )
  }

  async function handleSendText() {
    if (!input.trim() || sending) return
    setSending(true)
    try {
      await postMessage('text', input.trim())
      setInput('')
    } finally {
      setSending(false)
    }
  }

  async function handleFile(file: File) {
    if (sending) return
    setSending(true)
    try {
      const isPdf = file.type === 'application/pdf' || file.name.endsWith('.pdf')
      const path = `messages/${conv.id}/${Date.now()}-${file.name}`
      const storageRef = ref(storage, path)
      await uploadBytes(storageRef, file)
      const url = await getDownloadURL(storageRef)
      await postMessage(isPdf ? 'pdf' : 'image', file.name, {
        fileUrl: url,
        fileName: file.name,
      })
    } finally {
      setSending(false)
    }
  }

  async function handlePaymentLink() {
    const amount = Number(paymentAmount)
    if (!amount || amount <= 0) return
    setSending(true)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          currency: 'lkr',
          studentId: conv.studentId,
          studentName: conv.studentName,
          description: `Payment — ${conv.studentName}`,
          successUrl: `${window.location.origin}/student/payments?success=true`,
          cancelUrl: `${window.location.origin}/messages`,
        }),
      })
      const data = (await res.json()) as { url?: string; error?: string }
      if (!res.ok || !data.url) throw new Error(data.error ?? 'Stripe failed')
      const content = `Payment link for LKR ${amount.toLocaleString('en-LK')}`
      await postMessage('payment_link', content, {
        paymentLink: data.url,
        paymentAmount: amount,
      })
      setPaymentModal(false)
      setPaymentAmount('')
    } catch (err) {
      console.error(err)
      alert('Could not create payment link')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#DDE3EC] px-4 py-3 dark:border-gray-600">
        <div>
          <h2 className="font-jakarta font-bold text-[#0B3D6B] dark:text-white">
            {conv.studentName}
          </h2>
          <p className="text-xs text-[#5A6A7A]">{conv.studentPhone || 'No phone'}</p>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-xs text-[#5A6A7A]">
          <input
            type="checkbox"
            checked={whatsappEnabled}
            onChange={(e) => setWhatsappEnabled(e.target.checked)}
            className="rounded border-[#DDE3EC]"
          />
          Send via WhatsApp
        </label>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto bg-[#F5F7FB] p-4 dark:bg-gray-900">
        {messages.map((m) => {
          const isStaff = m.senderRole === 'staff'
          return (
            <div key={m.id} className={`flex ${isStaff ? 'justify-end' : 'justify-start'}`}>
              <div className="max-w-[85%]">
                {m.type === 'payment_link' && m.paymentLink ? (
                  <div
                    className={`rounded-xl border p-4 ${
                      isStaff
                        ? 'border-[#E8A020]/40 bg-[#E8A020] text-[#0B3D6B]'
                        : 'border-[#DDE3EC] bg-white dark:border-gray-600 dark:bg-gray-800'
                    }`}
                  >
                    <p className="text-sm font-semibold">Payment request</p>
                    {m.paymentAmount != null && (
                      <p className="mt-1 text-lg font-bold">{formatLKR(m.paymentAmount)}</p>
                    )}
                    <a
                      href={m.paymentLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 inline-block rounded-lg bg-[#0B3D6B] px-4 py-2 text-xs font-bold text-white"
                    >
                      Pay Now
                    </a>
                  </div>
                ) : m.type === 'image' && m.fileUrl ? (
                  <a href={m.fileUrl} target="_blank" rel="noopener noreferrer">
                    <img
                      src={m.fileUrl}
                      alt={m.fileName || 'Image'}
                      className="max-h-48 rounded-xl border border-[#DDE3EC]"
                    />
                  </a>
                ) : m.type === 'pdf' && m.fileUrl ? (
                  <a
                    href={m.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`block rounded-xl px-3 py-2 text-sm underline ${
                      isStaff ? 'bg-[#E8A020] text-[#0B3D6B]' : 'bg-gray-100 dark:bg-gray-700'
                    }`}
                  >
                    📄 {m.fileName || 'Download PDF'}
                  </a>
                ) : (
                  <div
                    className={`rounded-2xl px-3 py-2 text-sm ${
                      isStaff
                        ? 'rounded-br-sm bg-[#E8A020] text-[#0B3D6B]'
                        : 'rounded-bl-sm bg-gray-200 text-gray-900 dark:bg-gray-700 dark:text-gray-100'
                    }`}
                  >
                    {m.content}
                  </div>
                )}
                <p className={`mt-1 text-xs text-gray-400 ${isStaff ? 'text-right' : ''}`}>
                  {m.senderName} · {formatMessageTime(m.createdAt)}
                </p>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {paymentModal && (
        <div className="border-t border-[#DDE3EC] bg-white px-4 py-3 dark:border-gray-600 dark:bg-gray-800">
          <p className="mb-2 text-xs font-medium uppercase text-[#5A6A7A]">Payment link (LKR)</p>
          <div className="flex gap-2">
            <input
              type="number"
              min="0"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              placeholder="Amount"
              className="flex-1 rounded-lg border border-[#DDE3EC] px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={() => void handlePaymentLink()}
              disabled={sending}
              className="rounded-lg bg-[#0B3D6B] px-4 py-2 text-sm font-semibold text-white"
            >
              Send
            </button>
            <button
              type="button"
              onClick={() => setPaymentModal(false)}
              className="rounded-lg border px-3 py-2 text-sm"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      <div className="flex gap-2 border-t border-[#DDE3EC] bg-white p-3 dark:border-gray-600 dark:bg-gray-800">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,application/pdf"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void handleFile(f)
            e.target.value = ''
          }}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="rounded-lg border border-[#DDE3EC] px-3 py-2 text-[#0B3D6B]"
          title="Attach image or PDF"
        >
          <span className="ti ti-paperclip" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => setPaymentModal(true)}
          className="rounded-lg border border-[#DDE3EC] px-3 py-2 text-[#0B3D6B]"
          title="Send payment link"
        >
          <span className="ti ti-credit-card" aria-hidden="true" />
        </button>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && void handleSendText()}
          placeholder="Type a message…"
          className="min-w-0 flex-1 rounded-full border border-[#DDE3EC] px-4 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
        />
        <button
          type="button"
          onClick={() => void handleSendText()}
          disabled={sending || !input.trim()}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-[#E8A020] text-[#0B3D6B] disabled:opacity-50"
        >
          <span className="ti ti-send" aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
