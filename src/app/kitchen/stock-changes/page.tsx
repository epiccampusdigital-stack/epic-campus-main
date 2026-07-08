'use client'

import { useEffect, useMemo, useState } from 'react'
import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { formatQty } from '@/lib/kitchen-utils'
import {
  parseStockLog,
  type StockChangeType,
  type StockLogRecord,
  type StockLogSource,
} from '@/lib/kitchen/stockLog'

type RangeFilter = '7' | '30' | 'all'
type SourceFilter = 'all' | StockLogSource
type TypeFilter = 'all' | StockChangeType

const PAGE_SIZE = 20

const SOURCE_LABEL: Record<StockLogSource, string> = {
  kitchen: 'Kitchen',
  supplies: 'Supplies',
}

function formatDateTime(log: StockLogRecord): string {
  const d = log.createdAt?.toDate?.()
  if (!d) return '—'
  return d.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function StockChangesPage() {
  const [logs, setLogs] = useState<StockLogRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [range, setRange] = useState<RangeFilter>('30')
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const snap = await getDocs(
          query(collection(db, 'inventoryLogs'), orderBy('createdAt', 'desc'), limit(500)),
        )
        setLogs(snap.docs.map((d) => parseStockLog(d.id, d.data() as Record<string, unknown>)))
      } catch (err) {
        console.error('[StockChanges]', err)
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [])

  useEffect(() => {
    setPage(1)
  }, [range, sourceFilter, typeFilter, search])

  const rangeCutoff = useMemo(() => {
    if (range === 'all') return 0
    const days = range === '7' ? 7 : 30
    return Date.now() - days * 24 * 60 * 60 * 1000
  }, [range])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return logs.filter((log) => {
      if (rangeCutoff > 0) {
        const t = log.createdAt?.toDate?.().getTime() ?? 0
        if (t < rangeCutoff) return false
      }
      if (sourceFilter !== 'all' && log.source !== sourceFilter) return false
      if (typeFilter !== 'all' && log.changeType !== typeFilter) return false
      if (q && !log.itemName.toLowerCase().includes(q)) return false
      return true
    })
  }, [logs, rangeCutoff, sourceFilter, typeFilter, search])

  const summary = useMemo(() => {
    let addQty = 0
    let addCount = 0
    let removeQty = 0
    let removeCount = 0
    let adjustCount = 0
    for (const log of filtered) {
      if (log.changeType === 'add') {
        addQty += Math.abs(log.difference)
        addCount++
      } else if (log.changeType === 'remove') {
        removeQty += Math.abs(log.difference)
        removeCount++
      } else {
        adjustCount++
      }
    }
    return { addQty, addCount, removeQty, removeCount, adjustCount }
  }, [filtered])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const selectClass =
    'rounded-xl border border-[#DDE3EC] bg-white px-3 py-2 text-sm text-[#0D1B2A] outline-none focus:border-[#E8A020] dark:border-white/[0.08] dark:bg-white/[0.06] dark:text-white'

  return (
    <div className="space-y-6">
      {/* Header + date range */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-jakarta text-xl font-bold text-[#0D1B2A] dark:text-white md:text-2xl">
            Recent Stock Changes
          </h1>
          <p className="mt-1 text-sm text-[#5A6A7A] dark:text-white/50">
            Unified log of kitchen inventory and supplies movements
          </p>
        </div>
        <div className="flex gap-2">
          {(
            [
              { id: '7', label: 'Last 7 days' },
              { id: '30', label: 'Last 30 days' },
              { id: 'all', label: 'All' },
            ] as { id: RangeFilter; label: string }[]
          ).map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setRange(r.id)}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition-all ${
                range === r.id
                  ? 'bg-[#E8A020] text-white'
                  : 'border border-[#DDE3EC] text-[#5A6A7A] dark:border-white/[0.12] dark:text-white/60'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/90 bg-white/65 p-5 backdrop-blur-xl dark:border-white/[0.08] dark:bg-white/[0.05]">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#5A6A7A] dark:text-white/50">
            Total Additions
          </p>
          <p className="mt-1 font-jakarta text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            +{formatQty(summary.addQty)}
          </p>
          <p className="mt-0.5 text-xs text-[#5A6A7A] dark:text-white/40">{summary.addCount} changes</p>
        </div>
        <div className="rounded-2xl border border-white/90 bg-white/65 p-5 backdrop-blur-xl dark:border-white/[0.08] dark:bg-white/[0.05]">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#5A6A7A] dark:text-white/50">
            Total Removals
          </p>
          <p className="mt-1 font-jakarta text-2xl font-bold text-red-600 dark:text-red-400">
            -{formatQty(summary.removeQty)}
          </p>
          <p className="mt-0.5 text-xs text-[#5A6A7A] dark:text-white/40">{summary.removeCount} changes</p>
        </div>
        <div className="rounded-2xl border border-white/90 bg-white/65 p-5 backdrop-blur-xl dark:border-white/[0.08] dark:bg-white/[0.05]">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#5A6A7A] dark:text-white/50">
            Total Adjustments
          </p>
          <p className="mt-1 font-jakarta text-2xl font-bold text-[#E8A020]">{summary.adjustCount}</p>
          <p className="mt-0.5 text-xs text-[#5A6A7A] dark:text-white/40">manual adjustments</p>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value as SourceFilter)}
          className={selectClass}
        >
          <option value="all">All Sources</option>
          <option value="kitchen">Kitchen</option>
          <option value="supplies">Supplies</option>
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
          className={selectClass}
        >
          <option value="all">All Types</option>
          <option value="add">Added</option>
          <option value="remove">Removed</option>
          <option value="adjust">Adjusted</option>
        </select>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by item…"
          className={`${selectClass} min-w-[180px] flex-1`}
        />
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-white/90 bg-white/65 backdrop-blur-xl dark:border-white/[0.08] dark:bg-white/[0.05]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead>
              <tr className="border-b border-[#DDE3EC] bg-[#F5F7FB] text-xs font-medium uppercase text-[#5A6A7A] dark:border-white/[0.06] dark:bg-white/[0.03] dark:text-white/40">
                <th className="px-4 py-3">Date &amp; Time</th>
                <th className="px-4 py-3">Item</th>
                <th className="px-4 py-3">Change</th>
                <th className="px-4 py-3">Before</th>
                <th className="px-4 py-3">After</th>
                <th className="px-4 py-3">Changed By</th>
                <th className="px-4 py-3">Source</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b border-[#DDE3EC] dark:border-white/[0.06]">
                    {Array.from({ length: 7 }).map((__, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 animate-pulse rounded bg-[#DDE3EC] dark:bg-white/10" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : paginated.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-sm text-[#5A6A7A] dark:text-white/40">
                    No stock changes found for this filter.
                  </td>
                </tr>
              ) : (
                paginated.map((log) => (
                  <tr
                    key={log.id}
                    className="border-b border-[#DDE3EC] last:border-0 dark:border-white/[0.06]"
                  >
                    <td className="whitespace-nowrap px-4 py-3 text-[#5A6A7A] dark:text-white/60">
                      {formatDateTime(log)}
                    </td>
                    <td className="px-4 py-3 font-medium text-[#0D1B2A] dark:text-white">{log.itemName}</td>
                    <td className="px-4 py-3">
                      {log.changeType === 'add' ? (
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                          +{formatQty(Math.abs(log.difference))} {log.unit}
                        </span>
                      ) : log.changeType === 'remove' ? (
                        <span className="font-semibold text-red-600 dark:text-red-400">
                          -{formatQty(Math.abs(log.difference))} {log.unit}
                        </span>
                      ) : (
                        <span className="font-semibold text-[#E8A020]">
                          adjusted ({log.difference > 0 ? '+' : ''}
                          {formatQty(log.difference)} {log.unit})
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[#5A6A7A] dark:text-white/60">
                      {formatQty(log.previousQty)} {log.unit}
                    </td>
                    <td className="px-4 py-3 text-[#5A6A7A] dark:text-white/60">
                      {formatQty(log.newQty)} {log.unit}
                    </td>
                    <td className="px-4 py-3 text-[#5A6A7A] dark:text-white/60">{log.changedByName}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                          log.source === 'kitchen'
                            ? 'border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-800 dark:bg-orange-900/20 dark:text-orange-400'
                            : 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-900/20 dark:text-sky-400'
                        }`}
                      >
                        {SOURCE_LABEL[log.source]}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {!loading && filtered.length > PAGE_SIZE && (
        <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
          <p className="text-sm text-[#5A6A7A] dark:text-white/50">
            Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of{' '}
            {filtered.length}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="rounded-lg border border-[#DDE3EC] bg-white px-3 py-1.5 text-sm text-[#0B3D6B] hover:bg-[#F5F7FB] disabled:opacity-40 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white/70"
            >
              Previous
            </button>
            <span className="text-sm text-[#5A6A7A] dark:text-white/50">
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-lg border border-[#DDE3EC] bg-white px-3 py-1.5 text-sm text-[#0B3D6B] hover:bg-[#F5F7FB] disabled:opacity-40 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white/70"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
