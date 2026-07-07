'use client'

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
} from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { formatLKR } from '@/lib/utility-bills/helpers'
import { useManagement } from '@/components/layout/ManagementContext'
import type { Role } from '@/types'

const LOCATION_OPTIONS = [
  { value: 'Ahangama', label: 'Ahangama' },
  { value: 'Galle', label: 'Galle' },
  { value: 'Waduraba', label: 'Waduraba' },
  { value: 'Pinnaduwa', label: 'Pinnaduwa' },
] as const

type ToastKind = 'success' | 'warning'

type House = {
  id: string
  name: string
  address: string
  landlordName: string
  landlordPhone: string
  monthlyRent: number
  leaseStart: string
  leaseEnd: string
  location: string
  capacity: number
  notes: string
  createdAt?: Timestamp
  createdBy?: string
}

type HouseForm = {
  name: string
  address: string
  landlordName: string
  landlordPhone: string
  monthlyRent: string
  leaseStart: string
  leaseEnd: string
  location: string
  capacity: string
  notes: string
}

function SummaryCard({
  label,
  value,
  loading,
}: {
  label: string
  value: string
  loading?: boolean
}) {
  return (
    <div className="rounded-xl border border-[#DDE3EC] bg-white p-5 dark:bg-gray-800">
      <p className="font-inter text-xs font-medium uppercase tracking-wide text-[#5A6A7A]">
        {label}
      </p>
      {loading ? (
        <div className="mt-2 h-8 w-24 animate-pulse rounded bg-[#DDE3EC]" />
      ) : (
        <p className="mt-1 font-jakarta text-2xl font-bold text-[#0B3D6B]">{value}</p>
      )}
    </div>
  )
}

function emptyForm(): HouseForm {
  return {
    name: '',
    address: '',
    landlordName: '',
    landlordPhone: '',
    monthlyRent: '',
    leaseStart: '',
    leaseEnd: '',
    location: 'Ahangama',
    capacity: '1',
    notes: '',
  }
}

// Current month key "YYYY-MM" for reading each house's current-month bill total.
const CURRENT_MONTH_KEY = (() => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
})()

