'use client'

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { collection, doc, getDoc, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { formatLKR } from '@/lib/utils/formatCurrency'
import { useManagement } from '@/components/layout/ManagementContext'
import {
  currentMonthKey,
  locationFromName,
  monthKeyToLabel,
  seedAccommodations,
} from '@/lib/accommodation/helpers'
import HouseFormModal from '@/components/accommodation/HouseFormModal'
import BillsPanel from '@/components/accommodation/BillsPanel'
import InventoryPanel from '@/components/accommodation/InventoryPanel'
import type { AccommodationHouse } from '@/types/accommodation'
import type { Role } from '@/types'

type ToastKind = 'success' | 'warning'

interface CurrentBillInfo {
  hasBill: boolean
  rentPaid: boolean
  utilities: number
}

function normalizeHouse(id: string, data: Record<string, unknown>): AccommodationHouse {
  return {
    id,
    name: String(data.name ?? ''),
    address: String(data.address ?? ''),
    landlordName: String(data.landlordName ?? ''),
    landlordPhone: String(data.landlordPhone ?? ''),
    monthlyRent: Number(data.monthlyRent ?? 0),
    rentDueDay: Number(data.rentDueDay ?? 5),
    capacity: Number(data.capacity ?? 0),
    status: data.status === 'inactive' ? 'inactive' : 'active',
    notes: data.notes ? String(data.notes) : '',
    createdAt: typeof data.createdAt === 'string' ? data.createdAt : '',
  }
}

const LOCATION_BADGE: Record<string, string> = {
  Ahangama: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',
  Waduraba: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
  Pinnaduwa: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300',
  Galle: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  Hampton: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
  Other: 'bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-white/60',
}

function SummaryCard({ label, value, sub, loading }: { label: string; value: string; sub?: string; loading?: boolean }) {
  return (
    <div className="rounded-xl border border-[#DDE3EC] dark:border-white/10 bg-white p-5 dark:bg-gray-800">
      <p className="font-inter text-xs font-medium uppercase tracking-wide text-[#5A6A7A] dark:text-white/50">{label}</p>
      {loading ? (
        <div className="mt-2 h-8 w-24 animate-pulse rounded bg-[#DDE3EC] dark:bg-white/10" />
      ) : (
        <>
          <p className="mt-1 font-jakarta text-2xl font-bold text-[#0B3D6B] dark:text-[#E8A020]">{value}</p>
          {sub && <p className="mt-0.5 text-xs text-[#5A6A7A] dark:text-white/40">{sub}</p>}
        </>
      )}
    </div>
  )
}

function AccommodationPageContent() {
  const { user, hasRole } = useManagement()
  const [houses, setHouses] = useState<AccommodationHouse[]>([])
  const [billInfo, setBillInfo] = useState<Record<string, CurrentBillInfo>>({})
  const [loading, setLoading] = useState(true)
  const [seeding, setSeeding] = useState(false)
  const [toast, setToast] = useState('')
  const [toastKind, setToastKind] = useState<ToastKind>('success')

  const [houseModalOpen, setHouseModalOpen] = useState(false)
  const [editHouse, setEditHouse] = useState<AccommodationHouse | null>(null)
  const [billsHouse, setBillsHouse] = useState<AccommodationHouse | null>(null)
  const [inventoryHouse, setInventoryHouse] = useState<AccommodationHouse | null>(null)

  const allowed = (['admin', 'owner', 'accountant', 'reception', 'teacher', 'examCoordinator'] as Role[]).some((r) => hasRole(r))
  const canManage = (['admin', 'owner', 'accountant'] as Role[]).some((r) => hasRole(r))
  const isOwnerAdmin = hasRole('admin') || hasRole('owner')

  const monthKey = currentMonthKey()

  const showToast = useCallback((msg: string, kind: ToastKind = 'success') => {
    setToastKind(kind)
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }, [])

  const loadHouses = useCallback(async () => {
    setLoading(true)
    try {
      const snap = await getDocs(collection(db, 'accommodations'))
      const data = snap.docs
        .map((d) => normalizeHouse(d.id, d.data() as Record<string, unknown>))
        .sort((a, b) => a.name.localeCompare(b.name))
      setHouses(data)

      // Best-effort current-month bill per house (rent-paid status + utilities).
      const info: Record<string, CurrentBillInfo> = {}
      await Promise.all(
        data.map(async (h) => {
          try {
            const billSnap = await getDoc(doc(db, 'accommodations', h.id, 'bills', monthKey))
            if (billSnap.exists()) {
              const b = billSnap.data() as Record<string, unknown>
              const utilities = Number(b.ceb ?? 0) + Number(b.water ?? 0) + Number(b.internet ?? 0) + Number(b.other ?? 0)
              info[h.id] = { hasBill: true, rentPaid: Boolean(b.rentPaid ?? b.paid ?? false), utilities }
            }
          } catch {
            /* no read access / no bill */
          }
        }),
      )
      setBillInfo(info)
    } catch (err) {
      console.error('[AccommodationPage]', err)
      setHouses([])
    } finally {
      setLoading(false)
    }
  }, [monthKey])

  useEffect(() => {
    if (!allowed) return
    void loadHouses()
  }, [allowed, loadHouses])

  const summary = useMemo(() => {
    const active = houses.filter((h) => h.status === 'active')
    const totalRent = active.reduce((s, h) => s + Number(h.monthlyRent || 0), 0)
    const paidCount = active.filter((h) => billInfo[h.id]?.rentPaid).length
    const unpaidHouses = active.filter((h) => !billInfo[h.id]?.rentPaid)
    const unpaidTotal = unpaidHouses.reduce((s, h) => s + Number(h.monthlyRent || 0), 0)
    return {
      activeCount: active.length,
      totalRent,
      paidCount,
      unpaidCount: unpaidHouses.length,
      unpaidTotal,
    }
  }, [houses, billInfo])

  async function handleSeed() {
    if (!isOwnerAdmin || houses.length > 0) return
    setSeeding(true)
    try {
      const count = await seedAccommodations(user?.uid ?? '')
      showToast(`Seeded ${count} houses with default inventory`)
      await loadHouses()
    } catch (err) {
      console.error('[AccommodationPage] seed', err)
      showToast('Failed to seed houses', 'warning')
    } finally {
      setSeeding(false)
    }
  }

  if (!allowed) {
    return <p className="text-sm text-[#5A6A7A] dark:text-white/50">You do not have access to this page.</p>
  }

  return (
    <div className="space-y-6">
      {toast && (
        <div className={`fixed bottom-6 right-4 z-[70] rounded-xl px-5 py-3 text-sm font-medium text-white shadow-lg ${toastKind === 'warning' ? 'bg-amber-600' : 'bg-emerald-600'}`}>
          {toast}
        </div>
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-jakarta text-2xl font-bold text-[#0D1B2A] dark:text-white">Accommodation</h2>
          <p className="font-inter text-sm text-[#5A6A7A] dark:text-white/60">
            Houses, monthly bills and inventory — {monthKeyToLabel(monthKey)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isOwnerAdmin && houses.length === 0 && !loading && (
            <button
              type="button"
              disabled={seeding}
              onClick={() => void handleSeed()}
              className="inline-flex items-center gap-2 rounded-full border border-[#0B3D6B] px-5 py-3 font-jakarta text-sm font-bold text-[#0B3D6B] dark:border-white/20 dark:text-white hover:bg-[#F5F7FB] dark:hover:bg-white/[0.06] disabled:opacity-50"
            >
              <span className={`ti ti-database-import ${seeding ? 'animate-pulse' : ''}`} /> {seeding ? 'Seeding…' : 'Seed Houses'}
            </button>
          )}
          {canManage && (
            <button
              type="button"
              onClick={() => { setEditHouse(null); setHouseModalOpen(true) }}
              className="inline-flex items-center gap-2 rounded-full bg-[#E8A020] px-6 py-3 font-jakarta text-sm font-bold text-[#0B3D6B] hover:bg-[#F5B942]"
            >
              <span className="ti ti-plus" aria-hidden="true" /> Add House
            </button>
          )}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Total Houses" value={String(summary.activeCount)} sub="Active" loading={loading} />
        <SummaryCard label="Total Monthly Rent" value={formatLKR(summary.totalRent)} loading={loading} />
        <SummaryCard label="Paid This Month" value={`${summary.paidCount} / ${summary.activeCount}`} sub="Rent received" loading={loading} />
        <SummaryCard label="Unpaid This Month" value={String(summary.unpaidCount)} sub={`${formatLKR(summary.unpaidTotal)} outstanding`} loading={loading} />
      </div>

      {/* House grid */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-56 animate-pulse rounded-2xl bg-[#DDE3EC] dark:bg-white/10" />
          ))}
        </div>
      ) : houses.length === 0 ? (
        <div className="rounded-2xl border border-gray-100 bg-white py-16 text-center shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <span className="ti ti-home-off text-4xl text-gray-300 dark:text-gray-600" />
          <p className="mt-3 text-sm text-gray-500 dark:text-white/50">No accommodation houses yet</p>
          {isOwnerAdmin && <p className="mt-1 text-xs text-gray-400 dark:text-white/40">Use “Seed Houses” to create the 15 standard houses.</p>}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {houses.map((house) => {
            const location = locationFromName(house.name)
            const info = billInfo[house.id]
            const pill = !info?.hasBill
              ? { text: 'No Bill', cls: 'bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-white/50' }
              : info.rentPaid
                ? { text: 'Rent Paid', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' }
                : { text: 'Rent Unpaid', cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' }
            return (
              <div key={house.id} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-jakarta text-lg font-bold text-[#0B3D6B] dark:text-white">{house.name}</h3>
                  <span className={`inline-flex shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${LOCATION_BADGE[location] ?? LOCATION_BADGE.Other}`}>
                    {location}
                  </span>
                </div>

                <div className="mt-3 space-y-2 text-sm text-gray-600 dark:text-gray-300">
                  <p className="flex items-center gap-2">
                    <span className="ti ti-user text-[#0B3D6B] dark:text-[#E8A020]" />
                    <span>{house.landlordName || 'Not set'}</span>
                  </p>
                  <p className="flex items-center gap-2">
                    <span className="ti ti-phone text-[#0B3D6B] dark:text-[#E8A020]" />
                    <span>{house.landlordPhone || 'Not set'}</span>
                  </p>
                  <p className="text-sm font-bold text-[#E8A020]">{formatLKR(house.monthlyRent)}</p>
                  <p>Capacity: {house.capacity} students</p>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${pill.cls}`}>{pill.text}</span>
                    <span className="text-xs text-[#5A6A7A] dark:text-white/40">
                      Utilities: {info?.hasBill ? formatLKR(info.utilities) : '—'}
                    </span>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setBillsHouse(house)}
                    className="rounded-lg border border-gray-200 dark:border-gray-600 px-3 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    <span className="ti ti-receipt mr-1" /> Bills
                  </button>
                  <button
                    type="button"
                    onClick={() => setInventoryHouse(house)}
                    className="rounded-lg border border-gray-200 dark:border-gray-600 px-3 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    <span className="ti ti-clipboard-list mr-1" /> Inventory
                  </button>
                  {canManage && (
                    <button
                      type="button"
                      onClick={() => { setEditHouse(house); setHouseModalOpen(true) }}
                      className="rounded-lg border border-gray-200 dark:border-gray-600 px-3 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      <span className="ti ti-pencil mr-1" /> Edit
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <HouseFormModal
        open={houseModalOpen}
        house={editHouse}
        onClose={() => { setHouseModalOpen(false); setEditHouse(null) }}
        onSaved={(msg) => { showToast(msg, msg.startsWith('Failed') ? 'warning' : 'success'); void loadHouses() }}
      />

      {billsHouse && (
        <BillsPanel
          house={billsHouse}
          canManage={canManage}
          onClose={() => setBillsHouse(null)}
          onChanged={() => void loadHouses()}
        />
      )}

      {inventoryHouse && (
        <InventoryPanel
          house={inventoryHouse}
          canManage={canManage}
          onClose={() => setInventoryHouse(null)}
        />
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
