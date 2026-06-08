'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import {
  formatAmount,
  formatPaymentDate,
  getMethodLabel,
  getTypeLabel,
  parsePayment,
} from '@/lib/payments/helpers'
import { computePaymentSummary } from '@/lib/student/portal'
import { useStudentPortal } from '@/components/student/StudentContext'
import type { Payment } from '@/types'

const ReceiptModal = dynamic(() => import('@/components/payments/ReceiptModal'), {
  ssr: false,
})

const DEFAULT_FEE_OPTIONS = [
  { label: 'Registration Fee', amount: 25000, desc: 'EPIC Campus Registration' },
  { label: 'Course Fee', amount: 60000, desc: 'Language Training Program' },
  { label: 'Full Program Fee', amount: 85000, desc: 'Complete Program Package' },
]

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

interface FeeOption { label: string; amount: number; desc: string }

export default function StudentPaymentsPage() {
  const { user, student } = useStudentPortal()
  const searchParams = useSearchParams()
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [receiptPayment, setReceiptPayment] = useState<Payment | null>(null)
  const [payLoading, setPayLoading] = useState(false)

  // Build fee options from student's feeSchedule or fall back to defaults
  const feeOptions: FeeOption[] = (() => {
    const fs = (student as (typeof student & { feeSchedule?: { registrationFee?: number; courseFee?: number; otherFees?: { label: string; amount: number }[] } }) | null)?.feeSchedule
    if (!fs) return DEFAULT_FEE_OPTIONS
    const opts: FeeOption[] = [
      { label: 'Registration Fee', amount: fs.registrationFee ?? 25000, desc: 'EPIC Campus Registration' },
      { label: 'Course Fee', amount: fs.courseFee ?? 60000, desc: 'Language Training Program' },
    ]
    if (fs.otherFees?.length) {
      fs.otherFees.forEach((f) => opts.push({ label: f.label, amount: f.amount, desc: f.label }))
    }
    return opts
  })()

  const success = searchParams.get('success') === 'true'
  const cancelled = searchParams.get('cancelled') === 'true'

  useEffect(() => {
    if (!student) return

    async function load() {
      setLoading(true)
      try {
        const snap = await getDocs(
          query(collection(db, 'payments'), where('studentId', '==', student!.id)),
        )
        const list = snap.docs
          .map((d) => parsePayment(d.id, d.data() as Record<string, unknown>))
          .sort((a, b) => b.paymentDate.localeCompare(a.paymentDate))
        setPayments(list)
      } catch (err) {
        console.error('[StudentPayments]', err)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [student])

  async function handleStripePayment(amount: number, description: string) {
    if (!user || !student) return
    setPayLoading(true)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          currency: 'lkr',
          studentId: student.id,
          studentName: student.name,
          description,
        }),
      })
      const data = await res.json()
      if (data.url) window.location.href = data.url
    } catch (err) {
      console.error('Payment error:', err)
    } finally {
      setPayLoading(false)
    }
  }

  if (!student) return null

  const summary = computePaymentSummary(payments)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-jakarta text-2xl font-bold text-[#0D1B2A]">My Payments</h2>
        <p className="text-sm text-[#5A6A7A]">Pay fees online and view payment history</p>
      </div>

      {success && (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          Payment successful! Your payment has been recorded.
        </div>
      )}
      {cancelled && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Payment cancelled. No charge was made.
        </div>
      )}

      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-[#0B3D6B]">Make a Payment</h3>
        <p className="mb-4 text-sm text-gray-500">
          Pay your program fees securely via Stripe. Payments are processed in LKR.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {feeOptions.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => handleStripePayment(item.amount, item.desc)}
              disabled={payLoading}
              className="rounded-xl border border-gray-200 p-4 text-left transition-all hover:border-[#E8A020] hover:shadow-sm disabled:opacity-60"
            >
              <div className="font-semibold text-[#0B3D6B]">{item.label}</div>
              <div className="mt-1 text-2xl font-black text-[#E8A020]">LKR {item.amount.toLocaleString()}</div>
              <div className="mt-1 text-xs text-gray-400">{item.desc}</div>
            </button>
          ))}
        </div>
        {payLoading && (
          <p className="mt-4 text-center text-sm text-gray-500">Redirecting to payment...</p>
        )}
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
