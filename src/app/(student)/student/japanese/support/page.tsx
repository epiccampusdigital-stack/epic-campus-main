'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { useStudentPortal } from '@/components/student/StudentContext'
import { createJpSupportThread, listJpSupportThreadsForStudent } from '@/lib/jp/support'
import type { JpSupportThread, JpSupportThreadStatus } from '@/types'

const STATUS_LABELS: Record<JpSupportThreadStatus, string> = {
  open: 'Open',
  ai_answered: 'Answered',
  escalated: 'With staff',
  closed: 'Closed',
}

const STATUS_STYLES: Record<JpSupportThreadStatus, string> = {
  open: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-200',
  ai_answered: 'bg-[#1A6BAD]/10 text-[#1A6BAD] border-[#1A6BAD]/30',
  escalated: 'bg-[#E8A020]/15 text-[#0B3D6B] border-[#E8A020]/40 dark:text-[#E8A020]',
  closed: 'bg-gray-100 text-gray-500 border-gray-200 dark:bg-white/10 dark:text-white/40',
}

export default function JapaneseSupportPage() {
  const router = useRouter()
  const { student } = useStudentPortal()
  const [threads, setThreads] = useState<JpSupportThread[]>([])
  const [loading, setLoading] = useState(true)
  const [showNewForm, setShowNewForm] = useState(false)
  const [subject, setSubject] = useState('')
  const [question, setQuestion] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    if (!student) return
    setLoading(true)
    try {
      const list = await listJpSupportThreadsForStudent(student.id)
      setThreads(list)
    } catch (err) {
      console.error('[JapaneseSupportPage] load', err)
      toast.error('Could not load your questions.')
    } finally {
      setLoading(false)
    }
  }, [student])

  useEffect(() => {
    void load()
  }, [load])

  async function handleStartThread() {
    if (!student || !subject.trim() || !question.trim()) {
      toast.error('Enter a subject and your question.')
      return
    }
    setSubmitting(true)
    try {
      const thread = await createJpSupportThread({
        studentId: student.id,
        uid: student.uid ?? '',
        subject: subject.trim(),
        firstMessage: question.trim(),
      })
      router.push(`/student/japanese/support/${thread.id}`)
    } catch (err) {
      console.error('[JapaneseSupportPage] create thread', err)
      toast.error('Could not start a new question.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/student/japanese"
          className="font-inter text-xs font-medium text-[#5A6A7A] hover:text-[#0B3D6B] dark:text-white/50 dark:hover:text-white"
        >
          ← Back to course
        </Link>
        <h1 className="mt-2 font-jakarta text-xl font-bold text-[#0B3D6B] dark:text-white">Help &amp; Ask</h1>
        <p className="mt-1 font-inter text-sm text-[#5A6A7A] dark:text-white/60">
          Ask about the Japanese language or the course — our AI answers first, and you can always talk to a
          person.
        </p>
      </div>

      {!showNewForm ? (
        <button
          type="button"
          onClick={() => setShowNewForm(true)}
          className="rounded-lg bg-[#E8A020] px-4 py-2 font-jakarta text-sm font-bold text-[#0B3D6B] hover:bg-[#F5B942]"
        >
          + Ask a new question
        </button>
      ) : (
        <div className="rounded-xl border border-[#DDE3EC] bg-white p-5 dark:border-white/10 dark:bg-slate-800">
          <p className="font-jakarta text-sm font-bold text-[#0B3D6B] dark:text-white">New question</p>
          <div className="mt-3 space-y-3">
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject, e.g. Lesson 3 grammar question"
              className="w-full rounded-lg border border-[#DDE3EC] bg-white px-3 py-2 font-inter text-sm text-[#0D1B2A] focus:border-[#1A6BAD] focus:outline-none dark:border-white/10 dark:bg-slate-900 dark:text-white"
            />
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Type your question…"
              rows={4}
              className="w-full rounded-lg border border-[#DDE3EC] bg-white px-3 py-2 font-inter text-sm text-[#0D1B2A] focus:border-[#1A6BAD] focus:outline-none dark:border-white/10 dark:bg-slate-900 dark:text-white"
            />
          </div>
          <div className="mt-4 flex items-center gap-2">
            <button
              type="button"
              disabled={submitting}
              onClick={() => void handleStartThread()}
              className="rounded-lg bg-[#E8A020] px-4 py-2 font-jakarta text-sm font-bold text-[#0B3D6B] hover:bg-[#F5B942] disabled:opacity-50"
            >
              {submitting ? 'Sending…' : 'Send'}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowNewForm(false)
                setSubject('')
                setQuestion('')
              }}
              className="font-inter text-xs text-[#5A6A7A] hover:text-[#0B3D6B] dark:text-white/50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex h-32 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-[#0B3D6B] border-t-[#E8A020]" />
        </div>
      ) : threads.length === 0 ? (
        <p className="font-inter text-sm text-[#5A6A7A] dark:text-white/50">You haven&apos;t asked anything yet.</p>
      ) : (
        <div className="space-y-2">
          {threads.map((t) => (
            <Link
              key={t.id}
              href={`/student/japanese/support/${t.id}`}
              className="flex items-center justify-between gap-3 rounded-lg border border-[#DDE3EC] bg-white px-4 py-3 hover:bg-[#F5F7FB] dark:border-white/10 dark:bg-slate-800 dark:hover:bg-white/5"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-inter text-sm font-medium text-[#0D1B2A] dark:text-white">{t.subject}</p>
              </div>
              <span className={`inline-flex shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[t.status]}`}>
                {STATUS_LABELS[t.status]}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
