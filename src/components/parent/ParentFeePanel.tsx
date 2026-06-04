'use client'

import { useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import {
  COURSE_FEE_LKR,
  REGISTRATION_FEE_LKR,
} from '@/lib/payments/constants'
import { formatLKR, formatPaymentDate, getMethodLabel, getTypeLabel } from '@/lib/payments/helpers'
import { feeScheduleTotals } from '@/lib/parent/helpers'
import { defaultFeeSchedule } from '@/lib/students/helpers'
import { useParentPortal } from '@/components/parent/ParentContext'
import type { Payment } from '@/types'

const ReceiptModal = dynamic(() => import('@/components/payments/ReceiptModal'), {
  ssr: false,
})

interface ParentFeePanelProps {
  payments: Payment[]
  loading?: boolean
}

function FeeLine({
  title,
  amount,
  paid,
  method,
  paymentDate,
}: {
  title: string
  amount: number
  paid: boolean
  method?: string
  paymentDate?: string
}) {
  return (
    <div className="rounded-lg border border-[#DDE3EC] bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-jakarta text-sm font-semibold text-[#0D1B2A]">
          {title} — {formatLKR(amount)}
        </span>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
            paid
              ? 'bg-emerald-50 text-emerald-700'
              : 'bg-amber-50 text-amber-800'
          }`}
        >
          {paid ? 'Paid' : 'Unpaid'}
        </span>
      </div>
      {paid && (method || paymentDate) && (
        <p className="mt-2 text-xs text-[#5A6A7A]">
          {method && <span>{method}</span>}
          {method && paymentDate && ' · '}
          {paymentDate && formatPaymentDate(paymentDate)}
        </p>
      )}
    </div>
  )
}

export default function ParentFeePanel({ payments, loading }: ParentFeePanelProps) {
  const { student } = useParentPortal()
  const [payLoading, setPayLoading] = useState(false)
  const [receiptPayment, setReceiptPayment] = useState<Payment | null>(null)

  const schedule = student.feeSchedule ?? defaultFeeSchedule()
  const { totalDue, paidAmount, balance } = useMemo(
    () => feeScheduleTotals(schedule),
    [schedule],
  )

  async function handlePayOnline(amount: number, description: string) {
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
          successUrl: `${window.location.origin}/parent/payments?success=true`,
          cancelUrl: `${window.location.origin}/parent/payments?cancelled=true`,
        }),
      })
      const data = await res.json()
      if (data.url) window.location.href = data.url
    } catch (err) {
      console.error('[ParentFeePanel] pay', err)
    } finally {
      setPayLoading(false)
    }
  }

  const unpaidRegistration = !schedule.registration.paid
  const unpaidCourse = !schedule.course.paid

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-[#DDE3EC] bg-[#F5F7FB] p-4">
          <p className="text-xs font-medium uppercase text-[#5A6A7A]">Total due</p>
          <p className="mt-1 font-jakarta text-xl font-bold text-[#0B3D6B]">
            {formatLKR(totalDue)}
          </p>
        </div>
        <div className="rounded-xl border border-[#DDE3EC] bg-[#F5F7FB] p-4">
          <p className="text-xs font-medium uppercase text-[#5A6A7A]">Total paid</p>
          <p className="mt-1 font-jakarta text-xl font-bold text-emerald-700">
            {formatLKR(paidAmount)}
          </p>
        </div>
        <div className="rounded-xl border border-[#DDE3EC] bg-[#F5F7FB] p-4">
          <p className="text-xs font-medium uppercase text-[#5A6A7A]">Balance remaining</p>
          <p className="mt-1 font-jakarta text-xl font-bold text-[#0D1B2A]">
            {formatLKR(balance)}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <FeeLine
          title="Registration Fee"
          amount={REGISTRATION_FEE_LKR}
          paid={schedule.registration.paid}
          method={
            schedule.registration.method
              ? getMethodLabel(schedule.registration.method)
              : undefined
          }
          paymentDate={schedule.registration.paymentDate}
        />
        <FeeLine
          title="Course Fee"
          amount={COURSE_FEE_LKR}
          paid={schedule.course.paid}
          method={
            schedule.course.method ? getMethodLabel(schedule.course.method) : undefined
          }
          paymentDate={schedule.course.paymentDate}
        />
        {schedule.otherExpenses.map((o) => (
          <FeeLine
            key={o.id}
            title={o.description || 'Other expense'}
            amount={o.amount}
            paid={o.paid}
            method={o.method ? getMethodLabel(o.method) : undefined}
            paymentDate={o.paymentDate}
          />
        ))}
      </div>

      {(unpaidRegistration || unpaidCourse || balance > 0) && (
        <div className="rounded-xl border border-[#DDE3EC] bg-white p-5">
          <h4 className="font-jakarta text-sm font-bold text-[#0B3D6B]">Pay Online</h4>
          <p className="mt-1 text-sm text-[#5A6A7A]">
            Secure card payment in LKR via Stripe.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {unpaidRegistration && (
              <button
                type="button"
                disabled={payLoading}
                onClick={() =>
                  void handlePayOnline(
                    REGISTRATION_FEE_LKR,
                    `Registration Fee — ${student.name}`,
                  )
                }
                className="rounded-lg bg-[#E8A020] px-4 py-2 font-jakarta text-sm font-bold text-[#0B3D6B] hover:bg-[#F5B942] disabled:opacity-60"
              >
                Pay Registration ({formatLKR(REGISTRATION_FEE_LKR)})
              </button>
            )}
            {unpaidCourse && (
              <button
                type="button"
                disabled={payLoading}
                onClick={() =>
                  void handlePayOnline(COURSE_FEE_LKR, `Course Fee — ${student.name}`)
                }
                className="rounded-lg bg-[#0B3D6B] px-4 py-2 font-jakarta text-sm font-bold text-white hover:bg-[#0a3560] disabled:opacity-60"
              >
                Pay Course Fee ({formatLKR(COURSE_FEE_LKR)})
              </button>
            )}
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-[#DDE3EC] bg-white">
        <h4 className="border-b border-[#DDE3EC] bg-[#F5F7FB] px-4 py-3 font-jakarta text-sm font-bold text-[#0B3D6B]">
          Payment history
        </h4>
        {loading ? (
          <p className="px-4 py-8 text-center text-sm text-[#5A6A7A]">Loading…</p>
        ) : payments.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-[#5A6A7A]">
            No payments recorded yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-[#DDE3EC] bg-[#F5F7FB]">
                  {['Receipt', 'Date', 'Amount', 'Type', 'Status', ''].map((h) => (
                    <th
                      key={h || 'action'}
                      className="px-4 py-3 text-xs font-semibold uppercase text-[#5A6A7A]"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DDE3EC]">
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-3 font-medium text-[#0B3D6B]">
                      {p.receiptNumber}
                    </td>
                    <td className="px-4 py-3 text-[#5A6A7A]">
                      {formatPaymentDate(p.paymentDate)}
                    </td>
                    <td className="px-4 py-3 font-semibold">
                      {formatLKR(p.amount)}
                    </td>
                    <td className="px-4 py-3 capitalize text-[#5A6A7A]">
                      {getTypeLabel(p.type)}
                    </td>
                    <td className="px-4 py-3 capitalize">{p.status}</td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => setReceiptPayment(p)}
                        className="text-xs font-semibold text-[#0B3D6B] hover:underline"
                      >
                        Receipt
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
