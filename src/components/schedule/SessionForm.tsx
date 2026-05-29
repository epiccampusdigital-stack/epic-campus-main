'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  collection,
  doc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { COURSE_MAP, COURSES } from '@/lib/constants/courses'
import { useManagement } from '@/components/layout/ManagementContext'
import { logAuditEvent } from '@/lib/audit/helpers'
import {
  generateRecurringDates,
  getSessionTypeLabel,
} from '@/lib/schedule/helpers'
import type {
  CourseId,
  RecurringType,
  ScheduleSession,
  SessionType,
  StaffMember,
  Student,
} from '@/types'

export interface SessionFormValues {
  type: SessionType
  courseId: CourseId | ''
  staffId: string
  studentId: string
  batchName: string
  date: string
  startTime: string
  endTime: string
  location: string
  notes: string
  recurringType: RecurringType
  openSlot: boolean
}

const EMPTY: SessionFormValues = {
  type: 'class',
  courseId: '',
  staffId: '',
  studentId: '',
  batchName: '',
  date: new Date().toISOString().slice(0, 10),
  startTime: '09:00',
  endTime: '11:00',
  location: '',
  notes: '',
  recurringType: 'once',
  openSlot: false,
}

interface SessionFormProps {
  open: boolean
  onClose: () => void
  session?: ScheduleSession | null
  staff: StaffMember[]
  students: Student[]
  onSaved: () => void
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1.5 block font-inter text-xs font-medium uppercase tracking-wide text-[#5A6A7A]">
      {children}
    </label>
  )
}

function sessionToForm(s: ScheduleSession): SessionFormValues {
  return {
    type: s.type,
    courseId: s.courseId,
    staffId: s.staffId,
    studentId: s.studentId ?? '',
    batchName: s.batchName ?? '',
    date: s.date.slice(0, 10),
    startTime: s.startTime,
    endTime: s.endTime,
    location: s.location,
    notes: s.notes ?? '',
    recurringType: s.recurringType,
    openSlot: s.type === 'consultation' && s.bookingStatus === 'open',
  }
}

