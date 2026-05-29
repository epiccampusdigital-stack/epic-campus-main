'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import {
  formatAmount,
  formatPaymentDate,
  getMethodLabel,
  getTypeLabel,
} from '@/lib/payments/helpers'
import { parsePayment } from '@/lib/payments/helpers'
import { computePaymentSummary } from '@/lib/student/portal'
import { useStudentPortal } from '@/components/student/StudentContext'
import type { Payment } from '@/types'

const ReceiptModal = dynamic(() => import('@/components/payments/ReceiptModal'), {
  ssr: false,
})

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#DDE3EC] bg-white p-5">
      <p className="font-inter text-xs font-medium uppercase tracking-wide text-[#5A6A7A]">
        {label}
      </p>
      <p className="mt-1 font-jakarta text-2xl font-bold text-[#0B3D6B]">{value}</p>
    </div>
  )
}

export default function MyPaymentsPage() {
  const { student } = useStudentPortal()
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [receiptPayment, setReceiptPayment] = useState<Payment | null>(null)

  useEffect(() => {
    if (!student) return

    async function load() {
      setLoading(true)
      try {
        const snap = await getDocs(
          query(
            collection(db, 'payments'),
            where('studentId', '==', student!.id),
          ),
        )
        const list = snap.docs
          .map((d) => parsePayment(d.id, d.data() as Record<string, unknown>))
          .sort((a, b) => b.paymentDate.localeCompare(a.paymentDate))
        setPayments(list)
      } catch (err) {
        console.error('[MyPayments]', err)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [student])

  if (!student) return null

  const summary = computePaymentSummary(payments)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-jakarta text-2xl font-bold text-[#0D1B2A]">My Payments</h2>
        <p className="text-sm text-[#5A6A7A]">Fee history and receipts</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Total Paid (LKR)"
          value={loading ? '…' : formatAmount(summary.totalPaidLkr, 'LKR')}
        />
        <StatCard
          label="Total Pending (LKR)"
          value={loading ? '…' : formatAmount(summary.totalPendingLkr, 'LKR')}
        />
        <StatCard
          label="Next Due Date"
          value={
            loading
              ? '…'
              : summary.nextDue
                ? formatPaymentDate(summary.nextDue.paymentDate)
                : 'None'
          }
        />
      </div>

      {student.feeAmount != null && student.feeAmount > 0 && (
        <div className="rounded-xl border border-[#DDE3EC] bg-white p-4">
          <h3 className="font-jakarta text-sm font-bold text-[#0B3D6B]">Payment Schedule</h3>
          <p className="mt-1 text-sm text-[#5A6A7A]">
            Course fee: {formatAmount(student.feeAmount, student.feeCurrency ?? 'LKR')} · Status:{' '}
            <span className="capitalize">{student.paymentStatus ?? 'pending'}</span>
          </p>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-[#DDE3EC] bg-white">
        {loading ? (
          <div className="animate-pulse divide-y divide-[#DDE3EC]">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-14 px-4 py-4">
                <div className="h-3 w-full rounded bg-[#DDE3EC]" />
              </div>
            ))}
          </div>
        ) : payments.length === 0 ? (
          <p className="px-6 py-12 text-center text-sm text-[#5A6A7A]">No payments recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead>
                <tr className="border-b border-[#DDE3EC] bg-[#F5F7FB]">
                  {['Receipt No', 'Date', 'Amount', 'Type', 'Method', 'Status', ''].map((h) => (
                    <th
                      key={h || 'action'}
                      className="px-4 py-3 font-jakarta text-xs font-semibold uppercase tracking-wide text-[#5A6A7A]"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DDE3EC]">
                {payments.map((p) => (
                  <tr key={p.id} className="hover:bg-[#F5F7FB]/60">
                    <td className="px-4 py-3 font-medium text-[#0B3D6B]">{p.receiptNumber}</td>
                    <td className="px-4 py-3 text-[#5A6A7A]">{formatPaymentDate(p.paymentDate)}</td>
                    <td className="px-4 py-3 font-semibold">{formatAmount(p.amount, p.currency)}</td>
                    <td className="px-4 py-3 capitalize text-[#5A6A7A]">{getTypeLabel(p.type)}</td>
                    <td className="px-4 py-3 text-[#5A6A7A]">{getMethodLabel(p.method)}</td>
                    <td className="px-4 py-3 capitalize">{p.status}</td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => setReceiptPayment(p)}
                        className="rounded-lg px-3 py-1.5 text-xs font-semibold text-[#0B3D6B] hover:bg-[#0B3D6B]/10"
                      >
                        Download
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ReceiptModal
        payment={receiptPayment}
        open={!!receiptPayment}
        onClose={() => setReceiptPayment(null)}
      />
    </div>
  )
}
