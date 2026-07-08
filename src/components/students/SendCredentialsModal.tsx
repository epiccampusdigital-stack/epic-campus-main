'use client'

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { auth } from '@/lib/firebase/client'

export interface SendCredentialsTarget {
  id: string
  name: string
  email?: string
  mobile?: string
  studentCode?: string
  uid?: string
}

function generatePassword(): string {
  return (
    Math.random().toString(36).slice(-8).toUpperCase() +
    Math.floor(1000 + Math.random() * 9000)
  )
}

/** Reusable modal to (re)send a student their login details over WhatsApp.
 *  Because the original generated password is never stored, this resets the
 *  Firebase Auth password to a new value before sending. */
export default function SendCredentialsModal({
  open,
  student,
  onClose,
}: {
  open: boolean
  student: SendCredentialsTarget | null
  onClose: () => void
}) {
  const [password, setPassword] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (open) setPassword(generatePassword())
  }, [open, student?.id])

  if (!open || !student) return null

  const email = student.email ?? ''
  const phone = student.mobile ?? ''

  async function copyCredentials() {
    const text =
      `EPIC Campus Login Details\n` +
      `Student: ${student!.name}\n` +
      `Code: ${student!.studentCode ?? ''}\n` +
      `Email: ${email}\n` +
      `Password: ${password}\n` +
      `Portal: epiccampus.live`
    try {
      await navigator.clipboard.writeText(text)
      toast.success('Copied!')
    } catch {
      toast.error('Could not copy')
    }
  }

  async function copyEmail() {
    try {
      await navigator.clipboard.writeText(email)
      toast.success('Email copied')
    } catch {
      toast.error('Could not copy')
    }
  }

  async function resetAndSend() {
    if (!phone) {
      toast.error('This student has no phone number on file')
      return
    }
    if (!email) {
      toast.error('This student has no email — cannot reset login')
      return
    }
    setSending(true)
    try {
      const token = await auth.currentUser?.getIdToken()
      const res = await fetch('/api/students/reset-and-send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          studentId: student!.id,
          uid: student!.uid,
          phone,
          email,
          studentName: student!.name,
          studentCode: student!.studentCode,
          newPassword: password,
        }),
      })
      const data = (await res.json()) as { success?: boolean; error?: string; passwordReset?: boolean }
      if (data.success) {
        toast.success('Password reset & credentials sent via WhatsApp')
        onClose()
      } else if (data.passwordReset) {
        toast.error(data.error ?? 'Password reset, but WhatsApp failed to send')
      } else {
        toast.error(data.error ?? 'Failed to send credentials')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send credentials')
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white dark:bg-[#1A1535] p-6 shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="font-jakarta text-lg font-bold text-[#0D1B2A] dark:text-white">Send Login Details</h2>
            <p className="mt-0.5 text-xs text-[#5A6A7A] dark:text-white/50">
              Resets the password and sends new credentials via WhatsApp.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#5A6A7A] hover:bg-[#F5F7FB] dark:text-white/60 dark:hover:bg-white/[0.06]"
            aria-label="Close"
          >
            <span className="ti ti-x text-lg" />
          </button>
        </div>

        <div className="space-y-3">
          <div className="space-y-2.5 rounded-xl bg-[#F5F7FB] dark:bg-white/[0.04] px-4 py-3 text-sm">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-[#5A6A7A] dark:text-white/40">Student</p>
              <p className="font-semibold text-[#0D1B2A] dark:text-white">{student.name}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-[#5A6A7A] dark:text-white/40">Code</p>
              <p className="font-mono font-semibold text-[#0D1B2A] dark:text-white">{student.studentCode || '—'}</p>
            </div>
            <div className="flex items-end justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wide text-[#5A6A7A] dark:text-white/40">Email</p>
                <p className="truncate font-semibold text-[#0B3D6B] dark:text-[#E8A020]">{email || 'No email saved'}</p>
              </div>
              {email && (
                <button
                  type="button"
                  onClick={() => void copyEmail()}
                  title="Copy email"
                  className="shrink-0 rounded-lg border border-gray-200 dark:border-white/10 px-2 py-1.5 text-xs font-semibold text-[#0B3D6B] dark:text-white/70 hover:bg-gray-50 dark:hover:bg-white/[0.06]"
                >
                  <span className="ti ti-copy mr-1" /> Copy Email
                </button>
              )}
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-[#5A6A7A] dark:text-white/40">Phone</p>
              <p className={`font-semibold ${phone ? 'text-[#0D1B2A] dark:text-white' : 'text-amber-600 dark:text-amber-400'}`}>
                {phone || 'No phone saved'}
              </p>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-[#5A6A7A] dark:text-white/50">
              New Password
            </label>
            <div className="flex gap-2">
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="flex-1 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#0d0b1e] px-3 py-2.5 font-mono text-sm text-gray-900 dark:text-white outline-none focus:border-[#E8A020]"
              />
              <button
                type="button"
                onClick={() => setPassword(generatePassword())}
                title="Generate new password"
                className="rounded-lg border border-gray-200 dark:border-white/10 px-3 text-[#5A6A7A] dark:text-white/60 hover:bg-gray-50 dark:hover:bg-white/[0.06]"
              >
                <span className="ti ti-refresh" />
              </button>
            </div>
          </div>

          {phone ? (
            <div className="rounded-lg border border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
              Note: Student must have WhatsApp active on this number.
            </div>
          ) : (
            <div className="rounded-lg border border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
              No phone number saved for this student. Add their phone number first to send via WhatsApp, or copy the credentials and share manually.
            </div>
          )}
        </div>

        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={() => void copyCredentials()}
            className={`${phone ? 'flex-1' : 'flex-[2]'} rounded-xl border border-gray-200 dark:border-white/10 py-2.5 text-sm font-semibold text-gray-700 dark:text-white/70 hover:bg-gray-50 dark:hover:bg-white/[0.06]`}
          >
            <span className="ti ti-copy mr-1" /> Copy Credentials
          </button>
          <button
            type="button"
            disabled={sending || !phone}
            onClick={() => void resetAndSend()}
            title={!phone ? 'Phone number required to send via WhatsApp' : undefined}
            className={`${phone ? 'flex-[2]' : 'flex-1'} rounded-xl bg-green-600 py-2.5 text-sm font-bold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500 dark:disabled:bg-white/10 dark:disabled:text-white/40`}
          >
            {sending ? (
              <><span className="ti ti-loader animate-spin mr-1" /> Sending…</>
            ) : (
              <><span className="ti ti-brand-whatsapp mr-1" /> Reset Password & Send</>
            )}
          </button>
        </div>
      </div>
    </>
  )
}
