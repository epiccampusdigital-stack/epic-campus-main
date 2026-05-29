'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { collection, getDocs, orderBy, query } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { COURSES } from '@/lib/constants/courses'
import { parseStudent } from '@/lib/students/helpers'
import {
  computeAttendanceStats,
  parseAttendance,
  todayISO,
} from '@/lib/attendance/helpers'
import AttendanceForm from '@/components/attendance/AttendanceForm'
import AttendanceTable, {
  AttendanceTableEmpty,
  AttendanceTableMeta,
} from '@/components/attendance/AttendanceTable'
import type { AttendanceRecord, AttendanceStatus, CourseId, Student } from '@/types'

const PAGE_SIZE = 10

function StatCard({
  label,
  value,
  loading,
}: {
  label: string
  value: string
  loading?: boolean
}) {
  return (
    <div className="rounded-xl border border-[#DDE3EC] bg-white p-5">
      <p className="font-inter text-xs font-medium uppercase tracking-wide text-[#5A6A7A]">
        {label}
      </p>
      {loading ? (
        <div className="mt-2 h-8 w-20 animate-pulse rounded bg-[#DDE3EC]" />
      ) : (
        <p className="mt-1 font-jakarta text-2xl font-bold text-[#0B3D6B]">{value}</p>
      )}
    </div>
  )
}

export default function AttendancePage() {
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [dateFilter, setDateFilter] = useState(todayISO())
  const [courseFilter, setCourseFilter] = useState<CourseId | ''>('')
  const [batchFilter, setBatchFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<AttendanceStatus | ''>('')
  const [page, setPage] = useState(1)
  const [formOpen, setFormOpen] = useState(false)
  const [editRecord, setEditRecord] = useState<AttendanceRecord | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [attendanceSnap, studentsSnap] = await Promise.all([
        getDocs(query(collection(db, 'attendance'), orderBy('createdAt', 'desc'))),
        getDocs(collection(db, 'students')),
      ])
      setRecords(
        attendanceSnap.docs.map((d) =>
          parseAttendance(d.id, d.data() as Record<string, unknown>),
        ),
      )
      setStudents(
        studentsSnap.docs.map((d) =>
          parseStudent(d.id, d.data() as Record<string, unknown>),
        ),
      )
    } catch (err) {
      console.error('[AttendancePage]', err)
      setRecords([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const batches = useMemo(() => {
    const source = courseFilter
      ? students.filter((s) => s.courseId === courseFilter)
      : students
    const set = new Set(source.map((s) => s.batchId).filter(Boolean))
    return Array.from(set).sort()
  }, [students, courseFilter])

  const filtered = useMemo(() => {
    return records.filter((r) => {
      if (dateFilter && r.date.slice(0, 10) !== dateFilter) return false
      if (courseFilter && r.courseId !== courseFilter) return false
      if (batchFilter && r.batchName !== batchFilter) return false
      if (statusFilter && r.status !== statusFilter) return false
      return true
    })
  }, [records, dateFilter, courseFilter, batchFilter, statusFilter])

  const stats = useMemo(() => computeAttendanceStats(filtered), [filtered])

  useEffect(() => {
    setPage(1)
  }, [dateFilter, courseFilter, batchFilter, statusFilter])

  const paginated = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return filtered.slice(start, start + PAGE_SIZE)
  }, [filtered, page])

  function openMark() {
    setEditRecord(null)
    setFormOpen(true)
  }

  function openEdit(record: AttendanceRecord) {
    setEditRecord(record)
    setFormOpen(true)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-jakarta text-2xl font-bold text-[#0D1B2A]">Attendance</h2>
          <p className="font-inter text-sm text-[#5A6A7A]">Track student attendance</p>
        </div>
        <button
          type="button"
          onClick={openMark}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#E8A020] px-5 py-2.5 font-jakarta text-sm font-bold text-[#0B3D6B] transition-colors hover:bg-[#F5B942]"
        >
          <span className="ti ti-plus" aria-hidden="true" />
          Mark Attendance
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Present" value={String(stats.present)} loading={loading} />
        <StatCard label="Absent" value={String(stats.absent)} loading={loading} />
        <StatCard label="Late" value={String(stats.late)} loading={loading} />
        <StatCard label="Attendance Rate" value={stats.rate} loading={loading} />
      </div>

      <div className="rounded-xl border border-[#DDE3EC] bg-white p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="mb-1 block font-inter text-xs font-medium uppercase tracking-wide text-[#5A6A7A]">
              Date
            </label>
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full rounded-lg border border-[#DDE3EC] px-3 py-2.5 font-inter text-base outline-none focus:border-[#E8A020] sm:text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block font-inter text-xs font-medium uppercase tracking-wide text-[#5A6A7A]">
              Course
            </label>
            <select
              value={courseFilter}
              onChange={(e) => {
                setCourseFilter(e.target.value as CourseId | '')
                setBatchFilter('')
              }}
              className="w-full rounded-lg border border-[#DDE3EC] px-3 py-2.5 font-inter text-sm outline-none focus:border-[#E8A020]"
            >
              <option value="">All courses</option>
              {COURSES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block font-inter text-xs font-medium uppercase tracking-wide text-[#5A6A7A]">
              Batch
            </label>
            <select
              value={batchFilter}
              onChange={(e) => setBatchFilter(e.target.value)}
              className="w-full rounded-lg border border-[#DDE3EC] px-3 py-2.5 font-inter text-sm outline-none focus:border-[#E8A020]"
            >
              <option value="">All batches</option>
              {batches.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block font-inter text-xs font-medium uppercase tracking-wide text-[#5A6A7A]">
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as AttendanceStatus | '')}
              className="w-full rounded-lg border border-[#DDE3EC] px-3 py-2.5 font-inter text-sm outline-none focus:border-[#E8A020]"
            >
              <option value="">All statuses</option>
              <option value="present">Present</option>
              <option value="absent">Absent</option>
              <option value="late">Late</option>
            </select>
          </div>
        </div>
      </div>

      {!loading && filtered.length === 0 ? (
        <AttendanceTableEmpty onMark={openMark} />
      ) : (
        <>
          <AttendanceTable
            records={paginated}
            loading={loading}
            onEdit={openEdit}
          />
          {!loading && filtered.length > 0 && (
            <AttendanceTableMeta
              total={filtered.length}
              page={page}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
            />
          )}
        </>
      )}

      <AttendanceForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        record={editRecord}
        students={students}
        onSaved={loadData}
      />
    </div>
  )
}
