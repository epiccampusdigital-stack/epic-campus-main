'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { collection, getDocs, orderBy, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { COURSES } from '@/lib/constants/courses'
import { parseStudent } from '@/lib/students/helpers'
import {
  computeAttendanceStats,
  parseAttendance,
  todayISO,
} from '@/lib/attendance/helpers'
import LocationFilterSelect from '@/components/ui/LocationFilterSelect'
import { useManagement } from '@/components/layout/ManagementContext'
import { studentIdSetForLocation } from '@/lib/locations/helpers'
import AttendanceForm from '@/components/attendance/AttendanceForm'
import AttendanceTable, {
  AttendanceTableEmpty,
  AttendanceTableMeta,
} from '@/components/attendance/AttendanceTable'
import type { AttendanceRecord, AttendanceStatus, CourseId, Student, StudentLocation } from '@/types'

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
  const { user, hasRole } = useManagement()
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [dateFilter, setDateFilter] = useState(todayISO())
  const [courseFilter, setCourseFilter] = useState<CourseId | ''>('')
  const [batchFilter, setBatchFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<AttendanceStatus | ''>('')
  const [locationFilter, setLocationFilter] = useState<StudentLocation | ''>('')
  const [page, setPage] = useState(1)
  const [formOpen, setFormOpen] = useState(false)
  const [editRecord, setEditRecord] = useState<AttendanceRecord | null>(null)
  const [reportTab, setReportTab] = useState(false)
  const [reportData, setReportData] = useState<{
    studentId: string
    studentName: string
    studentCode?: string
    present: number
    absent: number
    late: number
    total: number
    percentage: number
  }[]>([])
  const [reportLoading, setReportLoading] = useState(false)
  const [reportMonth, setReportMonth] = useState(new Date().toISOString().slice(0, 7))

  const generateReport = useCallback(async () => {
    setReportLoading(true)
    try {
      const startDate = `${reportMonth}-01`
      const endDate = `${reportMonth}-31`
      const snap = await getDocs(
        query(
          collection(db, 'attendance'),
          where('date', '>=', startDate),
          where('date', '<=', endDate),
        )
      ).catch(() => getDocs(collection(db, 'attendance')))

      const studentMap: Record<string, {
        studentId: string
        studentName: string
        studentCode?: string
        present: number
        absent: number
        late: number
      }> = {}

      for (const docSnap of snap.docs) {
        const data = docSnap.data()
        const studentId = String(data.studentId ?? '')
        if (!studentId) continue
        // The date-range query filters this server-side; the fallback path (unindexed) doesn't, so re-check here.
        if (String(data.date ?? '').slice(0, 7) !== reportMonth) continue

        if (!studentMap[studentId]) {
          studentMap[studentId] = {
            studentId,
            studentName: String(data.studentName ?? 'Unknown'),
            studentCode: data.studentCode ? String(data.studentCode) : undefined,
            present: 0,
            absent: 0,
            late: 0,
          }
        }
        const status = String(data.status ?? '')
        if (status === 'present') studentMap[studentId].present++
        else if (status === 'absent') studentMap[studentId].absent++
        else if (status === 'late') studentMap[studentId].late++
      }

      const report = Object.values(studentMap).map(s => {
        const total = s.present + s.absent + s.late
        const percentage = total > 0 ? Math.round((s.present / total) * 100) : 0
        return { ...s, total, percentage }
      }).sort((a, b) => a.percentage - b.percentage)

      setReportData(report)
    } catch (err) {
      console.error('[AttendanceReport]', err)
    } finally {
      setReportLoading(false)
    }
  }, [reportMonth])

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

  useEffect(() => {
    if (
      user &&
      (hasRole('reception') || hasRole('teacher')) &&
      user.locationAssigned
    ) {
      setLocationFilter(user.locationAssigned)
    }
  }, [user, hasRole])

  const locationStudentIds = useMemo(
    () => studentIdSetForLocation(students, locationFilter),
    [students, locationFilter],
  )

  const batches = useMemo(() => {
    const source = courseFilter
      ? students.filter((s) => s.courseId === courseFilter)
      : students
    const set = new Set(source.map((s) => s.batchId).filter(Boolean))
    return Array.from(set).sort()
  }, [students, courseFilter])

  const filtered = useMemo(() => {
    return records.filter((r) => {
      if (locationFilter && !locationStudentIds.has(r.studentId)) return false
      if (dateFilter && r.date.slice(0, 10) !== dateFilter) return false
      if (courseFilter && r.courseId !== courseFilter) return false
      if (batchFilter && r.batchName !== batchFilter) return false
      if (statusFilter && r.status !== statusFilter) return false
      return true
    })
  }, [records, locationFilter, locationStudentIds, dateFilter, courseFilter, batchFilter, statusFilter])

  const stats = useMemo(() => computeAttendanceStats(filtered), [filtered])

  useEffect(() => {
    setPage(1)
  }, [dateFilter, courseFilter, batchFilter, statusFilter, locationFilter])

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
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setReportTab(false)}
            className={`rounded-xl px-4 py-2 text-sm font-semibold ${!reportTab ? 'bg-[#E8A020] text-white' : 'border border-[#DDE3EC] dark:border-white/20 text-[#5A6A7A] dark:text-white/60'}`}
          >
            Attendance
          </button>
          <button
            type="button"
            onClick={() => { setReportTab(true); void generateReport() }}
            className={`rounded-xl px-4 py-2 text-sm font-semibold ${reportTab ? 'bg-[#E8A020] text-white' : 'border border-[#DDE3EC] dark:border-white/20 text-[#5A6A7A] dark:text-white/60'}`}
          >
            <span className="ti ti-chart-bar mr-1" /> Report
          </button>
          <button
            type="button"
            onClick={openMark}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#E8A020] px-5 py-2.5 font-jakarta text-sm font-bold text-[#0B3D6B] transition-colors hover:bg-[#F5B942]"
          >
            <span className="ti ti-plus" aria-hidden="true" />
            Mark Attendance
          </button>
        </div>
      </div>

      {reportTab && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <input
              type="month"
              value={reportMonth}
              onChange={e => setReportMonth(e.target.value)}
              className="rounded-xl border border-[#DDE3EC] dark:border-white/20 bg-white dark:bg-white/[0.04] px-3 py-2 text-sm text-[#0D1B2A] dark:text-white outline-none focus:border-[#E8A020]"
            />
            <button
              type="button"
              onClick={() => void generateReport()}
              className="flex items-center gap-2 rounded-xl bg-[#0B3D6B] px-4 py-2 text-sm font-bold text-white"
            >
              <span className="ti ti-refresh" /> Generate
            </button>
            {reportData.length > 0 && (
              <div className="flex gap-3 ml-auto text-sm">
                <span className="text-emerald-600 font-bold">{reportData.filter(r => r.percentage >= 80).length} Good (≥80%)</span>
                <span className="text-amber-600 font-bold">{reportData.filter(r => r.percentage >= 60 && r.percentage < 80).length} At Risk (60-79%)</span>
                <span className="text-red-600 font-bold">{reportData.filter(r => r.percentage < 60).length} Critical (&lt;60%)</span>
              </div>
            )}
          </div>

          {reportLoading ? (
            <div className="space-y-2">{[1,2,3,4,5].map(i => <div key={i} className="h-12 animate-pulse rounded-xl bg-[#DDE3EC] dark:bg-white/10" />)}</div>
          ) : reportData.length === 0 ? (
            <div className="rounded-2xl border border-[#DDE3EC] dark:border-white/[0.08] bg-white dark:bg-white/[0.04] py-12 text-center">
              <span className="ti ti-clipboard-off text-4xl text-[#DDE3EC] dark:text-white/20" />
              <p className="mt-3 text-sm text-[#5A6A7A] dark:text-white/50">No attendance data for this month</p>
            </div>
          ) : (
            <div className="rounded-2xl border border-[#DDE3EC] dark:border-white/[0.08] bg-white dark:bg-white/[0.04] overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#DDE3EC] dark:border-white/[0.08] bg-[#F5F7FB] dark:bg-white/[0.02]">
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase text-[#5A6A7A] dark:text-white/50">Student</th>
                    <th className="px-4 py-3 text-center text-xs font-bold uppercase text-emerald-600">Present</th>
                    <th className="px-4 py-3 text-center text-xs font-bold uppercase text-red-500">Absent</th>
                    <th className="px-4 py-3 text-center text-xs font-bold uppercase text-amber-600">Late</th>
                    <th className="px-4 py-3 text-center text-xs font-bold uppercase text-[#5A6A7A] dark:text-white/50">Total</th>
                    <th className="px-4 py-3 text-center text-xs font-bold uppercase text-[#5A6A7A] dark:text-white/50">Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.map(r => (
                    <tr key={r.studentId} className="border-b border-[#DDE3EC]/50 dark:border-white/[0.04] last:border-0">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-[#0D1B2A] dark:text-white">{r.studentName}</p>
                        {r.studentCode && <p className="text-xs font-mono text-[#5A6A7A] dark:text-white/40">{r.studentCode}</p>}
                      </td>
                      <td className="px-4 py-3 text-center font-bold text-emerald-600">{r.present}</td>
                      <td className="px-4 py-3 text-center font-bold text-red-500">{r.absent}</td>
                      <td className="px-4 py-3 text-center font-bold text-amber-600">{r.late}</td>
                      <td className="px-4 py-3 text-center text-[#5A6A7A] dark:text-white/50">{r.total}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                          r.percentage >= 80 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400' :
                          r.percentage >= 60 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400' :
                          'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400'
                        }`}>
                          {r.percentage}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {!reportTab && (
      <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Present" value={String(stats.present)} loading={loading} />
        <StatCard label="Absent" value={String(stats.absent)} loading={loading} />
        <StatCard label="Late" value={String(stats.late)} loading={loading} />
        <StatCard label="Attendance Rate" value={stats.rate} loading={loading} />
      </div>

      <div className="rounded-xl border border-[#DDE3EC] bg-white p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-5">
          <div>
            <label className="mb-1 block font-inter text-xs font-medium uppercase tracking-wide text-[#5A6A7A]">
              Location
            </label>
            <LocationFilterSelect value={locationFilter} onChange={setLocationFilter} className="w-full rounded-lg border border-[#DDE3EC] px-3 py-2.5 font-inter text-sm outline-none focus:border-[#E8A020]" />
          </div>
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
