'use client'

import { useMemo, useState } from 'react'
import {
  collection,
  doc,
  serverTimestamp,
  setDoc,
  Timestamp,
} from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { auth, db, storage } from '@/lib/firebase/client'
import {
  buildWhatsAppPreview,
  filterStudentsForBroadcast,
} from '@/lib/broadcast/helpers'
import AudienceFilter from '@/components/broadcast/AudienceFilter'
import toast from 'react-hot-toast'
import { useManagement } from '@/components/layout/ManagementContext'
import type {
  BroadcastAudience,
  BroadcastFilters,
  BroadcastMediaType,
  BroadcastRecipient,
  Student,
} from '@/types'

const MAX_MESSAGE = 1000

interface BroadcastComposerProps {
  students: Student[]
  onSent: () => void
}

export default function BroadcastComposer({ students, onSent }: BroadcastComposerProps) {
  const { user } = useManagement()
  const [step, setStep] = useState(1)
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [mediaFile, setMediaFile] = useState<File | null>(null)
  const [mediaType, setMediaType] = useState<BroadcastMediaType | undefined>()
  const [audience, setAudience] = useState<BroadcastAudience>('all')
  const [filters, setFilters] = useState<BroadcastFilters>({})
  const [scheduleMode, setScheduleMode] = useState(false)
  const [scheduledAt, setScheduledAt] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const recipients: BroadcastRecipient[] = useMemo(
    () => filterStudentsForBroadcast(students, audience, filters),
    [students, audience, filters],
  )

  const previewText = buildWhatsAppPreview(
    message,
    mediaFile ? '(attachment)' : undefined,
    mediaType,
  )

  function handleFileChange(file: File | null) {
    setMediaFile(file)
    if (!file) {
      setMediaType(undefined)
      return
    }
    if (file.type.startsWith('image/')) setMediaType('image')
    else if (file.type === 'application/pdf') setMediaType('pdf')
    else {
      setError('Only image or PDF files are allowed')
      setMediaFile(null)
    }
  }

  async function saveAndSend(sendNow: boolean) {
    if (!user) return
    if (!title.trim()) {
      setError('Title is required')
      return
    }
    if (!message.trim()) {
      setError('Message is required')
      return
    }
    if (recipients.length === 0) {
      setError('No students match your audience')
      return
    }

    setSaving(true)
    setError('')

    try {
      const broadcastRef = doc(collection(db, 'broadcastMessages'))
      let mediaUrl: string | undefined

      if (mediaFile) {
        const path = `broadcasts/${broadcastRef.id}/attachment`
        const storageRef = ref(storage, path)
        await uploadBytes(storageRef, mediaFile)
        mediaUrl = await getDownloadURL(storageRef)
      }

      await setDoc(broadcastRef, {
        title: title.trim(),
        message: message.trim(),
        mediaUrl: mediaUrl ?? null,
        mediaType: mediaType ?? null,
        audience,
        filters,
        recipientCount: recipients.length,
        recipientNumbers: recipients.map((r) => r.phone),
        status:
          sendNow ? 'draft' : scheduleMode && scheduledAt ? 'scheduled' : 'draft',
        scheduledAt:
          !sendNow && scheduleMode && scheduledAt
            ? Timestamp.fromDate(new Date(scheduledAt))
            : null,
        sentAt: null,
        createdBy: user.uid,
        createdByName: user.displayName || user.email,
        createdAt: serverTimestamp(),
      })

      if (sendNow) {
        const token = await auth.currentUser?.getIdToken()
        if (!token) throw new Error('Not signed in')
        const res = await fetch('/api/broadcast/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ broadcastId: broadcastRef.id }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Send failed')
      }

      setConfirmOpen(false)
      setTitle('')
      setMessage('')
      setMediaFile(null)
      setStep(1)
      setScheduleMode(false)
      setScheduledAt('')
      toast.success(sendNow ? 'Broadcast sent' : 'Broadcast saved')
      onSent()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save broadcast'
      if (msg.toLowerCase().includes('index')) {
        console.error('Firestore index needed:', err)
        console.error('Create index at: https://console.firebase.google.com/project/YOUR_PROJECT/firestore/indexes')
        setError('Filter unavailable — please use fewer filters or contact support')
      } else {
        setError(msg)
      }
      toast.error('Something went wrong. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        {[1, 2, 3].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setStep(n)}
            className={`flex h-8 w-8 items-center justify-center rounded-full font-jakarta text-sm font-bold ${
              step === n
                ? 'bg-[#0B3D6B] text-white'
                : 'bg-[#DDE3EC] text-[#5A6A7A]'
            }`}
          >
            {n}
          </button>
        ))}
        <span className="self-center text-sm text-[#5A6A7A]">
          {step === 1 ? 'Compose' : step === 2 ? 'Audience' : 'Send'}
        </span>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4 rounded-xl border border-[#DDE3EC] bg-white p-6">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-[#5A6A7A]">
              Title (internal)
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border border-[#DDE3EC] px-3 py-2 text-sm"
              placeholder="e.g. March fee reminder"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-[#5A6A7A]">
              Message
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value.slice(0, MAX_MESSAGE))}
              rows={6}
              className="w-full rounded-lg border border-[#DDE3EC] px-3 py-2 text-sm"
              placeholder="WhatsApp message text…"
            />
            <p className="mt-1 text-right text-xs text-[#5A6A7A]">
              {message.length}/{MAX_MESSAGE}
            </p>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-[#5A6A7A]">
              Attachment (optional)
            </label>
            <input
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
              className="text-sm"
            />
          </div>
          <div className="rounded-xl border border-[#DDE3EC] bg-[#F5F7FB] p-4">
            <p className="mb-2 text-xs font-semibold uppercase text-[#5A6A7A]">
              WhatsApp preview
            </p>
            <div className="rounded-lg bg-[#DCF8C6] p-3 font-inter text-sm text-[#0D1B2A] whitespace-pre-wrap">
              {previewText || 'Your message will appear here…'}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setStep(2)}
            className="rounded-lg bg-[#0B3D6B] px-4 py-2 font-jakarta text-sm font-bold text-white"
          >
            Next: Audience
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4 rounded-xl border border-[#DDE3EC] bg-white p-6">
          <AudienceFilter
            audience={audience}
            onAudienceChange={setAudience}
            filters={filters}
            onFiltersChange={setFilters}
          />
          <div className="rounded-lg border border-[#E8A020]/40 bg-[#E8A020]/10 px-4 py-3">
            <p className="font-jakarta font-bold text-[#0B3D6B]">
              This message will be sent to {recipients.length} student
              {recipients.length === 1 ? '' : 's'}
            </p>
          </div>
          <div className="max-h-48 overflow-y-auto rounded-lg border border-[#DDE3EC]">
            <ul className="divide-y divide-[#DDE3EC] text-sm">
              {recipients.map((r) => (
                <li key={r.studentId} className="flex justify-between px-3 py-2">
                  <span className="font-medium text-[#0D1B2A]">{r.studentName}</span>
                  <span className="text-[#5A6A7A]">{r.phone}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="rounded-lg border border-[#DDE3EC] px-4 py-2 text-sm font-semibold text-[#0B3D6B]"
            >
              Back
            </button>
            <button
              type="button"
              onClick={() => setStep(3)}
              disabled={recipients.length === 0}
              className="rounded-lg bg-[#0B3D6B] px-4 py-2 font-jakarta text-sm font-bold text-white disabled:opacity-50"
            >
              Next: Send
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4 rounded-xl border border-[#DDE3EC] bg-white p-6">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={scheduleMode}
              onChange={(e) => setScheduleMode(e.target.checked)}
            />
            <span className="text-sm font-medium text-[#0D1B2A]">Schedule for later</span>
          </label>
          {scheduleMode && (
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="rounded-lg border border-[#DDE3EC] px-3 py-2 text-sm"
            />
          )}
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="rounded-lg border border-[#DDE3EC] px-4 py-2 text-sm font-semibold"
            >
              Back
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirmOpen(true)
              }}
              disabled={scheduleMode && !scheduledAt}
              className="rounded-lg bg-[#E8A020] px-6 py-2.5 font-jakarta text-sm font-bold text-[#0B3D6B] hover:bg-[#F5B942] disabled:opacity-50"
            >
              {scheduleMode ? 'Schedule broadcast' : 'Send now'}
            </button>
          </div>
        </div>
      )}

      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-w-md w-full rounded-xl bg-white p-6 shadow-xl">
            <h3 className="font-jakarta text-lg font-bold text-[#0D1B2A]">Confirm broadcast</h3>
            <p className="mt-2 text-sm text-[#5A6A7A]">
              {scheduleMode
                ? `Schedule for ${scheduledAt ? new Date(scheduledAt).toLocaleString() : '—'}`
                : 'Send immediately via WhatsApp'}
            </p>
            <p className="mt-3 text-sm">
              <span className="font-semibold text-[#0B3D6B]">{recipients.length}</span> recipients
            </p>
            <div className="mt-3 max-h-32 overflow-y-auto rounded-lg bg-[#F5F7FB] p-3 text-sm whitespace-pre-wrap">
              {message}
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                className="rounded-lg border px-4 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void saveAndSend(!scheduleMode)}
                className="rounded-lg bg-[#E8A020] px-4 py-2 text-sm font-bold text-[#0B3D6B] disabled:opacity-60"
              >
                {saving ? 'Sending…' : 'Confirm send'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
