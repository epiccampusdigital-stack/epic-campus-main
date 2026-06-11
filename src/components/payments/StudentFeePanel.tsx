'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { COURSE_MAP } from '@/lib/constants/courses'
import {
  COURSE_FEE_LKR,
  REGISTRATION_FEE_LKR,
  TOTAL_STUDENT_FEES_LKR,
} from '@/lib/payments/constants'
import {
  formatLKR,
  formatPaymentDate,
  generateReceiptNumber,
  getMethodLabel,
} from '@/lib/payments/helpers'
import { defaultFeeSchedule } from '@/lib/students/helpers'
import { useManagement } from '@/components/layout/ManagementContext'
import { logAuditEvent } from '@/lib/audit/helpers'
import { processPaymentCommissions } from '@/lib/commissions/helpers'
import type {
  Payment,
  PaymentMethod,
  PaymentType,
  Student,
  StudentFeeSchedule,
  StudentOtherExpense,
} from '@/types'

type FeeKey = 'registration' | 'course'

interface StudentFeePanelProps {
  student: Student
  payments: Payment[]
  onUpdated: () => void
}

function methodLabel(method?: PaymentMethod): string {
  if (!method) return '—'
  if (method === 'stripe') return 'Online (Stripe)'
  return getMethodLabel(method)
}

