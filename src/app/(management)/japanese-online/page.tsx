'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { collection, getDocs, query, where } from 'firebase/firestore'
import toast from 'react-hot-toast'
import { db } from '@/lib/firebase/client'
import { useManagement } from '@/components/layout/ManagementContext'
import CourseBuilder from '@/components/jp/CourseBuilder'
import { formatDate } from '@/lib/students/helpers'
import {
  extendJpEnrollment,
  getJpEnrollment,
  grantJpEnrollment,
  isJpEnrollmentActive,
  listJpEnrollmentsForCourse,
  revokeJpEnrollment,
} from '@/lib/jp/enrollments'
import type { JpEnrollment, JpEnrollmentSource, Role } from '@/types'

// Course builder (and a real course catalog) arrives in a later phase — for now
// every grant/revoke/extend on this page targets a single hard-coded course.
const JP_COURSE_ID = 'jft-foundation'

type TabKey =
  | 'students'
  | 'access'
  | 'course-builder'
  | 'payments'
  | 'fulfilment'
  | 'campus-sessions'
  | 'support'

interface TabDef {
  key: TabKey
  label: string
  roles: Role[]
}

const TAB_DEFS: TabDef[] = [
  { key: 'students', label: 'Students', roles: ['admin', 'owner', 'teacher'] },
  { key: 'access', label: 'Access', roles: ['admin', 'owner'] },
  { key: 'course-builder', label: 'Course builder', roles: ['admin', 'owner', 'teacher'] },
  { key: 'payments', label: 'Payments', roles: ['admin', 'owner', 'accountant'] },
  { key: 'fulfilment', label: 'Fulfilment', roles: ['admin', 'owner', 'reception'] },
  { key: 'campus-sessions', label: 'Campus sessions', roles: ['admin', 'owner', 'teacher'] },
  { key: 'support', label: 'Support', roles: ['admin', 'owner', 'teacher'] },
]

const PAGE_ROLES: Role[] = ['admin', 'owner', 'teacher', 'accountant', 'reception']

interface StudentLite {
  id: string
  name: string
  mobile: string
}

function tabButtonClasses(active: boolean): string {
  const base = 'px-4 py-2.5 font-jakarta text-sm font-semibold border-b-2 transition-colors duration-200'
  return active
    ? `${base} border-[#E8A020] text-[#0B3D6B] dark:text-[#E8A020]`
    : `${base} border-transparent text-[#5A6A7A] dark:text-white/50 hover:text-[#0B3D6B] dark:hover:text-white`
}

