'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { collection, getDocs, orderBy, query } from 'firebase/firestore'
import toast from 'react-hot-toast'
import { auth, db } from '@/lib/firebase/client'
import { COURSES } from '@/lib/constants/courses'
import { parseAttempt } from '@/lib/exam/helpers'
import {
  TEACHER_STAT_LABELS,
  filterStudentsByTeacherStat,
  type TeacherStatFilter,
} from '@/lib/dashboard/teacherStats'
import { parseStudent, STATUS_STYLES } from '@/lib/students/helpers'
import StudentForm from '@/components/students/StudentForm'
import SendCredentialsModal from '@/components/students/SendCredentialsModal'
import { StudentTableEmpty, StudentTableMeta } from '@/components/students/StudentTable'
import { getDefaultLocationFilter } from '@/lib/locations/helpers'
import LocationFilterSelect from '@/components/ui/LocationFilterSelect'
import { useManagement } from '@/components/layout/ManagementContext'
import type { CourseId, ExamAttempt, ExamResult, Student, StudentLocation } from '@/types'

const PAGE_SIZE = 10

function parseExamResult(id: string, data: Record<string, unknown>): ExamResult {
  return {
    id,
    examId: String(data.examId ?? ''),
    studentId: String(data.studentId ?? ''),
    score: data.score != null ? Number(data.score) : undefined,
    band: data.band ? String(data.band) : undefined,
    level: data.level ? String(data.level) : undefined,
    status: (data.status as ExamResult['status']) ?? 'pending',
    notes: data.notes ? String(data.notes) : undefined,
    createdAt: String(data.createdAt ?? new Date().toISOString()),
    createdBy: String(data.createdBy ?? ''),
  }
}

const TEACHER_STAT_VALUES: TeacherStatFilter[] = [
  'active',
  'passed',
  'failed',
  'dropped',
  'repeats',
]

