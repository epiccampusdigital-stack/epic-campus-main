'use client'

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { collection, doc, getDoc, getDocs, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import UtilityBillForm from '@/components/utility-bills/UtilityBillForm'
import UtilityBillList from '@/components/utility-bills/UtilityBillList'
import FixedBillsPanel from '@/components/utility-bills/FixedBillsPanel'
import {
  currentMonthKey,
  formatLKR,
  getLastSixMonthKeys,
  parseUtilityBill,
  sumByCategory,
  type UtilityBill,
} from '@/lib/utility-bills/helpers'
import { UTILITY_LOCATIONS } from '@/lib/utility-bills/fixed-bills'
import type { StudentLocation } from '@/types'

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

type HouseUtilityBill = {
  id: string
  houseId?: string
  houseName: string
  ceb: number
  water: number
  internet: number
  other: number
  paid: boolean
  month: string
  year: string | number
  notes: string
}

function UtilityBillsPageContent() {
  const searchParams = useSearchParams()
  const [bills, setBills] = useState<UtilityBill[]>([])
  const [houseBills, setHouseBills] = useState<HouseUtilityBill[]>([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [monthFilter, setMonthFilter] = useState(
    () => searchParams.get('month') || currentMonthKey(),
  )
  const [location, setLocation] = useState<StudentLocation>(
    () => (searchParams.get('location') as StudentLocation) || 'ahangama',
  )
  const [showHousesTab, setShowHousesTab] = useState(false)
  const [expandedHouse, setExpandedHouse] = useState<string | null>(null)

  const monthOptions = useMemo(() => getLastSixMonthKeys(), [])

  const housesGrouped = useMemo(() => {
    const map = new Map<string, { houseName: string; houseId?: string; bills: HouseUtilityBill[] }>()
    for (const b of houseBills) {
      if (!map.has(b.houseName)) map.set(b.houseName, { houseName: b.houseName, houseId: b.houseId, bills: [] })
      const entry = map.get(b.houseName)!
      entry.bills.push(b)
      if (!entry.houseId && b.houseId) entry.houseId = b.houseId
    }
    return Array.from(map.values()).map((h) => ({
      ...h,
      totalCeb: h.bills.reduce((s, x) => s + x.ceb, 0),
      totalWater: h.bills.reduce((s, x) => s + x.water, 0),
      totalInternet: h.bills.reduce((s, x) => s + x.internet, 0),
      unpaidAmount: h.bills
        .filter((x) => !x.paid)
        .reduce((s, x) => s + x.ceb + x.water + x.internet + x.other, 0),
    }))
  }, [houseBills])

  const loadBills = useCallback(async () => {
    setLoading(true)
    try {
      const [snap, rawSnap] = await Promise.all([
        getDocs(query(collection(db, 'utilityBills'), orderBy('createdAt', 'desc'))),
        getDocs(collection(db, 'utilityBills')),
      ])
      setBills(
        snap.docs.map((d) =>
          parseUtilityBill(d.id, d.data() as Record<string, unknown>),
        ),
      )
      setHouseBills(
        rawSnap.docs
          .filter((d) => d.data().houseName != null)
          .map((d) => {
            const raw = d.data()
            return {
              id: d.id,
              houseId: raw.houseId ? String(raw.houseId) : undefined,
              houseName: String(raw.houseName ?? ''),
              ceb: Number(raw.ceb ?? 0),
              water: Number(raw.water ?? 0),
              internet: Number(raw.internet ?? 0),
              other: Number(raw.other ?? 0),
              paid: Boolean(raw.paid),
              month: String(raw.month ?? ''),
              year: raw.year ?? '',
              notes: String(raw.notes ?? ''),
            } as HouseUtilityBill
          }),
      )
    } catch (err) {
      console.error('[UtilityBillsPage]', err)
      setBills([])
      setHouseBills([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadBills()
  }, [loadBills])

  useEffect(() => {
    const paidId = searchParams.get('paid')
    if (!paidId) return
    void (async () => {
      const snap = await getDoc(doc(db, 'fixedUtilityBills', paidId))
      if (snap.exists() && !snap.data()?.paid) {
        await updateDoc(doc(db, 'fixedUtilityBills', paidId), {
          paid: true,
          paymentDate: new Date().toISOString().slice(0, 10),
          updatedAt: serverTimestamp(),
        })
      }
    })()
  }, [searchParams])

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
          <h2 className="font-jakarta text-2xl font-bold text-[#0D1B2A] dark:text-white">
            Utility Bills
          </h2>
          <p className="font-inter text-sm text-[#5A6A7A]">
            Fixed monthly bills and one-off utility expenses by location
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

      <div className="flex flex-wrap gap-2 border-b border-[#DDE3EC] pb-1 dark:border-gray-600">
        {UTILITY_LOCATIONS.map((loc) => (
          <button
            key={loc.id}
            type="button"
            onClick={() => {
              setLocation(loc.id)
              setShowHousesTab(false)
            }}
            className={`rounded-t-lg px-4 py-2 font-jakarta text-sm font-semibold transition-colors ${
              !showHousesTab && location === loc.id
                ? 'border-b-2 border-[#E8A020] text-[#0B3D6B]'
                : 'text-[#5A6A7A] hover:text-[#0B3D6B]'
            }`}
          >
            {loc.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setShowHousesTab(true)}
          className={`rounded-t-lg px-4 py-2 font-jakarta text-sm font-semibold transition-colors ${
            showHousesTab
              ? 'border-b-2 border-[#E8A020] text-[#0B3D6B]'
              : 'text-[#5A6A7A] hover:text-[#0B3D6B]'
          }`}
        >
          Houses
        </button>
      </div>

      {showHousesTab ? (
        <section className="space-y-4">
          <h3 className="font-jakarta text-base font-bold text-[#0B3D6B] dark:text-white">
            Accommodation Houses
          </h3>
          <p className="text-sm text-[#5A6A7A]">
            Utility bills for rented student houses, grouped by house.
          </p>
          {housesGrouped.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#DDE3EC] bg-white py-12 text-center dark:border-gray-600 dark:bg-gray-800">
              <p className="text-sm text-[#5A6A7A]">No house utility bills yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {housesGrouped.map((h) => (
                <div
                  key={h.houseName}
                  className="overflow-hidden rounded-2xl border border-[#DDE3EC] bg-white dark:border-gray-600 dark:bg-gray-800"
                >
                  <div
                    onClick={() => setExpandedHouse(expandedHouse === h.houseName ? null : h.houseName)}
                    className="flex cursor-pointer flex-wrap items-center justify-between gap-3 p-4"
                  >
                    <div>
                      <p className="font-jakarta font-bold text-[#0D1B2A] dark:text-white">{h.houseName}</p>
                      <p className="mt-1 text-xs text-[#5A6A7A]">
                        CEB {formatLKR(h.totalCeb)} · Water {formatLKR(h.totalWater)} · Internet{' '}
                        {formatLKR(h.totalInternet)}
                      </p>
                      {h.unpaidAmount > 0 && (
                        <p className="mt-1 text-xs font-bold text-red-600">
                          Unpaid: {formatLKR(h.unpaidAmount)}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {h.houseId && (
                        <a
                          href={`/accommodation/${h.houseId}`}
                          onClick={(e) => e.stopPropagation()}
                          className="rounded-lg bg-[#0B3D6B] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#0a3560]"
                        >
                          View House
                        </a>
                      )}
                      <span
                        className={`ti ${expandedHouse === h.houseName ? 'ti-chevron-up' : 'ti-chevron-down'} text-[#5A6A7A]`}
                      />
                    </div>
                  </div>
                  {expandedHouse === h.houseName && (
                    <div className="border-t border-[#DDE3EC] px-4 py-3 dark:border-gray-600">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-xs font-semibold uppercase text-[#5A6A7A]">
                            <th className="py-2 pr-4">Month / Year</th>
                            <th className="py-2 pr-4 text-right">CEB</th>
                            <th className="py-2 pr-4 text-right">Water</th>
                            <th className="py-2 pr-4 text-right">Internet</th>
                            <th className="py-2 pr-4">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {h.bills.map((b) => (
                            <tr key={b.id} className="border-t border-[#DDE3EC] dark:border-gray-700">
                              <td className="py-2 pr-4 text-[#5A6A7A]">
                                {b.month}
                                {b.year ? ` ${b.year}` : ''}
                              </td>
                              <td className="py-2 pr-4 text-right font-mono text-[#0B3D6B] dark:text-[#E8A020]">
                                {b.ceb > 0 ? formatLKR(b.ceb) : '—'}
                              </td>
                              <td className="py-2 pr-4 text-right font-mono text-[#0B3D6B] dark:text-[#E8A020]">
                                {b.water > 0 ? formatLKR(b.water) : '—'}
                              </td>
                              <td className="py-2 pr-4 text-right font-mono text-[#0B3D6B] dark:text-[#E8A020]">
                                {b.internet > 0 ? formatLKR(b.internet) : '—'}
                              </td>
                              <td className="py-2 pr-4">
                                {b.paid ? (
                                  <span className="text-xs text-emerald-700">Paid</span>
                                ) : (
                                  <span className="text-xs text-amber-700">Unpaid</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <label className="font-inter text-sm font-medium text-[#5A6A7A]">Month</label>
            <input
              type="month"
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              className="rounded-lg border border-[#DDE3EC] bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            />
            <select
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              className="rounded-lg border border-[#DDE3EC] bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800"
              aria-label="Month quick pick"
            >
              {monthOptions.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          <section className="space-y-3">
            <h3 className="font-jakarta text-base font-bold text-[#0B3D6B] dark:text-white">
              Fixed bills — {UTILITY_LOCATIONS.find((l) => l.id === location)?.label}
            </h3>
            <p className="text-sm text-[#5A6A7A]">
              Recurring monthly bills reset each month (new month = all unchecked).
            </p>
            <FixedBillsPanel location={location} month={monthFilter} />
          </section>

          <section className="space-y-4">
            <h3 className="font-jakarta text-base font-bold text-[#0B3D6B] dark:text-white">
              One-off utility entries
            </h3>
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
            <UtilityBillList
              bills={filteredBills}
              loading={loading}
              onDeleted={loadBills}
              onAdd={() => setFormOpen(true)}
            />
          </section>
        </>
      )}

      <UtilityBillForm open={formOpen} onClose={() => setFormOpen(false)} onSaved={loadBills} />

      {houseBills.length > 0 && (
        <section className="space-y-4">
          <h3 className="font-jakarta text-base font-bold text-[#0B3D6B] dark:text-white">
            House Utility Bills — AI Imported ({houseBills.length})
          </h3>
          <div className="overflow-hidden rounded-2xl border border-[#DDE3EC] bg-white dark:bg-gray-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#DDE3EC] bg-[#F5F7FB] dark:bg-gray-700">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[#5A6A7A]">House</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[#5A6A7A]">Month / Year</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-[#5A6A7A]">CEB (LKR)</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-[#5A6A7A]">Water (LKR)</th>
                  <th className="hidden sm:table-cell px-4 py-3 text-left text-xs font-semibold text-[#5A6A7A]">Notes</th>
                </tr>
              </thead>
              <tbody>
                {houseBills.map((b) => (
                  <tr key={b.id} className="border-b border-[#DDE3EC] last:border-0 hover:bg-[#F5F7FB] dark:hover:bg-gray-700">
                    <td className="px-4 py-3 font-medium text-[#0D1B2A] dark:text-white">{b.houseName}</td>
                    <td className="px-4 py-3 text-[#5A6A7A]">{b.month}{b.year ? ` ${b.year}` : ''}</td>
                    <td className="px-4 py-3 text-right font-mono text-[#0B3D6B] dark:text-[#E8A020]">{b.ceb > 0 ? formatLKR(b.ceb) : '—'}</td>
                    <td className="px-4 py-3 text-right font-mono text-[#0B3D6B] dark:text-[#E8A020]">{b.water > 0 ? formatLKR(b.water) : '—'}</td>
                    <td className="hidden sm:table-cell px-4 py-3 text-xs text-[#5A6A7A]">{b.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}

export default function UtilityBillsPage() {
  return (
    <Suspense
      fallback={
        <div className="animate-pulse space-y-4 p-6">
          <div className="h-10 w-48 rounded bg-[#DDE3EC]" />
          <div className="h-64 rounded-xl bg-[#DDE3EC]" />
        </div>
      }
    >
      <UtilityBillsPageContent />
    </Suspense>
  )
}
