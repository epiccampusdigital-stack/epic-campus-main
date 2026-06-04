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
  formatLKR,
  formatEnrollmentDate,
} from '@/lib/enrollment/helpers'
import { useManagement } from '@/components/layout/ManagementContext'
import type { EnrollmentApplication, EnrollmentProgram, StudentLocation } from '@/types'

type StatusFilter = 'all' | 'pending' | 'confirmed' | 'rejected'
type ProgramFilter = 'all' | EnrollmentProgram
type LocationFilter = 'all' | StudentLocation

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
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className={`mt-1 font-jakarta text-3xl font-bold ${color}`}>{value}</p>
    </div>
  )
}

export default function EnrollmentsPage() {
  const { user } = useManagement()
  const [enrollments, setEnrollments] = useState<EnrollmentApplication[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [programFilter, setProgramFilter] = useState<ProgramFilter>('all')
  const [locationFilter, setLocationFilter] = useState<LocationFilter>('all')
  const [viewApp, setViewApp] = useState<EnrollmentApplication | null>(null)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [actionError, setActionError] = useState('')

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
      (e) =>
        e.stripePaymentStatus === 'paid' &&
        e.createdAt.slice(0, 10) === today,
    ).length
    return { total, pending, confirmed, paidToday }
  }, [enrollments, today])

  const filtered = useMemo(() => {
    return enrollments.filter((e) => {
      if (statusFilter !== 'all' && e.status !== statusFilter) return false
      if (programFilter !== 'all' && e.program !== programFilter) return false
      if (locationFilter !== 'all' && e.location !== locationFilter) return false
      return true
    })
  }, [enrollments, statusFilter, programFilter, locationFilter])

  async function handleCreateAccount(enrollment: EnrollmentApplication) {
    if (!auth.currentUser) return
    setActionError('')
    setConfirmingId(enrollment.id)
    try {
      const token = await auth.currentUser.getIdToken()
      const res = await fetch('/api/enrollment/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ enrollmentId: enrollment.id }),
      })
      const data = await res.json()
      if (!res.ok) {
        setActionError(data.error || 'Failed to create account')
        return
      }
      await load()
    } catch {
      setActionError('Network error. Please try again.')
    } finally {
      setConfirmingId(null)
    }
  }

  const isAdminOrOwner = user?.role === 'admin' || user?.role === 'owner'
  const [rejectingId, setRejectingId] = useState<string | null>(null)

  async function handleReject(enrollment: EnrollmentApplication) {
    if (!auth.currentUser) return
    setActionError('')
    setRejectingId(enrollment.id)
    try {
      const token = await auth.currentUser.getIdToken()
      const res = await fetch('/api/enrollment/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ enrollmentId: enrollment.id }),
      })
      if (!res.ok) {
        const data = await res.json()
        setActionError(data.error || 'Failed to reject')
        return
      }
      await load()
    } catch {
      setActionError('Network error.')
    } finally {
      setRejectingId(null)
    }
  }

  const selectCls =
    'rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-700 outline-none focus:border-[#0B3D6B] bg-white'

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div>
        <h1 className="font-jakarta text-2xl font-bold text-[#0B3D6B] dark:text-white">
          Online Enrollments
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage student enrollment applications from the website
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Applications" value={stats.total} color="text-[#0B3D6B]" />
        <StatCard label="Pending" value={stats.pending} color="text-amber-600" />
        <StatCard label="Confirmed" value={stats.confirmed} color="text-emerald-600" />
        <StatCard label="Paid Today" value={stats.paidToday} color="text-[#E8A020]" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          className={selectCls}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
        >
          <option value="all">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="confirmed">Confirmed</option>
          <option value="rejected">Rejected</option>
        </select>
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
          <option value="ahangama">Ahangama</option>
          <option value="galle">Galle</option>
          <option value="waduraba">Waduraba</option>
          <option value="pinnaduwa">Pinnaduwa</option>
        </select>
        <button
          type="button"
          onClick={load}
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

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <span className="ti ti-loader-2 animate-spin text-2xl text-[#0B3D6B]" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <span className="ti ti-clipboard-off text-4xl text-gray-300" />
            <p className="mt-3 text-sm text-gray-500">No enrollment applications found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-[#F5F7FB] dark:border-gray-700 dark:bg-gray-700/50">
                  {[
                    'Name',
                    'Program',
                    'Location',
                    'Amount Paid',
                    'Payment',
                    'Account',
                    'Date',
                    'Actions',
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                {filtered.map((e) => (
                  <tr
                    key={e.id}
                    className="transition-colors hover:bg-[#F5F7FB]/50 dark:hover:bg-gray-700/30"
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-[#0B3D6B] dark:text-white">
                        {e.firstName} {e.lastName}
                      </p>
                      <p className="text-xs text-gray-400">{e.email}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                      {PROGRAM_LABEL_MAP[e.program]}
                    </td>
                    <td className="px-4 py-3 capitalize text-gray-700 dark:text-gray-300">
                      {e.location}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-200">
                      {e.totalPaid > 0 ? formatLKR(e.totalPaid) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${PAYMENT_STATUS_STYLES[e.stripePaymentStatus]}`}
                      >
                        {e.stripePaymentStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${ENROLLMENT_STATUS_STYLES[e.status]}`}
                      >
                        {e.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                      {formatEnrollmentDate(e.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setViewApp(e)}
                          className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                        >
                          View
                        </button>
                        {!e.studentId && e.stripePaymentStatus === 'paid' && (
                          <button
                            type="button"
                            onClick={() => void handleCreateAccount(e)}
                            disabled={confirmingId === e.id}
                            className="rounded-lg bg-[#0B3D6B] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#0a3460] disabled:opacity-50"
                          >
                            {confirmingId === e.id ? (
                              <span className="ti ti-loader-2 animate-spin" />
                            ) : (
                              'Create Account'
                            )}
                          </button>
                        )}
                        {e.studentId && (
                          <span className="flex items-center gap-1 text-xs text-emerald-600">
                            <span className="ti ti-circle-check" />
                            Account Active
                          </span>
                        )}
                        {isAdminOrOwner && e.status !== 'rejected' && (
                          <button
                            type="button"
                            onClick={() => void handleReject(e)}
                            disabled={rejectingId === e.id}
                            className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                          >
                            {rejectingId === e.id ? (
                              <span className="ti ti-loader-2 animate-spin" />
                            ) : (
                              'Reject'
                            )}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* View Application Modal */}
      {viewApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setViewApp(null)}
          />
          <div className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-800">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-jakarta text-lg font-bold text-[#0B3D6B] dark:text-white">
                Enrollment Application
              </h2>
              <button
                type="button"
                onClick={() => setViewApp(null)}
                className="rounded-full p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <span className="ti ti-x text-gray-500" />
              </button>
            </div>

            <div className="space-y-3 text-sm">
              {[
                ['Name', `${viewApp.firstName} ${viewApp.lastName}`],
                ['Email', viewApp.email],
                ['Phone', viewApp.phone],
                ['Date of Birth', viewApp.dateOfBirth || '—'],
                ['Address', viewApp.address || '—'],
                ['Program', PROGRAM_LABEL_MAP[viewApp.program]],
                ['Location', viewApp.location],
                ['Batch Duration', viewApp.batchDuration],
                ['Amount Paid', viewApp.totalPaid > 0 ? formatLKR(viewApp.totalPaid) : '—'],
                ['Registration Fee', viewApp.registrationFeePaid ? '✅ Paid' : '❌ Not paid'],
                ['Course Fee', viewApp.courseFeePaid ? '✅ Paid' : '❌ Not paid'],
                ['Payment Status', viewApp.stripePaymentStatus],
                ['Application Status', viewApp.status],
                ['Student ID', viewApp.studentId || '—'],
                ['Reference', viewApp.id.slice(0, 16).toUpperCase()],
                ['Applied On', formatEnrollmentDate(viewApp.createdAt)],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4 border-b border-gray-50 pb-2">
                  <span className="font-medium text-gray-500">{label}</span>
                  <span className="text-right capitalize text-gray-800 dark:text-gray-200">
                    {value}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-6 flex gap-3">
              {!viewApp.studentId && viewApp.stripePaymentStatus === 'paid' && (
                <button
                  type="button"
                  onClick={() => { void handleCreateAccount(viewApp); setViewApp(null) }}
                  disabled={confirmingId === viewApp.id}
                  className="flex-1 rounded-xl bg-[#0B3D6B] py-2.5 text-sm font-semibold text-white hover:bg-[#0a3460]"
                >
                  Create Student Account
                </button>
              )}
              <button
                type="button"
                onClick={() => setViewApp(null)}
                className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
