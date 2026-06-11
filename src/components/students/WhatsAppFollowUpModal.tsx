'use client'

import { useCallback, useEffect, useState } from 'react'

export type WhatsAppFollowUpStudent = {
  id: string
  name: string
  phone: string
  course: string
  riskFlags?: string[]
  recommendation?: string
}

export type WhatsAppMessageType = 'check-in' | 'payment-reminder' | 'attendance-alert' | 'general'

interface WhatsAppFollowUpModalProps {
  student: WhatsAppFollowUpStudent | null
  staffName: string
  open: boolean
  onClose: () => void
  defaultMessageType?: WhatsAppMessageType
}

const MESSAGE_TYPES: { id: WhatsAppMessageType; label: string; emoji: string }[] = [
  { id: 'check-in', label: 'Check-in', emoji: '💬' },
  { id: 'payment-reminder', label: 'Payment', emoji: '💰' },
  { id: 'attendance-alert', label: 'Attendance', emoji: '📅' },
  { id: 'general', label: 'General', emoji: '📝' },
]

function formatPreviewTime(): string {
  return new Date().toLocaleTimeString('en-LK', { hour: '2-digit', minute: '2-digit' })
}

export default function WhatsAppFollowUpModal({
  student,
  staffName,
  open,
  onClose,
  defaultMessageType = 'check-in',
}: WhatsAppFollowUpModalProps) {
  const [messageType, setMessageType] = useState<WhatsAppMessageType>(defaultMessageType)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [previewTime] = useState(formatPreviewTime)

  const generate = useCallback(async () => {
    if (!student) return
    setLoading(true)
    try {
      const res = await fetch('/api/whatsapp-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentName: student.name,
          course: student.course,
          riskFlags: student.riskFlags ?? [],
          recommendation: student.recommendation ?? '',
          staffName,
          messageType,
        }),
      })
      const data = (await res.json()) as { message?: string }
      setMessage(data.message?.trim() || '')
    } catch {
      setMessage(
        `Hi ${student.name}, we wanted to check in on how things are going with ${student.course || 'your studies'}. Please reach out if you need any support — we're here for you! — ${staffName}`,
      )
    } finally {
      setLoading(false)
    }
  }, [student, staffName, messageType])

  useEffect(() => {
    if (!open) {
      setMessage('')
      setMessageType(defaultMessageType)
    }
  }, [open, defaultMessageType])

  if (!open || !student) return null

  const phoneDigits = student.phone.replace(/\D/g, '')
  const canOpenWhatsApp = phoneDigits.length > 0 && message.trim().length > 0

  function handleOpenWhatsApp() {
    if (!canOpenWhatsApp) return
    window.open(
      `https://wa.me/${phoneDigits}?text=${encodeURIComponent(message.trim())}`,
      '_blank',
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-[#0D1B2A]/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="whatsapp-followup-title"
        className="relative z-10 w-full max-w-lg rounded-2xl border border-[#DDE3EC] bg-white shadow-xl dark:border-gray-600 dark:bg-gray-800"
      >
        <div className="border-b border-[#DDE3EC] px-5 py-4 dark:border-gray-600">
          <div className="flex items-start justify-between gap-3">
            <h2
              id="whatsapp-followup-title"
              className="font-jakarta text-lg font-bold text-[#0B3D6B] dark:text-white"
            >
              Send WhatsApp to {student.name}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1 text-[#5A6A7A] hover:bg-[#F5F7FB] dark:hover:bg-gray-700"
              aria-label="Close"
            >
              <span className="ti ti-x text-lg" />
            </button>
          </div>
        </div>

        <div className="max-h-[calc(100vh-8rem)] space-y-4 overflow-y-auto px-5 py-4">
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[#5A6A7A]">
              Message type
            </p>
            <div className="flex flex-wrap gap-2">
              {MESSAGE_TYPES.map((t) => {
                const selected = messageType === t.id
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setMessageType(t.id)}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                      selected
                        ? 'bg-[#0B3D6B] text-white'
                        : 'border border-[#DDE3EC] bg-white text-[#5A6A7A] hover:border-[#0B3D6B]/30 dark:border-gray-600 dark:bg-gray-900'
                    }`}
                  >
                    {t.emoji} {t.label}
                  </button>
                )
              })}
            </div>
          </div>

          <button
            type="button"
            onClick={() => void generate()}
            disabled={loading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg border-2 border-[#E8A020] bg-white px-4 py-2.5 font-jakarta text-sm font-bold text-[#0B3D6B] hover:bg-[#E8A020]/10 disabled:opacity-60"
          >
            {loading ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#E8A020] border-t-transparent" />
                Generating…
              </>
            ) : (
              'Generate Message'
            )}
          </button>

          <div>
            <textarea
              rows={6}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Generate a message or type your own…"
              className="w-full resize-y rounded-lg border border-[#DDE3EC] px-3 py-2 text-sm text-[#0D1B2A] dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            />
            <p className="mt-1 text-right text-xs text-[#5A6A7A]">
              {message.length} characters
            </p>
          </div>

          <div className="rounded-xl bg-[#ECE5DD] p-4 dark:bg-gray-900">
            <div className="max-w-[90%] rounded-lg rounded-tl-none bg-white px-3 py-2 shadow-sm dark:bg-gray-800">
              <p className="mb-1 text-[10px] font-semibold text-[#25D366]">You</p>
              <p className="whitespace-pre-wrap text-sm text-[#0D1B2A] dark:text-gray-100">
                {message.trim() || 'Your message preview will appear here…'}
              </p>
              <p className="mt-1 text-right text-[10px] text-gray-400">{previewTime}</p>
            </div>
          </div>

          <p className="text-xs text-[#5A6A7A]">
            Student phone: {student.phone || 'No phone on file'}
          </p>
        </div>

        <div className="space-y-2 border-t border-[#DDE3EC] px-5 py-4 dark:border-gray-600">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void generate()}
              disabled={loading}
              className="flex-1 rounded-lg border border-[#DDE3EC] px-4 py-2.5 font-jakarta text-sm font-semibold text-[#5A6A7A] hover:bg-[#F5F7FB] disabled:opacity-60 dark:border-gray-600"
            >
              Regenerate
            </button>
            <button
              type="button"
              onClick={handleOpenWhatsApp}
              disabled={!canOpenWhatsApp}
              className="flex-1 rounded-lg bg-[#E8A020] px-4 py-2.5 font-jakarta text-sm font-bold text-[#0B3D6B] hover:bg-[#F5B942] disabled:opacity-50"
            >
              Open WhatsApp
            </button>
          </div>
          <p className="text-center text-[10px] text-[#5A6A7A]">
            Message opens in WhatsApp for your review before sending
          </p>
        </div>
      </div>
    </div>
  )
}
