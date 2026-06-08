'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { COURSE_MAP, COURSES } from '@/lib/constants/courses'
import { todayISO } from '@/lib/attendance/helpers'
import { useManagement } from '@/components/layout/ManagementContext'
import { logAuditEvent } from '@/lib/audit/helpers'
import type {
  AttendanceRecord,
  AttendanceStatus,
  CourseId,
  Student,
} from '@/types'

type MarkableStatus = 'present' | 'absent' | 'late'

interface StudentEntry {
  studentId: string
  selected: boolean
  status: MarkableStatus
  notes: string
}

interface AttendanceFormProps {
  open: boolean
  onClose: () => void
  record?: AttendanceRecord | null
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

export default function AttendanceForm({
  open,
  onClose,
  record,
  students,
  onSaved,
}: AttendanceFormProps) {
  const { user } = useManagement()
  const isEdit = !!record

  const [date, setDate] = useState(todayISO())
  const [courseId, setCourseId] = useState<CourseId | ''>('')
  const [batchName, setBatchName] = useState('')
  const [sessionStart, setSessionStart] = useState('09:00')
  const [sessionEnd, setSessionEnd] = useState('11:00')
  const [entries, setEntries] = useState<StudentEntry[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const batches = useMemo(() => {
    if (!courseId) return []
    const set = new Set(
      students.filter((s) => s.courseId === courseId).map((s) => s.batchId).filter(Boolean),
    )
    return Array.from(set).sort()
  }, [students, courseId])

  const batchStudents = useMemo(() => {
    if (!courseId || !batchName) return []
    return students.filter(
      (s) => s.courseId === courseId && s.batchId === batchName && s.status === 'active',
    )
  }, [students, courseId, batchName])

  useEffect(() => {
    if (!open) return

    if (record) {
      setDate(record.date.slice(0, 10))
      setCourseId(record.courseId)
      setBatchName(record.batchName)
      setSessionStart(record.sessionStart)
      setSessionEnd(record.sessionEnd)
      setEntries([
        {
          studentId: record.studentId,
          selected: true,
          status:
            record.status === 'absent' || record.status === 'late'
              ? record.status
              : 'present',
          notes: record.notes ?? '',
        },
      ])
    } else {
      setDate(todayISO())
      setCourseId('')
      setBatchName('')
      setSessionStart('09:00')
      setSessionEnd('11:00')
      setEntries([])
    }
    setError('')
  }, [open, record])

  useEffect(() => {
    if (isEdit || !open) return
    setEntries(
      batchStudents.map((s) => ({
        studentId: s.id,
        selected: true,
        status: 'present' as MarkableStatus,
        notes: '',
      })),
    )
  }, [batchStudents, isEdit, open])

  function setEntryStatus(studentId: string, status: MarkableStatus) {
    setEntries((prev) =>
      prev.map((e) => (e.studentId === studentId ? { ...e, status } : e)),
    )
  }

  function setEntryNotes(studentId: string, notes: string) {
    setEntries((prev) =>
      prev.map((e) => (e.studentId === studentId ? { ...e, notes } : e)),
    )
  }

  function toggleStudent(studentId: string) {
    setEntries((prev) =>
      prev.map((e) =>
        e.studentId === studentId ? { ...e, selected: !e.selected } : e,
      ),
    )
  }

  function markAllPresent() {
    setEntries((prev) => prev.map((e) => ({ ...e, status: 'present' })))
  }

  const selectedEntries = entries.filter((e) => e.selected)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user) {
      setError('You must be signed in to mark attendance')
      return
    }
    if (!courseId || !batchName) {
      setError('Please select course and batch')
      return
    }
    if (selectedEntries.length === 0) {
      setError('Select at least one student')
      return
    }
    if (sessionStart >= sessionEnd) {
      setError('Session end time must be after start time')
      return
    }

    setSaving(true)
    setError('')

    try {
      const course = COURSE_MAP[courseId]

      if (isEdit && record) {
        const entry = selectedEntries[0]
        await updateDoc(doc(db, 'attendance', record.id), {
          date,
          status: entry.status,
          sessionStart,
          sessionEnd,
          notes: entry.notes.trim() || null,
          updatedAt: serverTimestamp(),
        })
        await logAuditEvent({
          userId: user.uid,
          userEmail: user.email,
          userRole: user.role,
          action: 'updated',
          entityType: 'attendance',
          entityId: record.id,
          details: `Updated attendance for ${record.studentName}`,
        })
      } else {
        await Promise.all(
          selectedEntries.map(async (entry) => {
            const student = students.find((s) => s.id === entry.studentId)
            if (!student) return

            const docId = doc(collection(db, 'attendance')).id
            await setDoc(doc(db, 'attendance', docId), {
              studentId: student.id,
              studentName: student.name,
              studentCode: student.studentCode,
              courseId: student.courseId,
              courseName: course?.label ?? student.courseId,
              batchName: student.batchId,
              date,
              status: entry.status as AttendanceStatus,
              sessionStart,
              sessionEnd,
              notes: entry.notes.trim() || null,
              markedBy: user.uid,
              createdAt: serverTimestamp(),
            })
          }),
        )
        await logAuditEvent({
          userId: user.uid,
          userEmail: user.email,
          userRole: user.role,
          action: 'created',
          entityType: 'attendance',
          entityId: batchName,
          details: `Marked attendance for ${selectedEntries.length} students in ${batchName}`,
        })
      }

      onSaved()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save attendance')
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
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-2xl flex-col bg-white/90 dark:bg-[#0d1a2e]/90 backdrop-blur-2xl border-l border-white/80 dark:border-white/[0.08] shadow-2xl"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between border-b border-[#DDE3EC] px-6 py-4">
          <h2 className="font-jakarta text-lg font-bold text-[#0D1B2A]">
            {isEdit ? 'Edit Attendance' : 'Mark Attendance'}
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

            <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <FieldLabel>Date *</FieldLabel>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  className="w-full rounded-lg border border-[#DDE3EC] px-3 py-2.5 font-inter text-base outline-none focus:border-[#E8A020] sm:text-sm"
                />
              </div>
              <div>
                <FieldLabel>Session Start</FieldLabel>
                <input
                  type="time"
                  value={sessionStart}
                  onChange={(e) => setSessionStart(e.target.value)}
                  className="w-full rounded-lg border border-[#DDE3EC] px-3 py-2.5 font-inter text-base outline-none focus:border-[#E8A020] sm:text-sm"
                />
              </div>
              <div>
                <FieldLabel>Session End</FieldLabel>
                <input
                  type="time"
                  value={sessionEnd}
                  onChange={(e) => setSessionEnd(e.target.value)}
                  className="w-full rounded-lg border border-[#DDE3EC] px-3 py-2.5 font-inter text-base outline-none focus:border-[#E8A020] sm:text-sm"
                />
              </div>
            </div>

            <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <FieldLabel>Course *</FieldLabel>
                <select
                  value={courseId}
                  onChange={(e) => {
                    setCourseId(e.target.value as CourseId | '')
                    setBatchName('')
                  }}
                  required
                  disabled={isEdit}
                  className="w-full rounded-lg border border-[#DDE3EC] px-3 py-2.5 font-inter text-sm outline-none focus:border-[#E8A020] disabled:bg-[#F5F7FB]"
                >
                  <option value="">Select course</option>
                  {COURSES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <FieldLabel>Batch *</FieldLabel>
                <select
                  value={batchName}
                  onChange={(e) => setBatchName(e.target.value)}
                  required
                  disabled={isEdit || !courseId}
                  className="w-full rounded-lg border border-[#DDE3EC] px-3 py-2.5 font-inter text-sm outline-none focus:border-[#E8A020] disabled:bg-[#F5F7FB]"
                >
                  <option value="">Select batch</option>
                  {batches.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {!isEdit && batchName && (
              <div className="mb-4 flex items-center justify-between">
                <p className="font-inter text-sm text-[#5A6A7A]">
                  {batchStudents.length} student{batchStudents.length !== 1 ? 's' : ''} in batch
                </p>
                <button
                  type="button"
                  onClick={markAllPresent}
                  className="rounded-lg border border-[#0B3D6B]/20 px-3 py-1.5 font-jakarta text-xs font-semibold text-[#0B3D6B] hover:bg-[#0B3D6B]/5"
                >
                  Mark all present
                </button>
              </div>
            )}

            {courseId && batchName && entries.length === 0 && !isEdit && (
              <p className="rounded-lg border border-[#DDE3EC] bg-[#F5F7FB] px-4 py-3 text-sm text-[#5A6A7A]">
                No active students found in this batch.
              </p>
            )}

            {entries.length > 0 && (
              <div className="space-y-3">
                {entries.map((entry) => {
                  const student = students.find((s) => s.id === entry.studentId)
                  if (!student) return null

                  return (
                    <div
                      key={entry.studentId}
                      className="rounded-xl border border-[#DDE3EC] bg-[#F5F7FB]/40 p-4"
                    >
                      <div className="mb-3 flex items-start gap-3">
                        {!isEdit && (
                          <input
                            type="checkbox"
                            checked={entry.selected}
                            onChange={() => toggleStudent(entry.studentId)}
                            className="mt-1 h-4 w-4 rounded border-[#DDE3EC] text-[#E8A020] focus:ring-[#E8A020]"
                            aria-label={`Include ${student.name}`}
                          />
                        )}
                        <div className="flex-1">
                          <p className="font-jakarta font-semibold text-[#0D1B2A]">
                            {student.name}
                          </p>
                          <p className="text-xs text-[#5A6A7A]">{student.studentCode}</p>
                        </div>
                      </div>

                      <div className="mb-3 flex flex-wrap gap-4">
                        {(['present', 'absent', 'late'] as MarkableStatus[]).map((s) => (
                          <label
                            key={s}
                            className="inline-flex cursor-pointer items-center gap-2 font-inter text-sm capitalize text-[#0D1B2A]"
                          >
                            <input
                              type="radio"
                              name={`status-${entry.studentId}`}
                              value={s}
                              checked={entry.status === s}
                              onChange={() => setEntryStatus(entry.studentId, s)}
                              className="h-4 w-4 border-[#DDE3EC] text-[#E8A020] focus:ring-[#E8A020]"
                            />
                            {s}
                          </label>
                        ))}
                      </div>

                      <input
                        type="text"
                        value={entry.notes}
                        onChange={(e) => setEntryNotes(entry.studentId, e.target.value)}
                        placeholder="Notes (optional)"
                        className="w-full rounded-lg border border-[#DDE3EC] bg-white px-3 py-2 font-inter text-sm outline-none focus:border-[#E8A020]"
                      />
                    </div>
                  )
                })}
              </div>
            )}
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
              disabled={saving || entries.length === 0}
              className="flex-1 rounded-lg bg-[#E8A020] py-2.5 font-jakarta text-sm font-bold text-[#0B3D6B] hover:bg-[#F5B942] disabled:opacity-60"
            >
              {saving
                ? 'Saving…'
                : isEdit
                  ? 'Update Attendance'
                  : `Save ${selectedEntries.length} Record${selectedEntries.length !== 1 ? 's' : ''}`}
            </button>
          </div>
        </form>
      </aside>
    </>
  )
}
