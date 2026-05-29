'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { collection, doc, getDocs, orderBy, query, updateDoc } from 'firebase/firestore'
import dynamic from 'next/dynamic'
import { db } from '@/lib/firebase/client'
import { formatLKR } from '@/lib/payments/helpers'
import { parseStaff } from '@/lib/staff/helpers'
import {
  computePayrollStats,
  currentPeriodKey,
  formatPayrollAmount,
  getPeriodOptions,
  getSalaryTypeLabel,
  getStatusColor,
  getStatusLabel,
  parsePayroll,
} from '@/lib/payroll/helpers'
import PayrollForm from '@/components/payroll/PayrollForm'
import type { PayrollRecord, StaffMember } from '@/types'

const SalarySlip = dynamic(() => import('@/components/payroll/SalarySlip'), {
  ssr: false,
})

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
        <div className="mt-2 h-8 w-28 animate-pulse rounded bg-[#DDE3EC]" />
      ) : (
        <p className="mt-1 font-jakarta text-2xl font-bold text-[#0B3D6B]">{value}</p>
      )}
    </div>
  )
}

export default function PayrollPage() {
  const [records, setRecords] = useState<PayrollRecord[]>([])
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState(currentPeriodKey())
  const [page, setPage] = useState(1)
  const [formOpen, setFormOpen] = useState(false)
  const [editRecord, setEditRecord] = useState<PayrollRecord | null>(null)
  const [slipRecord, setSlipRecord] = useState<PayrollRecord | null>(null)

  const periodOptions = useMemo(() => getPeriodOptions(12), [])

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [payrollSnap, usersSnap] = await Promise.all([
        getDocs(query(collection(db, 'payroll'), orderBy('createdAt', 'desc'))),
        getDocs(collection(db, 'users')),
      ])
      setRecords(
        payrollSnap.docs.map((d) =>
          parsePayroll(d.id, d.data() as Record<string, unknown>),
        ),
      )
      setStaff(
        usersSnap.docs
          .map((d) => parseStaff(d.id, d.data() as Record<string, unknown>))
          .filter((s): s is StaffMember => s !== null),
      )
    } catch (err) {
      console.error('[PayrollPage]', err)
      setRecords([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const periodRecords = useMemo(
    () => records.filter((r) => r.period === period),
    [records, period],
  )

  const stats = useMemo(
    () => computePayrollStats(periodRecords),
    [periodRecords],
  )

  const totalPages = Math.max(1, Math.ceil(periodRecords.length / PAGE_SIZE))
  const pageItems = periodRecords.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  useEffect(() => {
    setPage(1)
  }, [period])

  async function markAsPaid(record: PayrollRecord) {
    await updateDoc(doc(db, 'payroll', record.id), { status: 'paid' })
    loadData()
  }

  function openEdit(record: PayrollRecord) {
    setEditRecord(record)
    setFormOpen(true)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-jakarta text-2xl font-bold text-[#0B3D6B]">Payroll</h1>
          <p className="mt-1 font-inter text-sm text-[#5A6A7A]">
            Staff salary management
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="rounded-lg border border-[#DDE3EC] bg-white px-3 py-2.5 font-inter text-sm outline-none focus:border-[#E8A020]"
          >
            {periodOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => {
              setEditRecord(null)
              setFormOpen(true)
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-[#E8A020] px-4 py-2.5 font-jakarta text-sm font-bold text-[#0B3D6B] hover:bg-[#F5B942]"
          >
            <span className="ti ti-plus" aria-hidden="true" />
            Process Payroll
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Payroll"
          value={formatLKR(stats.totalPayroll)}
          loading={loading}
        />
        <StatCard
          label="Staff Paid"
          value={String(stats.staffPaid)}
          loading={loading}
        />
        <StatCard
          label="Staff Pending"
          value={String(stats.staffPending)}
          loading={loading}
        />
        <StatCard
          label="Average Salary"
          value={formatLKR(stats.averageSalary)}
          loading={loading}
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-[#DDE3EC] bg-white">
        {loading ? (
          <div className="animate-pulse divide-y divide-[#DDE3EC]">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="flex gap-4 px-4 py-4">
                <div className="h-3 w-32 flex-1 rounded bg-[#DDE3EC]" />
                <div className="h-3 w-20 rounded bg-[#DDE3EC]" />
              </div>
            ))}
          </div>
        ) : periodRecords.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <span className="ti ti-report-money text-4xl text-[#DDE3EC]" aria-hidden="true" />
            <p className="mt-3 font-jakarta text-base font-semibold text-[#0B3D6B]">
              No payroll records for this period
            </p>
            <p className="mt-1 font-inter text-sm text-[#5A6A7A]">
              Click Process Payroll to add staff salaries.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-left text-sm">
              <thead>
                <tr className="border-b border-[#DDE3EC] bg-[#F5F7FB]">
                  {[
                    'Staff Name',
                    'Role',
                    'Salary Type',
                    'Base',
                    'Hours',
                    'Commission',
                    'Deductions',
                    'Net Pay',
                    'Status',
                    'Actions',
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 font-jakarta text-xs font-semibold uppercase tracking-wide text-[#5A6A7A]"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DDE3EC]">
                {pageItems.map((r) => (
                  <tr key={r.id} className="transition-colors hover:bg-[#F5F7FB]/60">
                    <td className="px-4 py-3 font-medium text-[#0D1B2A]">
                      {r.staffName}
                    </td>
                    <td className="px-4 py-3 capitalize text-[#5A6A7A]">
                      {r.role.replace(/([A-Z])/g, ' $1').trim()}
                    </td>
                    <td className="px-4 py-3 text-[#5A6A7A]">
                      {getSalaryTypeLabel(r.salaryType)}
                    </td>
                    <td className="px-4 py-3 text-[#5A6A7A]">
                      {formatPayrollAmount(r.baseSalary)}
                    </td>
                    <td className="px-4 py-3 text-[#5A6A7A]">
                      {r.hoursWorked ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-[#5A6A7A]">
                      {r.commission > 0 ? formatPayrollAmount(r.commission) : '—'}
                    </td>
                    <td className="px-4 py-3 text-[#5A6A7A]">
                      {formatPayrollAmount(r.deductions)}
                    </td>
                    <td className="px-4 py-3 font-semibold text-[#0B3D6B]">
                      {formatPayrollAmount(r.netPay)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${getStatusColor(r.status)}`}
                      >
                        {getStatusLabel(r.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setSlipRecord(r)}
                          className="rounded-lg px-2 py-1 text-xs font-semibold text-[#0B3D6B] hover:bg-[#0B3D6B]/10"
                        >
                          Slip
                        </button>
                        <button
                          type="button"
                          onClick={() => openEdit(r)}
                          className="rounded-lg px-2 py-1 text-xs font-semibold text-[#5A6A7A] hover:bg-[#F5F7FB]"
                        >
                          Edit
                        </button>
                        {r.status !== 'paid' && (
                          <button
                            type="button"
                            onClick={() => markAsPaid(r)}
                            className="rounded-lg px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
                          >
                            Mark Paid
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

      {!loading && periodRecords.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="font-inter text-sm text-[#5A6A7A]">
            Showing {(page - 1) * PAGE_SIZE + 1}–
            {Math.min(page * PAGE_SIZE, periodRecords.length)} of{' '}
            {periodRecords.length}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="rounded-lg border border-[#DDE3EC] px-3 py-1.5 text-sm text-[#5A6A7A] disabled:opacity-40"
            >
              Previous
            </button>
            <span className="flex items-center px-2 font-inter text-sm text-[#5A6A7A]">
              {page} / {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-lg border border-[#DDE3EC] px-3 py-1.5 text-sm text-[#5A6A7A] disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}

      <PayrollForm
        open={formOpen}
        onClose={() => {
          setFormOpen(false)
          setEditRecord(null)
        }}
        staff={staff}
        existingRecords={records}
        editRecord={editRecord}
        defaultPeriod={period}
        onSaved={loadData}
      />

      <SalarySlip
        record={slipRecord}
        open={!!slipRecord}
        onClose={() => setSlipRecord(null)}
      />
    </div>
  )
}
