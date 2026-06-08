'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  collection,
  doc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { useManagement } from '@/components/layout/ManagementContext'
import { logAuditEvent } from '@/lib/audit/helpers'
import {
  calculateNetPay,
  computeCommission,
  computeGrossBase,
  formatPeriodKey,
  generatePayrollId,
  nextPayrollSequence,
  totalDeductions,
} from '@/lib/payroll/helpers'
import type {
  PayrollPaymentMethod,
  PayrollRecord,
  PayrollStatus,
  SalaryType,
  StaffMember,
} from '@/types'

export interface PayrollFormValues {
  staffId: string
  month: number
  year: number
  salaryType: SalaryType
  baseSalary: string
  hoursWorked: string
  salesAmount: string
  commissionRate: string
  tax: string
  advances: string
  otherDeductions: string
  bonus: string
  paymentMethod: PayrollPaymentMethod
  bankDetails: string
  notes: string
  status: PayrollStatus
}

function defaultForm(): PayrollFormValues {
  const now = new Date()
  return {
    staffId: '',
    month: now.getMonth() + 1,
    year: now.getFullYear(),
    salaryType: 'fixed',
    baseSalary: '',
    hoursWorked: '',
    salesAmount: '',
    commissionRate: '',
    tax: '',
    advances: '',
    otherDeductions: '',
    bonus: '',
    paymentMethod: 'bank-transfer',
    bankDetails: '',
    notes: '',
    status: 'pending',
  }
}

interface PayrollFormProps {
  open: boolean
  onClose: () => void
  staff: StaffMember[]
  existingRecords: PayrollRecord[]
  editRecord?: PayrollRecord | null
  defaultPeriod?: string
  onSaved: () => void
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1.5 block font-inter text-xs font-medium uppercase tracking-wide text-[#5A6A7A]">
      {children}
    </label>
  )
}

function recordToForm(r: PayrollRecord): PayrollFormValues {
  const { month, year } = (() => {
    const [y, m] = r.period.split('-').map(Number)
    return { month: m, year: y }
  })()
  return {
    staffId: r.staffId,
    month,
    year,
    salaryType: r.salaryType,
    baseSalary: String(r.baseSalary),
    hoursWorked: r.hoursWorked != null ? String(r.hoursWorked) : '',
    salesAmount: r.salesAmount != null ? String(r.salesAmount) : '',
    commissionRate:
      r.commissionRate != null ? String(r.commissionRate) : '',
    tax: String(r.tax),
    advances: String(r.advances),
    otherDeductions: String(r.otherDeductions),
    bonus: String(r.bonus),
    paymentMethod: r.paymentMethod,
    bankDetails: r.bankDetails ?? '',
    notes: r.notes ?? '',
    status: r.status,
  }
}

