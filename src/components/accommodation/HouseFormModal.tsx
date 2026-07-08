'use client'

import { useEffect, useState } from 'react'
import { collection, doc, setDoc, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import type { AccommodationHouse } from '@/types/accommodation'

interface Props {
  open: boolean
  house: AccommodationHouse | null // null = add new
  onClose: () => void
  onSaved: (message: string) => void
}

const inputClass =
  'w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-[#0D1B2A] dark:text-white outline-none focus:border-[#E8A020]'

interface FormState {
  name: string
  address: string
  landlordName: string
  landlordPhone: string
  monthlyRent: string
  rentDueDay: string
  capacity: string
  status: 'active' | 'inactive'
  notes: string
}

function emptyForm(): FormState {
  return {
    name: '',
    address: '',
    landlordName: '',
    landlordPhone: '',
    monthlyRent: '',
    rentDueDay: '5',
    capacity: '6',
    status: 'active',
    notes: '',
  }
}

export default function HouseFormModal({ open, house, onClose, onSaved }: Props) {
  const [form, setForm] = useState<FormState>(emptyForm())
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    if (house) {
      setForm({
        name: house.name ?? '',
        address: house.address ?? '',
        landlordName: house.landlordName ?? '',
        landlordPhone: house.landlordPhone ?? '',
        monthlyRent: String(house.monthlyRent ?? ''),
        rentDueDay: String(house.rentDueDay ?? 5),
        capacity: String(house.capacity ?? 6),
        status: house.status === 'inactive' ? 'inactive' : 'active',
        notes: house.notes ?? '',
      })
    } else {
      setForm(emptyForm())
    }
  }, [open, house])

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function save() {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      const id = house?.id ?? doc(collection(db, 'accommodations')).id
      const payload = {
        name: form.name.trim(),
        address: form.address.trim(),
        landlordName: form.landlordName.trim(),
        landlordPhone: form.landlordPhone.trim(),
        monthlyRent: Number(form.monthlyRent || 0),
        rentDueDay: Math.min(31, Math.max(1, Number(form.rentDueDay || 1))),
        capacity: Math.max(1, Number(form.capacity || 1)),
        status: form.status,
        notes: form.notes.trim(),
      }
      if (house) {
        await updateDoc(doc(db, 'accommodations', id), payload)
        onSaved('House updated')
      } else {
        await setDoc(doc(db, 'accommodations', id), {
          ...payload,
          createdAt: new Date().toISOString(),
        })
        onSaved('House added')
      }
      onClose()
    } catch (err) {
      console.error('[HouseFormModal] save', err)
      onSaved('Failed to save house')
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-800">
        <h2 className="font-jakarta text-lg font-bold text-[#0B3D6B] dark:text-white">
          {house ? 'Edit House' : 'Add House'}
        </h2>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-300">House Name *</label>
            <input value={form.name} onChange={(e) => set('name', e.target.value)} className={inputClass} />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-300">Address</label>
            <textarea value={form.address} onChange={(e) => set('address', e.target.value)} rows={2} className={`${inputClass} resize-none`} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-300">Landlord Name</label>
            <input value={form.landlordName} onChange={(e) => set('landlordName', e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-300">Landlord Phone</label>
            <input value={form.landlordPhone} onChange={(e) => set('landlordPhone', e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-300">Monthly Rent (LKR)</label>
            <input type="number" value={form.monthlyRent} onChange={(e) => set('monthlyRent', e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-300">Rent Due Day (1–31)</label>
            <input type="number" min={1} max={31} value={form.rentDueDay} onChange={(e) => set('rentDueDay', e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-300">Capacity</label>
            <input type="number" min={1} value={form.capacity} onChange={(e) => set('capacity', e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-300">Status</label>
            <select value={form.status} onChange={(e) => set('status', e.target.value as FormState['status'])} className={inputClass}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-300">Notes</label>
            <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={3} className={`${inputClass} resize-none`} />
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-gray-200 dark:border-gray-600 py-2.5 text-sm font-medium text-[#5A6A7A] dark:text-white/70"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving || !form.name.trim()}
            onClick={() => void save()}
            className="flex-1 rounded-xl bg-[#E8A020] py-2.5 text-sm font-bold text-[#0B3D6B] disabled:opacity-50"
          >
            {saving ? 'Saving…' : house ? 'Save Changes' : 'Add House'}
          </button>
        </div>
      </div>
    </div>
  )
}
