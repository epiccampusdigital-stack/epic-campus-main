'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  updateDoc,
  deleteDoc,
} from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { useManagement } from '@/components/layout/ManagementContext'

interface House {
  id: string
  name: string
  address?: string
  landlordName?: string
  landlordPhone?: string
  monthlyRent?: number
  leaseStart?: string
  leaseEnd?: string
  location?: string
  capacity?: number
  notes?: string
}

interface Student {
  id: string
  name: string
  studentCode?: string
  courseId?: string
  houseId?: string
  accommodationId?: string
}

interface UtilityBill {
  id: string
  houseName: string
  month: string
  year: number
  ceb: number
  water: number
  internet?: number
  other?: number
  notes?: string
  paid?: boolean
  paidAt?: string
}

interface HouseInventoryItem {
  id: string
  itemName: string
  category: 'kitchen' | 'supplies' | 'furniture' | 'appliances' | 'other'
  quantity: number
  unit: string
  condition: 'good' | 'fair' | 'poor' | 'needs-replacement'
  notes?: string
  lastUpdated?: string
}

const COURSE_LABELS: Record<string, string> = {
  'japan-ssw': '🇯🇵 Japan SSW',
  'korea': '🇰🇷 Korea',
  'china': '🇨🇳 China',
  'ielts': '📝 IELTS',
  'nvq': '🎓 NVQ',
}

const CATEGORY_LABELS: Record<string, string> = {
  kitchen: '🍳 Kitchen',
  supplies: '🧹 Supplies',
  furniture: '🪑 Furniture',
  appliances: '⚡ Appliances',
  other: '📦 Other',
}

const CONDITION_COLORS: Record<string, string> = {
  good: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  fair: 'bg-amber-50 text-amber-700 border-amber-200',
  poor: 'bg-red-50 text-red-700 border-red-200',
  'needs-replacement': 'bg-red-100 text-red-800 border-red-300',
}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

function formatLKR(n: number) {
  return `LKR ${(n ?? 0).toLocaleString('en-LK')}`
}

type Tab = 'overview' | 'bills' | 'inventory'