function AccommodationPageContent() {
  const { user, hasRole } = useManagement()
  const [houses, setHouses] = useState<House[]>([])
  const [billTotals, setBillTotals] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editTarget, setEditTarget] = useState<House | null>(null)
  const [form, setForm] = useState<HouseForm>(emptyForm())
  const [toast, setToast] = useState('')
  const [toastKind, setToastKind] = useState<ToastKind>('success')

  const allowed = (['admin', 'owner', 'accountant', 'reception', 'teacher', 'examCoordinator'] as Role[]).some((r) => hasRole(r))

  const showToast = useCallback((msg: string, kind: ToastKind = 'success') => {
    setToastKind(kind)
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }, [])

  const loadHouses = useCallback(async () => {
    setLoading(true)
    try {
      const snap = await getDocs(query(collection(db, 'accommodations'), orderBy('createdAt', 'desc')))
      const data = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<House, 'id'>) }))
      setHouses(data)

      // Fetch each house's current-month bill total (best-effort; roles without bill
      // read access simply resolve to "no total" and show "—").
      const totals: Record<string, number> = {}
      await Promise.all(
        data.map(async (h) => {
          try {
            const billSnap = await getDoc(doc(db, 'accommodations', h.id, 'bills', CURRENT_MONTH_KEY))
            if (billSnap.exists()) {
              totals[h.id] = Number((billSnap.data() as { totalAmount?: number }).totalAmount ?? 0)
            }
          } catch {
            /* no access or no bill — leave undefined */
          }
        }),
      )
      setBillTotals(totals)
    } catch (err) {
      console.error('[AccommodationPage]', err)
      setHouses([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!allowed) return
    void loadHouses()
  }, [allowed, loadHouses])

  const stats = useMemo(() => {
    const totalHouses = houses.length
    const monthlyRentTotal = houses.reduce((sum, h) => sum + Number(h.monthlyRent || 0), 0)
    const today = new Date().toISOString().slice(0, 10)
    const activeLeases = houses.filter((h) => (h.leaseEnd || '') >= today).length
    return { totalHouses, monthlyRentTotal, activeLeases }
  }, [houses])

  function openAddModal() {
    setEditTarget(null)
    setForm(emptyForm())
    setFormOpen(true)
  }

  function openEditModal(house: House) {
    setEditTarget(house)
    setForm({
      name: house.name ?? '',
      address: house.address ?? '',
      landlordName: house.landlordName ?? '',
      landlordPhone: house.landlordPhone ?? '',
      monthlyRent: String(house.monthlyRent ?? ''),
      leaseStart: house.leaseStart ?? '',
      leaseEnd: house.leaseEnd ?? '',
      location: house.location || 'Ahangama',
      capacity: String(house.capacity ?? 1),
      notes: house.notes ?? '',
    })
    setFormOpen(true)
  }

  async function handleSaveHouse() {
    if (!user || !form.name.trim() || !form.address.trim()) return
    setSaving(true)
    try {
      const payload = {
        name: form.name.trim(),
        address: form.address.trim(),
        landlordName: form.landlordName.trim(),
        landlordPhone: form.landlordPhone.trim(),
        monthlyRent: Number(form.monthlyRent || 0),
        leaseStart: form.leaseStart,
        leaseEnd: form.leaseEnd,
        location: form.location,
        capacity: Math.max(1, Number(form.capacity || 1)),
        notes: form.notes.trim(),
      }

      if (editTarget) {
        await updateDoc(doc(db, 'accommodations', editTarget.id), payload)
        showToast('House updated successfully')
      } else {
        await addDoc(collection(db, 'accommodations'), {
          ...payload,
          createdAt: serverTimestamp(),
          createdBy: user.uid,
        })
        showToast('House added successfully')
      }

      setFormOpen(false)
      setEditTarget(null)
      setForm(emptyForm())
      await loadHouses()
    } catch (err) {
      console.error('[AccommodationPage] save', err)
      showToast('Failed to save house', 'warning')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteHouse(house: House) {
    if (!(hasRole('admin') || hasRole('owner'))) return
    if (!window.confirm(`Delete ${house.name}?`)) return
    try {
      await deleteDoc(doc(db, 'accommodations', house.id))
      showToast('House deleted successfully')
      await loadHouses()
    } catch (err) {
      console.error('[AccommodationPage] delete', err)
      showToast('Failed to delete house', 'warning')
    }
  }

  if (!allowed) {
    return <p>You do not have access to this page.</p>
  }

  return (
    <div className="space-y-6">
      {toast && (
        <div
          className={`fixed bottom-6 right-4 z-50 rounded-xl px-5 py-3 text-sm font-medium text-white shadow-lg ${
            toastKind === 'warning' ? 'bg-amber-600' : 'bg-emerald-600'
          }`}
        >
          {toast}
        </div>
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-jakarta text-2xl font-bold text-[#0D1B2A] dark:text-white">
            Accommodation
          </h2>
          <p className="font-inter text-sm text-[#5A6A7A]">
            Manage rented houses and landlord details
          </p>
        </div>
        <button
          type="button"
          onClick={openAddModal}
          className="inline-flex items-center gap-2 rounded-full bg-[#E8A020] px-6 py-3 font-jakarta text-sm font-bold text-[#0B3D6B] hover:bg-[#F5B942]"
        >
          <span className="ti ti-plus" aria-hidden="true" />
          Add House
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <SummaryCard
          label="Total Houses"
          value={String(stats.totalHouses)}
          loading={loading}
        />
        <SummaryCard
          label="Monthly Rent Total"
          value={formatLKR(stats.monthlyRentTotal)}
          loading={loading}
        />
        <SummaryCard
          label="Active Leases"
          value={String(stats.activeLeases)}
          loading={loading}
        />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-56 animate-pulse rounded-xl bg-[#DDE3EC]" />
          ))}
        </div>
      ) : houses.length === 0 ? (
        <div className="rounded-2xl border border-gray-100 bg-white py-16 text-center shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <span className="ti ti-home-off text-4xl text-gray-300" />
          <p className="mt-3 text-sm text-gray-500">No accommodation houses yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {houses.map((house) => (
            <div
              key={house.id}
              className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-jakarta text-lg font-bold text-[#0B3D6B] dark:text-white">
                  {house.name}
                </h3>
                <span className="inline-flex rounded-full border border-[#DDE3EC] bg-[#F5F7FB] px-2.5 py-0.5 text-xs font-medium text-[#0B3D6B]">
                  {house.location}
                </span>
              </div>

              <div className="mt-3 space-y-2 text-sm text-gray-600 dark:text-gray-300">
                <p className="flex items-start gap-2">
                  <span className="ti ti-map-pin mt-0.5 text-[#0B3D6B]" />
                  <span>{house.address}</span>
                </p>
                <p className="flex items-center gap-2">
                  <span className="ti ti-user text-[#0B3D6B]" />
                  <span>{house.landlordName || '-'}</span>
                </p>
                <p className="flex items-center gap-2">
                  <span className="ti ti-phone text-[#0B3D6B]" />
                  <span>{house.landlordPhone || '-'}</span>
                </p>
                <p className="text-sm font-bold text-[#E8A020]">
                  {formatLKR(Number(house.monthlyRent || 0))}
                </p>
                <p>Capacity: {Number(house.capacity || 0)} students</p>
                <p>
                  Lease period: {house.leaseStart || '-'} → {house.leaseEnd || '-'}
                </p>
                <p className="flex items-center gap-2">
                  <span className="ti ti-receipt text-[#0B3D6B]" />
                  <span>
                    This month&apos;s bills:{' '}
                    <span className="font-semibold text-[#0B3D6B] dark:text-[#E8A020]">
                      {billTotals[house.id] != null ? formatLKR(billTotals[house.id]) : '—'}
                    </span>
                  </span>
                </p>
                {house.notes && (
                  <p className="text-xs text-[#5A6A7A] dark:text-white/50">{house.notes}</p>
                )}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href={`/accommodation/${house.id}`}
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                  View Bills
                </Link>
                {(user?.roles?.some((r) => r !== 'teacher') ?? false) && (
                  <button
                    type="button"
                    onClick={() => openEditModal(house)}
                    className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Edit
                  </button>
                )}
                {(hasRole('admin') || hasRole('owner')) && (
                  <button
                    type="button"
                    onClick={() => void handleDeleteHouse(house)}
                    className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => {
              setFormOpen(false)
              setEditTarget(null)
            }}
          />
          <div className="relative z-10 w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-800">
            <h2 className="font-jakarta text-lg font-bold text-[#0B3D6B] dark:text-white">
              {editTarget ? 'Edit House' : 'Add House'}
            </h2>

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="mb-1 block text-xs font-medium text-gray-500">House Name</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-1 block text-xs font-medium text-gray-500">Address</label>
                <input
                  value={form.address}
                  onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Location</label>
                <select
                  value={form.location}
                  onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                >
                  {LOCATION_OPTIONS.map((loc) => (
                    <option key={loc.value} value={loc.value}>
                      {loc.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Landlord Name</label>
                <input
                  value={form.landlordName}
                  onChange={(e) => setForm((p) => ({ ...p, landlordName: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Landlord Phone</label>
                <input
                  value={form.landlordPhone}
                  onChange={(e) => setForm((p) => ({ ...p, landlordPhone: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Monthly Rent LKR</label>
                <input
                  type="number"
                  value={form.monthlyRent}
                  onChange={(e) => setForm((p) => ({ ...p, monthlyRent: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Capacity</label>
                <input
                  type="number"
                  min={1}
                  value={form.capacity}
                  onChange={(e) => setForm((p) => ({ ...p, capacity: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Lease Start</label>
                <input
                  type="date"
                  value={form.leaseStart}
                  onChange={(e) => setForm((p) => ({ ...p, leaseStart: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Lease End</label>
                <input
                  type="date"
                  value={form.leaseEnd}
                  onChange={(e) => setForm((p) => ({ ...p, leaseEnd: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-1 block text-xs font-medium text-gray-500">Notes</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                  rows={3}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                />
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setFormOpen(false)
                  setEditTarget(null)
                }}
                className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving || !form.name.trim() || !form.address.trim()}
                onClick={() => void handleSaveHouse()}
                className="flex-1 rounded-xl bg-[#E8A020] py-2.5 text-sm font-bold text-[#0B3D6B] disabled:opacity-50"
              >
                {saving ? 'Saving…' : editTarget ? 'Save Changes' : 'Add House'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function AccommodationPage() {
  return (
    <Suspense
      fallback={
        <div className="animate-pulse space-y-4 p-6">
          <div className="h-10 w-48 rounded bg-[#DDE3EC]" />
          <div className="h-64 rounded-xl bg-[#DDE3EC]" />
        </div>
      }
    >
      <AccommodationPageContent />
    </Suspense>
  )
}
