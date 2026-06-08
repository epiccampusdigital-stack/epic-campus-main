'use client'

import { useEffect, useMemo, useState } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { parseStudent } from '@/lib/students/helpers'
import {
  SESSION_DURATIONS,
  createTeacherSession,
  updateTeacherSession,
} from '@/lib/sessions/helpers'
import type { Student, TeacherSession } from '@/types'

export interface TeacherSessionFormValues {
  studentId: string
  topic: string
  description: string
  date: string
  time: string
  duration: number
}

const EMPTY: TeacherSessionFormValues = {
  studentId: '',
  topic: '',
  description: '',
  date: new Date().toISOString().slice(0, 10),
  time: '09:00',
  duration: 60,
}

interface TeacherSessionFormProps {
  open: boolean
  onClose: () => void
  session?: TeacherSession | null
  teacherId: string
  teacherName: string
  onSaved: () => void
}

function sessionToForm(s: TeacherSession): TeacherSessionFormValues {
  const d = new Date(s.scheduledAt)
  const hours = String(d.getHours()).padStart(2, '0')
  const mins = String(d.getMinutes()).padStart(2, '0')
  return {
    studentId: s.studentId,
    topic: s.topic,
    description: s.description,
    date: d.toISOString().slice(0, 10),
    time: `${hours}:${mins}`,
    duration: s.duration,
  }
}

export default function TeacherSessionForm({
  open,
  onClose,
  session,
  teacherId,
  teacherName,
  onSaved,
}: TeacherSessionFormProps) {
  const [form, setForm] = useState<TeacherSessionFormValues>(EMPTY)
  const [students, setStudents] = useState<Student[]>([])
  const [studentSearch, setStudentSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const isEdit = !!session

  useEffect(() => {
    if (!open) return
    setForm(session ? sessionToForm(session) : EMPTY)
    setError('')
    setStudentSearch('')
    void getDocs(collection(db, 'students')).then((snap) => {
      setStudents(
        snap.docs
          .map((d) => parseStudent(d.id, d.data() as Record<string, unknown>))
          .sort((a, b) => a.name.localeCompare(b.name)),
      )
    })
  }, [open, session])

  const filteredStudents = useMemo(() => {
    const q = studentSearch.trim().toLowerCase()
    if (!q) return students.slice(0, 40)
    return students
      .filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.studentCode.toLowerCase().includes(q) ||
          s.mobile.includes(q),
      )
      .slice(0, 40)
  }, [students, studentSearch])

  function setField<K extends keyof TeacherSessionFormValues>(
    key: K,
    value: TeacherSessionFormValues[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.studentId || !form.topic.trim()) {
      setError('Student and topic are required.')
      return
    }
    const student = students.find((s) => s.id === form.studentId)
    if (!student) {
      setError('Select a valid student.')
      return
    }

    const scheduledAt = new Date(`${form.date}T${form.time}`)
    if (Number.isNaN(scheduledAt.getTime())) {
      setError('Invalid date or time.')
      return
    }

    setSaving(true)
    setError('')
    try {
      if (isEdit && session) {
        await updateTeacherSession(session.id, {
          studentId: student.id,
          studentName: student.name,
          topic: form.topic,
          description: form.description,
          scheduledAt,
          duration: form.duration,
        })
      } else {
        await createTeacherSession({
          teacherId,
          teacherName,
          studentId: student.id,
          studentName: student.name,
          topic: form.topic,
          description: form.description,
          scheduledAt,
          duration: form.duration,
        })
      }
      onSaved()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save session')
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <>
      <div className="fixed inset-0 z-40 bg-[#0D1B2A]/40 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <aside
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col bg-white/90 dark:bg-[#0d1a2e]/90 backdrop-blur-2xl border-l border-white/80 dark:border-white/[0.08] shadow-2xl"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between border-b border-[#DDE3EC] px-6 py-4 dark:border-gray-600">
          <h2 className="font-jakarta text-lg font-bold text-[#0D1B2A] dark:text-white">
            {isEdit ? 'Edit Session' : 'Add Session'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-[#5A6A7A] hover:bg-[#F5F7FB]"
            aria-label="Close"
          >
            <span className="ti ti-x text-xl" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-5">
            {error && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="mb-4">
              <label className="mb-1.5 block font-inter text-xs font-medium uppercase text-[#5A6A7A]">
                Student *
              </label>
              <input
                type="search"
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                placeholder="Search by name, code, phone…"
                className="mb-2 w-full rounded-lg border border-[#DDE3EC] px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
              />
              <select
                value={form.studentId}
                onChange={(e) => setField('studentId', e.target.value)}
                required
                className="w-full rounded-lg border border-[#DDE3EC] px-3 py-2.5 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
              >
                <option value="">Select student</option>
                {filteredStudents.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.studentCode})
                  </option>
                ))}
              </select>
            </div>

            <div className="mb-4">
              <label className="mb-1.5 block font-inter text-xs font-medium uppercase text-[#5A6A7A]">
                Topic *
              </label>
              <input
                value={form.topic}
                onChange={(e) => setField('topic', e.target.value)}
                required
                className="w-full rounded-lg border border-[#DDE3EC] px-3 py-2.5 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                placeholder="e.g. Speaking practice review"
              />
            </div>

            <div className="mb-4">
              <label className="mb-1.5 block font-inter text-xs font-medium uppercase text-[#5A6A7A]">
                Description
              </label>
              <textarea
                value={form.description}
                onChange={(e) => setField('description', e.target.value)}
                rows={3}
                className="w-full resize-none rounded-lg border border-[#DDE3EC] px-3 py-2.5 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                placeholder="Session goals or context…"
              />
            </div>

            <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block font-inter text-xs font-medium uppercase text-[#5A6A7A]">
                  Date *
                </label>
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => setField('date', e.target.value)}
                  required
                  className="w-full rounded-lg border border-[#DDE3EC] px-3 py-2.5 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="mb-1.5 block font-inter text-xs font-medium uppercase text-[#5A6A7A]">
                  Time *
                </label>
                <input
                  type="time"
                  value={form.time}
                  onChange={(e) => setField('time', e.target.value)}
                  required
                  className="w-full rounded-lg border border-[#DDE3EC] px-3 py-2.5 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block font-inter text-xs font-medium uppercase text-[#5A6A7A]">
                Duration *
              </label>
              <select
                value={form.duration}
                onChange={(e) => setField('duration', Number(e.target.value))}
                className="w-full rounded-lg border border-[#DDE3EC] px-3 py-2.5 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
              >
                {SESSION_DURATIONS.map((m) => (
                  <option key={m} value={m}>
                    {m} minutes
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex gap-3 border-t border-[#DDE3EC] px-6 py-4 dark:border-gray-600">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-[#DDE3EC] py-2.5 text-sm font-semibold text-[#5A6A7A]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-lg bg-[#E8A020] py-2.5 text-sm font-bold text-[#0B3D6B] disabled:opacity-60"
            >
              {saving ? 'Saving…' : isEdit ? 'Update' : 'Save Session'}
            </button>
          </div>
        </form>
      </aside>
    </>
  )
}
