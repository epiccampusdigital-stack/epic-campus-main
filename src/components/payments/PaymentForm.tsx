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
  generateReceiptNumber,
  sendPaymentWhatsApp,
  formatAmount,
} from '@/lib/payments/helpers'
import { useManagement } from '@/components/layout/ManagementContext'
import type { Payment, PaymentMethod, PaymentStatus, PaymentType, Student } from '@/types'

export interface PaymentFormValues {
  studentId: string
  type: PaymentType
  amount: string
  currency: 'LKR' | 'USD'
  method: PaymentMethod
  bankReference: string
  stripeId: string
  status: PaymentStatus
  paymentDate: string
  notes: string
}

const EMPTY: PaymentFormValues = {
  studentId: '',
  type: 'tuition',
  amount: '',
  currency: 'LKR',
  method: 'cash',
  bankReference: '',
  stripeId: '',
  status: 'paid',
  paymentDate: new Date().toISOString().slice(0, 10),
  notes: '',
}

interface PaymentFormProps {
  open: boolean
  onClose: () => void
  payment?: Payment | null
  students: Student[]
  onSaved: () => void
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1.5 block font-inter text-xs font-medium uppercase tracking-wide text-[#5A6A7A]">
      {children}
    </label>
  )
}

function paymentToForm(p: Payment): PaymentFormValues {
  return {
    studentId: p.studentId,
    type: p.type,
    amount: String(p.amount),
    currency: p.currency,
    method: p.method,
    bankReference: p.bankReference ?? '',
    stripeId: p.stripeId ?? '',
    status: p.status === 'cancelled' ? 'pending' : p.status,
    paymentDate: p.paymentDate.slice(0, 10),
    notes: p.notes ?? '',
  }
}

