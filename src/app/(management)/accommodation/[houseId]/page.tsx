'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { useManagement } from '@/components/layout/ManagementContext'
import { COURSE_MAP } from '@/lib/constants/courses'
import { formatLKR } from '@/lib/utility-bills/helpers'
import { getInitials } from '@/lib/students/helpers'

type TabId = 'bills' | 'students' | 'overview'
type ToastKind = 'success' | 'warning'
type BillType = 'rent' | 'electricity' | 'water' | 'internet' | 'repair' | 'other'
type BillStatus = 'paid' | 'unpaid' | 'overdue'

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
  createdBy?: string
}

type HouseBill = {
  id: string
  type: BillType
  amount: number
  month: string
  dueDate: string
  paidDate: string | null
  status: BillStatus
  notes: string
  addedBy: string
  createdAt?: unknown
}

type StudentLite = {
  id: string
  name: string
  studentCode: string
  courseId: string
  houseId?: string | null
  houseName?: string | null
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

type BillForm = {
  type: BillType
  month: string
  amount: string
  dueDate: string
  notes: string
}

const BILL_TYPE_OPTIONS: { value: BillType; label: string }[] = [
  { value: 'rent', label: 'Rent' },
  { value: 'electricity', label: 'Electricity' },
  { value: 'water', label: 'Water' },
  { value: 'internet', label: 'Internet' },
  { value: 'repair', label: 'Repair' },
  { value: 'other', label: 'Other' },
]

function typeBadgeClass(type: BillType): string {
  if (type === 'rent') return 'bg-[#0B3D6B]/10 text-[#0B3D6B] border-[#0B3D6B]/20'
  if (type === 'electricity') return 'bg-amber-100 text-amber-800 border-amber-200'
  if (type === 'water') return 'bg-blue-100 text-blue-800 border-blue-200'
  if (type === 'internet') return 'bg-teal-100 text-teal-800 border-teal-200'
  if (type === 'repair') return 'bg-orange-100 text-orange-800 border-orange-200'
  return 'bg-gray-100 text-gray-700 border-gray-200'
}

function statusBadgeClass(status: BillStatus): string {
  if (status === 'paid') return 'bg-emerald-100 text-emerald-700 border-emerald-200'
  if (status === 'overdue') return 'bg-red-100 text-red-700 border-red-200'
  return 'bg-amber-100 text-amber-700 border-amber-200'
}

function leaseBadge(leaseEnd: string): { label: string; cls: string } {
  const today = new Date()
  const end = new Date(leaseEnd)
  const ms = end.getTime() - today.getTime()
  const days = Math.ceil(ms / (1000 * 60 * 60 * 24))
  if (Number.isNaN(days)) {
    return { label: 'Unknown', cls: 'bg-gray-100 text-gray-700 border-gray-200' }
  }
  if (days < 0) {
    return { label: 'Expired', cls: 'bg-red-100 text-red-700 border-red-200' }
  }
  if (days <= 30) {
    return { label: 'Expiring Soon', cls: 'bg-amber-100 text-amber-700 border-amber-200' }
  }
  return { label: 'Active', cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' }
}

function monthLabel(month: string): string {
  if (!month || month === 'all') return 'All months'
  const [y, m] = month.split('-')
  if (!y || !m) return month
  return new Date(Number(y), Number(m) - 1, 1).toLocaleString('en-US', {
    month: 'short',
    year: 'numeric',
  })
}

function monthOptions(): { value: string; label: string }[] {
  const base = new Date()
  const list: { value: string; label: string }[] = [{ value: 'all', label: 'All' }]
  for (let i = 0; i < 6; i += 1) {
    const dt = new Date(base.getFullYear(), base.getMonth() - i, 1)
    const yyyy = dt.getFullYear()
    const mm = String(dt.getMonth() + 1).padStart(2, '0')
    list.push({ value: `${yyyy}-${mm}`, label: dt.toLocaleString('en-US', { month: 'short', year: 'numeric' }) })
  }
  return list
}

function todayYmd(): string {
  return new Date().toISOString().slice(0, 10)
}

function currentMonth(): string {
  return todayYmd().slice(0, 7)
}

function emptyHouseForm(): HouseForm {
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

function emptyBillForm(): BillForm {
  return {
    type: 'rent',
    month: currentMonth(),
    amount: '',
    dueDate: todayYmd(),
    notes: '',
  }
}

function SummaryCard({ label, value, loading }: { label: string; value: string; loading?: boolean }) {
  return (
    <div className="rounded-xl border border-[#DDE3EC] bg-white p-5 dark:bg-gray-800">
      <p className="font-inter text-xs font-medium uppercase tracking-wide text-[#5A6A7A]">{label}</p>
      {loading ? <div className="mt-2 h-8 w-24 animate-pulse rounded bg-[#DDE3EC]" /> : <p className="mt-1 font-jakarta text-2xl font-bold text-[#0B3D6B]">{value}</p>}
    </div>
  )
}

export default function AccommodationHousePage() {
  const params = useParams()
  const houseId = String(params.houseId ?? '')
  const { user } = useManagement()

  const [tab, setTab] = useState<TabId>('bills')
  const [house, setHouse] = useState<House | null>(null)
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')
  const [toastKind, setToastKind] = useState<ToastKind>('success')

  const [bills, setBills] = useState<HouseBill[]>([])
  const [billMonthFilter, setBillMonthFilter] = useState(currentMonth())
  const [billFormOpen, setBillFormOpen] = useState(false)
  const [savingBill, setSavingBill] = useState(false)
  const [billForm, setBillForm] = useState<BillForm>(emptyBillForm())

  const [assignedStudents, setAssignedStudents] = useState<StudentLite[]>([])
  const [studentsLoading, setStudentsLoading] = useState(false)
  const [assignModalOpen, setAssignModalOpen] = useState(false)
  const [allStudents, setAllStudents] = useState<StudentLite[]>([])
  const [studentSearch, setStudentSearch] = useState('')

  const [editOpen, setEditOpen] = useState(false)
  const [savingHouse, setSavingHouse] = useState(false)
  const [houseForm, setHouseForm] = useState<HouseForm>(emptyHouseForm())

  const allowed = user?.role === 'admin' || user?.role === 'owner' || user?.role === 'accountant'

  const showToast = useCallback((msg: string, kind: ToastKind = 'success') => {
    setToastKind(kind)
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }, [])

  const loadHouse = useCallback(async () => {
    if (!houseId) return
    setLoading(true)
    try {
      const snap = await getDoc(doc(db, 'accommodation', houseId))
      if (!snap.exists()) {
        setHouse(null)
        return
      }
      setHouse({ id: snap.id, ...(snap.data() as Omit<House, 'id'>) })
    } catch (err) {
      console.error('[AccommodationHouse] house', err)
      setHouse(null)
    } finally {
      setLoading(false)
    }
  }, [houseId])

  const loadBills = useCallback(async () => {
    if (!houseId) return
    try {
      const snap = await getDocs(
        query(collection(db, 'accommodation', houseId, 'bills'), orderBy('createdAt', 'desc')),
      )
      setBills(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<HouseBill, 'id'>) })))
    } catch (err) {
      console.error('[AccommodationHouse] bills', err)
      setBills([])
    }
  }, [houseId])

  const loadAssignedStudents = useCallback(async () => {
    if (!houseId) return
    setStudentsLoading(true)
    try {
      const snap = await getDocs(query(collection(db, 'students'), where('houseId', '==', houseId)))
      setAssignedStudents(
        snap.docs.map((d) => ({
          id: d.id,
          name: String(d.data().name ?? ''),
          studentCode: String(d.data().studentCode ?? ''),
          courseId: String(d.data().courseId ?? ''),
          houseId: d.data().houseId as string | null | undefined,
          houseName: d.data().houseName as string | null | undefined,
        })),
      )
    } catch (err) {
      console.error('[AccommodationHouse] students', err)
      setAssignedStudents([])
    } finally {
      setStudentsLoading(false)
    }
  }, [houseId])

  useEffect(() => {
    if (!allowed) return
    void loadHouse()
    void loadBills()
    void loadAssignedStudents()
  }, [allowed, loadHouse, loadBills, loadAssignedStudents])

  const billsView = useMemo(() => {
    if (billMonthFilter === 'all') return bills
    return bills.filter((b) => b.month === billMonthFilter)
  }, [bills, billMonthFilter])

  const billStats = useMemo(() => {
    const month = currentMonth()
    const thisMonth = bills.filter((b) => b.month === month)
    const thisMonthTotal = thisMonth.reduce((sum, b) => sum + Number(b.amount || 0), 0)
    const unpaidCount = billsView.filter((b) => b.status === 'unpaid' || b.status === 'overdue').length
    const paidThisMonth = thisMonth
      .filter((b) => b.status === 'paid' && (b.paidDate || '').slice(0, 7) === month)
      .reduce((sum, b) => sum + Number(b.amount || 0), 0)
    const overdueCount = billsView.filter((b) => b.status === 'overdue').length
    return { thisMonthTotal, unpaidCount, paidThisMonth, overdueCount }
  }, [bills, billsView])

  const capacityReached = useMemo(() => {
    if (!house) return false
    return assignedStudents.length >= Number(house.capacity || 0)
  }, [assignedStudents.length, house])

  const availableStudents = useMemo(() => {
    const q = studentSearch.trim().toLowerCase()
    return allStudents.filter((s) => {
      if (s.houseId && s.houseId !== houseId) return false
      if (!q) return true
      return s.name.toLowerCase().includes(q)
    })
  }, [allStudents, studentSearch, houseId])

  async function handleAddBill() {
    if (!user || !houseId) return
    if (!billForm.amount) return
    setSavingBill(true)
    try {
      const due = billForm.dueDate || todayYmd()
      const isOverdue = due < todayYmd()
      await addDoc(collection(db, 'accommodation', houseId, 'bills'), {
        type: billForm.type,
        amount: Number(billForm.amount || 0),
        month: billForm.month,
        dueDate: due,
        paidDate: null,
        status: (isOverdue ? 'overdue' : 'unpaid') as BillStatus,
        notes: billForm.notes.trim(),
        addedBy: user.uid,
        createdAt: serverTimestamp(),
      })
      setBillForm(emptyBillForm())
      setBillFormOpen(false)
      showToast('Bill added successfully')
      await loadBills()
    } catch (err) {
      console.error('[AccommodationHouse] add bill', err)
      showToast('Failed to add bill', 'warning')
    } finally {
      setSavingBill(false)
    }
  }

  async function handleMarkPaid(bill: HouseBill) {
    if (!houseId) return
    try {
      await updateDoc(doc(db, 'accommodation', houseId, 'bills', bill.id), {
        status: 'paid',
        paidDate: todayYmd(),
      })
      showToast('Marked as paid')
      await loadBills()
    } catch (err) {
      console.error('[AccommodationHouse] mark paid', err)
      showToast('Failed to update bill', 'warning')
    }
  }

  async function handleOpenAssignModal() {
    setAssignModalOpen(true)
    try {
      const snap = await getDocs(collection(db, 'students'))
      setAllStudents(
        snap.docs.map((d) => ({
          id: d.id,
          name: String(d.data().name ?? ''),
          studentCode: String(d.data().studentCode ?? ''),
          courseId: String(d.data().courseId ?? ''),
          houseId: d.data().houseId as string | null | undefined,
          houseName: d.data().houseName as string | null | undefined,
        })),
      )
    } catch (err) {
      console.error('[AccommodationHouse] load all students', err)
      setAllStudents([])
    }
  }

  async function handleAssignStudent(studentId: string) {
    if (!houseId || !house) return
    if (capacityReached) {
      showToast('Capacity reached for this house', 'warning')
      return
    }
    try {
      await updateDoc(doc(db, 'students', studentId), {
        houseId,
        houseName: house.name,
      })
      showToast('Student assigned successfully')
      await loadAssignedStudents()
      setAssignModalOpen(false)
    } catch (err) {
      console.error('[AccommodationHouse] assign', err)
      showToast('Failed to assign student', 'warning')
    }
  }

  async function handleRemoveStudent(studentId: string) {
    try {
      await updateDoc(doc(db, 'students', studentId), {
        houseId: null,
        houseName: null,
      })
      showToast('Student removed from house')
      await loadAssignedStudents()
    } catch (err) {
      console.error('[AccommodationHouse] remove', err)
      showToast('Failed to remove student', 'warning')
    }
  }

  function openEditHouse() {
    if (!house) return
    setHouseForm({
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
    setEditOpen(true)
  }

  async function handleSaveHouseEdit() {
    if (!houseId || !houseForm.name.trim() || !houseForm.address.trim()) return
    setSavingHouse(true)
    try {
      await updateDoc(doc(db, 'accommodation', houseId), {
        name: houseForm.name.trim(),
        address: houseForm.address.trim(),
        landlordName: houseForm.landlordName.trim(),
        landlordPhone: houseForm.landlordPhone.trim(),
        monthlyRent: Number(houseForm.monthlyRent || 0),
        leaseStart: houseForm.leaseStart,
        leaseEnd: houseForm.leaseEnd,
        location: houseForm.location,
        capacity: Math.max(1, Number(houseForm.capacity || 1)),
        notes: houseForm.notes.trim(),
      })
      showToast('House updated successfully')
      setEditOpen(false)
      await loadHouse()
    } catch (err) {
      console.error('[AccommodationHouse] edit', err)
      showToast('Failed to update house', 'warning')
    } finally {
      setSavingHouse(false)
    }
  }

  if (!allowed) {
    return <p>You do not have access to this page.</p>
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-4 p-6">
        <div className="h-10 w-56 rounded bg-[#DDE3EC]" />
        <div className="h-64 rounded-xl bg-[#DDE3EC]" />
      </div>
    )
  }

  if (!house) {
    return (
      <div className="rounded-xl border border-[#DDE3EC] bg-white p-12 text-center">
        <p className="font-jakarta text-lg font-bold text-[#0D1B2A]">House not found</p>
        <Link href="/accommodation" className="mt-4 inline-block text-sm font-medium text-[#0B3D6B] hover:text-[#E8A020]">
          ← Back to Accommodation
        </Link>
      </div>
    )
  }

  const lease = leaseBadge(house.leaseEnd)

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

      <Link
        href="/accommodation"
        className="inline-flex items-center gap-1 font-inter text-sm text-[#5A6A7A] hover:text-[#0B3D6B]"
      >
        <span className="ti ti-arrow-left" aria-hidden="true" />
        Back to Accommodation
      </Link>

      <div className="rounded-xl border border-[#DDE3EC] bg-white p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="font-jakarta text-2xl font-bold text-[#0D1B2A]">{house.name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="inline-flex rounded-full border border-[#DDE3EC] bg-[#F5F7FB] px-2.5 py-0.5 text-xs font-medium text-[#0B3D6B]">
                {house.location}
              </span>
              <span className="inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${lease.cls}">
                {lease.label}
              </span>
            </div>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-[#5A6A7A]">Monthly Rent</p>
            <p className="font-jakarta text-2xl font-bold text-[#E8A020]">{formatLKR(Number(house.monthlyRent || 0))}</p>
          </div>
        </div>
      </div>

      <div className="border-b border-[#DDE3EC]">
        <nav className="-mb-px flex gap-1 overflow-x-auto">
          {([
            { id: 'bills', label: 'Bills', icon: 'ti-receipt' },
            { id: 'students', label: 'Students', icon: 'ti-users' },
            { id: 'overview', label: 'Overview', icon: 'ti-home' },
          ] as { id: TabId; label: string; icon: string }[]).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 font-inter text-sm font-medium transition-colors ${
                tab === t.id
                  ? 'border-[#E8A020] text-[#0B3D6B]'
                  : 'border-transparent text-[#5A6A7A] hover:text-[#0B3D6B]'
              }`}
            >
              <span className={`ti ${t.icon}`} aria-hidden="true" />
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      {tab === 'bills' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={billMonthFilter}
              onChange={(e) => setBillMonthFilter(e.target.value)}
              className="rounded-lg border border-[#DDE3EC] bg-white px-3 py-2 text-sm"
            >
              {monthOptions().map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setBillFormOpen(true)}
              className="ml-auto inline-flex items-center gap-2 rounded-full bg-[#E8A020] px-5 py-2.5 font-jakarta text-sm font-bold text-[#0B3D6B] hover:bg-[#F5B942]"
            >
              <span className="ti ti-plus" />
              Add Bill
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard label="This Month Total" value={formatLKR(billStats.thisMonthTotal)} />
            <SummaryCard label="Unpaid" value={String(billStats.unpaidCount)} />
            <SummaryCard label="Paid This Month" value={formatLKR(billStats.paidThisMonth)} />
            <SummaryCard label="Overdue" value={String(billStats.overdueCount)} />
          </div>

          <div className="overflow-x-auto rounded-xl border border-[#DDE3EC] bg-white">
            <table className="min-w-full">
              <thead className="border-b border-[#DDE3EC] bg-[#F5F7FB]">
                <tr>
                  {['Month', 'Type', 'Amount', 'Due Date', 'Status', 'Notes', 'Actions'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left font-jakarta text-xs font-semibold uppercase tracking-wide text-[#5A6A7A]">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DDE3EC]">
                {billsView.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-sm text-[#5A6A7A]">
                      No bills for {monthLabel(billMonthFilter)}.
                    </td>
                  </tr>
                ) : (
                  billsView.map((b) => (
                    <tr key={b.id}>
                      <td className="px-4 py-3 text-sm text-[#0D1B2A]">{b.month}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${typeBadgeClass(b.type)}`}>
                          {b.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm font-bold text-[#0B3D6B]">{formatLKR(Number(b.amount || 0))}</td>
                      <td className="px-4 py-3 text-sm text-[#0D1B2A]">{b.dueDate || '-'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${statusBadgeClass(b.status)}`}>
                          {b.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-[#5A6A7A]">{b.notes || '-'}</td>
                      <td className="px-4 py-3">
                        {(b.status === 'unpaid' || b.status === 'overdue') ? (
                          <button
                            type="button"
                            onClick={() => void handleMarkPaid(b)}
                            className="rounded-lg border border-emerald-300 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
                          >
                            Mark Paid
                          </button>
                        ) : (
                          <span className="text-xs text-[#5A6A7A]">Paid {b.paidDate || ''}</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'students' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-[#5A6A7A]">
              Assigned {assignedStudents.length} / {Number(house.capacity || 0)} students
            </p>
            <button
              type="button"
              onClick={() => void handleOpenAssignModal()}
              className="inline-flex items-center gap-2 rounded-full bg-[#E8A020] px-5 py-2.5 font-jakarta text-sm font-bold text-[#0B3D6B] hover:bg-[#F5B942]"
            >
              <span className="ti ti-plus" />
              Assign Student
            </button>
          </div>

          {capacityReached && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              House is at max capacity.
            </div>
          )}

          <div className="rounded-xl border border-[#DDE3EC] bg-white">
            {studentsLoading ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-14 animate-pulse rounded bg-[#DDE3EC]" />
                ))}
              </div>
            ) : assignedStudents.length === 0 ? (
              <p className="p-6 text-center text-sm text-[#5A6A7A]">No students assigned yet.</p>
            ) : (
              <ul className="divide-y divide-[#DDE3EC]">
                {assignedStudents.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-3 p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#0B3D6B] text-xs font-bold text-white">
                        {getInitials(s.name)}
                      </div>
                      <div>
                        <p className="font-jakarta text-sm font-semibold text-[#0D1B2A]">{s.name}</p>
                        <div className="mt-0.5 flex flex-wrap items-center gap-2">
                          <span className="inline-flex rounded-full border border-[#DDE3EC] bg-[#F5F7FB] px-2.5 py-0.5 text-[11px] font-medium text-[#0B3D6B]">
                            {COURSE_MAP[s.courseId as keyof typeof COURSE_MAP]?.label ?? s.courseId}
                          </span>
                          <span className="text-xs text-[#5A6A7A]">{s.studentCode}</span>
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleRemoveStudent(s.id)}
                      className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {tab === 'overview' && (
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-jakarta text-lg font-bold text-[#0B3D6B]">House Details</h3>
            <button
              type="button"
              onClick={openEditHouse}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              Edit
            </button>
          </div>

          <dl className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
            <div>
              <dt className="font-medium text-[#5A6A7A]">Name</dt>
              <dd className="text-[#0D1B2A]">{house.name}</dd>
            </div>
            <div>
              <dt className="font-medium text-[#5A6A7A]">Location</dt>
              <dd className="text-[#0D1B2A]">{house.location}</dd>
            </div>
            <div>
              <dt className="font-medium text-[#5A6A7A]">Address</dt>
              <dd className="text-[#0D1B2A]">{house.address}</dd>
            </div>
            <div>
              <dt className="font-medium text-[#5A6A7A]">Landlord</dt>
              <dd className="text-[#0D1B2A]">{house.landlordName || '-'}</dd>
            </div>
            <div>
              <dt className="font-medium text-[#5A6A7A]">Landlord Phone</dt>
              <dd className="text-[#0D1B2A]">{house.landlordPhone || '-'}</dd>
            </div>
            <div>
              <dt className="font-medium text-[#5A6A7A]">Monthly Rent</dt>
              <dd className="font-bold text-[#E8A020]">{formatLKR(Number(house.monthlyRent || 0))}</dd>
            </div>
            <div>
              <dt className="font-medium text-[#5A6A7A]">Capacity</dt>
              <dd className="text-[#0D1B2A]">{house.capacity} students</dd>
            </div>
            <div>
              <dt className="font-medium text-[#5A6A7A]">Lease Period</dt>
              <dd className="text-[#0D1B2A]">{house.leaseStart} → {house.leaseEnd}</dd>
            </div>
            <div>
              <dt className="font-medium text-[#5A6A7A]">Lease Status</dt>
              <dd>
                <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${lease.cls}`}>
                  {lease.label}
                </span>
              </dd>
            </div>
            <div className="md:col-span-2">
              <dt className="font-medium text-[#5A6A7A]">Notes</dt>
              <dd className="text-[#0D1B2A]">{house.notes || '-'}</dd>
            </div>
          </dl>
        </div>
      )}

      {billFormOpen && (
        <div className="fixed inset-0 z-50 flex items-stretch justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setBillFormOpen(false)} />
          <div className="relative z-10 h-full w-full max-w-md bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#DDE3EC] px-5 py-4">
              <h2 className="font-jakarta text-lg font-bold text-[#0B3D6B]">Add Bill</h2>
              <button type="button" onClick={() => setBillFormOpen(false)} className="rounded-full p-1.5 hover:bg-[#F5F7FB]">
                <span className="ti ti-x text-lg" />
              </button>
            </div>
            <div className="space-y-4 p-5">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Type</label>
                <select
                  value={billForm.type}
                  onChange={(e) => setBillForm((p) => ({ ...p, type: e.target.value as BillType }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                >
                  {BILL_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Month</label>
                <input
                  type="month"
                  value={billForm.month}
                  onChange={(e) => setBillForm((p) => ({ ...p, month: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Amount LKR</label>
                <input
                  type="number"
                  value={billForm.amount}
                  onChange={(e) => setBillForm((p) => ({ ...p, amount: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Due Date</label>
                <input
                  type="date"
                  value={billForm.dueDate}
                  onChange={(e) => setBillForm((p) => ({ ...p, dueDate: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Notes</label>
                <textarea
                  rows={3}
                  value={billForm.notes}
                  onChange={(e) => setBillForm((p) => ({ ...p, notes: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="mt-auto border-t border-[#DDE3EC] p-4">
              <button
                type="button"
                onClick={() => void handleAddBill()}
                disabled={savingBill || !billForm.amount}
                className="w-full rounded-xl bg-[#E8A020] py-2.5 text-sm font-bold text-[#0B3D6B] disabled:opacity-50"
              >
                {savingBill ? 'Saving…' : 'Save Bill'}
              </button>
            </div>
          </div>
        </div>
      )}

      {assignModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setAssignModalOpen(false)} />
          <div className="relative z-10 w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="font-jakarta text-lg font-bold text-[#0B3D6B]">Assign Student</h2>
            <input
              type="search"
              value={studentSearch}
              onChange={(e) => setStudentSearch(e.target.value)}
              placeholder="Search students by name"
              className="mt-3 w-full rounded-lg border border-[#DDE3EC] px-3 py-2 text-sm"
            />
            <div className="mt-4 max-h-[360px] space-y-2 overflow-y-auto">
              {availableStudents.length === 0 ? (
                <p className="text-sm text-[#5A6A7A]">No students found</p>
              ) : (
                availableStudents.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => void handleAssignStudent(s.id)}
                    disabled={capacityReached && s.houseId !== houseId}
                    className="flex w-full items-center justify-between rounded-lg border border-[#DDE3EC] p-3 text-left hover:bg-[#F5F7FB] disabled:opacity-50"
                  >
                    <div>
                      <p className="text-sm font-semibold text-[#0D1B2A]">{s.name}</p>
                      <p className="text-xs text-[#5A6A7A]">{s.studentCode}</p>
                    </div>
                    <span className="text-xs font-medium text-[#0B3D6B]">Assign</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {editOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setEditOpen(false)} />
          <div className="relative z-10 w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="font-jakarta text-lg font-bold text-[#0B3D6B]">Edit House</h2>
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="mb-1 block text-xs font-medium text-gray-500">House Name</label>
                <input value={houseForm.name} onChange={(e) => setHouseForm((p) => ({ ...p, name: e.target.value }))} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-xs font-medium text-gray-500">Address</label>
                <input value={houseForm.address} onChange={(e) => setHouseForm((p) => ({ ...p, address: e.target.value }))} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Location</label>
                <select value={houseForm.location} onChange={(e) => setHouseForm((p) => ({ ...p, location: e.target.value }))} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm">
                  {['Ahangama', 'Galle', 'Waduraba', 'Pinnaduwa'].map((loc) => (
                    <option key={loc} value={loc}>{loc}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Landlord Name</label>
                <input value={houseForm.landlordName} onChange={(e) => setHouseForm((p) => ({ ...p, landlordName: e.target.value }))} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Landlord Phone</label>
                <input value={houseForm.landlordPhone} onChange={(e) => setHouseForm((p) => ({ ...p, landlordPhone: e.target.value }))} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Monthly Rent LKR</label>
                <input type="number" value={houseForm.monthlyRent} onChange={(e) => setHouseForm((p) => ({ ...p, monthlyRent: e.target.value }))} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Capacity</label>
                <input type="number" min={1} value={houseForm.capacity} onChange={(e) => setHouseForm((p) => ({ ...p, capacity: e.target.value }))} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Lease Start</label>
                <input type="date" value={houseForm.leaseStart} onChange={(e) => setHouseForm((p) => ({ ...p, leaseStart: e.target.value }))} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Lease End</label>
                <input type="date" value={houseForm.leaseEnd} onChange={(e) => setHouseForm((p) => ({ ...p, leaseEnd: e.target.value }))} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-xs font-medium text-gray-500">Notes</label>
                <textarea rows={3} value={houseForm.notes} onChange={(e) => setHouseForm((p) => ({ ...p, notes: e.target.value }))} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="mt-6 flex gap-3">
              <button type="button" onClick={() => setEditOpen(false)} className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium">Cancel</button>
              <button type="button" onClick={() => void handleSaveHouseEdit()} disabled={savingHouse} className="flex-1 rounded-xl bg-[#E8A020] py-2.5 text-sm font-bold text-[#0B3D6B] disabled:opacity-50">
                {savingHouse ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
