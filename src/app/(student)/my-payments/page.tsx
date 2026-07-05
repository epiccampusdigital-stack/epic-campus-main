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
  const { student, user } = useStudentPortal()
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [receiptPayment, setReceiptPayment] = useState<Payment | null>(null)
  const [paymentPlan, setPaymentPlan] = useState<{
    id: string
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
  const [receiptUpload, setReceiptUpload] = useState<{ installmentIndex: number; planId: string } | null>(null)
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [receiptNote, setReceiptNote] = useState('')
  const [uploadingReceipt, setUploadingReceipt] = useState(false)
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null)

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
          const [planSnap1, planSnap2] = await Promise.all([
            getDocs(
              query(
                collection(db, 'studentPaymentPlans'),
                where('studentId', '==', student!.id),
              ),
            ).catch(() => ({ docs: [] as { id: string; data: () => Record<string, unknown> }[] })),
            getDocs(
              query(
                collection(db, 'studentPaymentPlans'),
                where('userId', '==', student!.id),
              ),
            ).catch(() => ({ docs: [] as { id: string; data: () => Record<string, unknown> }[] })),
          ])
          const planDocs = [...planSnap1.docs, ...planSnap2.docs]
          if (planDocs.length > 0) {
            const planData = planDocs[0].data() as {
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
            setPaymentPlan({ id: planDocs[0].id, ...planData })
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

  async function handleReceiptUpload() {
    if (!receiptFile || !receiptUpload || !user) return
    setUploadingReceipt(true)
    try {
      const { ref, uploadBytes, getDownloadURL } = await import('firebase/storage')
      const { storage } = await import('@/lib/firebase/client')
      const storageRef = ref(storage, `payment-receipts/${user.uid}/${Date.now()}-${receiptFile.name}`)
      await uploadBytes(storageRef, receiptFile)
      const downloadUrl = await getDownloadURL(storageRef)

      const { addDoc, collection, serverTimestamp } = await import('firebase/firestore')
      const { db } = await import('@/lib/firebase/client')
      await addDoc(collection(db, 'paymentReceipts'), {
        studentId: user.uid,
        studentName: user.displayName ?? '',
        planId: receiptUpload.planId,
        installmentIndex: receiptUpload.installmentIndex,
        receiptUrl: downloadUrl,
        fileName: receiptFile.name,
        note: receiptNote.trim(),
        status: 'pending',
        createdAt: serverTimestamp(),
      })

      setUploadSuccess('Receipt uploaded! Reception will verify and confirm your payment shortly.')
      setReceiptUpload(null)
      setReceiptFile(null)
      setReceiptNote('')
    } catch (err) {
      console.error('[ReceiptUpload]', err)
    } finally {
      setUploadingReceipt(false)
    }
  }

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
                <div key={inst.id ?? idx} className="px-5 py-3">
                  <div className="flex items-center justify-between gap-3">
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

                  {!isPaid && (
                    <div className="mt-3 border-t border-[#DDE3EC] dark:border-white/[0.08] pt-3">
                      <button
                        type="button"
                        onClick={() => setReceiptUpload({ installmentIndex: idx, planId: paymentPlan.id })}
                        className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#DDE3EC] dark:border-white/20 py-2.5 text-sm font-semibold text-[#5A6A7A] dark:text-white/60 hover:border-[#0B3D6B] hover:text-[#0B3D6B] transition-all"
                      >
                        <span className="ti ti-receipt" /> Pay via Bank Transfer
                      </button>
                    </div>
                  )}
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

      {uploadSuccess && (
        <div className="fixed bottom-6 right-4 z-50 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-medium text-white shadow-lg max-w-sm">
          ✅ {uploadSuccess}
          <button type="button" onClick={() => setUploadSuccess(null)} className="ml-3 text-white/70 hover:text-white">✕</button>
        </div>
      )}

      {receiptUpload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => { setReceiptUpload(null); setReceiptFile(null); setReceiptNote('') }} />
          <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white dark:bg-[#0d1a2e] p-6 shadow-2xl">
            <h2 className="font-jakarta font-bold text-[#0B3D6B] dark:text-white mb-1">Bank Transfer Receipt</h2>
            <p className="text-xs text-[#5A6A7A] dark:text-white/50 mb-4">
              Upload your bank transfer receipt. Reception will verify and mark your payment as confirmed.
            </p>

            <div className="space-y-3">
              {/* Bank details */}
              <div className="rounded-xl bg-[#F5F7FB] dark:bg-white/[0.04] border border-[#DDE3EC] dark:border-white/20 p-4 space-y-2">
                <p className="text-xs font-bold text-[#0B3D6B] dark:text-blue-300 uppercase tracking-wider">Bank Transfer Details</p>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-[#5A6A7A] dark:text-white/50">Bank</span>
                    <span className="font-semibold text-[#0D1B2A] dark:text-white">Bank of Ceylon</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#5A6A7A] dark:text-white/50">Account Name</span>
                    <span className="font-semibold text-[#0D1B2A] dark:text-white">EPIC Campus (Pvt) Ltd</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#5A6A7A] dark:text-white/50">Account No.</span>
                    <span className="font-mono font-bold text-[#0B3D6B] dark:text-blue-300">76279834</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#5A6A7A] dark:text-white/50">Branch</span>
                    <span className="font-semibold text-[#0D1B2A] dark:text-white">Ahangama</span>
                  </div>
                </div>
              </div>

              {/* File upload */}
              <div>
                <label className="mb-1.5 block text-xs font-bold text-[#5A6A7A] dark:text-white/50">
                  Upload Receipt (photo/PDF) *
                </label>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={e => setReceiptFile(e.target.files?.[0] ?? null)}
                  className="w-full rounded-xl border border-[#DDE3EC] dark:border-white/20 bg-[#F5F7FB] dark:bg-white/[0.04] px-3 py-2.5 text-sm text-[#0D1B2A] dark:text-white file:mr-3 file:rounded-lg file:border-0 file:bg-[#0B3D6B] file:px-3 file:py-1 file:text-xs file:font-bold file:text-white"
                />
                {receiptFile && (
                  <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">✓ {receiptFile.name}</p>
                )}
              </div>

              {/* Note */}
              <div>
                <label className="mb-1.5 block text-xs font-bold text-[#5A6A7A] dark:text-white/50">
                  Note (optional)
                </label>
                <input
                  type="text"
                  value={receiptNote}
                  onChange={e => setReceiptNote(e.target.value)}
                  placeholder="e.g. Transfer ref: 12345"
                  className="w-full rounded-xl border border-[#DDE3EC] dark:border-white/20 bg-[#F5F7FB] dark:bg-white/[0.04] px-3 py-2.5 text-sm text-[#0D1B2A] dark:text-white outline-none focus:border-[#E8A020]"
                />
              </div>
            </div>

            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => { setReceiptUpload(null); setReceiptFile(null); setReceiptNote('') }}
                className="flex-1 rounded-xl border border-[#DDE3EC] dark:border-white/20 py-2.5 text-sm font-semibold text-[#5A6A7A] dark:text-white/60"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!receiptFile || uploadingReceipt}
                onClick={() => void handleReceiptUpload()}
                className="flex-1 rounded-xl bg-[#0B3D6B] py-2.5 text-sm font-bold text-white disabled:opacity-40"
              >
                {uploadingReceipt ? (
                  <><span className="ti ti-loader animate-spin mr-1" />Uploading...</>
                ) : (
                  <><span className="ti ti-upload mr-1" />Submit Receipt</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
