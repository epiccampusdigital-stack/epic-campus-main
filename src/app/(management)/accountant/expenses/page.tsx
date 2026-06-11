'use client'

import { useEffect, useState } from 'react'
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
} from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { formatLKR } from '@/lib/utils/formatCurrency'

interface Expense {
  id: string
  category: string
  description: string
  amount: number
  date: string
  createdByName?: string
  source?: string
  sourceId?: string
}

function thisMonthPrefix(offset = 0): string {
  const d = new Date()
  d.setMonth(d.getMonth() + offset)
  return d.toISOString().slice(0, 7)
}

export default function AccountantExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [monthFilter, setMonthFilter] = useState(thisMonthPrefix())

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const snap = await getDocs(
          query(
            collection(db, 'expenses'),
            where('category', '==', 'Kitchen & Canteen'),
            orderBy('date', 'desc'),
          ),
        )
        setExpenses(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Expense)))
      } catch (err) {
        console.error('[AccountantExpenses]', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const filtered = expenses.filter((e) => !monthFilter || e.date.startsWith(monthFilter))
  const curTotal = filtered.reduce((s, e) => s + e.amount, 0)

  const prevMonth = thisMonthPrefix(-1)
  const prevMonthFiltered = expenses.filter((e) => e.date.startsWith(prevMonth))
  const prevTotal = prevMonthFiltered.reduce((s, e) => s + e.amount, 0)
  const changePercent = prevTotal > 0 ? ((curTotal - prevTotal) / prevTotal) * 100 : 0

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-[#0D1B2A] dark:text-white">Kitchen & Canteen Expenses</h1>

      {/* Kitchen summary mini-section */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="rounded-[12px] border border-white/90 bg-white/65 p-4 backdrop-blur-2xl dark:border-white/[0.08] dark:bg-white/[0.05]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.05em] text-gray-400 dark:text-white/40">This Month</p>
          <p className="mt-2 text-xl font-bold text-[#0B3D6B] dark:text-[#E8A020]">{formatLKR(curTotal)}</p>
        </div>
        <div className="rounded-[12px] border border-white/90 bg-white/65 p-4 backdrop-blur-2xl dark:border-white/[0.08] dark:bg-white/[0.05]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.05em] text-gray-400 dark:text-white/40">Last Month</p>
          <p className="mt-2 text-xl font-bold text-[#5A6A7A] dark:text-white/60">{formatLKR(prevTotal)}</p>
        </div>
        <div className="rounded-[12px] border border-white/90 bg-white/65 p-4 backdrop-blur-2xl dark:border-white/[0.08] dark:bg-white/[0.05]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.05em] text-gray-400 dark:text-white/40">Change</p>
          <p className={`mt-2 text-xl font-bold ${changePercent > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
            {changePercent >= 0 ? '+' : ''}{changePercent.toFixed(1)}%
          </p>
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3">
        <label className="text-xs text-[#5A6A7A]">Month</label>
        <input
          type="month"
          value={monthFilter}
          onChange={(e) => setMonthFilter(e.target.value)}
          className="rounded-lg border border-[#DDE3EC] bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
        />
      </div>

      {/* Expenses table */}
      <div className="overflow-hidden rounded-xl border border-white/90 bg-white/65 backdrop-blur-xl dark:border-white/[0.08] dark:bg-white/[0.05]">
        <div className="border-b border-[#DDE3EC] bg-amber-50 px-5 py-3 dark:border-white/[0.06] dark:bg-amber-900/10">
          <p className="text-xs text-amber-700 dark:text-amber-400">
            Kitchen expense entries are read-only. They are created automatically when admin approves a kitchen order.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-left text-sm">
            <thead>
              <tr className="border-b border-[#DDE3EC] bg-[#F5F7FB] text-xs font-medium uppercase text-[#5A6A7A] dark:border-white/[0.06] dark:bg-white/[0.03] dark:text-white/40">
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3">Amount (LKR)</th>
                <th className="px-4 py-3">Created By</th>
                <th className="px-4 py-3">Source</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-[#DDE3EC] dark:border-white/[0.06]">
                    {Array.from({ length: 5 }).map((__, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 animate-pulse rounded bg-[#DDE3EC] dark:bg-white/10" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-sm text-[#5A6A7A] dark:text-white/40">
                    No kitchen expense entries for this period
                  </td>
                </tr>
              ) : (
                filtered.map((e) => (
                  <tr key={e.id} className="border-b border-[#DDE3EC] last:border-0 dark:border-white/[0.06]">
                    <td className="px-4 py-3 text-[#5A6A7A] dark:text-white/60">{e.date}</td>
                    <td className="px-4 py-3 text-[#0D1B2A] dark:text-white">{e.description}</td>
                    <td className="px-4 py-3 font-medium text-[#0B3D6B] dark:text-[#E8A020]">{formatLKR(e.amount)}</td>
                    <td className="px-4 py-3 text-[#5A6A7A] dark:text-white/60">{e.createdByName ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className="inline-block rounded-full bg-orange-50 border border-orange-200 px-2 py-0.5 text-[10px] font-medium text-orange-700">
                        kitchen-order
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