export default function SessionForm({
  open,
  onClose,
  session,
  staff,
  students,
  onSaved,
}: SessionFormProps) {
  const { user } = useManagement()
  const [form, setForm] = useState<SessionFormValues>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const isEdit = !!session

  useEffect(() => {
    if (open) {
      setForm(session ? sessionToForm(session) : EMPTY)
      setError('')
    }
  }, [open, session])

  const batches = useMemo(() => {
    if (!form.courseId) return []
    const set = new Set<string>()
    students
      .filter((s) => s.courseId === form.courseId && s.batchId)
      .forEach((s) => set.add(s.batchId))
    return Array.from(set).sort()
  }, [students, form.courseId])

  const filteredStudents = useMemo(() => {
    if (!form.courseId) return students.slice(0, 30)
    return students.filter((s) => s.courseId === form.courseId).slice(0, 30)
  }, [students, form.courseId])

  const selectedStaff = staff.find((s) => s.id === form.staffId)
  const selectedStudent = students.find((s) => s.id === form.studentId)

  function setField<K extends keyof SessionFormValues>(
    key: K,
    value: SessionFormValues[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    if (!form.courseId || !form.staffId) {
      setError('Course and staff member are required.')
      return
    }
    if (form.type === 'class' && !form.batchName) {
      setError('Batch is required for class sessions.')
      return
    }
    if (
      form.type === 'consultation' &&
      !form.openSlot &&
      !form.studentId
    ) {
      setError('Select a student or mark as an open booking slot.')
      return
    }

    setSaving(true)
    setError('')

    try {
      const staffMember = staff.find((s) => s.id === form.staffId)
      const courseName = COURSE_MAP[form.courseId]?.label ?? ''
      const basePayload: Record<string, unknown> = {
        type: form.type,
        courseId: form.courseId,
        courseName,
        staffId: form.staffId,
        staffName: staffMember?.displayName ?? '',
        studentId: form.type === 'consultation' && !form.openSlot ? form.studentId : '',
        studentName:
          form.type === 'consultation' && !form.openSlot
            ? selectedStudent?.name ?? ''
            : '',
        batchName: form.type === 'class' ? form.batchName : '',
        startTime: form.startTime,
        endTime: form.endTime,
        location: form.location.trim(),
        notes: form.notes.trim() || null,
        status: 'scheduled' as const,
        isRecurring: form.recurringType !== 'once',
        recurringType: form.recurringType,
        createdBy: user.uid,
      }

      if (form.type === 'consultation') {
        basePayload.bookingStatus = form.openSlot ? 'open' : 'approved'
      }

      if (isEdit && session) {
        await updateDoc(doc(db, 'schedule', session.id), {
          ...basePayload,
          date: form.date,
        })
        await logAuditEvent({
          userId: user.uid,
          userEmail: user.email,
          userRole: user.role,
          action: 'updated',
          entityType: 'schedule',
          entityId: session.id,
          details: `Updated ${getSessionTypeLabel(form.type)} on ${form.date}`,
        })
      } else {
        const dates = generateRecurringDates(form.date, form.recurringType)
        for (const date of dates) {
          const id = doc(collection(db, 'schedule')).id
          await setDoc(doc(db, 'schedule', id), {
            ...basePayload,
            date,
            createdAt: serverTimestamp(),
          })
        }
        await logAuditEvent({
          userId: user.uid,
          userEmail: user.email,
          userRole: user.role,
          action: 'created',
          entityType: 'schedule',
          entityId: dates.length > 1 ? 'recurring' : form.date,
          details: `Created ${getSessionTypeLabel(form.type)} (${dates.length} session${dates.length > 1 ? 's' : ''})`,
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
      <div
        className="fixed inset-0 z-40 bg-[#0D1B2A]/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col bg-white shadow-2xl"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between border-b border-[#DDE3EC] px-6 py-4">
          <h2 className="font-jakarta text-lg font-bold text-[#0D1B2A]">
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

            <div className="mb-5">
              <FieldLabel>Session Type *</FieldLabel>
              <div className="grid grid-cols-3 gap-2">
                {(['class', 'consultation', 'exam'] as SessionType[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setField('type', t)}
                    className={`rounded-lg border px-3 py-2.5 font-jakarta text-sm font-semibold transition-colors ${
                      form.type === t
                        ? t === 'class'
                          ? 'border-[#0B3D6B] bg-[#0B3D6B] text-white'
                          : t === 'consultation'
                            ? 'border-[#E8A020] bg-[#E8A020] text-[#0B3D6B]'
                            : 'border-red-600 bg-red-600 text-white'
                        : 'border-[#DDE3EC] text-[#5A6A7A] hover:bg-[#F5F7FB]'
                    }`}
                  >
                    {getSessionTypeLabel(t)}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-5">
              <FieldLabel>Course *</FieldLabel>
              <select
                value={form.courseId}
                onChange={(e) => {
                  setField('courseId', e.target.value as CourseId)
                  setField('batchName', '')
                  setField('studentId', '')
                }}
                required
                className="w-full rounded-lg border border-[#DDE3EC] px-3 py-2.5 font-inter text-sm outline-none focus:border-[#E8A020]"
              >
                <option value="">Select course</option>
                {COURSES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.flag} {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="mb-5">
              <FieldLabel>Staff Member *</FieldLabel>
              <select
                value={form.staffId}
                onChange={(e) => setField('staffId', e.target.value)}
                required
                className="w-full rounded-lg border border-[#DDE3EC] px-3 py-2.5 font-inter text-sm outline-none focus:border-[#E8A020]"
              >
                <option value="">Select staff</option>
                {staff
                  .filter((s) => s.status === 'active')
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.displayName} ({s.role})
                    </option>
                  ))}
              </select>
              {selectedStaff && (
                <p className="mt-1 text-xs text-[#5A6A7A]">{selectedStaff.email}</p>
              )}
            </div>

            {form.type === 'class' && (
              <div className="mb-5">
                <FieldLabel>Batch *</FieldLabel>
                <select
                  value={form.batchName}
                  onChange={(e) => setField('batchName', e.target.value)}
                  required
                  className="w-full rounded-lg border border-[#DDE3EC] px-3 py-2.5 font-inter text-sm outline-none focus:border-[#E8A020]"
                >
                  <option value="">Select batch</option>
                  {batches.map((b) => (
                    <option key={b} value={b}>
                      Batch {b}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {form.type === 'consultation' && (
              <div className="mb-5 space-y-3">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.openSlot}
                    onChange={(e) => {
                      setField('openSlot', e.target.checked)
                      if (e.target.checked) setField('studentId', '')
                    }}
                    className="rounded border-[#DDE3EC] text-[#E8A020] focus:ring-[#E8A020]"
                  />
                  <span className="font-inter text-sm text-[#0D1B2A]">
                    Open slot (students can book from portal)
                  </span>
                </label>
                {!form.openSlot && (
                  <div>
                    <FieldLabel>Student *</FieldLabel>
                    <select
                      value={form.studentId}
                      onChange={(e) => setField('studentId', e.target.value)}
                      required={!form.openSlot}
                      className="w-full rounded-lg border border-[#DDE3EC] px-3 py-2.5 font-inter text-sm outline-none focus:border-[#E8A020]"
                    >
                      <option value="">Select student</option>
                      {filteredStudents.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.studentCode})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}

            <div className="mb-5">
              <FieldLabel>Date *</FieldLabel>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setField('date', e.target.value)}
                required
                className="w-full rounded-lg border border-[#DDE3EC] px-3 py-2.5 font-inter text-sm outline-none focus:border-[#E8A020]"
              />
            </div>

            <div className="mb-5 grid grid-cols-2 gap-4">
              <div>
                <FieldLabel>Start Time *</FieldLabel>
                <input
                  type="time"
                  value={form.startTime}
                  onChange={(e) => setField('startTime', e.target.value)}
                  required
                  className="w-full rounded-lg border border-[#DDE3EC] px-3 py-2.5 font-inter text-sm outline-none focus:border-[#E8A020]"
                />
              </div>
              <div>
                <FieldLabel>End Time *</FieldLabel>
                <input
                  type="time"
                  value={form.endTime}
                  onChange={(e) => setField('endTime', e.target.value)}
                  required
                  className="w-full rounded-lg border border-[#DDE3EC] px-3 py-2.5 font-inter text-sm outline-none focus:border-[#E8A020]"
                />
              </div>
            </div>

            <div className="mb-5">
              <FieldLabel>Location</FieldLabel>
              <input
                type="text"
                value={form.location}
                onChange={(e) => setField('location', e.target.value)}
                placeholder="Room number or online meeting link"
                className="w-full rounded-lg border border-[#DDE3EC] px-3 py-2.5 font-inter text-sm outline-none focus:border-[#E8A020]"
              />
            </div>

            {!isEdit && (
              <div className="mb-5">
                <FieldLabel>Recurring</FieldLabel>
                <select
                  value={form.recurringType}
                  onChange={(e) =>
                    setField('recurringType', e.target.value as RecurringType)
                  }
                  className="w-full rounded-lg border border-[#DDE3EC] px-3 py-2.5 font-inter text-sm outline-none focus:border-[#E8A020]"
                >
                  <option value="once">Once</option>
                  <option value="weekly">Weekly (12 weeks)</option>
                  <option value="daily">Daily (12 days)</option>
                </select>
              </div>
            )}

            <div>
              <FieldLabel>Notes</FieldLabel>
              <textarea
                value={form.notes}
                onChange={(e) => setField('notes', e.target.value)}
                rows={3}
                className="w-full resize-none rounded-lg border border-[#DDE3EC] px-3 py-2.5 font-inter text-sm outline-none focus:border-[#E8A020]"
                placeholder="Optional notes…"
              />
            </div>
          </div>

          <div className="flex gap-3 border-t border-[#DDE3EC] px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-[#DDE3EC] py-2.5 font-jakarta text-sm font-semibold text-[#5A6A7A] hover:bg-[#F5F7FB]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-lg bg-[#E8A020] py-2.5 font-jakarta text-sm font-bold text-[#0B3D6B] hover:bg-[#F5B942] disabled:opacity-60"
            >
              {saving ? 'Saving…' : isEdit ? 'Update Session' : 'Save Session'}
            </button>
          </div>
        </form>
      </aside>
    </>
  )
}
