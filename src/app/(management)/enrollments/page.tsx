'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { collection, getDocs, orderBy, query } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { auth } from '@/lib/firebase/client'
import {
  parseEnrollment,
  PROGRAM_LABEL_MAP,
  ENROLLMENT_STATUS_STYLES,
  PAYMENT_STATUS_STYLES,
  LOCATION_OPTIONS,
  formatLKR,
  formatEnrollmentDate,
} from '@/lib/enrollment/helpers'
import { useManagement } from '@/components/layout/ManagementContext'
import type { EnrollmentApplication, EnrollmentProgram, StudentLocation } from '@/types'

type StatusTab = 'pending' | 'confirmed' | 'rejected'
type ProgramFilter = 'all' | EnrollmentProgram
type LocationFilter = 'all' | StudentLocation

const STATUS_TABS: { id: StatusTab; label: string }[] = [
  { id: 'pending', label: 'Pending' },
  { id: 'confirmed', label: 'Approved' },
  { id: 'rejected', label: 'Rejected' },
]

function StatCard({
  label,
  value,
  color,
}: {
  label: string
  value: number | string
  color: string
}) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className={`mt-1 font-jakarta text-3xl font-bold ${color}`}>{value}</p>
    </div>
  )
}

function defaultStudentCode(existingCount: number): string {
  const year = new Date().getFullYear()
  return `EC-${year}-${String(existingCount + 1).padStart(3, '0')}`
}