export default function PaymentForm({
  open,
  onClose,
  payment,
  students,
  onSaved,
}: PaymentFormProps) {
  const { user } = useManagement()
  const [form, setForm] = useState<PaymentFormValues>(EMPTY)
  const [studentSearch, setStudentSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const isEdit = !!payment

  useEffect(() => {
    if (open) {
      setForm(payment ? paymentToForm(payment) : EMPTY)
      setStudentSearch('')
      setError('')
    }
  }, [open, payment])

  const filteredStudents = useMemo(() => {
    const q = studentSearch.trim().toLowerCase()
    if (!q) return students.slice(0, 20)
    return students
      .filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.studentCode.toLowerCase().includes(q) ||
          s.mobile.includes(q),
      )
      .slice(0, 20)
  }, [students, studentSearch])

  const selectedStudent = students.find((s) => s.id === form.studentId)

  function setField<K extends keyof PaymentFormValues>(
    key: K,
    value: PaymentFormValues[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !selectedStudent) {
      setError('Please select a student')
      return
    }
    setSaving(true)
    setError('')

    try {
      const course = COURSE_MAP[selectedStudent.courseId]
      const paymentDocId = payment?.id ?? doc(collection(db, 'payments')).id
      const amount = Number(form.amount)

      const payload = {
        studentId: selectedStudent.id,
        studentName: selectedStudent.name,
        studentCode: selectedStudent.studentCode,
        courseId: selectedStudent.courseId,
        courseName: course?.label ?? selectedStudent.courseId,
        amount,
        currency: form.currency,
        type: form.type,
        method: form.method,
        bankReference: form.method === 'bank-transfer' ? form.bankReference.trim() || null : null,
        stripeId: form.method === 'stripe' ? form.stripeId.trim() || null : null,
        status: form.status,
        paymentDate: form.paymentDate,
        notes: form.notes.trim() || null,
        branchId: user.branchId ?? selectedStudent.branchId ?? 'galle-main',
        updatedAt: serverTimestamp(),
      }

      if (isEdit) {
        await updateDoc(doc(db, 'payments', paymentDocId), payload)
      } else {
        const allSnap = await getDocs(collection(db, 'payments'))
        const receiptNumber = await generateReceiptNumber(allSnap.size)
        await setDoc(doc(db, 'payments', paymentDocId), {
          ...payload,
          receiptNumber,
          receiptNo: receiptNumber,
          createdAt: serverTimestamp(),
          createdBy: user.uid,
        })

        await updateDoc(doc(db, 'students', selectedStudent.id), {
          paymentStatus: form.status === 'cancelled' ? 'pending' : form.status,
        })

        if (selectedStudent.mobile) {
          await sendPaymentWhatsApp(
            selectedStudent.mobile,
            selectedStudent.name,
            formatAmount(amount, form.currency),
            receiptNumber,
          )
        }
      }

      onSaved()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save payment')
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-[#0D1B2A]/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col bg-white shadow-2xl"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between border-b border-[#DDE3EC] px-6 py-4">
          <h2 className="font-jakarta text-lg font-bold text-[#0D1B2A]">
            {isEdit ? 'Edit Payment' : 'Record Payment'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-[#5A6A7A] hover:bg-[#F5F7FB]"
            aria-label="Close"
          >
            <span className="ti ti-x text-xl" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-5">
            {error && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="mb-5">
              <FieldLabel>Student *</FieldLabel>
              <input
                type="search"
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                placeholder="Search by name or student code…"
                className="mb-2 w-full rounded-lg border border-[#DDE3EC] px-3 py-2.5 font-inter text-base outline-none focus:border-[#E8A020] sm:text-sm"
              />
              <select
                value={form.studentId}
                onChange={(e) => setField('studentId', e.target.value)}
                required
                className="w-full rounded-lg border border-[#DDE3EC] px-3 py-2.5 font-inter text-base outline-none focus:border-[#E8A020] sm:text-sm"
              >
                <option value="">Select student</option>
                {filteredStudents.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.studentCode}) — {COURSE_MAP[s.courseId]?.label}
                  </option>
                ))}
              </select>
              {selectedStudent && (
                <p className="mt-1 text-xs text-[#5A6A7A]">
                  {selectedStudent.mobile} · Batch {selectedStudent.batchId}
                </p>
              )}
            </div>

            <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <FieldLabel>Payment Type</FieldLabel>
                <select
                  value={form.type}
                  onChange={(e) => setField('type', e.target.value as PaymentType)}
                  className="w-full rounded-lg border border-[#DDE3EC] px-3 py-2.5 font-inter text-sm outline-none focus:border-[#E8A020]"
                >
                  <option value="tuition">Tuition</option>
                  <option value="registration">Registration</option>
                  <option value="exam">Exam</option>
                  <option value="visa">Visa</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <FieldLabel>Status</FieldLabel>
                <select
                  value={form.status}
                  onChange={(e) => setField('status', e.target.value as PaymentStatus)}
                  className="w-full rounded-lg border border-[#DDE3EC] px-3 py-2.5 font-inter text-sm outline-none focus:border-[#E8A020]"
                >
                  <option value="paid">Paid</option>
                  <option value="partial">Partial</option>
                  <option value="pending">Pending</option>
                </select>
              </div>
            </div>

            <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <FieldLabel>Amount *</FieldLabel>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.amount}
                  onChange={(e) => setField('amount', e.target.value)}
                  required
                  className="w-full rounded-lg border border-[#DDE3EC] px-3 py-2.5 font-inter text-base outline-none focus:border-[#E8A020] sm:text-sm"
                />
              </div>
              <div>
                <FieldLabel>Currency</FieldLabel>
                <select
                  value={form.currency}
                  onChange={(e) => setField('currency', e.target.value as 'LKR' | 'USD')}
                  className="w-full rounded-lg border border-[#DDE3EC] px-3 py-2.5 font-inter text-sm outline-none focus:border-[#E8A020]"
                >
                  <option value="LKR">LKR</option>
                  <option value="USD">USD</option>
                </select>
              </div>
            </div>

            <div className="mb-5">
              <FieldLabel>Payment Method</FieldLabel>
              <select
                value={form.method}
                onChange={(e) => setField('method', e.target.value as PaymentMethod)}
                className="w-full rounded-lg border border-[#DDE3EC] px-3 py-2.5 font-inter text-sm outline-none focus:border-[#E8A020]"
              >
                <option value="cash">Cash</option>
                <option value="bank-transfer">Bank Transfer</option>
                <option value="stripe">Stripe</option>
              </select>
            </div>

            {form.method === 'bank-transfer' && (
              <div className="mb-5">
                <FieldLabel>Bank Reference Number</FieldLabel>
                <input
                  type="text"
                  value={form.bankReference}
                  onChange={(e) => setField('bankReference', e.target.value)}
                  placeholder="Transaction reference"
                  className="w-full rounded-lg border border-[#DDE3EC] px-3 py-2.5 font-inter text-sm outline-none focus:border-[#E8A020]"
                />
              </div>
            )}

            {form.method === 'stripe' && (
              <div className="mb-5">
                <FieldLabel>Stripe Payment ID</FieldLabel>
                <input
                  type="text"
                  value={form.stripeId}
                  onChange={(e) => setField('stripeId', e.target.value)}
                  placeholder="pi_xxxxxxxx"
                  className="w-full rounded-lg border border-[#DDE3EC] px-3 py-2.5 font-inter text-sm outline-none focus:border-[#E8A020]"
                />
              </div>
            )}

            <div className="mb-5">
              <FieldLabel>Payment Date</FieldLabel>
              <input
                type="date"
                value={form.paymentDate}
                onChange={(e) => setField('paymentDate', e.target.value)}
                className="w-full rounded-lg border border-[#DDE3EC] px-3 py-2.5 font-inter text-base outline-none focus:border-[#E8A020] sm:text-sm"
              />
            </div>

            <div>
              <FieldLabel>Notes</FieldLabel>
              <textarea
                value={form.notes}
                onChange={(e) => setField('notes', e.target.value)}
                rows={3}
                className="w-full resize-none rounded-lg border border-[#DDE3EC] px-3 py-2.5 font-inter text-base outline-none focus:border-[#E8A020] sm:text-sm"
                placeholder="Optional notes…"
              />
            </div>
          </div>

          <div className="flex gap-3 border-t border-[#DDE3EC] px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-[#DDE3EC] py-2.5 font-jakarta text-sm font-semibold text-[#5A6A7A] hover:bg-[#F5F7FB]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-lg bg-[#E8A020] py-2.5 font-jakarta text-sm font-bold text-[#0B3D6B] hover:bg-[#F5B942] disabled:opacity-60"
            >
              {saving ? 'Saving…' : isEdit ? 'Update Payment' : 'Save Payment'}
            </button>
          </div>
        </form>
      </aside>
    </>
  )
}