export default function PayrollForm({
  open,
  onClose,
  staff,
  existingRecords,
  editRecord,
  defaultPeriod,
  onSaved,
}: PayrollFormProps) {
  const { user } = useManagement()
  const [form, setForm] = useState<PayrollFormValues>(defaultForm())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const isEdit = !!editRecord

  useEffect(() => {
    if (!open) return
    if (editRecord) {
      setForm(recordToForm(editRecord))
    } else {
      const next = defaultForm()
      if (defaultPeriod) {
        const [y, m] = defaultPeriod.split('-').map(Number)
        next.month = m
        next.year = y
      }
      setForm(next)
    }
    setError('')
  }, [open, editRecord, defaultPeriod])

  const selectedStaff = staff.find((s) => s.id === form.staffId)

  useEffect(() => {
    if (!selectedStaff || isEdit) return
    setForm((prev) => ({
      ...prev,
      salaryType: selectedStaff.salaryType,
      baseSalary: String(selectedStaff.baseSalary),
      commissionRate:
        selectedStaff.commissionRate != null
          ? String(selectedStaff.commissionRate)
          : prev.commissionRate,
    }))
  }, [selectedStaff, isEdit])

  const computed = useMemo(() => {
    const baseSalary = parseFloat(form.baseSalary) || 0
    const hoursWorked = parseFloat(form.hoursWorked) || 0
    const salesAmount = parseFloat(form.salesAmount) || 0
    const commissionRate = parseFloat(form.commissionRate) || 0
    const bonus = parseFloat(form.bonus) || 0
    const tax = parseFloat(form.tax) || 0
    const advances = parseFloat(form.advances) || 0
    const other = parseFloat(form.otherDeductions) || 0

    const grossBase = computeGrossBase({
      salaryType: form.salaryType,
      baseSalary,
      hoursWorked,
      hourlyRate: baseSalary,
    })
    const commission =
      form.salaryType === 'commission'
        ? computeCommission(salesAmount, commissionRate)
        : 0
    const deductions = totalDeductions(tax, advances, other)
    const netPay = calculateNetPay(grossBase, bonus, deductions, commission)

    return { grossBase, commission, deductions, netPay }
  }, [form])

  function setField<K extends keyof PayrollFormValues>(
    key: K,
    value: PayrollFormValues[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !selectedStaff) {
      setError('Please select a staff member.')
      return
    }

    setSaving(true)
    setError('')

    try {
      const period = formatPeriodKey(form.month, form.year)
      const baseSalary = parseFloat(form.baseSalary) || 0
      const hoursWorked = parseFloat(form.hoursWorked) || 0
      const salesAmount = parseFloat(form.salesAmount) || 0
      const commissionRate = parseFloat(form.commissionRate) || 0
      const bonus = parseFloat(form.bonus) || 0
      const tax = parseFloat(form.tax) || 0
      const advances = parseFloat(form.advances) || 0
      const otherDeductions = parseFloat(form.otherDeductions) || 0

      const payload = {
        staffId: selectedStaff.id,
        staffName: selectedStaff.displayName,
        role: selectedStaff.role,
        period,
        salaryType: form.salaryType,
        baseSalary,
        hoursWorked: form.salaryType === 'hourly' ? hoursWorked : null,
        hourlyRate: form.salaryType === 'hourly' ? baseSalary : null,
        salesAmount: form.salaryType === 'commission' ? salesAmount : null,
        commissionRate:
          form.salaryType === 'commission' ? commissionRate : null,
        commission: computed.commission,
        bonus,
        tax,
        advances,
        otherDeductions,
        deductions: computed.deductions,
        netPay: computed.netPay,
        status: form.status,
        paymentMethod: form.paymentMethod,
        bankDetails:
          form.paymentMethod === 'bank-transfer' ? form.bankDetails.trim() : null,
        notes: form.notes.trim() || null,
        processedBy: user.uid,
        processedAt: serverTimestamp(),
      }

      if (isEdit && editRecord) {
        await updateDoc(doc(db, 'payroll', editRecord.id), payload)
        await logAuditEvent({
          userId: user.uid,
          userEmail: user.email,
          userRole: user.role,
          action: 'updated',
          entityType: 'payroll',
          entityId: editRecord.payrollId,
          details: `Updated payroll for ${selectedStaff.displayName} — ${period}`,
        })
      } else {
        const payrollId = generatePayrollId(
          form.year,
          nextPayrollSequence(existingRecords, form.year),
        )
        const id = doc(collection(db, 'payroll')).id
        await setDoc(doc(db, 'payroll', id), {
          ...payload,
          payrollId,
          createdAt: serverTimestamp(),
        })
        await logAuditEvent({
          userId: user.uid,
          userEmail: user.email,
          userRole: user.role,
          action: 'created',
          entityType: 'payroll',
          entityId: payrollId,
          details: `Processed payroll ${payrollId} for ${selectedStaff.displayName}`,
        })
      }

      onSaved()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save payroll')
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  const months = Array.from({ length: 12 }, (_, i) => ({
    value: i + 1,
    label: new Date(2000, i, 1).toLocaleDateString('en-US', { month: 'long' }),
  }))

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i)

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-[#0D1B2A]/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col bg-white/90 dark:bg-[#0d1a2e]/90 backdrop-blur-2xl border-l border-white/80 dark:border-white/[0.08] shadow-2xl"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between border-b border-[#DDE3EC] px-6 py-4">
          <h2 className="font-jakarta text-lg font-bold text-[#0D1B2A]">
            {isEdit ? 'Edit Payroll' : 'Process Payroll'}
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
              <FieldLabel>Staff Member *</FieldLabel>
              <select
                value={form.staffId}
                onChange={(e) => setField('staffId', e.target.value)}
                required
                disabled={isEdit}
                className="w-full rounded-lg border border-[#DDE3EC] px-3 py-2.5 font-inter text-sm outline-none focus:border-[#E8A020] disabled:bg-[#F5F7FB]"
              >
                <option value="">Select staff</option>
                {staff
                  .filter((s) => s.status === 'active')
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.displayName} ({s.role})
                    </option>
                  ))}
              </select>
            </div>

            <div className="mb-5 grid grid-cols-2 gap-4">
              <div>
                <FieldLabel>Pay Month</FieldLabel>
                <select
                  value={form.month}
                  onChange={(e) => setField('month', Number(e.target.value))}
                  className="w-full rounded-lg border border-[#DDE3EC] px-3 py-2.5 font-inter text-sm outline-none focus:border-[#E8A020]"
                >
                  {months.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <FieldLabel>Pay Year</FieldLabel>
                <select
                  value={form.year}
                  onChange={(e) => setField('year', Number(e.target.value))}
                  className="w-full rounded-lg border border-[#DDE3EC] px-3 py-2.5 font-inter text-sm outline-none focus:border-[#E8A020]"
                >
                  {years.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mb-5">
              <FieldLabel>Salary Type</FieldLabel>
              <select
                value={form.salaryType}
                onChange={(e) =>
                  setField('salaryType', e.target.value as SalaryType)
                }
                className="w-full rounded-lg border border-[#DDE3EC] px-3 py-2.5 font-inter text-sm outline-none focus:border-[#E8A020]"
              >
                <option value="fixed">Fixed</option>
                <option value="hourly">Hourly</option>
                <option value="commission">Commission</option>
              </select>
            </div>

            <div className="mb-5">
              <FieldLabel>
                {form.salaryType === 'hourly' ? 'Hourly Rate (LKR)' : 'Base Salary (LKR)'}
              </FieldLabel>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.baseSalary}
                onChange={(e) => setField('baseSalary', e.target.value)}
                required
                className="w-full rounded-lg border border-[#DDE3EC] px-3 py-2.5 font-inter text-sm outline-none focus:border-[#E8A020]"
              />
            </div>

            {form.salaryType === 'hourly' && (
              <div className="mb-5">
                <FieldLabel>Hours Worked</FieldLabel>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={form.hoursWorked}
                  onChange={(e) => setField('hoursWorked', e.target.value)}
                  required
                  className="w-full rounded-lg border border-[#DDE3EC] px-3 py-2.5 font-inter text-sm outline-none focus:border-[#E8A020]"
                />
              </div>
            )}

            {form.salaryType === 'commission' && (
              <div className="mb-5 grid grid-cols-2 gap-4">
                <div>
                  <FieldLabel>Sales Amount (LKR)</FieldLabel>
                  <input
                    type="number"
                    min="0"
                    value={form.salesAmount}
                    onChange={(e) => setField('salesAmount', e.target.value)}
                    required
                    className="w-full rounded-lg border border-[#DDE3EC] px-3 py-2.5 font-inter text-sm outline-none focus:border-[#E8A020]"
                  />
                </div>
                <div>
                  <FieldLabel>Commission Rate (%)</FieldLabel>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={form.commissionRate}
                    onChange={(e) => setField('commissionRate', e.target.value)}
                    className="w-full rounded-lg border border-[#DDE3EC] px-3 py-2.5 font-inter text-sm outline-none focus:border-[#E8A020]"
                  />
                </div>
              </div>
            )}

            <div className="mb-5">
              <FieldLabel>Bonus (LKR)</FieldLabel>
              <input
                type="number"
                min="0"
                value={form.bonus}
                onChange={(e) => setField('bonus', e.target.value)}
                className="w-full rounded-lg border border-[#DDE3EC] px-3 py-2.5 font-inter text-sm outline-none focus:border-[#E8A020]"
              />
            </div>

            <div className="mb-5">
              <p className="mb-2 font-jakarta text-sm font-semibold text-[#0B3D6B]">
                Deductions
              </p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <FieldLabel>Tax</FieldLabel>
                  <input
                    type="number"
                    min="0"
                    value={form.tax}
                    onChange={(e) => setField('tax', e.target.value)}
                    className="w-full rounded-lg border border-[#DDE3EC] px-3 py-2.5 font-inter text-sm outline-none focus:border-[#E8A020]"
                  />
                </div>
                <div>
                  <FieldLabel>Advances</FieldLabel>
                  <input
                    type="number"
                    min="0"
                    value={form.advances}
                    onChange={(e) => setField('advances', e.target.value)}
                    className="w-full rounded-lg border border-[#DDE3EC] px-3 py-2.5 font-inter text-sm outline-none focus:border-[#E8A020]"
                  />
                </div>
                <div>
                  <FieldLabel>Other</FieldLabel>
                  <input
                    type="number"
                    min="0"
                    value={form.otherDeductions}
                    onChange={(e) => setField('otherDeductions', e.target.value)}
                    className="w-full rounded-lg border border-[#DDE3EC] px-3 py-2.5 font-inter text-sm outline-none focus:border-[#E8A020]"
                  />
                </div>
              </div>
            </div>

            <div className="mb-5 grid grid-cols-2 gap-4">
              <div>
                <FieldLabel>Payment Method</FieldLabel>
                <select
                  value={form.paymentMethod}
                  onChange={(e) =>
                    setField(
                      'paymentMethod',
                      e.target.value as PayrollPaymentMethod,
                    )
                  }
                  className="w-full rounded-lg border border-[#DDE3EC] px-3 py-2.5 font-inter text-sm outline-none focus:border-[#E8A020]"
                >
                  <option value="bank-transfer">Bank Transfer</option>
                  <option value="cash">Cash</option>
                </select>
              </div>
              <div>
                <FieldLabel>Status</FieldLabel>
                <select
                  value={form.status}
                  onChange={(e) =>
                    setField('status', e.target.value as PayrollStatus)
                  }
                  className="w-full rounded-lg border border-[#DDE3EC] px-3 py-2.5 font-inter text-sm outline-none focus:border-[#E8A020]"
                >
                  <option value="pending">Pending</option>
                  <option value="processing">Processing</option>
                  <option value="paid">Paid</option>
                </select>
              </div>
            </div>

            {form.paymentMethod === 'bank-transfer' && (
              <div className="mb-5">
                <FieldLabel>Bank Account Details</FieldLabel>
                <textarea
                  value={form.bankDetails}
                  onChange={(e) => setField('bankDetails', e.target.value)}
                  rows={2}
                  placeholder="Bank name, account number, branch…"
                  className="w-full resize-none rounded-lg border border-[#DDE3EC] px-3 py-2.5 font-inter text-sm outline-none focus:border-[#E8A020]"
                />
              </div>
            )}

            <div className="mb-5">
              <FieldLabel>Notes</FieldLabel>
              <textarea
                value={form.notes}
                onChange={(e) => setField('notes', e.target.value)}
                rows={2}
                className="w-full resize-none rounded-lg border border-[#DDE3EC] px-3 py-2.5 font-inter text-sm outline-none focus:border-[#E8A020]"
              />
            </div>

            <div className="rounded-xl border border-[#E8A020]/30 bg-[#E8A020]/10 p-4">
              <p className="font-inter text-xs uppercase tracking-wide text-[#5A6A7A]">
                Net Pay (calculated)
              </p>
              <p className="font-jakarta text-2xl font-bold text-[#0B3D6B]">
                LKR {computed.netPay.toLocaleString('en-LK')}
              </p>
              <p className="mt-1 text-xs text-[#5A6A7A]">
                Base {computed.grossBase.toLocaleString()} + Bonus + Commission −
                Deductions ({computed.deductions.toLocaleString()})
              </p>
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
              {saving ? 'Saving…' : isEdit ? 'Update Payroll' : 'Save Payroll'}
            </button>
          </div>
        </form>
      </aside>
    </>
  )
}