export default function EnrollmentsPage() {
  const { user } = useManagement()
  const [enrollments, setEnrollments] = useState<EnrollmentApplication[]>([])
  const [loading, setLoading] = useState(true)
  const [statusTab, setStatusTab] = useState<StatusTab>('pending')
  const [programFilter, setProgramFilter] = useState<ProgramFilter>('all')
  const [locationFilter, setLocationFilter] = useState<LocationFilter>('all')
  const [viewApp, setViewApp] = useState<EnrollmentApplication | null>(null)
  const [approveTarget, setApproveTarget] = useState<EnrollmentApplication | null>(null)
  const [rejectTarget, setRejectTarget] = useState<EnrollmentApplication | null>(null)
  const [studentCode, setStudentCode] = useState('')
  const [approveLocation, setApproveLocation] = useState<StudentLocation>('ahangama')
  const [batchIntake, setBatchIntake] = useState(String(new Date().getFullYear()))
  const [rejectionReason, setRejectionReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [actionError, setActionError] = useState('')
  const [actionSuccess, setActionSuccess] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const snap = await getDocs(
        query(collection(db, 'enrollmentApplications'), orderBy('createdAt', 'desc')),
      )
      setEnrollments(
        snap.docs.map((d) => parseEnrollment(d.id, d.data() as Record<string, unknown>)),
      )
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const today = new Date().toISOString().slice(0, 10)

  const stats = useMemo(() => {
    const total = enrollments.length
    const pending = enrollments.filter((e) => e.status === 'pending').length
    const confirmed = enrollments.filter((e) => e.status === 'confirmed').length
    const paidToday = enrollments.filter(
      (e) => e.stripePaymentStatus === 'paid' && e.createdAt.slice(0, 10) === today,
    ).length
    return { total, pending, confirmed, paidToday }
  }, [enrollments, today])

  const filtered = useMemo(() => {
    return enrollments.filter((e) => {
      if (e.status !== statusTab) return false
      if (programFilter !== 'all' && e.program !== programFilter) return false
      if (locationFilter !== 'all' && e.location !== locationFilter) return false
      return true
    })
  }, [enrollments, statusTab, programFilter, locationFilter])

  function openApproveModal(enrollment: EnrollmentApplication) {
    setActionError('')
    setActionSuccess('')
    setApproveTarget(enrollment)
    setStudentCode(defaultStudentCode(enrollments.length))
    setApproveLocation(enrollment.location || 'ahangama')
    setBatchIntake(String(new Date().getFullYear()))
  }

  async function handleApprove() {
    if (!auth.currentUser || !approveTarget) return
    setActionError('')
    setSubmitting(true)
    try {
      const token = await auth.currentUser.getIdToken()
      const res = await fetch('/api/students/create-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          enrollmentId: approveTarget.id,
          studentCode: studentCode.trim(),
          location: approveLocation,
          batchIntake: batchIntake.trim(),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setActionError(data.error || 'Failed to create account')
        return
      }
      setActionSuccess(`Account created for ${approveTarget.firstName} ${approveTarget.lastName}`)
      setApproveTarget(null)
      await load()
    } catch {
      setActionError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleReject() {
    if (!auth.currentUser || !rejectTarget) return
    setActionError('')
    setSubmitting(true)
    try {
      const token = await auth.currentUser.getIdToken()
      const res = await fetch('/api/enrollment/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          enrollmentId: rejectTarget.id,
          rejectionReason: rejectionReason.trim(),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setActionError(data.error || 'Failed to reject')
        return
      }
      setActionSuccess(`Enrollment rejected for ${rejectTarget.firstName} ${rejectTarget.lastName}`)
      setRejectTarget(null)
      setRejectionReason('')
      await load()
    } catch {
      setActionError('Network error.')
    } finally {
      setSubmitting(false)
    }
  }

  const isStaff = user?.role === 'admin' || user?.role === 'owner' || user?.role === 'reception'
  const selectCls =
    'rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-700 outline-none focus:border-[#0B3D6B] bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200'

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="font-jakarta text-2xl font-bold text-[#0B3D6B] dark:text-white">
          Online Enrollments
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Review applications, approve and create student login accounts
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Applications" value={stats.total} color="text-[#0B3D6B]" />
        <StatCard label="Pending" value={stats.pending} color="text-amber-600" />
        <StatCard label="Approved" value={stats.confirmed} color="text-emerald-600" />
        <StatCard label="Paid Today" value={stats.paidToday} color="text-[#E8A020]" />
      </div>

      <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-1 dark:border-gray-700">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setStatusTab(tab.id)}
            className={`rounded-t-lg px-4 py-2 text-sm font-semibold transition-colors ${
              statusTab === tab.id
                ? 'border-b-2 border-[#E8A020] text-[#0B3D6B] dark:text-[#E8A020]'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <select
          className={selectCls}
          value={programFilter}
          onChange={(e) => setProgramFilter(e.target.value as ProgramFilter)}
        >
          <option value="all">All Programs</option>
          <option value="japan-ssw">Japan SSW</option>
          <option value="korea">Korea</option>
          <option value="china">China</option>
          <option value="ielts">IELTS</option>
          <option value="nvq">NVQ</option>
        </select>
        <select
          className={selectCls}
          value={locationFilter}
          onChange={(e) => setLocationFilter(e.target.value as LocationFilter)}
        >
          <option value="all">All Locations</option>
          {LOCATION_OPTIONS.map((loc) => (
            <option key={loc.value} value={loc.value}>
              {loc.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => void load()}
          className="ml-auto flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
        >
          <span className="ti ti-refresh" />
          Refresh
        </button>
      </div>

      {actionError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {actionError}
        </div>
      )}
      {actionSuccess && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {actionSuccess}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <span className="ti ti-loader-2 animate-spin text-2xl text-[#0B3D6B]" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-gray-100 bg-white py-16 text-center shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <span className="ti ti-clipboard-off text-4xl text-gray-300" />
          <p className="mt-3 text-sm text-gray-500">No {statusTab} enrollments</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((e) => (
            <div
              key={e.id}
              className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-jakarta text-lg font-bold text-[#0B3D6B] dark:text-white">
                    {e.firstName} {e.lastName}
                  </p>
                  <p className="text-sm text-gray-500">{e.email}</p>
                  <p className="text-sm text-gray-500">{e.phone}</p>
                </div>
                <span
                  className={`inline-flex shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${ENROLLMENT_STATUS_STYLES[e.status]}`}
                >
                  {e.status === 'confirmed' ? 'Approved' : e.status}
                </span>
              </div>

              <div className="mt-4 space-y-1 text-sm text-gray-600 dark:text-gray-300">
                <p>
                  <span className="font-medium">Course:</span> {PROGRAM_LABEL_MAP[e.program]}
                </p>
                <p>
                  <span className="font-medium">Paid:</span>{' '}
                  {e.totalPaid > 0 ? formatLKR(e.totalPaid) : '—'}
                </p>
                <p>
                  <span className="font-medium">Submitted:</span>{' '}
                  {formatEnrollmentDate(e.createdAt)}
                </p>
                <p>
                  <span
                    className={`inline-flex rounded-full border px-2 py-0.5 text-xs capitalize ${PAYMENT_STATUS_STYLES[e.stripePaymentStatus]}`}
                  >
                    Payment: {e.stripePaymentStatus}
                  </span>
                </p>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setViewApp(e)}
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                  View
                </button>
                {isStaff && e.status === 'pending' && !e.studentId && (
                  <>
                    <button
                      type="button"
                      onClick={() => openApproveModal(e)}
                      className="rounded-lg bg-[#E8A020] px-3 py-1.5 text-xs font-bold text-[#0B3D6B] hover:bg-[#d4911c]"
                    >
                      ✓ Approve & Create Account
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRejectTarget(e)
                        setRejectionReason('')
                        setActionError('')
                      }}
                      className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
                    >
                      ✗ Reject
                    </button>
                  </>
                )}
                {e.studentId && (
                  <span className="flex items-center gap-1 text-xs text-emerald-600">
                    <span className="ti ti-circle-check" />
                    Account active
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {approveTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setApproveTarget(null)} />
          <div className="relative z-10 w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-800">
            <h2 className="font-jakarta text-lg font-bold text-[#0B3D6B] dark:text-white">
              Approve & Create Account
            </h2>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
              {approveTarget.firstName} {approveTarget.lastName} · {approveTarget.email}
            </p>
            <p className="mt-1 text-xs text-gray-500">
              This will create a login account and send credentials via WhatsApp
            </p>

            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Student ID</label>
                <input
                  value={studentCode}
                  onChange={(ev) => setStudentCode(ev.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Location</label>
                <select
                  value={approveLocation}
                  onChange={(ev) => setApproveLocation(ev.target.value as StudentLocation)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                >
                  {LOCATION_OPTIONS.map((loc) => (
                    <option key={loc.value} value={loc.value}>
                      {loc.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">
                  Batch / Intake
                </label>
                <input
                  value={batchIntake}
                  onChange={(ev) => setBatchIntake(ev.target.value)}
                  placeholder="e.g. 2026"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                />
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setApproveTarget(null)}
                className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submitting || !studentCode.trim()}
                onClick={() => void handleApprove()}
                className="flex-1 rounded-xl bg-[#E8A020] py-2.5 text-sm font-bold text-[#0B3D6B] disabled:opacity-50"
              >
                {submitting ? 'Creating…' : 'Confirm & Create Account'}
              </button>
            </div>
          </div>
        </div>
      )}

      {rejectTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setRejectTarget(null)} />
          <div className="relative z-10 w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-800">
            <h2 className="font-jakarta text-lg font-bold text-red-600">Reject Enrollment</h2>
            <p className="mt-2 text-sm text-gray-600">
              {rejectTarget.firstName} {rejectTarget.lastName}
            </p>
            <div className="mt-4">
              <label className="mb-1 block text-xs font-medium text-gray-500">
                Reason (optional)
              </label>
              <textarea
                value={rejectionReason}
                onChange={(ev) => setRejectionReason(ev.target.value)}
                rows={3}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
              />
            </div>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setRejectTarget(null)}
                className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => void handleReject()}
                className="flex-1 rounded-xl border-2 border-red-500 py-2.5 text-sm font-bold text-red-600 disabled:opacity-50"
              >
                {submitting ? 'Rejecting…' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}

      {viewApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setViewApp(null)} />
          <div className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-800">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-jakarta text-lg font-bold text-[#0B3D6B] dark:text-white">
                Enrollment Application
              </h2>
              <button type="button" onClick={() => setViewApp(null)} className="rounded-full p-1.5 hover:bg-gray-100">
                <span className="ti ti-x text-gray-500" />
              </button>
            </div>
            <div className="space-y-3 text-sm">
              {[
                ['Name', `${viewApp.firstName} ${viewApp.lastName}`],
                ['Email', viewApp.email],
                ['Phone', viewApp.phone],
                ['Program', PROGRAM_LABEL_MAP[viewApp.program]],
                ['Location', viewApp.location],
                ['Amount Paid', viewApp.totalPaid > 0 ? formatLKR(viewApp.totalPaid) : '—'],
                ['Payment', viewApp.stripePaymentStatus],
                ['Status', viewApp.status === 'confirmed' ? 'Approved' : viewApp.status],
                ['Student ID', viewApp.studentId || '—'],
                ['Applied On', formatEnrollmentDate(viewApp.createdAt)],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4 border-b border-gray-50 pb-2">
                  <span className="font-medium text-gray-500">{label}</span>
                  <span className="text-right capitalize text-gray-800 dark:text-gray-200">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
