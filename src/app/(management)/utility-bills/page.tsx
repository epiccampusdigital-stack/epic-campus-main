'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { collection, getDocs, orderBy, query } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import UtilityBillForm from '@/components/utility-bills/UtilityBillForm'
import UtilityBillList from '@/components/utility-bills/UtilityBillList'
import {
  currentMonthKey,
  formatLKR,
  getLastSixMonthKeys,
  parseUtilityBill,
  sumByCategory,
  type UtilityBill,
} from '@/lib/utility-bills/helpers'

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
    <div className="rounded-xl border border-[#DDE3EC] bg-white p-5">
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

export default function UtilityBillsPage() {
  const [bills, setBills] = useState<UtilityBill[]>([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [monthFilter, setMonthFilter] = useState(currentMonthKey())

  const monthOptions = useMemo(() => getLastSixMonthKeys(), [])

  const loadBills = useCallback(async () => {
    setLoading(true)
    try {
      const snap = await getDocs(
        query(collection(db, 'utilityBills'), orderBy('createdAt', 'desc')),
      )
      setBills(
        snap.docs.map((d) =>
          parseUtilityBill(d.id, d.data() as Record<string, unknown>),
        ),
      )
    } catch (err) {
      console.error('[UtilityBillsPage]', err)
      setBills([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadBills()
  }, [loadBills])

  const summaryMonth = monthFilter
  const categoryTotals = useMemo(
    () => sumByCategory(bills, summaryMonth),
    [bills, summaryMonth],
  )

  const filteredBills = useMemo(
    () => bills.filter((b) => b.month === monthFilter),
    [bills, monthFilter],
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-jakarta text-2xl font-bold text-[#0D1B2A]">Utility Bills</h2>
          <p className="font-inter text-sm text-[#5A6A7A]">
            Track monthly utility expenses
          </p>
        </div>
        <button
          type="button"
          onClick={() => setFormOpen(true)}
          className="inline-flex items-center gap-2 rounded-full bg-[#E8A020] px-6 py-3 font-jakarta text-sm font-bold text-[#0B3D6B] hover:bg-[#F5B942]"
        >
          <span className="ti ti-plus" aria-hidden="true" />
          Add Bill
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Electricity (this month)"
          value={formatLKR(categoryTotals.electricity)}
          loading={loading}
        />
        <SummaryCard
          label="Water (this month)"
          value={formatLKR(categoryTotals.water)}
          loading={loading}
        />
        <SummaryCard
          label="Internet (this month)"
          value={formatLKR(categoryTotals.internet)}
          loading={loading}
        />
        <SummaryCard
          label="Other (this month)"
          value={formatLKR(categoryTotals.other)}
          loading={loading}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="font-inter text-sm font-medium text-[#5A6A7A]">Month</label>
        <select
          value={monthFilter}
          onChange={(e) => setMonthFilter(e.target.value)}
          className="rounded-lg border border-[#DDE3EC] bg-white px-3 py-2 text-sm"
        >
          {monthOptions.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </div>

      <UtilityBillList bills={filteredBills} loading={loading} onDeleted={loadBills} />

      <UtilityBillForm open={formOpen} onClose={() => setFormOpen(false)} onSaved={loadBills} />
    </div>
  )
}
