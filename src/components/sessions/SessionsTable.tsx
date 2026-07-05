'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  cancelTeacherSession,
  completeTeacherSession,
  formatSessionDateTime,
  sessionStatusStyle,
} from '@/lib/sessions/helpers'
import EmptyState from '@/components/ui/EmptyState'
import type { TeacherSession } from '@/types'

interface SessionsTableProps {
  sessions: TeacherSession[]
  loading: boolean
  onEdit: (session: TeacherSession) => void
  onRefresh: () => void
  onAdd?: () => void
  /** Opens the complete-notes modal for this session (e.g. from Start Session link) */
  autoOpenSessionId?: string | null
}

export default function SessionsTable({
  sessions,
  loading,
  onEdit,
  onRefresh,
  onAdd,
  autoOpenSessionId,
}: SessionsTableProps) {
  const [notesModal, setNotesModal] = useState<TeacherSession | null>(null)
  const [notes, setNotes] = useState('')
  const [acting, setActing] = useState(false)

  useEffect(() => {
    if (!autoOpenSessionId || loading) return
    const match = sessions.find((s) => s.id === autoOpenSessionId && s.status === 'scheduled')
    if (match) {
      setNotesModal(match)
      setNotes(match.notes || '')
    }
  }, [autoOpenSessionId, sessions, loading])

  async function handleComplete() {
    if (!notesModal) return
    setActing(true)
    try {
      await completeTeacherSession(notesModal.id, notes)
      setNotesModal(null)
      setNotes('')
      onRefresh()
    } finally {
      setActing(false)
    }
  }

  async function handleCancel(id: string) {
    if (!confirm('Cancel this session?')) return
    setActing(true)
    try {
      await cancelTeacherSession(id)
      onRefresh()
    } finally {
      setActing(false)
    }
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-3 p-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-10 rounded bg-[#DDE3EC]/60" />
        ))}
      </div>
    )
  }

  if (sessions.length === 0) {
    return (
      <EmptyState
        icon="ti-chalkboard"
        title="No sessions yet"
        subtitle="Schedule one-on-one discussions with students about exams and course progress."
        actionLabel={onAdd ? 'Add Session' : undefined}
        onAction={onAdd}
      />
    )
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left font-inter text-sm">
          <thead>
            <tr className="border-b border-[#DDE3EC] bg-[#F5F7FB] dark:bg-gray-900">
              <th className="px-5 py-3 text-xs font-medium uppercase text-[#5A6A7A]">Date</th>
              <th className="px-5 py-3 text-xs font-medium uppercase text-[#5A6A7A]">Time</th>
              <th className="px-5 py-3 text-xs font-medium uppercase text-[#5A6A7A]">Student</th>
              <th className="px-5 py-3 text-xs font-medium uppercase text-[#5A6A7A]">Topic</th>
              <th className="px-5 py-3 text-xs font-medium uppercase text-[#5A6A7A]">Duration</th>
              <th className="px-5 py-3 text-xs font-medium uppercase text-[#5A6A7A]">Status</th>
              <th className="px-5 py-3 text-xs font-medium uppercase text-[#5A6A7A]">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((s) => {
              const { date, time } = formatSessionDateTime(s.scheduledAt)
              return (
                <tr key={s.id} className="border-b border-[#DDE3EC] last:border-0 dark:border-gray-600">
                  <td className="px-5 py-3 text-[#0D1B2A] dark:text-white">{date}</td>
                  <td className="px-5 py-3 text-[#5A6A7A]">{time}</td>
                  <td className="px-5 py-3 font-medium text-[#0D1B2A] dark:text-white">{s.studentName}</td>
                  <td className="px-5 py-3 text-[#5A6A7A]">{s.topic}</td>
                  <td className="px-5 py-3 text-[#5A6A7A]">{s.duration} min</td>
                  <td className="px-5 py-3">
                    <span
                      className={`inline-block rounded-full border px-2.5 py-0.5 text-xs capitalize ${sessionStatusStyle(s.status)}`}
                    >
                      {s.status}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex flex-wrap gap-2">
                      {s.status === 'scheduled' && (
                        <>
                          <button
                            type="button"
                            disabled={acting}
                            onClick={() => {
                              setNotesModal(s)
                              setNotes(s.notes || '')
                            }}
                            className="text-xs font-semibold text-emerald-700 hover:underline"
                          >
                            Complete
                          </button>
                          <button
                            type="button"
                            disabled={acting}
                            onClick={() => void handleCancel(s.id)}
                            className="text-xs font-semibold text-red-600 hover:underline"
                          >
                            Cancel
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => onEdit(s)}
                        className="text-xs font-semibold text-[#0B3D6B] hover:text-[#E8A020]"
                      >
                        Edit
                      </button>
                      <Link href={`/sessions/lesson-plan/${s.id}`}
                        className="flex items-center gap-1.5 rounded-lg border border-[#DDE3EC] dark:border-white/20 px-2.5 py-1.5 text-xs font-semibold text-[#5A6A7A] dark:text-white/60 hover:border-[#0B3D6B] hover:text-[#0B3D6B] transition-all">
                        <span className="ti ti-notes" /> Plan
                      </Link>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {notesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0D1B2A]/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-gray-800">
            <h3 className="font-jakarta font-bold text-[#0D1B2A] dark:text-white">Session notes</h3>
            <p className="mt-1 text-sm text-[#5A6A7A]">
              {notesModal.studentName} — {notesModal.topic}
            </p>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              className="mt-4 w-full rounded-lg border border-[#DDE3EC] px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
              placeholder="Notes from this session…"
            />
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setNotesModal(null)}
                className="flex-1 rounded-lg border py-2 text-sm"
              >
                Close
              </button>
              <button
                type="button"
                disabled={acting}
                onClick={() => void handleComplete()}
                className="flex-1 rounded-lg bg-[#E8A020] py-2 text-sm font-bold text-[#0B3D6B]"
              >
                Mark completed
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
