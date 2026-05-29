'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { collection, getDocs, orderBy, query } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { COURSES } from '@/lib/constants/courses'
import { parseStudent } from '@/lib/students/helpers'
import {
  parsePayment,
  computePaymentStats,
  formatLKR,
} from '@/lib/payments/helpers'
import PaymentForm from '@/components/payments/PaymentForm'
import PaymentTable, {
  PaymentTableEmpty,
  PaymentTableMeta,
} from '@/components/payments/PaymentTable'
import dynamic from 'next/dynamic'
import type { CourseId, Payment, PaymentMethod, PaymentStatus, Student } from '@/types'

const ReceiptModal = dynamic(() => import('@/components/payments/ReceiptModal'), {
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

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [courseFilter, setCourseFilter] = useState<CourseId | ''>('')
  const [methodFilter, setMethodFilter] = useState<PaymentMethod | ''>('')
  const [statusFilter, setStatusFilter] = useState<PaymentStatus | ''>('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)
  const [formOpen, setFormOpen] = useState(false)
  const [editPayment, setEditPayment] = useState<Payment | null>(null)
  const [receiptPayment, setReceiptPayment] = useState<Payment | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [paymentsSnap, studentsSnap] = await Promise.all([
        getDocs(query(collection(db, 'payments'), orderBy('createdAt', 'desc'))),
        getDocs(collection(db, 'students')),
      ])
      setPayments(
        paymentsSnap.docs.map((d) =>
          parsePayment(d.id, d.data() as Record<string, unknown>),
        ),
      )
      setStudents(
        studentsSnap.docs.map((d) =>
          parseStudent(d.id, d.data() as Record<string, unknown>),
        ),
      )
    } catch (err) {
      console.error('[PaymentsPage]', err)
      setPayments([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const stats = useMemo(() => computePaymentStats(payments), [payments])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return payments.filter((p) => {
      if (courseFilter && p.courseId !== courseFilter) return false
      if (methodFilter && p.method !== methodFilter) return false
      if (statusFilter && p.status !== statusFilter) return false
      if (dateFrom && p.paymentDate.slice(0, 10) < dateFrom) return false
      if (dateTo && p.paymentDate.slice(0, 10) > dateTo) return false
      if (!q) return true
      return (
        p.studentName.toLowerCase().includes(q) ||
        p.receiptNumber.toLowerCase().includes(q) ||
        (p.studentCode?.toLowerCase().includes(q) ?? false)
      )
    })
  }, [payments, search, courseFilter, methodFilter, statusFilter, dateFrom, dateTo])

  useEffect(() => {
    setPage(1)
  }, [search, courseFilter, methodFilter, statusFilter, dateFrom, dateTo])

  const paginated = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return filtered.slice(start, start + PAGE_SIZE)
  }, [filtered, page])

  function openAdd() {
    setEditPayment(null)
    setFormOpen(true)
  }

  function openEdit(payment: Payment) {
    setEditPayment(payment)
    setFormOpen(true)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-jakarta text-2xl font-bold text-[#0D1B2A]">Payments</h2>
          <p className="font-inter text-sm text-[#5A6A7A]">Track all fee collections</p>
        </div>
        <button
          type="button"
          onClick={openAdd}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#E8A020] px-5 py-2.5 font-jakarta text-sm font-bold text-[#0B3D6B] hover:bg-[#F5B942]"
        >
          <span className="ti ti-plus" aria-hidden="true" />
          Add Payment
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Today's Collection"
          value={formatLKR(stats.todayCollection)}
          loading={loading}
        />
        <StatCard
          label="This Month"
          value={formatLKR(stats.monthCollection)}
          loading={loading}
        />
        <StatCard
          label="Pending"
          value={String(stats.pendingCount)}
          loading={loading}
        />
        <StatCard
          label="Total Collected"
          value={formatLKR(stats.totalCollected)}
          loading={loading}
        />
      </div>

      <div className="rounded-xl border border-[#DDE3EC] bg-white p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <div className="relative xl:col-span-2">
            <span
              className="ti ti-search absolute left-3 top-1/2 -translate-y-1/2 text-[#5A6A7A]"
              aria-hidden="true"
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search student or receipt…"
              className="w-full rounded-lg border border-[#DDE3EC] py-2.5 pl-10 pr-3 font-inter text-base outline-none focus:border-[#E8A020] sm:text-sm"
            />
          </div>
          <select
            value={courseFilter}
            onChange={(e) => setCourseFilter(e.target.value as CourseId | '')}
            className="rounded-lg border border-[#DDE3EC] px-3 py-2.5 font-inter text-sm outline-none focus:border-[#E8A020]"
          >
            <option value="">All courses</option>
            {COURSES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
          <select
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value as PaymentMethod | '')}
            className="rounded-lg border border-[#DDE3EC] px-3 py-2.5 font-inter text-sm outline-none focus:border-[#E8A020]"
          >
            <option value="">All methods</option>
            <option value="cash">Cash</option>
            <option value="bank-transfer">Bank Transfer</option>
            <option value="stripe">Stripe</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as PaymentStatus | '')}
            className="rounded-lg border border-[#DDE3EC] px-3 py-2.5 font-inter text-sm outline-none focus:border-[#E8A020]"
          >
            <option value="">All statuses</option>
            <option value="paid">Paid</option>
            <option value="partial">Partial</option>
            <option value="pending">Pending</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="rounded-lg border border-[#DDE3EC] px-3 py-2.5 font-inter text-sm outline-none focus:border-[#E8A020]"
            aria-label="From date"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="rounded-lg border border-[#DDE3EC] px-3 py-2.5 font-inter text-sm outline-none focus:border-[#E8A020]"
            aria-label="To date"
          />
        </div>
      </div>

      {!loading && filtered.length === 0 ? (
        <PaymentTableEmpty onAdd={openAdd} />
      ) : (
        <>
          <PaymentTable
            payments={paginated}
            loading={loading}
            onViewReceipt={setReceiptPayment}
            onEdit={openEdit}
          />
          {!loading && filtered.length > 0 && (
            <PaymentTableMeta
              total={filtered.length}
              page={page}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
            />
          )}
        </>
      )}

      <PaymentForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        payment={editPayment}
        students={students}
        onSaved={loadData}
      />

      <ReceiptModal
        payment={receiptPayment}
        open={!!receiptPayment}
        onClose={() => setReceiptPayment(null)}
      />
    </div>
  )
}