export default function HouseDetailPage() {
  const { houseId } = useParams<{ houseId: string }>()
  const router = useRouter()
  const { user } = useManagement()

  const [tab, setTab] = useState<Tab>('overview')
  const [house, setHouse] = useState<House | null>(null)
  const [students, setStudents] = useState<Student[]>([])
  const [bills, setBills] = useState<UtilityBill[]>([])
  const [inventory, setInventory] = useState<HouseInventoryItem[]>([])
  const [loading, setLoading] = useState(true)

  // Bill form
  const [billFormOpen, setBillFormOpen] = useState(false)
  const [billForm, setBillForm] = useState({ month: MONTHS[new Date().getMonth()], year: new Date().getFullYear(), ceb: '', water: '', internet: '', other: '', notes: '', paid: false })
  const [savingBill, setSavingBill] = useState(false)

  // Inventory form
  const [invFormOpen, setInvFormOpen] = useState(false)
  const [invForm, setInvForm] = useState({ itemName: '', category: 'supplies' as HouseInventoryItem['category'], quantity: '1', unit: 'units', condition: 'good' as HouseInventoryItem['condition'], notes: '' })
  const [savingInv, setSavingInv] = useState(false)

  const [toast, setToast] = useState('')
  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const canEdit = ['admin', 'owner', 'accountant', 'reception'].includes(user?.role ?? '')

  const load = useCallback(async () => {
    if (!houseId) return
    setLoading(true)
    try {
      let houseData: House | null = null
      const snap1 = await getDoc(doc(db, 'accommodation', houseId)).catch(() => null)
      if (snap1?.exists()) {
        houseData = { id: snap1.id, ...snap1.data() } as House
      } else {
        const snap2 = await getDoc(doc(db, 'accommodations', houseId)).catch(() => null)
        if (snap2?.exists()) houseData = { id: snap2.id, ...snap2.data() } as House
      }
      setHouse(houseData)

      if (houseData) {
        const studSnap = await getDocs(collection(db, 'students'))
        setStudents(
          studSnap.docs
            .map(d => ({ id: d.id, ...d.data() } as Student))
            .filter(s => s.houseId === houseId || s.accommodationId === houseId || s.houseId === houseData!.name)
        )

        const billsSnap = await getDocs(collection(db, 'utilityBills'))
        setBills(
          billsSnap.docs
            .map(d => ({ id: d.id, ...d.data() } as UtilityBill))
            .filter(b => b.houseName?.toLowerCase() === houseData!.name?.toLowerCase())
            .sort((a, b) => {
              if (a.year !== b.year) return b.year - a.year
              return MONTHS.indexOf(b.month) - MONTHS.indexOf(a.month)
            })
        )

        const invSnap = await getDocs(collection(db, 'accommodation', houseId, 'inventory'))
          .catch(() => getDocs(collection(db, 'accommodations', houseId, 'inventory')).catch(() => ({ docs: [] as { id: string; data: () => Record<string, unknown> }[] })))
        setInventory(invSnap.docs.map(d => ({ id: d.id, ...d.data() } as HouseInventoryItem)))
      }
    } catch (err) {
      console.error('[HouseDetail]', err)
    } finally {
      setLoading(false)
    }
  }, [houseId])

  useEffect(() => { void load() }, [load])

  async function saveBill() {
    if (!house || !houseId) return
    setSavingBill(true)
    try {
      await addDoc(collection(db, 'utilityBills'), {
        houseName: house.name,
        houseId,
        month: billForm.month,
        year: Number(billForm.year),
        ceb: parseFloat(billForm.ceb || '0'),
        water: parseFloat(billForm.water || '0'),
        internet: parseFloat(billForm.internet || '0'),
        other: parseFloat(billForm.other || '0'),
        notes: billForm.notes.trim(),
        paid: billForm.paid,
        createdAt: serverTimestamp(),
        createdBy: user?.uid,
      })
      showToast('Bill added successfully')
      setBillFormOpen(false)
      setBillForm({ month: MONTHS[new Date().getMonth()], year: new Date().getFullYear(), ceb: '', water: '', internet: '', other: '', notes: '', paid: false })
      void load()
    } catch (err) {
      console.error('[SaveBill]', err)
      showToast('Failed to save bill')
    } finally {
      setSavingBill(false)
    }
  }

  async function toggleBillPaid(bill: UtilityBill) {
    try {
      await updateDoc(doc(db, 'utilityBills', bill.id), { paid: !bill.paid, updatedAt: serverTimestamp() })
      setBills(prev => prev.map(b => b.id === bill.id ? { ...b, paid: !b.paid } : b))
    } catch (err) { console.error('[TogglePaid]', err) }
  }

  async function deleteBill(bill: UtilityBill) {
    if (!confirm(`Delete ${bill.month} ${bill.year} bill?`)) return
    try {
      await deleteDoc(doc(db, 'utilityBills', bill.id))
      setBills(prev => prev.filter(b => b.id !== bill.id))
      showToast('Bill deleted')
    } catch (err) { console.error('[DeleteBill]', err) }
  }

  async function saveInventoryItem() {
    if (!houseId || !invForm.itemName.trim()) return
    setSavingInv(true)
    try {
      await addDoc(collection(db, 'accommodation', houseId, 'inventory'), {
        itemName: invForm.itemName.trim(),
        category: invForm.category,
        quantity: parseFloat(invForm.quantity || '1'),
        unit: invForm.unit.trim(),
        condition: invForm.condition,
        notes: invForm.notes.trim(),
        lastUpdated: new Date().toISOString(),
        createdBy: user?.uid,
      })
      showToast('Item added')
      setInvFormOpen(false)
      setInvForm({ itemName: '', category: 'supplies', quantity: '1', unit: 'units', condition: 'good', notes: '' })
      void load()
    } catch (err) {
      console.error('[SaveInv]', err)
      showToast('Failed to save item')
    } finally {
      setSavingInv(false)
    }
  }

  async function deleteInventoryItem(item: HouseInventoryItem) {
    if (!houseId || !confirm(`Delete ${item.itemName}?`)) return
    try {
      await deleteDoc(doc(db, 'accommodation', houseId, 'inventory', item.id))
      setInventory(prev => prev.filter(i => i.id !== item.id))
      showToast('Item deleted')
    } catch (err) { console.error('[DeleteInv]', err) }
  }

  if (!user) return null

  const totalCEB = bills.reduce((s, b) => s + (b.ceb ?? 0), 0)
  const totalWater = bills.reduce((s, b) => s + (b.water ?? 0), 0)
  const totalInternet = bills.reduce((s, b) => s + (b.internet ?? 0), 0)
  const totalOther = bills.reduce((s, b) => s + (b.other ?? 0), 0)
  const totalUnpaid = bills.filter(b => !b.paid).reduce((s, b) => s + (b.ceb ?? 0) + (b.water ?? 0) + (b.internet ?? 0) + (b.other ?? 0), 0)
  const invByCategory = inventory.reduce<Record<string, HouseInventoryItem[]>>((acc, item) => {
    if (!acc[item.category]) acc[item.category] = []
    acc[item.category].push(item)
    return acc
  }, {})

  const inputClass = 'w-full rounded-xl border border-[#DDE3EC] dark:border-white/20 bg-[#F5F7FB] dark:bg-white/[0.04] px-3 py-2.5 text-sm text-[#0D1B2A] dark:text-white outline-none focus:border-[#E8A020]'

  if (loading) return (
    <div className="animate-pulse space-y-4">
      <div className="h-10 w-48 rounded-xl bg-[#DDE3EC] dark:bg-white/10" />
      <div className="h-40 rounded-2xl bg-[#DDE3EC] dark:bg-white/10" />
    </div>
  )

  if (!house) return (
    <div className="rounded-2xl border border-[#DDE3EC] bg-white dark:bg-white/[0.04] py-16 text-center">
      <span className="ti ti-home-off text-4xl text-[#DDE3EC]" />
      <p className="mt-3 text-sm text-[#5A6A7A]">House not found</p>
      <button type="button" onClick={() => router.push('/accommodation')} className="mt-4 rounded-xl bg-[#E8A020] px-4 py-2 text-sm font-bold text-[#0B3D6B]">Back</button>
    </div>
  )

  return (
    <div className="space-y-5">
      {toast && <div className="fixed bottom-6 right-4 z-50 rounded-xl bg-[#0B3D6B] px-5 py-3 text-sm font-medium text-white shadow-lg">{toast}</div>}

      {/* Back */}
      <button type="button" onClick={() => router.push('/accommodation')} className="flex items-center gap-2 text-sm font-semibold text-[#5A6A7A] hover:text-[#0B3D6B] dark:text-white/50 dark:hover:text-white">
        <span className="ti ti-arrow-left" /> Back to Accommodation
      </button>

      {/* House Header */}
      <div className="rounded-2xl bg-gradient-to-r from-[#0B3D6B] to-[#1A6BAD] p-6 text-white">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-jakarta text-2xl font-bold flex items-center gap-2">
              <span className="ti ti-home text-[#E8A020]" />{house.name}
            </h1>
            {house.address && <p className="text-sm text-white/70 mt-1 flex items-center gap-1"><span className="ti ti-map-pin" />{house.address}</p>}
            {house.location && <p className="text-sm text-white/60 mt-0.5">{house.location}</p>}
          </div>
          <div className="flex flex-col items-end gap-1">
            {house.monthlyRent && <span className="rounded-xl bg-[#E8A020] px-3 py-1.5 text-sm font-bold text-[#0B3D6B]">{formatLKR(house.monthlyRent)}/month</span>}
            <span className="text-xs text-white/60">{house.capacity ?? 0} student capacity</span>
          </div>
        </div>
        {(house.landlordName || house.landlordPhone || house.leaseStart) && (
          <div className="mt-4 flex flex-wrap gap-4 text-sm text-white/70">
            {house.landlordName && <span className="flex items-center gap-1"><span className="ti ti-user" />{house.landlordName}</span>}
            {house.landlordPhone && <span className="flex items-center gap-1"><span className="ti ti-phone" />{house.landlordPhone}</span>}
            {house.leaseStart && <span className="flex items-center gap-1"><span className="ti ti-calendar" />{house.leaseStart} → {house.leaseEnd ?? 'ongoing'}</span>}
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-[#DDE3EC] dark:border-white/[0.08] bg-white dark:bg-white/[0.04] p-4 text-center">
          <p className="font-jakarta text-2xl font-black text-[#0B3D6B] dark:text-white">{students.length}</p>
          <p className="text-xs text-[#5A6A7A] dark:text-white/50">Students</p>
        </div>
        <div className="rounded-2xl border border-[#DDE3EC] dark:border-white/[0.08] bg-white dark:bg-white/[0.04] p-4 text-center">
          <p className="font-jakarta text-2xl font-black text-[#0B3D6B] dark:text-white">{bills.length}</p>
          <p className="text-xs text-[#5A6A7A] dark:text-white/50">Bill Records</p>
        </div>
        <div className={`rounded-2xl border p-4 text-center ${totalUnpaid > 0 ? 'border-red-200 bg-red-50 dark:bg-red-900/20' : 'border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20'}`}>
          <p className={`font-jakarta text-lg font-black ${totalUnpaid > 0 ? 'text-red-700' : 'text-emerald-700'}`}>{formatLKR(totalUnpaid)}</p>
          <p className={`text-xs ${totalUnpaid > 0 ? 'text-red-600' : 'text-emerald-600'}`}>Unpaid</p>
        </div>
        <div className="rounded-2xl border border-[#DDE3EC] dark:border-white/[0.08] bg-white dark:bg-white/[0.04] p-4 text-center">
          <p className="font-jakarta text-2xl font-black text-[#0B3D6B] dark:text-white">{inventory.length}</p>
          <p className="text-xs text-[#5A6A7A] dark:text-white/50">Inventory Items</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {(['overview', 'bills', 'inventory'] as Tab[]).map(t => (
          <button key={t} type="button" onClick={() => setTab(t)}
            className={`rounded-xl px-4 py-2 text-sm font-semibold capitalize transition-all ${tab === t ? 'bg-[#E8A020] text-white' : 'border border-[#DDE3EC] dark:border-white/20 text-[#5A6A7A] dark:text-white/60'}`}>
            {t === 'bills' ? '💡 Bills' : t === 'inventory' ? '📦 Inventory' : '👥 Overview'}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW TAB ── */}
      {tab === 'overview' && (
        <div className="rounded-2xl border border-[#DDE3EC] dark:border-white/[0.08] bg-white dark:bg-white/[0.04] overflow-hidden">
          <div className="px-5 py-4 border-b border-[#DDE3EC] dark:border-white/[0.08]">
            <h2 className="font-jakarta font-bold text-[#0B3D6B] dark:text-white">Assigned Students ({students.length})</h2>
          </div>
          {students.length === 0 ? (
            <div className="py-10 text-center">
              <span className="ti ti-users-off text-3xl text-[#DDE3EC]" />
              <p className="mt-2 text-sm text-[#5A6A7A] dark:text-white/50">No students assigned yet</p>
            </div>
          ) : (
            <div className="divide-y divide-[#DDE3EC] dark:divide-white/[0.06]">
              {students.map(s => (
                <div key={s.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0B3D6B] text-xs font-bold text-white">
                    {s.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#0D1B2A] dark:text-white truncate">{s.name}</p>
                    <p className="text-xs text-[#5A6A7A] dark:text-white/40">
                      {s.studentCode && <span className="font-mono mr-2">{s.studentCode}</span>}
                      {COURSE_LABELS[s.courseId ?? ''] ?? s.courseId}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── BILLS TAB ── */}
      {tab === 'bills' && (
        <div className="space-y-4">
          {/* Bill totals */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: 'CEB Total', value: totalCEB, color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200 dark:bg-amber-900/20' },
              { label: 'Water Total', value: totalWater, color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200 dark:bg-blue-900/20' },
              { label: 'Internet Total', value: totalInternet, color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200 dark:bg-purple-900/20' },
              { label: 'Other Total', value: totalOther, color: 'text-[#5A6A7A]', bg: 'border-[#DDE3EC] bg-white dark:bg-white/[0.04]' },
            ].map(s => (
              <div key={s.label} className={`rounded-2xl border p-4 text-center ${s.bg}`}>
                <p className={`font-jakarta text-lg font-black ${s.color}`}>{formatLKR(s.value)}</p>
                <p className={`text-xs ${s.color}`}>{s.label}</p>
              </div>
            ))}
          </div>

          {canEdit && (
            <button type="button" onClick={() => setBillFormOpen(true)}
              className="flex items-center gap-2 rounded-xl bg-[#E8A020] px-4 py-2.5 text-sm font-bold text-[#0B3D6B]">
              <span className="ti ti-plus" /> Add Bill
            </button>
          )}

          {/* Bills table */}
          <div className="rounded-2xl border border-[#DDE3EC] dark:border-white/[0.08] bg-white dark:bg-white/[0.04] overflow-hidden">
            <div className="px-5 py-4 border-b border-[#DDE3EC] dark:border-white/[0.08]">
              <h2 className="font-jakarta font-bold text-[#0B3D6B] dark:text-white">Bill History ({bills.length} months)</h2>
            </div>
            {bills.length === 0 ? (
              <div className="py-10 text-center">
                <span className="ti ti-receipt-off text-3xl text-[#DDE3EC]" />
                <p className="mt-2 text-sm text-[#5A6A7A] dark:text-white/50">No bills yet — add manually or use AI Importer</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#DDE3EC] dark:border-white/[0.08] bg-[#F5F7FB] dark:bg-white/[0.02]">
                      <th className="px-4 py-3 text-left text-xs font-bold uppercase text-[#5A6A7A]">Month</th>
                      <th className="px-4 py-3 text-right text-xs font-bold uppercase text-[#5A6A7A]">CEB</th>
                      <th className="px-4 py-3 text-right text-xs font-bold uppercase text-[#5A6A7A]">Water</th>
                      <th className="px-4 py-3 text-right text-xs font-bold uppercase text-[#5A6A7A]">Internet</th>
                      <th className="px-4 py-3 text-right text-xs font-bold uppercase text-[#5A6A7A]">Total</th>
                      <th className="px-4 py-3 text-center text-xs font-bold uppercase text-[#5A6A7A]">Status</th>
                      {canEdit && <th className="px-4 py-3 text-xs font-bold uppercase text-[#5A6A7A]">Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {bills.map(b => {
                      const total = (b.ceb ?? 0) + (b.water ?? 0) + (b.internet ?? 0) + (b.other ?? 0)
                      return (
                        <tr key={b.id} className="border-b border-[#DDE3EC]/50 dark:border-white/[0.04] last:border-0 hover:bg-[#F5F7FB]/50 dark:hover:bg-white/[0.02]">
                          <td className="px-4 py-3 font-semibold text-[#0D1B2A] dark:text-white">{b.month} {b.year}</td>
                          <td className="px-4 py-3 text-right font-mono text-[#0D1B2A] dark:text-white">{(b.ceb ?? 0).toLocaleString()}</td>
                          <td className="px-4 py-3 text-right font-mono text-[#0D1B2A] dark:text-white">{(b.water ?? 0).toLocaleString()}</td>
                          <td className="px-4 py-3 text-right font-mono text-[#0D1B2A] dark:text-white">{(b.internet ?? 0).toLocaleString()}</td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-[#0B3D6B] dark:text-blue-300">{total.toLocaleString()}</td>
                          <td className="px-4 py-3 text-center">
                            {canEdit ? (
                              <button type="button" onClick={() => void toggleBillPaid(b)}
                                className={`rounded-full px-2.5 py-0.5 text-xs font-bold border ${b.paid ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-600 border-red-200'}`}>
                                {b.paid ? '✓ Paid' : 'Unpaid'}
                              </button>
                            ) : (
                              <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold border ${b.paid ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-600 border-red-200'}`}>
                                {b.paid ? '✓ Paid' : 'Unpaid'}
                              </span>
                            )}
                          </td>
                          {canEdit && (
                            <td className="px-4 py-3">
                              <button type="button" onClick={() => void deleteBill(b)} className="text-red-400 hover:text-red-600">
                                <span className="ti ti-trash text-sm" />
                              </button>
                            </td>
                          )}
                        </tr>
                      )
                    })}
                    <tr className="bg-[#0B3D6B]/5 dark:bg-white/[0.02] font-bold">
                      <td className="px-4 py-3 text-[#0B3D6B] dark:text-blue-300">TOTAL</td>
                      <td className="px-4 py-3 text-right font-mono text-[#0B3D6B] dark:text-blue-300">{totalCEB.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right font-mono text-[#0B3D6B] dark:text-blue-300">{totalWater.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right font-mono text-[#0B3D6B] dark:text-blue-300">{totalInternet.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right font-mono text-[#0B3D6B] dark:text-blue-300">{(totalCEB + totalWater + totalInternet + totalOther).toLocaleString()}</td>
                      <td className="px-4 py-3" />{canEdit && <td className="px-4 py-3" />}
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Add Bill Modal */}
          {billFormOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/50" onClick={() => setBillFormOpen(false)} />
              <div className="relative z-10 w-full max-w-md rounded-2xl bg-white dark:bg-[#0d1a2e] p-6 shadow-2xl">
                <h2 className="font-jakarta font-bold text-[#0B3D6B] dark:text-white mb-4">Add Utility Bill — {house.name}</h2>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-xs font-bold text-[#5A6A7A] dark:text-white/50">Month</label>
                      <select value={billForm.month} onChange={e => setBillForm(f => ({ ...f, month: e.target.value }))} className={inputClass}>
                        {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-bold text-[#5A6A7A] dark:text-white/50">Year</label>
                      <input type="number" value={billForm.year} onChange={e => setBillForm(f => ({ ...f, year: Number(e.target.value) }))} className={inputClass} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-xs font-bold text-amber-600">CEB (LKR)</label>
                      <input type="number" value={billForm.ceb} onChange={e => setBillForm(f => ({ ...f, ceb: e.target.value }))} placeholder="0" className={inputClass} />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-bold text-blue-600">Water (LKR)</label>
                      <input type="number" value={billForm.water} onChange={e => setBillForm(f => ({ ...f, water: e.target.value }))} placeholder="0" className={inputClass} />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-bold text-purple-600">Internet (LKR)</label>
                      <input type="number" value={billForm.internet} onChange={e => setBillForm(f => ({ ...f, internet: e.target.value }))} placeholder="0" className={inputClass} />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-bold text-[#5A6A7A]">Other (LKR)</label>
                      <input type="number" value={billForm.other} onChange={e => setBillForm(f => ({ ...f, other: e.target.value }))} placeholder="0" className={inputClass} />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-bold text-[#5A6A7A] dark:text-white/50">Notes</label>
                    <input type="text" value={billForm.notes} onChange={e => setBillForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional notes" className={inputClass} />
                  </div>
                  <label className="flex items-center gap-2 text-sm text-[#0D1B2A] dark:text-white">
                    <input type="checkbox" checked={billForm.paid} onChange={e => setBillForm(f => ({ ...f, paid: e.target.checked }))} className="rounded" />
                    Mark as paid
                  </label>
                </div>
                <div className="mt-5 flex gap-3">
                  <button type="button" onClick={() => setBillFormOpen(false)} className="flex-1 rounded-xl border border-[#DDE3EC] py-2.5 text-sm font-semibold text-[#5A6A7A]">Cancel</button>
                  <button type="button" disabled={savingBill} onClick={() => void saveBill()} className="flex-1 rounded-xl bg-[#E8A020] py-2.5 text-sm font-bold text-[#0B3D6B] disabled:opacity-50">
                    {savingBill ? 'Saving...' : 'Save Bill'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── INVENTORY TAB ── */}
      {tab === 'inventory' && (
        <div className="space-y-4">
          {canEdit && (
            <button type="button" onClick={() => setInvFormOpen(true)}
              className="flex items-center gap-2 rounded-xl bg-[#E8A020] px-4 py-2.5 text-sm font-bold text-[#0B3D6B]">
              <span className="ti ti-plus" /> Add Item
            </button>
          )}

          {inventory.length === 0 ? (
            <div className="rounded-2xl border border-[#DDE3EC] dark:border-white/[0.08] bg-white dark:bg-white/[0.04] py-12 text-center">
              <span className="ti ti-package-off text-4xl text-[#DDE3EC]" />
              <p className="mt-3 text-sm text-[#5A6A7A] dark:text-white/50">No inventory items yet</p>
              <p className="mt-1 text-xs text-[#5A6A7A]/60">Track furniture, appliances, kitchen items and supplies per house</p>
            </div>
          ) : (
            Object.entries(invByCategory).map(([cat, items]) => (
              <div key={cat} className="rounded-2xl border border-[#DDE3EC] dark:border-white/[0.08] bg-white dark:bg-white/[0.04] overflow-hidden">
                <div className="px-5 py-3 border-b border-[#DDE3EC] dark:border-white/[0.08] bg-[#F5F7FB] dark:bg-white/[0.02]">
                  <h3 className="font-jakarta font-bold text-sm text-[#0B3D6B] dark:text-white">{CATEGORY_LABELS[cat] ?? cat}</h3>
                </div>
                <div className="divide-y divide-[#DDE3EC] dark:divide-white/[0.06]">
                  {items.map(item => (
                    <div key={item.id} className="flex items-center gap-3 px-5 py-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-[#0D1B2A] dark:text-white">{item.itemName}</p>
                        <p className="text-xs text-[#5A6A7A] dark:text-white/40">{item.quantity} {item.unit}</p>
                      </div>
                      <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-bold ${CONDITION_COLORS[item.condition] ?? CONDITION_COLORS.fair}`}>
                        {item.condition.replace('-', ' ')}
                      </span>
                      {canEdit && (
                        <button type="button" onClick={() => void deleteInventoryItem(item)} className="shrink-0 text-red-400 hover:text-red-600">
                          <span className="ti ti-trash text-sm" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}

          {/* Add Inventory Modal */}
          {invFormOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/50" onClick={() => setInvFormOpen(false)} />
              <div className="relative z-10 w-full max-w-md rounded-2xl bg-white dark:bg-[#0d1a2e] p-6 shadow-2xl">
                <h2 className="font-jakarta font-bold text-[#0B3D6B] dark:text-white mb-4">Add Inventory Item</h2>
                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block text-xs font-bold text-[#5A6A7A] dark:text-white/50">Item Name</label>
                    <input type="text" value={invForm.itemName} onChange={e => setInvForm(f => ({ ...f, itemName: e.target.value }))} placeholder="e.g. Rice Cooker" className={inputClass} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-xs font-bold text-[#5A6A7A] dark:text-white/50">Category</label>
                      <select value={invForm.category} onChange={e => setInvForm(f => ({ ...f, category: e.target.value as HouseInventoryItem['category'] }))} className={inputClass}>
                        <option value="kitchen">Kitchen</option>
                        <option value="supplies">Supplies</option>
                        <option value="furniture">Furniture</option>
                        <option value="appliances">Appliances</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-bold text-[#5A6A7A] dark:text-white/50">Condition</label>
                      <select value={invForm.condition} onChange={e => setInvForm(f => ({ ...f, condition: e.target.value as HouseInventoryItem['condition'] }))} className={inputClass}>
                        <option value="good">Good</option>
                        <option value="fair">Fair</option>
                        <option value="poor">Poor</option>
                        <option value="needs-replacement">Needs Replacement</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-bold text-[#5A6A7A] dark:text-white/50">Quantity</label>
                      <input type="number" value={invForm.quantity} onChange={e => setInvForm(f => ({ ...f, quantity: e.target.value }))} className={inputClass} />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-bold text-[#5A6A7A] dark:text-white/50">Unit</label>
                      <input type="text" value={invForm.unit} onChange={e => setInvForm(f => ({ ...f, unit: e.target.value }))} placeholder="units / kg / sets" className={inputClass} />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-bold text-[#5A6A7A] dark:text-white/50">Notes</label>
                    <input type="text" value={invForm.notes} onChange={e => setInvForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional" className={inputClass} />
                  </div>
                </div>
                <div className="mt-5 flex gap-3">
                  <button type="button" onClick={() => setInvFormOpen(false)} className="flex-1 rounded-xl border border-[#DDE3EC] py-2.5 text-sm font-semibold text-[#5A6A7A]">Cancel</button>
                  <button type="button" disabled={savingInv || !invForm.itemName.trim()} onClick={() => void saveInventoryItem()} className="flex-1 rounded-xl bg-[#E8A020] py-2.5 text-sm font-bold text-[#0B3D6B] disabled:opacity-50">
                    {savingInv ? 'Saving...' : 'Add Item'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {house.notes && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 dark:bg-amber-900/20 px-5 py-4">
          <p className="text-xs font-bold text-amber-700 mb-1">Notes</p>
          <p className="text-sm text-amber-800 dark:text-amber-300">{house.notes}</p>
        </div>
      )}
    </div>
  )
}
