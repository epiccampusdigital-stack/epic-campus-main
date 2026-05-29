'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import {
  AUDIT_ACTIONS,
  formatAuditTimestamp,
  getActionColor,
  getActionLabel,
  parseAuditLog,
} from '@/lib/audit/helpers'
import type { AuditAction, AuditLog } from '@/types'

const PAGE_SIZE = 20

function TableSkeleton() {
  return (
    <div className="animate-pulse divide-y divide-[#DDE3EC]">
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="flex gap-4 px-4 py-4">
          <div className="h-3 w-28 rounded bg-[#DDE3EC]" />
          <div className="h-3 w-24 flex-1 rounded bg-[#DDE3EC]" />
          <div className="h-3 w-20 rounded bg-[#DDE3EC]" />
        </div>
      ))}
    </div>
  )
}

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [actionFilter, setActionFilter] = useState<AuditAction | ''>('')
  const [userFilter, setUserFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)

  const loadLogs = useCallback(async () => {
    setLoading(true)
    try {
      const snap = await getDocs(collection(db, 'auditLog'))
      const entries = snap.docs
        .map((d) => parseAuditLog(d.id, d.data() as Record<string, unknown>))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      setLogs(entries)
    } catch (err) {
      console.error('[AuditLogPage]', err)
      setLogs([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadLogs()
  }, [loadLogs])

  const users = useMemo(() => {
    const set = new Set(logs.map((l) => l.userEmail).filter(Boolean))
    return Array.from(set).sort()
  }, [logs])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return logs.filter((l) => {
      if (actionFilter && l.action !== actionFilter) return false
      if (userFilter && l.userEmail !== userFilter) return false
      const day = l.createdAt.slice(0, 10)
      if (dateFrom && day < dateFrom) return false
      if (dateTo && day > dateTo) return false
      if (!q) return true
      return (
        l.userEmail.toLowerCase().includes(q) ||
        l.action.toLowerCase().includes(q) ||
        l.entityType.toLowerCase().includes(q) ||
        l.entityId.toLowerCase().includes(q) ||
        l.details.toLowerCase().includes(q)
      )
    })
  }, [logs, search, actionFilter, userFilter, dateFrom, dateTo])

  useEffect(() => {
    setPage(1)
  }, [search, actionFilter, userFilter, dateFrom, dateTo])

  const paginated = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return filtered.slice(start, start + PAGE_SIZE)
  }, [filtered, page])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-jakarta text-2xl font-bold text-[#0D1B2A]">Audit Log</h2>
        <p className="font-inter text-sm text-[#5A6A7A]">All system activity</p>
      </div>

      <div className="rounded-xl border border-[#DDE3EC] bg-white p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-5">
          <div className="relative lg:col-span-2">
            <span
              className="ti ti-search absolute left-3 top-1/2 -translate-y-1/2 text-[#5A6A7A]"
              aria-hidden="true"
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search user, action, entity…"
              className="w-full rounded-lg border border-[#DDE3EC] py-2.5 pl-10 pr-3 font-inter text-base outline-none focus:border-[#E8A020] sm:text-sm"
            />
          </div>
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value as AuditAction | '')}
            className="rounded-lg border border-[#DDE3EC] px-3 py-2.5 font-inter text-sm outline-none focus:border-[#E8A020]"
          >
            <option value="">All actions</option>
            {AUDIT_ACTIONS.map((a) => (
              <option key={a} value={a}>
                {getActionLabel(a)}
              </option>
            ))}
          </select>
          <select
            value={userFilter}
            onChange={(e) => setUserFilter(e.target.value)}
            className="rounded-lg border border-[#DDE3EC] px-3 py-2.5 font-inter text-sm outline-none focus:border-[#E8A020]"
          >
            <option value="">All users</option>
            {users.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-2 lg:col-span-1">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="rounded-lg border border-[#DDE3EC] px-2 py-2.5 font-inter text-sm outline-none focus:border-[#E8A020]"
              aria-label="From date"
            />
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="rounded-lg border border-[#DDE3EC] px-2 py-2.5 font-inter text-sm outline-none focus:border-[#E8A020]"
              aria-label="To date"
            />
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-[#DDE3EC] bg-white">
        {loading ? (
          <TableSkeleton />
        ) : filtered.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <span className="ti ti-history mb-3 block text-4xl text-[#0B3D6B]/40" aria-hidden="true" />
            <p className="font-jakarta font-bold text-[#0D1B2A]">No audit entries</p>
            <p className="mt-1 text-sm text-[#5A6A7A]">
              System actions will appear here as users interact with the platform.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-left text-sm">
              <thead>
                <tr className="border-b border-[#DDE3EC] bg-[#F5F7FB]">
                  {[
                    'Timestamp',
                    'User',
                    'Action',
                    'Entity Type',
                    'Entity ID',
                    'Details',
                    'IP Address',
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 font-jakarta text-xs font-semibold uppercase tracking-wide text-[#5A6A7A]"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DDE3EC]">
                {paginated.map((log) => (
                  <tr key={log.id} className="hover:bg-[#F5F7FB]/60">
                    <td className="whitespace-nowrap px-4 py-3 text-[#5A6A7A]">
                      {formatAuditTimestamp(log.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-[#0D1B2A]">{log.userEmail || log.userId}</p>
                      <p className="text-xs capitalize text-[#5A6A7A]">{log.userRole}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${getActionColor(log.action)}`}
                      >
                        {getActionLabel(log.action)}
                      </span>
                    </td>
                    <td className="px-4 py-3 capitalize text-[#5A6A7A]">{log.entityType}</td>
                    <td className="max-w-[120px] truncate px-4 py-3 font-mono text-xs text-[#5A6A7A]">
                      {log.entityId || '—'}
                    </td>
                    <td className="max-w-[200px] truncate px-4 py-3 text-[#5A6A7A]">
                      {log.details || '—'}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-[#5A6A7A]">
                      {log.ipAddress || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!loading && filtered.length > 0 && (
        <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
          <p className="font-inter text-sm text-[#5A6A7A]">
            Showing {(page - 1) * PAGE_SIZE + 1}–
            {Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length} entries
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="rounded-lg border border-[#DDE3EC] bg-white px-3 py-1.5 text-sm text-[#0B3D6B] hover:bg-[#F5F7FB] disabled:opacity-40"
            >
              Previous
            </button>
            <span className="font-inter text-sm text-[#5A6A7A]">
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-lg border border-[#DDE3EC] bg-white px-3 py-1.5 text-sm text-[#0B3D6B] hover:bg-[#F5F7FB] disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
