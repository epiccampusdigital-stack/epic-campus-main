'use client'

import { useEffect, useState } from 'react'
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { db, storage } from '@/lib/firebase/client'
import { useManagement } from '@/components/layout/ManagementContext'
import { logAuditEvent } from '@/lib/audit/helpers'
import { formatLKR } from '@/lib/utility-bills/helpers'
import type { FixedUtilityBill } from '@/lib/utility-bills/fixed-bills'

interface FixedBillPayModalProps {
  bill: FixedUtilityBill | null
  open: boolean
  onClose: () => void
  onSaved: () => void
}

export default function FixedBillPayModal({
  bill,
  open,
  onClose,
  onSaved,
}: FixedBillPayModalProps) {
  const { user } = useManagement()
  const [actualAmount, setActualAmount] = useState('')
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10))
  const [notes, setNotes] = useState('')
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open && bill) {
      setActualAmount(String(bill.expectedAmount))
      setPaymentDate(new Date().toISOString().slice(0, 10))
      setNotes(bill.notes ?? '')
      setReceiptFile(null)
      setError('')
    }
  }, [open, bill])

  if (!open || !bill) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    const amount = Number(actualAmount)
    if (!amount || amount <= 0) {
      setError('Enter a valid amount.')
      return
    }

    setSaving(true)
    setError('')
    try {
      let receiptUrl = bill!.receiptUrl
      if (receiptFile) {
        const storageRef = ref(storage, `utility-bills/fixed/${bill!.id}/${Date.now()}`)
        await uploadBytes(storageRef, receiptFile)
        receiptUrl = await getDownloadURL(storageRef)
      }

      await updateDoc(doc(db, 'fixedUtilityBills', bill!.id), {
        paid: true,
        actualAmount: amount,
        paymentDate,
        notes: notes.trim() || null,
        receiptUrl: receiptUrl ?? null,
        updatedAt: serverTimestamp(),
      })

      await logAuditEvent({
        userId: user.uid,
        userEmail: user.email,
        userRole: user.role,
        action: 'updated',
        entityType: 'utilityBill',
        entityId: bill!.id,
        details: `Marked fixed bill ${bill!.billName} as paid — ${formatLKR(amount)}`,
      })

      onSaved()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-[#0D1B2A]/40" onClick={onClose} aria-hidden="true" />
      <div
        className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-[#DDE3EC] bg-white p-6 shadow-xl dark:bg-gray-800"
        role="dialog"
        aria-modal="true"
      >
        <h3 className="font-jakarta text-lg font-bold text-[#0B3D6B] dark:text-white">
          Mark as paid — {bill.billName}
        </h3>
        <p className="mt-1 text-sm text-[#5A6A7A]">
          Expected: {formatLKR(bill.expectedAmount)}
        </p>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium uppercase text-[#5A6A7A]">
              Actual amount (LKR)
            </label>
            <input
              type="number"
              min="0"
              value={actualAmount}
              onChange={(e) => setActualAmount(e.target.value)}
              required
              className="w-full rounded-lg border border-[#DDE3EC] px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium uppercase text-[#5A6A7A]">
              Payment date
            </label>
            <input
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              required
              className="w-full rounded-lg border border-[#DDE3EC] px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium uppercase text-[#5A6A7A]">
              Receipt photo
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)}
              className="w-full text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium uppercase text-[#5A6A7A]">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-[#DDE3EC] px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-[#DDE3EC] py-2 text-sm font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-lg bg-[#E8A020] py-2 text-sm font-bold text-[#0B3D6B] disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Confirm paid'}
            </button>
          </div>
        </form>
      </div>
    </>
  )
}
