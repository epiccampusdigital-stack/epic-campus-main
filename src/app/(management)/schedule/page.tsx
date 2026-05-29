'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { collection, getDocs, orderBy, query } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { COURSES } from '@/lib/constants/courses'
import { parseStaff } from '@/lib/staff/helpers'
import { parseStudent } from '@/lib/students/helpers'
import { parseSession } from '@/lib/schedule/helpers'
import CalendarView from '@/components/schedule/CalendarView'
import ScheduleList from '@/components/schedule/ScheduleList'
import SessionForm from '@/components/schedule/SessionForm'
import type {
  CourseId,
  ScheduleSession,
  SessionType,
  StaffMember,
  Student,
} from '@/types'

type ViewMode = 'calendar' | 'list'

export default function SchedulePage() {
  const [sessions, setSessions] = useState<ScheduleSession[]>([])
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<ViewMode>('calendar')
  const [formOpen, setFormOpen] = useState(false)
  const [editSession, setEditSession] = useState<ScheduleSession | null>(null)

  const [courseFilter, setCourseFilter] = useState<CourseId | ''>('')
  const [staffFilter, setStaffFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState<SessionType | ''>('')

  const [listTypeFilter, setListTypeFilter] = useState<SessionType | ''>('')
  const [listCourseFilter, setListCourseFilter] = useState<CourseId | ''>('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [listPage, setListPage] = useState(1)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [scheduleSnap, usersSnap, studentsSnap] = await Promise.all([
        getDocs(query(collection(db, 'schedule'), orderBy('date', 'asc'))),
        getDocs(collection(db, 'users')),
        getDocs(collection(db, 'students')),
      ])

      setSessions(
        scheduleSnap.docs.map((d) =>
          parseSession(d.id, d.data() as Record<string, unknown>),
        ),
      )
      setStaff(
        usersSnap.docs
          .map((d) => parseStaff(d.id, d.data() as Record<string, unknown>))
          .filter((s): s is StaffMember => s !== null),
      )
      setStudents(
        studentsSnap.docs.map((d) =>
          parseStudent(d.id, d.data() as Record<string, unknown>),
        ),
      )
    } catch (err) {
      console.error('[SchedulePage]', err)
      setSessions([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const filteredForCalendar = useMemo(() => {
    return sessions.filter((s) => {
      if (courseFilter && s.courseId !== courseFilter) return false
      if (staffFilter && s.staffId !== staffFilter) return false
      if (typeFilter && s.type !== typeFilter) return false
      return true
    })
  }, [sessions, courseFilter, staffFilter, typeFilter])

  function openAddForm() {
    setEditSession(null)
    setFormOpen(true)
  }

  function openEditForm(session: ScheduleSession) {
    setEditSession(session)
    setFormOpen(true)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-jakarta text-2xl font-bold text-[#0B3D6B]">Schedule</h1>
          <p className="mt-1 font-inter text-sm text-[#5A6A7A]">
            Manage classes and consultations
          </p>
        </div>
        <button
          type="button"
          onClick={openAddForm}
          className="inline-flex items-center gap-2 rounded-lg bg-[#E8A020] px-4 py-2.5 font-jakarta text-sm font-bold text-[#0B3D6B] hover:bg-[#F5B942]"
        >
          <span className="ti ti-plus" aria-hidden="true" />
          Add Session
        </button>
      </div>

      <div className="flex flex-col gap-4 rounded-xl border border-[#DDE3EC] bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex rounded-lg border border-[#DDE3EC] p-1">
          <button
            type="button"
            onClick={() => setViewMode('calendar')}
            className={`rounded-md px-4 py-2 font-jakarta text-sm font-semibold transition-colors ${
              viewMode === 'calendar'
                ? 'bg-[#0B3D6B] text-white'
                : 'text-[#5A6A7A] hover:bg-[#F5F7FB]'
            }`}
          >
            Calendar View
          </button>
          <button
            type="button"
            onClick={() => setViewMode('list')}
            className={`rounded-md px-4 py-2 font-jakarta text-sm font-semibold transition-colors ${
              viewMode === 'list'
                ? 'bg-[#0B3D6B] text-white'
                : 'text-[#5A6A7A] hover:bg-[#F5F7FB]'
            }`}
          >
            List View
          </button>
        </div>

        <div className="flex flex-wrap gap-3">
          <select
            value={viewMode === 'calendar' ? typeFilter : listTypeFilter}
            onChange={(e) => {
              const v = e.target.value as SessionType | ''
              setTypeFilter(v)
              setListTypeFilter(v)
              setListPage(1)
            }}
            className="rounded-lg border border-[#DDE3EC] px-3 py-2 font-inter text-sm outline-none focus:border-[#E8A020]"
          >
            <option value="">All types</option>
            <option value="class">Class</option>
            <option value="consultation">Consultation</option>
            <option value="exam">Exam</option>
          </select>

          <select
            value={viewMode === 'calendar' ? courseFilter : listCourseFilter}
            onChange={(e) => {
              const v = e.target.value as CourseId | ''
              setCourseFilter(v)
              setListCourseFilter(v)
              setListPage(1)
            }}
            className="rounded-lg border border-[#DDE3EC] px-3 py-2 font-inter text-sm outline-none focus:border-[#E8A020]"
          >
            <option value="">All courses</option>
            {COURSES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>

          {viewMode === 'calendar' && (
            <select
              value={staffFilter}
              onChange={(e) => setStaffFilter(e.target.value)}
              className="rounded-lg border border-[#DDE3EC] px-3 py-2 font-inter text-sm outline-none focus:border-[#E8A020]"
            >
              <option value="">All staff</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.displayName}
                </option>
              ))}
            </select>
          )}

          {viewMode === 'list' && (
            <>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value)
                  setListPage(1)
                }}
                className="rounded-lg border border-[#DDE3EC] px-3 py-2 font-inter text-sm outline-none focus:border-[#E8A020]"
                placeholder="From"
              />
              <input
                type="date"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value)
                  setListPage(1)
                }}
                className="rounded-lg border border-[#DDE3EC] px-3 py-2 font-inter text-sm outline-none focus:border-[#E8A020]"
                placeholder="To"
              />
            </>
          )}
        </div>
      </div>

      {viewMode === 'calendar' ? (
        <CalendarView sessions={filteredForCalendar} loading={loading} />
      ) : (
        <ScheduleList
          sessions={sessions}
          students={students}
          loading={loading}
          page={listPage}
          onPageChange={setListPage}
          typeFilter={listTypeFilter}
          courseFilter={listCourseFilter}
          dateFrom={dateFrom}
          dateTo={dateTo}
          onEdit={openEditForm}
          onRefresh={loadData}
        />
      )}

      <SessionForm
        open={formOpen}
        onClose={() => {
          setFormOpen(false)
          setEditSession(null)
        }}
        session={editSession}
        staff={staff}
        students={students}
        onSaved={loadData}
      />
    </div>
  )
}
