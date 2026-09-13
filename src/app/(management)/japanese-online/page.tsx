'use client'

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { collection, getDocs, orderBy, query, where } from 'firebase/firestore'
import toast from 'react-hot-toast'
import { auth, db } from '@/lib/firebase/client'
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
import { isLessonReleased } from '@/lib/jp/drip'
import type {
  JpEnrollment,
  JpEnrollmentSource,
  JpFulfilment,
  JpLesson,
  JpLessonProgress,
  JpModule,
  JpOrder,
  JpSettings,
  Role,
} from '@/types'

async function authedJson<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await auth.currentUser?.getIdToken()
  const headers = new Headers(init?.headers)
  headers.set('Authorization', `Bearer ${token ?? ''}`)
  const res = await fetch(path, { ...init, headers })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { error?: string })?.error ?? `Request failed (${res.status})`)
  return data as T
}

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
  /** Firebase Auth UID — jpProgress is keyed by this, not the doc id. */
  uid?: string
}

interface CourseLessonLite extends JpLesson {
  moduleTitle: string
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
  const [courseLessons, setCourseLessons] = useState<CourseLessonLite[]>([])
  const [progressByUid, setProgressByUid] = useState<Record<string, JpLessonProgress[]>>({})
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [studentsSnap, courseEnrollments, modulesSnap] = await Promise.all([
        getDocs(query(collection(db, 'students'), where('enrollmentType', 'in', ['online', 'both']))),
        listJpEnrollmentsForCourse(JP_COURSE_ID),
        getDocs(query(collection(db, 'jpCourses', JP_COURSE_ID, 'modules'), orderBy('order'))),
      ])

      const studentRows: StudentLite[] = studentsSnap.docs.map((d) => {
        const data = d.data()
        return {
          id: d.id,
          name: String(data.name ?? ''),
          mobile: String(data.mobile ?? ''),
          uid: data.uid ? String(data.uid) : undefined,
        }
      })
      setRows(studentRows)

      const map: Record<string, JpEnrollment> = {}
      courseEnrollments.forEach((e) => {
        map[e.studentId] = e
      })
      setEnrollments(map)

