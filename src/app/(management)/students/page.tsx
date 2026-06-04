'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { collection, getDocs, orderBy, query } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { COURSES } from '@/lib/constants/courses'
import { parseStudent } from '@/lib/students/helpers'
import StudentForm from '@/components/students/StudentForm'
import StudentTable, {
  StudentTableEmpty,
  StudentTableMeta,
} from '@/components/students/StudentTable'
import { LOCATION_LABELS } from '@/lib/students/helpers'
import { useManagement } from '@/components/layout/ManagementContext'
import type { CourseId, Student, StudentLocation } from '@/types'

const PAGE_SIZE = 10

const LOCATION_OPTIONS: { id: StudentLocation | ''; label: string }[] = [
  { id: '', label: 'All locations' },
  { id: 'ahangama', label: LOCATION_LABELS.ahangama },
  { id: 'galle', label: LOCATION_LABELS.galle },
  { id: 'waduraba', label: LOCATION_LABELS.waduraba },
  { id: 'pinnaduwa', label: LOCATION_LABELS.pinnaduwa },
]

export default function StudentsPage() {
  const { user } = useManagement()
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [courseFilter, setCourseFilter] = useState<CourseId | ''>('')
  const [locationFilter, setLocationFilter] = useState<StudentLocation | ''>('')
  const [statusFilter, setStatusFilter] = useState<Student['status'] | ''>('')
  const [batchFilter, setBatchFilter] = useState('')
  const [page, setPage] = useState(1)
  const [formOpen, setFormOpen] = useState(false)
  const [editStudent, setEditStudent] = useState<Student | null>(null)

  const loadStudents = useCallback(async () => {
    setLoading(true)
    try {
      const q = query(collection(db, 'students'), orderBy('createdAt', 'desc'))
      const snap = await getDocs(q)
      setStudents(
        snap.docs.map((d) => parseStudent(d.id, d.data() as Record<string, unknown>)),
      )
    } catch (err) {
      console.error('[StudentsPage] load failed:', err)
      setStudents([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadStudents()
  }, [loadStudents])

  useEffect(() => {
    if (user?.role === 'reception' && user.locationAssigned) {
      setLocationFilter(user.locationAssigned)
    }
  }, [user?.role, user?.locationAssigned])

  const batches = useMemo(() => {
    const set = new Set(students.map((s) => s.batchId).filter(Boolean))
    return Array.from(set).sort()
  }, [students])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return students.filter((s) => {
      if (courseFilter && s.courseId !== courseFilter) return false
      if (statusFilter && s.status !== statusFilter) return false
      if (batchFilter && s.batchId !== batchFilter) return false
      if (locationFilter && s.location !== locationFilter) return false
      if (!q) return true
      return (
        s.name.toLowerCase().includes(q) ||
        (s.email?.toLowerCase().includes(q) ?? false) ||
        s.mobile.includes(q) ||
        s.studentCode.toLowerCase().includes(q)
      )
    })
  }, [students, search, courseFilter, statusFilter, batchFilter, locationFilter])

  useEffect(() => {
    setPage(1)
  }, [search, courseFilter, statusFilter, batchFilter, locationFilter])

  const paginated = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return filtered.slice(start, start + PAGE_SIZE)
  }, [filtered, page])

  function openAdd() {
    setEditStudent(null)
    setFormOpen(true)
  }

  function openEdit(student: Student) {
    setEditStudent(student)
    setFormOpen(true)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-jakarta text-2xl font-bold text-[#0D1B2A]">Students</h2>
          <p className="font-inter text-sm text-[#5A6A7A]">
            Manage enrollments, profiles, and student records
          </p>
        </div>
        <button
          type="button"
          onClick={openAdd}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#E8A020] px-5 py-2.5 font-jakarta text-sm font-bold text-[#0B3D6B] transition-colors hover:bg-[#F5B942]"
        >
          <span className="ti ti-plus" aria-hidden="true" />
          Add Student
        </button>
      </div>

      <div className="rounded-xl border border-[#DDE3EC] bg-white p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-5">
          <div className="relative md:col-span-2 lg:col-span-1">
            <span
              className="ti ti-search absolute left-3 top-1/2 -translate-y-1/2 text-[#5A6A7A]"
              aria-hidden="true"
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, email, phone…"
              className="w-full rounded-lg border border-[#DDE3EC] py-2.5 pl-10 pr-3 font-inter text-base text-[#0D1B2A] outline-none focus:border-[#E8A020] sm:text-sm"
            />
          </div>
          <select
            value={courseFilter}
            onChange={(e) => setCourseFilter(e.target.value as CourseId | '')}
            className="rounded-lg border border-[#DDE3EC] px-3 py-2.5 font-inter text-sm text-[#0D1B2A] outline-none focus:border-[#E8A020]"
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
            className="rounded-lg border border-[#DDE3EC] px-3 py-2.5 font-inter text-sm text-[#0D1B2A] outline-none focus:border-[#E8A020]"
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
            className="rounded-lg border border-[#DDE3EC] px-3 py-2.5 font-inter text-sm text-[#0D1B2A] outline-none focus:border-[#E8A020]"
          >
            <option value="">All batches</option>
            {batches.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
          <select
            value={locationFilter}
            onChange={(e) => setLocationFilter(e.target.value as StudentLocation | '')}
            className="rounded-lg border border-[#DDE3EC] px-3 py-2.5 font-inter text-sm text-[#0D1B2A] outline-none focus:border-[#E8A020]"
            title="Campus location"
          >
            {LOCATION_OPTIONS.map((loc) => (
              <option key={loc.id || 'all'} value={loc.id}>
                {loc.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {!loading && filtered.length === 0 ? (
        <StudentTableEmpty onAdd={openAdd} />
      ) : (
        <>
          <StudentTable
            students={paginated}
            loading={loading}
            onEdit={openEdit}
          />
          {!loading && filtered.length > 0 && (
            <StudentTableMeta
              total={filtered.length}
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
    </div>
  )
}