export default function StudentFeePanel({
  student,
  payments,
  onUpdated,
}: StudentFeePanelProps) {
  const { user } = useManagement()
  const [schedule, setSchedule] = useState<StudentFeeSchedule>(
    () => student.feeSchedule ?? defaultFeeSchedule(),
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [linkLoading, setLinkLoading] = useState<string | null>(null)
  const [generatedLink, setGeneratedLink] = useState<string | null>(null)

  useEffect(() => {
    setSchedule(student.feeSchedule ?? defaultFeeSchedule())
  }, [student.feeSchedule, student.id])

  const otherTotal = schedule.otherExpenses.reduce((s, o) => s + o.amount, 0)
  const totalDue = REGISTRATION_FEE_LKR + COURSE_FEE_LKR + otherTotal
  const totalPaid = useMemo(() => {
    let paid = 0
    if (schedule.registration.paid) paid += schedule.registration.amount
    if (schedule.course.paid) paid += schedule.course.amount
    for (const o of schedule.otherExpenses) {
      if (o.paid) paid += o.amount
    }
    return paid
  }, [schedule])
  const balance = Math.max(0, totalDue - totalPaid)

  function updateLine(
    key: FeeKey,
    patch: Partial<StudentFeeSchedule['registration']>,
  ) {
    setSchedule((prev) => ({
      ...prev,
      [key]: { ...prev[key], ...patch },
    }))
  }

  function updateOther(id: string, patch: Partial<StudentOtherExpense>) {
    setSchedule((prev) => ({
      ...prev,
      otherExpenses: prev.otherExpenses.map((o) =>
        o.id === id ? { ...o, ...patch } : o,
      ),
    }))
  }

  function addOtherExpense() {
    setSchedule((prev) => ({
      ...prev,
      otherExpenses: [
        ...prev.otherExpenses,
        {
          id: `other-${Date.now()}`,
          description: '',
          amount: 0,
          paid: false,
        },
      ],
    }))
  }

  function removeOther(id: string) {
    setSchedule((prev) => ({
      ...prev,
      otherExpenses: prev.otherExpenses.filter((o) => o.id !== id),
    }))
  }

  async function recordPaymentIfPaid(
    amount: number,
    type: PaymentType,
    method: PaymentMethod,
    paymentDate: string,
    notes?: string,
  ) {
    if (!user) return
    const allSnap = await getDocs(collection(db, 'payments'))
    const receiptNumber = await generateReceiptNumber(allSnap.size)
    const paymentDocId = doc(collection(db, 'payments')).id
    const course = COURSE_MAP[student.courseId]
    await setDoc(doc(db, 'payments', paymentDocId), {
      studentId: student.id,
      studentName: student.name,
      studentCode: student.studentCode,
      courseId: student.courseId,
      courseName: course?.label ?? student.courseId,
      amount,
      currency: 'LKR',
      type,
      method,
      bankReference: method === 'bank-transfer' ? notes ?? null : null,
      stripeId: method === 'stripe' ? notes ?? null : null,
      status: 'paid',
      paymentDate,
      notes: notes?.trim() || null,
      receiptNumber,
      receiptNo: receiptNumber,
      branchId: user.branchId ?? student.branchId ?? 'galle-main',
      agentId: student.agentId ?? null,
      agentName: student.agentName ?? null,
      createdAt: serverTimestamp(),
      createdBy: user.uid,
    })

    await processPaymentCommissions(
      paymentDocId,
      {
        type,
        amount,
        status: 'paid',
        agentId: student.agentId,
        agentName: student.agentName,
        paymentDate,
        location: student.location,
      },
      student,
    )
  }

  async function saveSchedule() {
    if (!user) return
    setSaving(true)
    setError('')
    try {
      const paymentStatus =
        totalPaid >= totalDue ? 'paid' : totalPaid > 0 ? 'partial' : 'pending'

      await updateDoc(doc(db, 'students', student.id), {
        feeSchedule: schedule,
        paymentStatus,
        updatedAt: serverTimestamp(),
      })

      await logAuditEvent({
        userId: user.uid,
        userEmail: user.email,
        userRole: user.role,
        action: 'updated',
        entityType: 'student',
        entityId: student.id,
        details: `Updated fee schedule for ${student.name}`,
      })

      onUpdated()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save fees')
    } finally {
      setSaving(false)
    }
  }

  async function togglePaid(key: FeeKey, checked: boolean) {
    const line = schedule[key]
    const today = new Date().toISOString().slice(0, 10)
    const next = {
      ...line,
      paid: checked,
      paymentDate: checked ? line.paymentDate || today : undefined,
      method: checked ? line.method || 'cash' : undefined,
    }
    setSchedule((prev) => ({ ...prev, [key]: next }))
    if (checked && user && !line.paid) {
      const type: PaymentType = key === 'registration' ? 'registration' : 'tuition'
      await recordPaymentIfPaid(
        line.amount,
        type,
        next.method as PaymentMethod,
        next.paymentDate!,
        line.reference,
      )
    }
  }

  async function generateStripeLink(
    target: FeeKey | string,
    amount: number,
    description: string,
  ) {
    setLinkLoading(target)
    setGeneratedLink(null)
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
          successUrl: `${window.location.origin}/students/${student.id}?tab=payments&success=true`,
          cancelUrl: `${window.location.origin}/students/${student.id}?tab=payments&cancelled=true`,
        }),
      })
      const data = (await res.json()) as { url?: string; error?: string }
      if (!res.ok || !data.url) {
        throw new Error(data.error ?? 'Failed to create payment link')
      }
      setGeneratedLink(data.url)
      if (target === 'registration' || target === 'course') {
        updateLine(target, {
          method: 'stripe',
          stripePaymentLinkUrl: data.url,
        })
      } else {
        updateOther(target, {
          method: 'stripe',
          stripePaymentLinkUrl: data.url,
        })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Stripe link failed')
    } finally {
      setLinkLoading(null)
    }
  }

  function FeeSection({
    feeKey,
    title,
    amount,
  }: {
    feeKey: FeeKey
    title: string
    amount: number
  }) {
    const line = schedule[feeKey]
    return (
      <div className="rounded-lg border border-[#DDE3EC] p-4 dark:border-gray-600 dark:bg-gray-800/50">
        <div className="flex flex-wrap items-start gap-3">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={line.paid}
              onChange={(e) => void togglePaid(feeKey, e.target.checked)}
              className="h-4 w-4 rounded border-[#DDE3EC] text-[#E8A020] focus:ring-[#E8A020]"
            />
            <span className="font-jakarta text-sm font-semibold text-[#0D1B2A] dark:text-white">
              {title} — {formatLKR(amount)}
            </span>
          </label>
        </div>
        {line.paid && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium uppercase text-[#5A6A7A]">
                Payment method
              </label>
              <select
                value={line.method ?? 'cash'}
                onChange={(e) =>
                  updateLine(feeKey, { method: e.target.value as PaymentMethod })
                }
                className="w-full rounded-lg border border-[#DDE3EC] bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              >
                <option value="cash">Cash</option>
                <option value="bank-transfer">Bank Transfer</option>
                <option value="stripe">Online (Stripe)</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase text-[#5A6A7A]">
                Date paid
              </label>
              <input
                type="date"
                value={line.paymentDate?.slice(0, 10) ?? ''}
                onChange={(e) => updateLine(feeKey, { paymentDate: e.target.value })}
                className="w-full rounded-lg border border-[#DDE3EC] bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium uppercase text-[#5A6A7A]">
                Reference / notes
              </label>
              <input
                type="text"
                value={line.reference ?? ''}
                onChange={(e) => updateLine(feeKey, { reference: e.target.value })}
                placeholder="Transaction ref or notes"
                className="w-full rounded-lg border border-[#DDE3EC] bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              />
            </div>
            {line.method === 'stripe' && (
              <div className="sm:col-span-2">
                <button
                  type="button"
                  disabled={linkLoading === feeKey}
                  onClick={() =>
                    void generateStripeLink(feeKey, amount, `${title} — ${student.name}`)
                  }
                  className="inline-flex items-center gap-2 rounded-lg bg-[#0B3D6B] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0a3560] disabled:opacity-60"
                >
                  {linkLoading === feeKey ? 'Generating…' : 'Generate Payment Link'}
                </button>
                {(line.stripePaymentLinkUrl || generatedLink) && (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={line.stripePaymentLinkUrl ?? generatedLink ?? ''}
                      className="min-w-0 flex-1 rounded-lg border border-[#DDE3EC] bg-[#F5F7FB] px-3 py-2 text-xs dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const url = line.stripePaymentLinkUrl ?? generatedLink
                        if (url) void navigator.clipboard.writeText(url)
                      }}
                      className="rounded-lg border border-[#DDE3EC] px-3 py-2 text-xs font-medium text-[#0B3D6B] dark:border-gray-600 dark:text-white"
                    >
                      Copy
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-200">
          {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-[#DDE3EC] bg-[#F5F7FB] p-4 dark:border-gray-600 dark:bg-gray-800">
          <p className="text-xs font-medium uppercase text-[#5A6A7A]">Total due</p>
          <p className="mt-1 font-jakarta text-xl font-bold text-[#0B3D6B] dark:text-[#E8A020]">
            {formatLKR(totalDue)}
          </p>
          <p className="mt-0.5 text-xs text-[#5A6A7A]">
            Standard {formatLKR(TOTAL_STUDENT_FEES_LKR)} + other
          </p>
        </div>
        <div className="rounded-xl border border-[#DDE3EC] bg-[#F5F7FB] p-4 dark:border-gray-600 dark:bg-gray-800">
          <p className="text-xs font-medium uppercase text-[#5A6A7A]">Total paid</p>
          <p className="mt-1 font-jakarta text-xl font-bold text-emerald-700 dark:text-emerald-400">
            {formatLKR(totalPaid)}
          </p>
        </div>
        <div className="rounded-xl border border-[#DDE3EC] bg-[#F5F7FB] p-4 dark:border-gray-600 dark:bg-gray-800">
          <p className="text-xs font-medium uppercase text-[#5A6A7A]">Balance remaining</p>
          <p className="mt-1 font-jakarta text-xl font-bold text-[#0D1B2A] dark:text-white">
            {formatLKR(balance)}
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <FeeSection
          feeKey="registration"
          title="Registration Fee"
          amount={REGISTRATION_FEE_LKR}
        />
        <FeeSection feeKey="course" title="Course Fee" amount={COURSE_FEE_LKR} />

        <div className="rounded-lg border border-[#DDE3EC] p-4 dark:border-gray-600">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="font-jakarta text-sm font-bold text-[#0B3D6B] dark:text-white">
              Other Expenses
            </h4>
            <button
              type="button"
              onClick={addOtherExpense}
              className="inline-flex items-center gap-1 rounded-lg border border-[#0B3D6B] px-3 py-1.5 text-xs font-semibold text-[#0B3D6B] dark:border-[#E8A020] dark:text-[#E8A020]"
            >
              <span className="ti ti-plus" aria-hidden="true" />
              Add line
            </button>
          </div>
          {schedule.otherExpenses.length === 0 ? (
            <p className="text-sm text-[#5A6A7A]">No other expenses added.</p>
          ) : (
            <div className="space-y-3">
              {schedule.otherExpenses.map((o) => (
                <div
                  key={o.id}
                  className="rounded-lg border border-dashed border-[#DDE3EC] p-3 dark:border-gray-600"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="checkbox"
                      checked={o.paid}
                      onChange={(e) => updateOther(o.id, { paid: e.target.checked })}
                      className="h-4 w-4"
                    />
                    <input
                      type="text"
                      value={o.description}
                      onChange={(e) => updateOther(o.id, { description: e.target.value })}
                      placeholder="Description"
                      className="min-w-[120px] flex-1 rounded-lg border border-[#DDE3EC] px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                    />
                    <input
                      type="number"
                      min="0"
                      value={o.amount || ''}
                      onChange={(e) =>
                        updateOther(o.id, { amount: Number(e.target.value) || 0 })
                      }
                      placeholder="LKR"
                      className="w-28 rounded-lg border border-[#DDE3EC] px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                    />
                    <button
                      type="button"
                      onClick={() => removeOther(o.id)}
                      className="rounded p-1 text-red-600 hover:bg-red-50"
                      aria-label="Remove"
                    >
                      <span className="ti ti-trash" aria-hidden="true" />
                    </button>
                  </div>
                  {o.paid && (
                    <div className="mt-3 grid gap-2 sm:grid-cols-3">
                      <select
                        value={o.method ?? 'cash'}
                        onChange={(e) =>
                          updateOther(o.id, { method: e.target.value as PaymentMethod })
                        }
                        className="rounded-lg border border-[#DDE3EC] px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                      >
                        <option value="cash">Cash</option>
                        <option value="bank-transfer">Bank Transfer</option>
                        <option value="stripe">Online (Stripe)</option>
                      </select>
                      <input
                        type="date"
                        value={o.paymentDate?.slice(0, 10) ?? ''}
                        onChange={(e) => updateOther(o.id, { paymentDate: e.target.value })}
                        className="rounded-lg border border-[#DDE3EC] px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                      />
                      <input
                        type="text"
                        value={o.reference ?? ''}
                        onChange={(e) => updateOther(o.id, { reference: e.target.value })}
                        placeholder="Reference"
                        className="rounded-lg border border-[#DDE3EC] px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                      />
                      {o.method === 'stripe' && (
                        <button
                          type="button"
                          disabled={linkLoading === o.id}
                          onClick={() =>
                            void generateStripeLink(
                              o.id,
                              o.amount,
                              o.description || 'Other expense',
                            )
                          }
                          className="col-span-full text-left text-xs font-semibold text-[#0B3D6B] dark:text-[#E8A020]"
                        >
                          {linkLoading === o.id
                            ? 'Generating link…'
                            : 'Generate Payment Link'}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <button
        type="button"
        disabled={saving}
        onClick={() => void saveSchedule()}
        className="rounded-lg bg-[#E8A020] px-5 py-2.5 font-jakarta text-sm font-bold text-[#0B3D6B] hover:bg-[#F5B942] disabled:opacity-60"
      >
        {saving ? 'Saving…' : 'Save fee schedule'}
      </button>

      <div>
        <h4 className="mb-3 font-jakarta text-sm font-bold uppercase tracking-wide text-[#0B3D6B] dark:text-white">
          Payment history
        </h4>
        {payments.length === 0 ? (
          <p className="text-sm text-[#5A6A7A]">No payment records yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-[#DDE3EC] dark:border-gray-600">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="border-b border-[#DDE3EC] bg-[#F5F7FB] text-xs uppercase text-[#5A6A7A] dark:border-gray-600 dark:bg-gray-800">
                  <th className="px-4 py-3">Receipt</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Method</th>
                  <th className="px-4 py-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DDE3EC] dark:divide-gray-600">
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-3 font-medium text-[#0D1B2A] dark:text-white">
                      {p.receiptNumber || p.id.slice(0, 8)}
                    </td>
                    <td className="px-4 py-3 capitalize text-[#5A6A7A]">{p.type}</td>
                    <td className="px-4 py-3 font-medium text-[#0D1B2A] dark:text-white">
                      {formatLKR(p.amount)}
                    </td>
                    <td className="px-4 py-3 text-[#5A6A7A]">{methodLabel(p.method)}</td>
                    <td className="px-4 py-3 text-[#5A6A7A]">
                      {formatPaymentDate(p.paymentDate)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
