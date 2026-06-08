'use client'

import { useEffect, useState } from 'react'
import {
  collection,
  doc,
  serverTimestamp,
  setDoc,
  Timestamp,
} from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { db, storage } from '@/lib/firebase/client'
import {
  CATEGORY_LABELS,
  monthKeyFromDate,
  type UtilityBillCategory,
} from '@/lib/utility-bills/helpers'
import { useManagement } from '@/components/layout/ManagementContext'
import { logAuditEvent } from '@/lib/audit/helpers'

interface UtilityBillFormProps {
  open: boolean
  onClose: () => void
  onSaved: () => void
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1.5 block font-inter text-xs font-medium uppercase tracking-wide text-[#5A6A7A]">
      {children}
    </label>
  )
}

export default function UtilityBillForm({ open, onClose, onSaved }: UtilityBillFormProps) {
  const { user } = useManagement()
  const [category, setCategory] = useState<UtilityBillCategory>('electricity')
  const [amount, setAmount] = useState('')
  const [billDate, setBillDate] = useState(new Date().toISOString().slice(0, 10))
  const [dueDate, setDueDate] = useState('')
  const [notes, setNotes] = useState('')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      setCategory('electricity')
      setAmount('')
      setBillDate(new Date().toISOString().slice(0, 10))
      setDueDate('')
      setNotes('')
      setPhotoFile(null)
      setError('')
    }
  }, [open])

  if (!open) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return

    const parsedAmount = Number(amount)
    if (!parsedAmount || parsedAmount <= 0) {
      setError('Enter a valid amount in LKR.')
      return
    }
    if (!billDate) {
      setError('Bill date is required.')
      return
    }

    setSaving(true)
    setError('')

    try {
      const billRef = doc(collection(db, 'utilityBills'))
      const billId = billRef.id
      let photoUrl: string | undefined

      if (photoFile) {
        const storageRef = ref(storage, `utility-bills/${billId}`)
        await uploadBytes(storageRef, photoFile)
        photoUrl = await getDownloadURL(storageRef)
      }

      const billTimestamp = Timestamp.fromDate(new Date(billDate + 'T12:00:00'))
      const dueTimestamp = dueDate
        ? Timestamp.fromDate(new Date(dueDate + 'T12:00:00'))
        : undefined

      await setDoc(billRef, {
        category,
        amount: parsedAmount,
        currency: 'LKR',
        billDate: billTimestamp,
        dueDate: dueTimestamp ?? null,
        photoUrl: photoUrl ?? null,
        notes: notes.trim(),
        addedBy: user!.uid,
        addedByName: user!.displayName || user!.email,
        createdAt: serverTimestamp(),
        month: monthKeyFromDate(billDate),
      })

      await logAuditEvent({
        userId: user!.uid,
        userEmail: user!.email,
        userRole: user!.role,
        action: 'created',
        entityType: 'utilityBill',
        entityId: billId,
        details: `Added ${CATEGORY_LABELS[category]} bill — LKR ${parsedAmount}`,
      })

      onSaved()
      onClose()
    } catch (err) {
      console.error('[UtilityBillForm]', err)
      setError('Failed to save bill. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-[#0D1B2A]/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col bg-white/90 dark:bg-[#0d1a2e]/90 backdrop-blur-2xl border-l border-white/80 dark:border-white/[0.08] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#DDE3EC] px-6 py-4">
          <h2 className="font-jakarta text-lg font-bold text-[#0B3D6B]">Add Utility Bill</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-[#5A6A7A] hover:bg-[#F5F7FB]"
            aria-label="Close"
          >
            <span className="ti ti-x text-xl" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-y-auto">
          <div className="space-y-4 px-6 py-5">
            <div>
              <FieldLabel>Category</FieldLabel>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as UtilityBillCategory)}
                className="w-full rounded-lg border border-[#DDE3EC] px-3 py-2.5 text-sm"
              >
                {(Object.keys(CATEGORY_LABELS) as UtilityBillCategory[]).map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_LABELS[c]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <FieldLabel>Amount (LKR)</FieldLabel>
              <input
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full rounded-lg border border-[#DDE3EC] px-3 py-2.5 text-sm"
                required
              />
            </div>

            <div>
              <FieldLabel>Bill Date</FieldLabel>
              <input
                type="date"
                value={billDate}
                onChange={(e) => setBillDate(e.target.value)}
                className="w-full rounded-lg border border-[#DDE3EC] px-3 py-2.5 text-sm"
                required
              />
            </div>

            <div>
              <FieldLabel>Due Date (optional)</FieldLabel>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full rounded-lg border border-[#DDE3EC] px-3 py-2.5 text-sm"
              />
            </div>

            <div>
              <FieldLabel>Photo</FieldLabel>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
                className="w-full text-sm text-[#5A6A7A]"
              />
            </div>

            <div>
              <FieldLabel>Notes</FieldLabel>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-[#DDE3EC] px-3 py-2.5 text-sm"
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>

          <div className="mt-auto border-t border-[#DDE3EC] px-6 py-4">
            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-full bg-[#E8A020] px-6 py-3 font-jakarta text-sm font-bold text-[#0B3D6B] hover:bg-[#F5B942] disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save Bill'}
            </button>
          </div>
        </form>
      </aside>
    </>
  )
}