function StatusBadge({ enrollment }: { enrollment?: JpEnrollment | null }) {
  if (!enrollment) {
    return (
      <span className="inline-flex rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs font-medium text-gray-600 dark:border-white/10 dark:bg-white/5 dark:text-white/50">
        No enrollment
      </span>
    )
  }
  const active = isJpEnrollmentActive(enrollment)
  const label = active
    ? 'Active'
    : enrollment.status === 'expired'
      ? 'Expired'
      : enrollment.status === 'revoked'
        ? 'Revoked'
        : 'Inactive'
  const styles = active
    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-200'
    : 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-200'
  return <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${styles}`}>{label}</span>
}

function ComingSoon() {
  return (
    <div className="flex h-64 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[#DDE3EC] text-center dark:border-white/10">
      <span className="ti ti-clock-hour-4 text-2xl text-[#5A6A7A]" aria-hidden="true" />
      <p className="font-inter text-sm text-[#5A6A7A] dark:text-white/50">Coming in a later phase</p>
    </div>
  )
}

function StudentsTab() {
  const [rows, setRows] = useState<StudentLite[]>([])
  const [enrollments, setEnrollments] = useState<Record<string, JpEnrollment>>({})
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [studentsSnap, courseEnrollments] = await Promise.all([
        getDocs(query(collection(db, 'students'), where('enrollmentType', 'in', ['online', 'both']))),
        listJpEnrollmentsForCourse(JP_COURSE_ID),
      ])
      setRows(
        studentsSnap.docs.map((d) => {
          const data = d.data()
          return { id: d.id, name: String(data.name ?? ''), mobile: String(data.mobile ?? '') }
        }),
      )
      const map: Record<string, JpEnrollment> = {}
      courseEnrollments.forEach((e) => {
        map[e.studentId] = e
      })
      setEnrollments(map)
    } catch (err) {
      console.error('[JapaneseOnlinePage] StudentsTab load', err)
      toast.error('Could not load online students.')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-[#0B3D6B] border-t-[#E8A020]" />
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[#DDE3EC] text-center dark:border-white/10">
        <span className="ti ti-users text-2xl text-[#5A6A7A]" aria-hidden="true" />
        <p className="font-inter text-sm text-[#5A6A7A] dark:text-white/50">No online students yet</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-[#DDE3EC] bg-white dark:border-white/10 dark:bg-slate-800">
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead>
          <tr className="border-b border-[#DDE3EC] dark:border-white/10">
            {['Name', 'Phone', 'Enrollment Status', 'Expiry Date'].map((h) => (
              <th
                key={h}
                className="px-4 py-3 font-jakarta text-xs font-semibold uppercase text-[#5A6A7A] dark:text-white/50"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#DDE3EC] dark:divide-white/10">
          {rows.map((row) => {
            const enrollment = enrollments[row.id]
            return (
              <tr key={row.id}>
                <td className="px-4 py-3 font-medium text-[#0D1B2A] dark:text-white">{row.name || '—'}</td>
                <td className="px-4 py-3 text-[#5A6A7A] dark:text-white/60">{row.mobile || '—'}</td>
                <td className="px-4 py-3">
                  <StatusBadge enrollment={enrollment} />
                </td>
                <td className="px-4 py-3 text-[#5A6A7A] dark:text-white/60">
                  {enrollment?.expiresAt ? formatDate(enrollment.expiresAt) : 'No expiry'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function AccessTab({ grantedBy }: { grantedBy: string }) {
  const [allStudents, setAllStudents] = useState<StudentLite[]>([])
  const [loadingStudents, setLoadingStudents] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [enrollment, setEnrollment] = useState<JpEnrollment | null>(null)
  const [loadingEnrollment, setLoadingEnrollment] = useState(false)
  const [source, setSource] = useState<JpEnrollmentSource>('admin')
  const [expiryDate, setExpiryDate] = useState('')
  const [extendDate, setExtendDate] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoadingStudents(true)
      try {
        const snap = await getDocs(collection(db, 'students'))
        if (cancelled) return
        setAllStudents(
          snap.docs.map((d) => {
            const data = d.data()
            return { id: d.id, name: String(data.name ?? ''), mobile: String(data.mobile ?? '') }
          }),
        )
      } catch (err) {
        console.error('[JapaneseOnlinePage] AccessTab load students', err)
        toast.error('Could not load students.')
      } finally {
        if (!cancelled) setLoadingStudents(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return []
    return allStudents
      .filter((s) => s.name.toLowerCase().includes(q) || s.mobile.includes(q))
      .slice(0, 20)
  }, [allStudents, search])

  const selectedStudent = allStudents.find((s) => s.id === selectedId) ?? null

  const loadEnrollment = useCallback(async (studentId: string) => {
    setLoadingEnrollment(true)
    try {
      const e = await getJpEnrollment(studentId, JP_COURSE_ID)
      setEnrollment(e)
    } catch (err) {
      console.error('[JapaneseOnlinePage] AccessTab load enrollment', err)
      toast.error('Could not load enrollment.')
      setEnrollment(null)
    } finally {
      setLoadingEnrollment(false)
    }
  }, [])

  function selectStudent(id: string) {
    setSelectedId(id)
    setSearch('')
    setExpiryDate('')
    setExtendDate('')
    void loadEnrollment(id)
  }

  async function handleGrant() {
    if (!selectedStudent) return
    setBusy(true)
    try {
      await grantJpEnrollment({
        studentId: selectedStudent.id,
        courseId: JP_COURSE_ID,
        source,
        grantedBy,
        expiresAt: expiryDate ? new Date(expiryDate).toISOString() : null,
      })
      toast.success(`Access granted to ${selectedStudent.name}`)
      await loadEnrollment(selectedStudent.id)
    } catch (err) {
      console.error('[JapaneseOnlinePage] grant', err)
      toast.error('Could not grant access.')
    } finally {
      setBusy(false)
    }
  }

  async function handleRevoke() {
    if (!selectedStudent) return
    setBusy(true)
    try {
      await revokeJpEnrollment(selectedStudent.id, JP_COURSE_ID, grantedBy)
      toast.success(`Access revoked for ${selectedStudent.name}`)
      await loadEnrollment(selectedStudent.id)
    } catch (err) {
      console.error('[JapaneseOnlinePage] revoke', err)
      toast.error('Could not revoke access.')
    } finally {
      setBusy(false)
    }
  }

  async function handleExtend() {
    if (!selectedStudent || !extendDate) return
    setBusy(true)
    try {
      await extendJpEnrollment(selectedStudent.id, JP_COURSE_ID, new Date(extendDate).toISOString())
      toast.success(`Expiry extended for ${selectedStudent.name}`)
      await loadEnrollment(selectedStudent.id)
    } catch (err) {
      console.error('[JapaneseOnlinePage] extend', err)
      toast.error('Could not extend access.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[#DDE3EC] bg-white p-5 dark:border-white/10 dark:bg-slate-800">
        <label className="font-inter text-xs font-medium uppercase tracking-wide text-[#5A6A7A] dark:text-white/50">
          Search student
        </label>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or phone…"
          className="mt-1.5 w-full rounded-lg border border-[#DDE3EC] bg-white px-3 py-2 font-inter text-sm text-[#0D1B2A] focus:border-[#1A6BAD] focus:outline-none dark:border-white/10 dark:bg-slate-900 dark:text-white"
        />
        {loadingStudents && <p className="mt-2 font-inter text-xs text-[#5A6A7A] dark:text-white/40">Loading students…</p>}
        {matches.length > 0 && (
          <ul className="mt-2 max-h-56 divide-y divide-[#DDE3EC] overflow-y-auto rounded-lg border border-[#DDE3EC] dark:divide-white/10 dark:border-white/10">
            {matches.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => selectStudent(s.id)}
                  className="flex w-full items-center justify-between px-3 py-2 text-left font-inter text-sm text-[#0D1B2A] hover:bg-[#F5F7FB] dark:text-white dark:hover:bg-white/5"
                >
                  <span>{s.name || '—'}</span>
                  <span className="text-xs text-[#5A6A7A] dark:text-white/50">{s.mobile}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {selectedStudent && (
        <div className="rounded-xl border border-[#DDE3EC] bg-white p-5 dark:border-white/10 dark:bg-slate-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-jakarta text-sm font-bold text-[#0B3D6B] dark:text-white">{selectedStudent.name}</p>
              <p className="font-inter text-xs text-[#5A6A7A] dark:text-white/60">{selectedStudent.mobile}</p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedId(null)}
              className="font-inter text-xs text-[#5A6A7A] hover:text-[#0B3D6B] dark:text-white/50 dark:hover:text-white"
            >
              Change
            </button>
          </div>

          <div className="mt-4 border-t border-[#DDE3EC] pt-4 dark:border-white/10">
            {loadingEnrollment ? (
              <p className="font-inter text-sm text-[#5A6A7A] dark:text-white/50">Loading enrollment…</p>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <StatusBadge enrollment={enrollment} />
                <span className="font-inter text-xs text-[#5A6A7A] dark:text-white/60">
                  {enrollment?.expiresAt
                    ? `Expires ${formatDate(enrollment.expiresAt)}`
                    : enrollment
                      ? 'No expiry'
                      : 'No JP enrollment yet'}
                </span>
              </div>
            )}
          </div>

          <div className="mt-5 grid gap-5 sm:grid-cols-3">
            <div className="space-y-2">
              <p className="font-jakarta text-xs font-bold uppercase text-[#5A6A7A] dark:text-white/50">Grant</p>
              <select
                value={source}
                onChange={(e) => setSource(e.target.value as JpEnrollmentSource)}
                className="w-full rounded-lg border border-[#DDE3EC] bg-white px-3 py-2 font-inter text-sm text-[#0D1B2A] dark:border-white/10 dark:bg-slate-900 dark:text-white"
              >
                <option value="admin">Admin</option>
              </select>
              <input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="w-full rounded-lg border border-[#DDE3EC] bg-white px-3 py-2 font-inter text-sm text-[#0D1B2A] dark:border-white/10 dark:bg-slate-900 dark:text-white"
              />
              <p className="font-inter text-[11px] text-[#5A6A7A] dark:text-white/40">Leave blank for no expiry.</p>
              <button
                type="button"
                disabled={busy}
                onClick={handleGrant}
                className="w-full rounded-lg bg-[#E8A020] px-3 py-2 font-jakarta text-sm font-bold text-[#0B3D6B] hover:bg-[#F5B942] disabled:opacity-50"
              >
                Grant access
              </button>
            </div>

            <div className="space-y-2">
              <p className="font-jakarta text-xs font-bold uppercase text-[#5A6A7A] dark:text-white/50">Revoke</p>
              <p className="font-inter text-[11px] text-[#5A6A7A] dark:text-white/40">
                Immediately ends this student&apos;s access.
              </p>
              <button
                type="button"
                disabled={busy || !enrollment}
                onClick={handleRevoke}
                className="w-full rounded-lg border border-red-300 px-3 py-2 font-jakarta text-sm font-bold text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-900/20"
              >
                Revoke access
              </button>
            </div>

            <div className="space-y-2">
              <p className="font-jakarta text-xs font-bold uppercase text-[#5A6A7A] dark:text-white/50">Extend</p>
              <input
                type="date"
                value={extendDate}
                onChange={(e) => setExtendDate(e.target.value)}
                className="w-full rounded-lg border border-[#DDE3EC] bg-white px-3 py-2 font-inter text-sm text-[#0D1B2A] dark:border-white/10 dark:bg-slate-900 dark:text-white"
              />
              <button
                type="button"
                disabled={busy || !enrollment || !extendDate}
                onClick={handleExtend}
                className="w-full rounded-lg border border-[#1A6BAD] px-3 py-2 font-jakarta text-sm font-bold text-[#1A6BAD] hover:bg-[#1A6BAD]/10 disabled:opacity-50"
              >
                Extend expiry
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function JapaneseOnlinePage() {
  const router = useRouter()
  const { user, loading: authLoading, hasRole } = useManagement()
  const [activeTab, setActiveTab] = useState<TabKey | null>(null)

  const isAuthorised = PAGE_ROLES.some((r) => hasRole(r))

  useEffect(() => {
    if (authLoading || !user) return
    if (!isAuthorised) {
      router.replace('/dashboard')
    }
  }, [authLoading, user, isAuthorised, router])

  const visibleTabs = useMemo(() => TAB_DEFS.filter((t) => t.roles.some((r) => hasRole(r))), [hasRole])

  useEffect(() => {
    if (visibleTabs.length === 0) return
    if (!activeTab || !visibleTabs.some((t) => t.key === activeTab)) {
      setActiveTab(visibleTabs[0].key)
    }
  }, [visibleTabs, activeTab])

  if (authLoading || !user) return null

  if (!isAuthorised) {
    return (
      <div className="flex h-full min-h-[50vh] flex-col items-center justify-center gap-2 text-center">
        <span className="ti ti-lock text-3xl text-[#5A6A7A]" aria-hidden="true" />
        <p className="font-jakarta text-lg font-bold text-[#0B3D6B] dark:text-white">Not authorised</p>
        <p className="font-inter text-sm text-[#5A6A7A] dark:text-white/60">
          You don&apos;t have access to the Japanese Online section.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-jakarta text-2xl font-bold text-[#0B3D6B] dark:text-white">Japanese Online</h1>
        <p className="mt-1 font-inter text-sm text-[#5A6A7A] dark:text-white/60">
          Manage the Japanese online course — students, access, and course operations
        </p>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-[#DDE3EC] dark:border-white/10">
        {visibleTabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={tabButtonClasses(activeTab === tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div>
        {activeTab === 'students' && <StudentsTab />}
        {activeTab === 'access' && <AccessTab grantedBy={user.uid} />}
        {activeTab === 'course-builder' && (
          <CourseBuilder courseId={JP_COURSE_ID} canEdit={hasRole('admin') || hasRole('owner')} />
        )}
        {activeTab === 'payments' && <ComingSoon />}
        {activeTab === 'fulfilment' && <ComingSoon />}
        {activeTab === 'campus-sessions' && <ComingSoon />}
        {activeTab === 'support' && <ComingSoon />}
      </div>
    </div>
  )
}
