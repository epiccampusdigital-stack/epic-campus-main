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
    <div className="rounded-xl border border-[#DDE3EC] dark:border-white/[0.08] bg-white dark:bg-white/[0.04] p-5">
      <p className="font-inter text-xs font-medium uppercase tracking-wide text-[#5A6A7A] dark:text-white/50">
        {label}
      </p>
      <p className="mt-1 font-jakarta text-2xl font-bold text-[#0B3D6B] dark:text-[#E8A020]">{value}</p>
    </div>
  )
}

export default function MyPaymentsPage() {
  const { student } = useStudentPortal()
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [receiptPayment, setReceiptPayment] = useState<Payment | null>(null)
  const [paymentPlan, setPaymentPlan] = useState<{
    totalFee: number
    currency: string
    installments: {
      id: string
      label: string
      amount: number
      dueDate: string
      paidAt?: string
    }[]
  } | null>(null)

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

        try {
          const planSnap = await getDocs(
            query(
              collection(db, 'studentPaymentPlans'),
              where('studentId', '==', student!.id),
            ),
          )
          if (!planSnap.empty) {
            const planData = planSnap.docs[0].data() as {
              totalFee: number
              currency: string
              installments: {
                id: string
                label: string
                amount: number
                dueDate: string
                paidAt?: string
              }[]
            }
            setPaymentPlan(planData)
          }
        } catch {
          // payment plan is optional — fail silently
        }
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
        <h2 className="font-jakarta text-2xl font-bold text-[#0D1B2A] dark:text-white">My Payments</h2>
        <p className="text-sm text-[#5A6A7A] dark:text-white/50">Fee history and receipts</p>
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
        <div className="rounded-xl border border-[#DDE3EC] dark:border-white/[0.08] bg-white dark:bg-white/[0.04] p-4">
          <h3 className="font-jakarta text-sm font-bold text-[#0B3D6B] dark:text-[#E8A020]">Payment Schedule</h3>
          <p className="mt-1 text-sm text-[#5A6A7A] dark:text-white/50">
            Course fee: {formatAmount(student.feeAmount, student.feeCurrency ?? 'LKR')} · Status:{' '}
            <span className="capitalize">{student.paymentStatus ?? 'pending'}</span>
          </p>
        </div>
      )}

      {paymentPlan && paymentPlan.installments?.length > 0 && (
        <div className="rounded-2xl border border-[#DDE3EC] dark:border-white/[0.08] bg-white dark:bg-white/[0.04] overflow-hidden">
          <div className="border-b border-[#DDE3EC] dark:border-white/[0.06] px-5 py-4">
            <h3 className="font-jakarta font-bold text-[#0B3D6B] dark:text-white">
              Installment Schedule
            </h3>
            <p className="mt-0.5 text-xs text-[#5A6A7A] dark:text-white/50">
              Total fee: {formatAmount(paymentPlan.totalFee, (paymentPlan.currency ?? 'LKR') as 'LKR' | 'USD')}
            </p>
          </div>
          <div className="divide-y divide-[#DDE3EC] dark:divide-white/[0.06]">
            {paymentPlan.installments.map((inst, idx) => {
              const isPaid = !!inst.paidAt
              const isOverdue = !isPaid && inst.dueDate < new Date().toISOString().slice(0, 10)
              return (
                <div key={inst.id ?? idx} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      isPaid
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                        : isOverdue
                          ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                          : 'bg-[#0B3D6B]/10 text-[#0B3D6B] dark:bg-white/10 dark:text-white/60'
                    }`}>
                      {isPaid ? <span className="ti ti-check" /> : idx + 1}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[#0D1B2A] dark:text-white">
                        {inst.label}
                      </p>
                      <p className="text-xs text-[#5A6A7A] dark:text-white/50">
                        Due: {inst.dueDate}
                        {inst.paidAt ? ` · Paid: ${inst.paidAt.slice(0, 10)}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="font-semibold text-sm text-[#0D1B2A] dark:text-white">
                      {formatAmount(inst.amount, (paymentPlan.currency ?? 'LKR') as 'LKR' | 'USD')}
                    </p>
                    <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                      isPaid
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                        : isOverdue
                          ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                          : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                    }`}>
                      {isPaid ? 'Paid' : isOverdue ? 'Overdue' : 'Pending'}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-[#DDE3EC] dark:border-white/[0.08] bg-white dark:bg-white/[0.04]">
        {loading ? (
          <div className="animate-pulse divide-y divide-[#DDE3EC] dark:divide-white/[0.06]">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-14 px-4 py-4">
                <div className="h-3 w-full rounded bg-[#DDE3EC] dark:bg-white/10" />
              </div>
            ))}
          </div>
        ) : payments.length === 0 ? (
          <p className="px-6 py-12 text-center text-sm text-[#5A6A7A] dark:text-white/50">No payments recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead>
                <tr className="border-b border-[#DDE3EC] dark:border-white/[0.08] bg-[#F5F7FB] dark:bg-white/[0.03]">
                  {['Receipt No', 'Date', 'Amount', 'Type', 'Method', 'Status', ''].map((h) => (
                    <th
                      key={h || 'action'}
                      className="px-4 py-3 font-jakarta text-xs font-semibold uppercase tracking-wide text-[#5A6A7A] dark:text-white/50"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DDE3EC] dark:divide-white/[0.06]">
                {payments.map((p) => (
                  <tr key={p.id} className="hover:bg-[#F5F7FB]/60 dark:hover:bg-white/[0.05]">
                    <td className="px-4 py-3 font-medium text-[#0B3D6B] dark:text-[#E8A020]">{p.receiptNumber}</td>
                    <td className="px-4 py-3 text-[#5A6A7A] dark:text-white/50">{formatPaymentDate(p.paymentDate)}</td>
                    <td className="px-4 py-3 font-semibold dark:text-white">{formatAmount(p.amount, p.currency)}</td>
                    <td className="px-4 py-3 capitalize text-[#5A6A7A] dark:text-white/50">{getTypeLabel(p.type)}</td>
                    <td className="px-4 py-3 text-[#5A6A7A] dark:text-white/50">{getMethodLabel(p.method)}</td>
                    <td className="px-4 py-3 capitalize dark:text-white">{p.status}</td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => setReceiptPayment(p)}
                        className="rounded-lg px-3 py-1.5 text-xs font-semibold text-[#0B3D6B] dark:text-[#E8A020] hover:bg-[#0B3D6B]/10 dark:hover:bg-white/[0.08]"
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