export default function StudentsPage() {
  const { user, hasRole } = useManagement()
  const searchParams = useSearchParams()
  const teacherStatParam = searchParams.get('teacherStat')
  const teacherStat = TEACHER_STAT_VALUES.includes(teacherStatParam as TeacherStatFilter)
    ? (teacherStatParam as TeacherStatFilter)
    : null

  const [students, setStudents] = useState<Student[]>([])
  const [examResults, setExamResults] = useState<ExamResult[]>([])
  const [examAttempts, setExamAttempts] = useState<ExamAttempt[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [courseFilter, setCourseFilter] = useState<CourseId | ''>('')
  const [locationFilter, setLocationFilter] = useState<StudentLocation | ''>('')
  const [statusFilter, setStatusFilter] = useState<Student['status'] | ''>('')
  const [batchFilter, setBatchFilter] = useState('')
  const [page, setPage] = useState(1)
  const [formOpen, setFormOpen] = useState(false)
  const [editStudent, setEditStudent] = useState<Student | null>(null)
  const [sendCredsStudent, setSendCredsStudent] = useState<Student | null>(null)
  const [fixingUids, setFixingUids] = useState(false)

  const loadStudents = useCallback(async () => {
    setLoading(true)
    try {
      const q = query(collection(db, 'students'), orderBy('createdAt', 'desc'))
      const [studentsSnap, resultsSnap, attemptsSnap] = await Promise.all([
        getDocs(q),
        teacherStat
          ? getDocs(collection(db, 'examResults')).catch(() => ({ docs: [] }))
          : Promise.resolve({ docs: [] }),
        teacherStat
          ? getDocs(collection(db, 'examAttempts')).catch(() => ({ docs: [] }))
          : Promise.resolve({ docs: [] }),
      ])
      setStudents(
        studentsSnap.docs.map((d) =>
          parseStudent(d.id, d.data() as Record<string, unknown>),
        ),
      )
      setExamResults(
        resultsSnap.docs.map((d) =>
          parseExamResult(d.id, d.data() as Record<string, unknown>),
        ),
      )
      setExamAttempts(
        attemptsSnap.docs.map((d) =>
          parseAttempt(d.id, d.data() as Record<string, unknown>),
        ),
      )
    } catch (err) {
      console.error('[StudentsPage] load failed:', err)
      setStudents([])
    } finally {
      setLoading(false)
    }
  }, [teacherStat])

  useEffect(() => {
    loadStudents()
  }, [loadStudents])

  useEffect(() => {
    const def = getDefaultLocationFilter(user)
    if (def) setLocationFilter(def)
  }, [user])

  const batches = useMemo(() => {
    const set = new Set(students.map((s) => s.batchId).filter(Boolean))
    return Array.from(set).sort()
  }, [students])

  const filtered = useMemo(() => {
    let list = students
    if (teacherStat) {
      list = filterStudentsByTeacherStat(list, teacherStat, examResults, examAttempts)
    }
    const q = searchQuery.trim().toLowerCase()
    return list.filter((s) => {
      if (courseFilter && s.courseId !== courseFilter) return false
      if (statusFilter && s.status !== statusFilter) return false
      if (batchFilter && s.batchId !== batchFilter) return false
      if (locationFilter && s.location !== locationFilter) return false
      if (!q) return true
      const studentRecord = s as unknown as Record<string, unknown>
      return (
        s.name.toLowerCase().includes(q) ||
        (s.email?.toLowerCase().includes(q) ?? false) ||
        s.mobile.includes(q) ||
        s.studentCode.toLowerCase().includes(q) ||
        String(studentRecord.registrationNumber ?? '').toLowerCase().includes(q)
      )
    })
  }, [
    students,
    searchQuery,
    courseFilter,
    statusFilter,
    batchFilter,
    locationFilter,
    teacherStat,
    examResults,
    examAttempts,
  ])

  useEffect(() => {
    setPage(1)
  }, [searchQuery, courseFilter, statusFilter, batchFilter, locationFilter])

  const displayedStudents = filtered

  const paginated = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return displayedStudents.slice(start, start + PAGE_SIZE)
  }, [displayedStudents, page])

  function openAdd() {
    setEditStudent(null)
    setFormOpen(true)
  }

  function openEdit(student: Student) {
    setEditStudent(student)
    setFormOpen(true)
  }

  async function fixStudentUids() {
    if (!auth.currentUser) {
      toast.error('You must be logged in')
      return
    }
    setFixingUids(true)
    try {
      const token = await auth.currentUser.getIdToken()
      const res = await fetch('/api/admin/fix-student-uids', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = (await res.json()) as {
        fixed?: number
        alreadyCorrect?: number
        notFound?: string[]
        errors?: string[]
        error?: string
      }
      if (!res.ok) {
        throw new Error(data.error ?? 'Fix failed')
      }
      toast.success(
        `Fixed ${data.fixed ?? 0} students · ${data.alreadyCorrect ?? 0} already correct`,
      )
      if (data.notFound?.length) {
        console.warn('[fix-student-uids] No Auth account:', data.notFound)
        toast(`No Auth account for ${data.notFound.length} student(s) — see console`, {
          icon: '⚠️',
        })
      }
      if (data.errors?.length) {
        console.error('[fix-student-uids] Errors:', data.errors)
      }
      await loadStudents()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not fix student UIDs')
    } finally {
      setFixingUids(false)
    }
  }

  const isAdmin = hasRole('admin') || hasRole('owner')

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-jakarta text-2xl font-bold text-[#0D1B2A] dark:text-white">Students</h2>
          <p className="font-inter text-sm text-[#5A6A7A]">
            {teacherStat
              ? `Filtered: ${TEACHER_STAT_LABELS[teacherStat]}`
              : 'Manage enrollments, profiles, and student records'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isAdmin && (
            <button
              type="button"
              onClick={() => void fixStudentUids()}
              disabled={fixingUids}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#0B3D6B] px-4 py-2.5 font-jakarta text-sm font-semibold text-[#0B3D6B] hover:bg-[#0B3D6B]/5 disabled:opacity-60"
            >
              <span className="ti ti-link" aria-hidden="true" />
              {fixingUids ? 'Fixing…' : 'Fix UIDs'}
            </button>
          )}
          <button
            type="button"
            onClick={openAdd}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#E8A020] px-5 py-2.5 font-jakarta text-sm font-bold text-[#0B3D6B] transition-colors hover:bg-[#F5B942]"
          >
            <span className="ti ti-plus" aria-hidden="true" />
            Add Student
          </button>
        </div>
      </div>

      {teacherStat && (
        <div className="flex items-center justify-between rounded-lg border border-[#E8A020]/40 bg-[#E8A020]/10 px-4 py-3 text-sm text-[#0B3D6B]">
          <span>
            Showing <strong>{TEACHER_STAT_LABELS[teacherStat]}</strong> only
          </span>
          <a href="/students" className="font-semibold hover:underline">
            Clear filter
          </a>
        </div>
      )}

      <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#1A1535] p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-5">
          <div className="relative md:col-span-2 lg:col-span-1">
            <span
              className="ti ti-search absolute left-3 top-1/2 -translate-y-1/2 text-[#5A6A7A] dark:text-white/40"
              aria-hidden="true"
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search name, email, phone…"
              className="w-full rounded-xl border-2 border-gray-200 dark:border-white/10 bg-white dark:bg-[#1A1535] py-2.5 pl-10 pr-3 font-inter text-base text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/30 outline-none focus:border-[#E8A020] dark:focus:border-[#E8A020] transition-colors duration-200 sm:text-sm"
            />
          </div>
          <select
            value={courseFilter}
            onChange={(e) => setCourseFilter(e.target.value as CourseId | '')}
            className="rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#1A1535] px-3 py-2.5 font-inter text-sm text-gray-900 dark:text-white outline-none focus:border-[#E8A020] dark:focus:border-[#E8A020]"
          >
            <option value="">All courses</option>
            {COURSES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as Student['status'] | '')}
            className="rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#1A1535] px-3 py-2.5 font-inter text-sm text-gray-900 dark:text-white outline-none focus:border-[#E8A020] dark:focus:border-[#E8A020]"
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="pending">Pending</option>
            <option value="completed">Completed</option>
            <option value="withdrawn">Withdrawn</option>
          </select>
          <select
            value={batchFilter}
            onChange={(e) => setBatchFilter(e.target.value)}
            className="rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#1A1535] px-3 py-2.5 font-inter text-sm text-gray-900 dark:text-white outline-none focus:border-[#E8A020] dark:focus:border-[#E8A020]"
          >
            <option value="">All batches</option>
            {batches.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
          <LocationFilterSelect value={locationFilter} onChange={setLocationFilter} />
        </div>
      </div>

      {!loading && displayedStudents.length === 0 ? (
        <StudentTableEmpty onAdd={openAdd} />
      ) : (
        <>
          <div className="overflow-x-auto -mx-4 rounded-xl border border-gray-100 bg-white dark:border-white/[0.05] dark:bg-white/[0.04] sm:mx-0">
            <div className="min-w-[600px] sm:min-w-0">
            <table className="min-w-full">
              <thead className="border-b border-gray-100 bg-gray-50 dark:border-white/[0.05] dark:bg-white/[0.03]">
                <tr>
                  <th className="px-4 py-3 text-left font-jakarta text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-white/40">
                    Student
                  </th>
                  <th className="px-4 py-3 text-left font-jakarta text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-white/40">
                    Contact
                  </th>
                  <th className="px-4 py-3 text-left font-jakarta text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-white/40">
                    Student Code
                  </th>
                  <th className="px-4 py-3 text-left font-jakarta text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-white/40">
                    Status
                  </th>
                  <th className="px-4 py-3 font-jakarta text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-white/40">
                    ID Status
                  </th>
                  <th className="px-4 py-3 text-left font-jakarta text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-white/40">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                {loading
                  ? Array.from({ length: 6 }).map((_, index) => (
                      <tr key={index}>
                        <td colSpan={6} className="px-4 py-4">
                          <div className="h-4 w-full animate-pulse rounded bg-gray-100 dark:bg-white/[0.08]" />
                        </td>
                      </tr>
                    ))
                  : paginated.map((s) => {
                      const studentRecord = s as unknown as Record<string, unknown>
                      const registrationNumber = String(studentRecord.registrationNumber ?? '').trim()
                      const studentIdNum = String(studentRecord.studentId ?? '').trim()
                      const hasIds = Boolean(registrationNumber && studentIdNum)
                      return (
                        <tr key={s.id} className="bg-white dark:bg-transparent hover:bg-gray-50 dark:hover:bg-white/[0.03] transition-colors duration-150 cursor-pointer">
                          <td className="px-4 py-3">
                            <div>
                              <Link
                                href={`/students/${s.id}`}
                                className="font-jakarta text-sm font-semibold text-gray-900 dark:text-white hover:text-[#E8A020] hover:underline transition-colors"
                              >
                                {s.name}
                              </Link>
                              <p className="text-xs text-gray-500 dark:text-white/40">{s.batchId || '—'}</p>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-sm text-gray-900 dark:text-white">{s.email || '—'}</p>
                            <p className="text-xs text-gray-500 dark:text-white/40">{s.mobile || '—'}</p>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{s.studentCode}</td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span
                                className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[s.status]}`}
                              >
                                {s.status}
                              </span>
                              {s.paymentStatus === 'partial' && (s.pendingAmount ?? 0) > 0 && (
                                <span className="inline-flex rounded-full bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 text-xs text-amber-700 dark:text-amber-400">
                                  LKR {s.pendingAmount!.toLocaleString()} pending
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {hasIds ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-900/30 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                                <span className="ti ti-check text-[10px]" />
                                Assigned
                              </span>
                            ) : (
                              <a
                                href={`/students/${s.id}`}
                                className="inline-flex items-center gap-1 rounded-full bg-amber-50 dark:bg-amber-900/30 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300 hover:underline"
                              >
                                Pending
                              </a>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <Link
                                href={`/students/${s.id}`}
                                className="rounded-lg border border-gray-200 dark:border-white/10 px-2.5 py-1 text-xs font-medium text-gray-700 dark:text-white/70 hover:bg-gray-50 dark:hover:bg-white/[0.06]"
                              >
                                View
                              </Link>
                              <button
                                type="button"
                                onClick={() => openEdit(s)}
                                className="rounded-lg border border-gray-200 dark:border-white/10 px-2.5 py-1 text-xs font-medium text-gray-700 dark:text-white/70 hover:bg-gray-50 dark:hover:bg-white/[0.06]"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                title="Send login credentials via WhatsApp"
                                onClick={() => setSendCredsStudent(s)}
                                className="rounded-lg p-1.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
                              >
                                <span className="ti ti-brand-whatsapp text-lg" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
              </tbody>
            </table>
            </div>
          </div>
          {!loading && displayedStudents.length > 0 && (
            <StudentTableMeta
              total={displayedStudents.length}
              page={page}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
            />
          )}
        </>
      )}

      <StudentForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        student={editStudent}
        onSaved={loadStudents}
      />

      <SendCredentialsModal
        open={!!sendCredsStudent}
        student={sendCredsStudent}
        onClose={() => setSendCredsStudent(null)}
      />
    </div>
  )
}