      const moduleList = modulesSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<JpModule, 'id'>) }))
      const lessonEntries = await Promise.all(
        moduleList.map(async (m) => {
          const snap = await getDocs(
            query(collection(db, 'jpCourses', JP_COURSE_ID, 'modules', m.id, 'lessons'), orderBy('order')),
          )
          return snap.docs.map((d) => ({
            id: d.id,
            moduleTitle: m.title,
            ...(d.data() as Omit<JpLesson, 'id'>),
          }))
        }),
      )
      setCourseLessons(lessonEntries.flat())

      // jpProgress is keyed by Auth UID, not the students/{id} doc id — see
      // src/lib/jp/progress.ts. Staff can't read another student's jpProgress
      // under the client rules, so this goes through the Admin-SDK route,
      // batched into one call for every resolvable uid on this page.
      const uids = Array.from(new Set(studentRows.map((r) => r.uid).filter((u): u is string => Boolean(u))))
      if (uids.length > 0) {
        const token = await auth.currentUser?.getIdToken()
        const res = await fetch(`/api/jp/progress?uids=${encodeURIComponent(uids.join(','))}`, {
          headers: { Authorization: `Bearer ${token ?? ''}` },
        })
        const data = await res.json().catch(() => ({}))
        setProgressByUid(res.ok && data.progress ? data.progress : {})
      } else {
        setProgressByUid({})
      }
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
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead>
          <tr className="border-b border-[#DDE3EC] dark:border-white/10">
            {['Name', 'Phone', 'Enrollment Status', 'Expiry Date', 'Progress', 'Last Activity'].map((h) => (
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
            const progress = row.uid ? progressByUid[row.uid] ?? [] : []
            const releasedLessons = enrollment ? courseLessons.filter((l) => isLessonReleased(l, enrollment)) : []
            const completedCount = releasedLessons.filter((l) =>
              progress.some((p) => p.lessonId === l.id && p.completed),
            ).length
            const lastActivity = progress.reduce<string | null>((latest, p) => {
              if (!p.lastAt) return latest
              return !latest || p.lastAt > latest ? p.lastAt : latest
            }, null)
            const isExpanded = expandedId === row.id

            return (
              <Fragment key={row.id}>
                <tr
                  className="cursor-pointer hover:bg-[#F5F7FB] dark:hover:bg-white/5"
                  onClick={() => setExpandedId(isExpanded ? null : row.id)}
                >
                  <td className="px-4 py-3 font-medium text-[#0D1B2A] dark:text-white">
                    <span
                      className={`ti ${isExpanded ? 'ti-chevron-down' : 'ti-chevron-right'} mr-1.5 text-[#5A6A7A]`}
                      aria-hidden="true"
                    />
                    {row.name || '—'}
                  </td>
                  <td className="px-4 py-3 text-[#5A6A7A] dark:text-white/60">{row.mobile || '—'}</td>
                  <td className="px-4 py-3">
                    <StatusBadge enrollment={enrollment} />
                  </td>
                  <td className="px-4 py-3 text-[#5A6A7A] dark:text-white/60">
                    {enrollment?.expiresAt ? formatDate(enrollment.expiresAt) : 'No expiry'}
                  </td>
                  <td className="px-4 py-3 text-[#0D1B2A] dark:text-white">
                    {releasedLessons.length > 0 ? `${completedCount}/${releasedLessons.length}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-[#5A6A7A] dark:text-white/60">
                    {lastActivity ? formatDate(lastActivity) : 'Never'}
                  </td>
                </tr>
                {isExpanded && (
                  <tr>
                    <td colSpan={6} className="bg-[#F5F7FB] px-4 py-3 dark:bg-slate-900/40">
                      {!row.uid ? (
                        <p className="font-inter text-sm text-[#5A6A7A] dark:text-white/50">
                          No Firebase Auth UID on file for this student — progress can&apos;t be resolved.
                        </p>
                      ) : courseLessons.length === 0 ? (
                        <p className="font-inter text-sm text-[#5A6A7A] dark:text-white/50">No lessons in this course yet.</p>
                      ) : (
                        <div className="space-y-1.5">
                          {courseLessons.map((lesson) => {
                            const lessonProgress = progress.find((p) => p.lessonId === lesson.id)
                            const released = enrollment ? isLessonReleased(lesson, enrollment) : false
                            return (
                              <div
                                key={lesson.id}
                                className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2 dark:bg-slate-800"
                              >
                                <div className="min-w-0 flex-1">
                                  <p className="truncate font-inter text-sm text-[#0D1B2A] dark:text-white">
                                    {lesson.moduleTitle} · {lesson.order}. {lesson.title}
                                  </p>
                                  <p className="font-inter text-xs text-[#5A6A7A] dark:text-white/50">
                                    {!released
                                      ? 'Locked'
                                      : lessonProgress
                                        ? `${Math.round(lessonProgress.watchedSec)}s / ${Math.round(lessonProgress.durationSec)}s watched`
                                        : 'Not started'}
                                  </p>
                                </div>
                                {lessonProgress?.completed ? (
                                  <span className="ti ti-circle-check text-emerald-500" aria-hidden="true" />
                                ) : (
                                  <span className="font-inter text-xs text-[#5A6A7A] dark:text-white/40">—</span>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
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

function EmptyRow({ label }: { label: string }) {
  return <p className="px-1 py-3 font-inter text-sm text-[#5A6A7A] dark:text-white/50">{label}</p>
}

function JpSettingsPanel() {
  const [open, setOpen] = useState(false)
  const [settings, setSettings] = useState<JpSettings | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await authedJson<{ settings: JpSettings }>('/api/jp/settings')
      setSettings(data.settings)
    } catch (err) {
      console.error('[JpSettingsPanel] load', err)
      toast.error('Could not load settings.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open && !settings) void load()
  }, [open, settings, load])

  async function handleSave() {
    if (!settings) return
    setSaving(true)
    try {
      const data = await authedJson<{ settings: JpSettings }>('/api/jp/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })
      setSettings(data.settings)
      toast.success('Settings saved')
    } catch (err) {
      console.error('[JpSettingsPanel] save', err)
      toast.error('Could not save settings.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-xl border border-[#DDE3EC] bg-white dark:border-white/10 dark:bg-slate-800">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-5 py-4 text-left"
      >
        <span className={`ti ${open ? 'ti-chevron-down' : 'ti-chevron-right'} text-[#5A6A7A]`} aria-hidden="true" />
        <span className="font-jakarta text-sm font-bold text-[#0B3D6B] dark:text-white">
          Checkout settings (postage, bank details)
        </span>
      </button>

      {open && (
        <div className="space-y-4 border-t border-[#DDE3EC] px-5 py-4 dark:border-white/10">
          {loading || !settings ? (
            <div className="flex h-24 items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-[3px] border-[#0B3D6B] border-t-[#E8A020]" />
            </div>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="font-inter text-xs font-medium uppercase tracking-wide text-[#5A6A7A] dark:text-white/50">
                    Flat postage (LKR)
                  </label>
                  <input
                    type="number"
                    value={settings.postageFlatLKR}
                    onChange={(e) => setSettings({ ...settings, postageFlatLKR: Number(e.target.value) })}
                    className="w-full rounded-lg border border-[#DDE3EC] bg-white px-3 py-2 font-inter text-sm text-[#0D1B2A] dark:border-white/10 dark:bg-slate-900 dark:text-white"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="font-inter text-xs font-medium uppercase tracking-wide text-[#5A6A7A] dark:text-white/50">
                    Bank name
                  </label>
                  <input
                    type="text"
                    value={settings.bankName}
                    onChange={(e) => setSettings({ ...settings, bankName: e.target.value })}
                    className="w-full rounded-lg border border-[#DDE3EC] bg-white px-3 py-2 font-inter text-sm text-[#0D1B2A] dark:border-white/10 dark:bg-slate-900 dark:text-white"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="font-inter text-xs font-medium uppercase tracking-wide text-[#5A6A7A] dark:text-white/50">
                    Account name
                  </label>
                  <input
                    type="text"
                    value={settings.bankAccountName}
                    onChange={(e) => setSettings({ ...settings, bankAccountName: e.target.value })}
                    className="w-full rounded-lg border border-[#DDE3EC] bg-white px-3 py-2 font-inter text-sm text-[#0D1B2A] dark:border-white/10 dark:bg-slate-900 dark:text-white"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="font-inter text-xs font-medium uppercase tracking-wide text-[#5A6A7A] dark:text-white/50">
                    Account number
                  </label>
                  <input
                    type="text"
                    value={settings.bankAccountNumber}
                    onChange={(e) => setSettings({ ...settings, bankAccountNumber: e.target.value })}
                    className="w-full rounded-lg border border-[#DDE3EC] bg-white px-3 py-2 font-inter text-sm text-[#0D1B2A] dark:border-white/10 dark:bg-slate-900 dark:text-white"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="font-inter text-xs font-medium uppercase tracking-wide text-[#5A6A7A] dark:text-white/50">
                    Branch
                  </label>
                  <input
                    type="text"
                    value={settings.bankBranch}
                    onChange={(e) => setSettings({ ...settings, bankBranch: e.target.value })}
                    className="w-full rounded-lg border border-[#DDE3EC] bg-white px-3 py-2 font-inter text-sm text-[#0D1B2A] dark:border-white/10 dark:bg-slate-900 dark:text-white"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="font-inter text-xs font-medium uppercase tracking-wide text-[#5A6A7A] dark:text-white/50">
                  Dispatch promise text
                </label>
                <input
                  type="text"
                  value={settings.dispatchPromiseText}
                  onChange={(e) => setSettings({ ...settings, dispatchPromiseText: e.target.value })}
                  className="w-full rounded-lg border border-[#DDE3EC] bg-white px-3 py-2 font-inter text-sm text-[#0D1B2A] dark:border-white/10 dark:bg-slate-900 dark:text-white"
                />
              </div>
              <div className="space-y-1.5">
                <label className="font-inter text-xs font-medium uppercase tracking-wide text-[#5A6A7A] dark:text-white/50">
                  Refund policy text
                </label>
                <textarea
                  value={settings.refundPolicyText}
                  onChange={(e) => setSettings({ ...settings, refundPolicyText: e.target.value })}
                  rows={3}
                  className="w-full rounded-lg border border-[#DDE3EC] bg-white px-3 py-2 font-inter text-sm text-[#0D1B2A] dark:border-white/10 dark:bg-slate-900 dark:text-white"
                />
              </div>
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleSave()}
                className="rounded-lg bg-[#E8A020] px-4 py-2 font-jakarta text-sm font-bold text-[#0B3D6B] hover:bg-[#F5B942] disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save settings'}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function PaymentsTab() {
  const { hasRole } = useManagement()
  const canManageSettings = hasRole('admin') || hasRole('owner')

  const [orders, setOrders] = useState<JpOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await authedJson<{ orders: JpOrder[] }>('/api/jp/orders')
      setOrders(data.orders)
    } catch (err) {
      console.error('[PaymentsTab] load', err)
      toast.error('Could not load orders.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const awaitingVerification = orders.filter((o) => o.status === 'awaiting_verification')
  const paidOrders = orders
    .filter((o) => o.status === 'paid')
    .sort((a, b) => (b.paidAt ?? '').localeCompare(a.paidAt ?? ''))

  async function handleApprove(orderId: string) {
    setBusyId(orderId)
    try {
      await authedJson('/api/jp/orders/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId }),
      })
      toast.success('Order approved — enrollment granted')
      await load()
    } catch (err) {
      console.error('[PaymentsTab] approve', err)
      toast.error(err instanceof Error ? err.message : 'Could not approve order.')
    } finally {
      setBusyId(null)
    }
  }

  async function handleReject(orderId: string) {
    if (!rejectReason.trim()) {
      toast.error('Enter a reason.')
      return
    }
    setBusyId(orderId)
    try {
      await authedJson('/api/jp/orders/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, reason: rejectReason.trim() }),
      })
      toast.success('Order rejected')
      setRejectingId(null)
      setRejectReason('')
      await load()
    } catch (err) {
      console.error('[PaymentsTab] reject', err)
      toast.error('Could not reject order.')
    } finally {
      setBusyId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-[#0B3D6B] border-t-[#E8A020]" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-[#DDE3EC] bg-white p-5 dark:border-white/10 dark:bg-slate-800">
        <p className="font-jakarta text-sm font-bold text-[#0B3D6B] dark:text-white">
          Awaiting verification ({awaitingVerification.length})
        </p>
        {awaitingVerification.length === 0 ? (
          <EmptyRow label="Nothing awaiting verification." />
        ) : (
          <div className="mt-3 space-y-2">
            {awaitingVerification.map((o) => (
              <div key={o.id} className="rounded-lg border border-[#DDE3EC] px-4 py-3 dark:border-white/10">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-inter text-sm font-medium text-[#0D1B2A] dark:text-white">{o.deliveryName}</p>
                    <p className="font-inter text-xs text-[#5A6A7A] dark:text-white/50">
                      Ref {o.paymentRef} · LKR {o.totalLKR.toLocaleString()} · {formatDate(o.createdAt)}
                    </p>
                  </div>
                  {o.receiptUploadPath && (
                    <a
                      href={o.receiptUploadPath}
                      target="_blank"
                      rel="noreferrer"
                      className="font-inter text-xs text-[#1A6BAD] hover:underline"
                    >
                      View slip
                    </a>
                  )}
                  {rejectingId === o.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        placeholder="Reason"
                        className="rounded-lg border border-[#DDE3EC] px-2 py-1.5 font-inter text-xs dark:border-white/10 dark:bg-slate-900 dark:text-white"
                      />
                      <button
                        type="button"
                        disabled={busyId === o.id}
                        onClick={() => void handleReject(o.id)}
                        className="rounded-lg bg-red-600 px-3 py-1.5 font-jakarta text-xs font-bold text-white hover:bg-red-700 disabled:opacity-50"
                      >
                        Confirm
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setRejectingId(null)
                          setRejectReason('')
                        }}
                        className="font-inter text-xs text-[#5A6A7A] hover:text-[#0B3D6B] dark:text-white/50"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={busyId === o.id}
                        onClick={() => void handleApprove(o.id)}
                        className="rounded-lg bg-[#E8A020] px-3 py-1.5 font-jakarta text-xs font-bold text-[#0B3D6B] hover:bg-[#F5B942] disabled:opacity-50"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => setRejectingId(o.id)}
                        className="font-inter text-xs text-red-600 hover:underline dark:text-red-300"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-[#DDE3EC] bg-white dark:border-white/10 dark:bg-slate-800">
        <div className="px-5 pt-4">
          <p className="font-jakarta text-sm font-bold text-[#0B3D6B] dark:text-white">
            Paid orders ({paidOrders.length})
          </p>
        </div>
        {paidOrders.length === 0 ? (
          <div className="px-5 pb-4">
            <EmptyRow label="No paid orders yet." />
          </div>
        ) : (
          <table className="mt-3 w-full min-w-[560px] text-left text-sm">
            <thead>
              <tr className="border-b border-[#DDE3EC] dark:border-white/10">
                {['Student', 'Rail', 'Amount', 'Paid'].map((h) => (
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
              {paidOrders.map((o) => (
                <tr key={o.id}>
                  <td className="px-4 py-3 font-medium text-[#0D1B2A] dark:text-white">{o.deliveryName}</td>
                  <td className="px-4 py-3 capitalize text-[#5A6A7A] dark:text-white/60">{o.rail.replace('_', ' ')}</td>
                  <td className="px-4 py-3 text-[#5A6A7A] dark:text-white/60">LKR {o.totalLKR.toLocaleString()}</td>
                  <td className="px-4 py-3 text-[#5A6A7A] dark:text-white/60">{formatDate(o.paidAt ?? undefined)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {canManageSettings && <JpSettingsPanel />}
    </div>
  )
}

function FulfilmentTab() {
  const [rows, setRows] = useState<(JpFulfilment & { order: JpOrder | null })[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [dispatchingId, setDispatchingId] = useState<string | null>(null)
  const [postalRef, setPostalRef] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await authedJson<{ rows: (JpFulfilment & { order: JpOrder | null })[] }>('/api/jp/fulfilment')
      setRows(data.rows)
    } catch (err) {
      console.error('[FulfilmentTab] load', err)
      toast.error('Could not load fulfilment queue.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function handlePack(orderId: string) {
    setBusyId(orderId)
    try {
      await authedJson('/api/jp/fulfilment/pack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId }),
      })
      toast.success('Marked packed')
      await load()
    } catch (err) {
      console.error('[FulfilmentTab] pack', err)
      toast.error('Could not mark packed.')
    } finally {
      setBusyId(null)
    }
  }

  async function handleDispatch(orderId: string) {
    if (!postalRef.trim()) {
      toast.error('Enter a postal reference.')
      return
    }
    setBusyId(orderId)
    try {
      await authedJson('/api/jp/fulfilment/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, postalRef: postalRef.trim() }),
      })
      toast.success('Marked dispatched')
      setDispatchingId(null)
      setPostalRef('')
      await load()
    } catch (err) {
      console.error('[FulfilmentTab] dispatch', err)
      toast.error('Could not mark dispatched.')
    } finally {
      setBusyId(null)
    }
  }

  async function handleCollect(orderId: string) {
    setBusyId(orderId)
    try {
      await authedJson('/api/jp/fulfilment/collect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId }),
      })
      toast.success('Marked collected at campus')
      await load()
    } catch (err) {
      console.error('[FulfilmentTab] collect', err)
      toast.error('Could not mark collected.')
    } finally {
      setBusyId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-[#0B3D6B] border-t-[#E8A020]" />
      </div>
    )
  }

  const groups: { key: 'pending' | 'packed' | 'dispatched'; label: string }[] = [
    { key: 'pending', label: 'Pending' },
    { key: 'packed', label: 'Packed' },
    { key: 'dispatched', label: 'Dispatched' },
  ]

  const today = new Date().toISOString().slice(0, 10)
  const todaysDispatches = rows.filter((r) => r.status === 'dispatched' && (r.dispatchedAt ?? '').slice(0, 10) === today)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end print:hidden">
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-lg border border-[#DDE3EC] px-3 py-2 font-jakarta text-xs font-bold text-[#0B3D6B] hover:bg-[#F5F7FB] dark:border-white/10 dark:text-white dark:hover:bg-white/5"
        >
          <span className="ti ti-printer mr-1.5" aria-hidden="true" />
          Print today&apos;s dispatches ({todaysDispatches.length})
        </button>
      </div>

      {/* Print-only view — see the print:hidden wrapper below for the screen view. */}
      <div className="hidden print:block">
        <h2 className="font-jakarta text-lg font-bold">Dispatches — {today}</h2>
        <table className="mt-3 w-full text-left text-sm">
          <thead>
            <tr>
              {['Name', 'Address', 'District', 'Phone', 'Postal ref'].map((h) => (
                <th key={h} className="border-b border-black/20 px-2 py-1">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {todaysDispatches.map((r) => (
              <tr key={r.id}>
                <td className="border-b border-black/10 px-2 py-1">{r.order?.deliveryName}</td>
                <td className="border-b border-black/10 px-2 py-1">{r.order?.deliveryAddress}</td>
                <td className="border-b border-black/10 px-2 py-1">{r.order?.deliveryDistrict}</td>
                <td className="border-b border-black/10 px-2 py-1">{r.order?.deliveryPhone}</td>
                <td className="border-b border-black/10 px-2 py-1">{r.postalRef}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-6 print:hidden">
        {groups.map(({ key, label }) => {
          const groupRows = rows.filter((r) => r.status === key)
          return (
            <div key={key} className="rounded-xl border border-[#DDE3EC] bg-white p-5 dark:border-white/10 dark:bg-slate-800">
              <p className="font-jakarta text-sm font-bold text-[#0B3D6B] dark:text-white">
                {label} ({groupRows.length})
              </p>
              {groupRows.length === 0 ? (
                <EmptyRow label={`No orders ${label.toLowerCase()}.`} />
              ) : (
                <div className="mt-3 space-y-2">
                  {groupRows.map((row) => (
                    <div key={row.id} className="rounded-lg border border-[#DDE3EC] px-4 py-3 dark:border-white/10">
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="font-inter text-sm font-medium text-[#0D1B2A] dark:text-white">
                            {row.order?.deliveryName ?? '—'}
                          </p>
                          <p className="font-inter text-xs text-[#5A6A7A] dark:text-white/50">
                            {row.order?.deliveryAddress
                              ? `${row.order.deliveryAddress}, ${row.order.deliveryDistrict} · ${row.order.deliveryPhone}`
                              : `Collecting at campus · ${row.order?.deliveryPhone ?? ''}`}
                          </p>
                        </div>

                        {key === 'pending' && (
                          <button
                            type="button"
                            disabled={busyId === row.orderId}
                            onClick={() => void handlePack(row.orderId)}
                            className="rounded-lg bg-[#E8A020] px-3 py-1.5 font-jakarta text-xs font-bold text-[#0B3D6B] hover:bg-[#F5B942] disabled:opacity-50"
                          >
                            Mark packed
                          </button>
                        )}

                        {key === 'packed' && (
                          dispatchingId === row.orderId ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                value={postalRef}
                                onChange={(e) => setPostalRef(e.target.value)}
                                placeholder="Postal reference"
                                className="rounded-lg border border-[#DDE3EC] px-2 py-1.5 font-inter text-xs dark:border-white/10 dark:bg-slate-900 dark:text-white"
                              />
                              <button
                                type="button"
                                disabled={busyId === row.orderId}
                                onClick={() => void handleDispatch(row.orderId)}
                                className="rounded-lg bg-[#1A6BAD] px-3 py-1.5 font-jakarta text-xs font-bold text-white hover:bg-[#155a94] disabled:opacity-50"
                              >
                                Confirm dispatch
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setDispatchingId(null)
                                  setPostalRef('')
                                }}
                                className="font-inter text-xs text-[#5A6A7A] hover:text-[#0B3D6B] dark:text-white/50"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setDispatchingId(row.orderId)}
                                className="rounded-lg bg-[#1A6BAD] px-3 py-1.5 font-jakarta text-xs font-bold text-white hover:bg-[#155a94]"
                              >
                                Mark dispatched
                              </button>
                              <button
                                type="button"
                                disabled={busyId === row.orderId}
                                onClick={() => void handleCollect(row.orderId)}
                                className="rounded-lg border border-[#DDE3EC] px-3 py-1.5 font-jakarta text-xs font-bold text-[#0B3D6B] hover:bg-[#F5F7FB] disabled:opacity-50 dark:border-white/10 dark:text-white dark:hover:bg-white/5"
                              >
                                Collected at campus
                              </button>
                            </div>
                          )
                        )}

                        {key === 'dispatched' && (
                          <span className="font-inter text-xs text-[#5A6A7A] dark:text-white/50">
                            Postal ref: {row.postalRef} · {formatDate(row.dispatchedAt ?? undefined)}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
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
        {activeTab === 'payments' && <PaymentsTab />}
        {activeTab === 'fulfilment' && <FulfilmentTab />}
        {activeTab === 'campus-sessions' && <ComingSoon />}
        {activeTab === 'support' && <ComingSoon />}
      </div>
    </div>
  )
}
