'use client'

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import {
  formatCommissionStatus,
  getCommissionStatusClasses,
  markCommissionCancelled,
  markCommissionPaid,
  markCommissionsPaidBulk,
  parseAgentCommission,
  type AgentCommissionRecord,
} from '@/lib/commissions/helpers'
import { currentMonthKey, getMonthPickerOptions } from '@/lib/dashboard/helpers'
import { formatLKR } from '@/lib/payments/helpers'
import { parseStaff, staffHasRole } from '@/lib/staff/helpers'
import EmptyState from '@/components/ui/EmptyState'
import LocationFilterSelect from '@/components/ui/LocationFilterSelect'
import { useManagement } from '@/components/layout/ManagementContext'
import type { StaffMember, StudentLocation } from '@/types'

type CommissionRow = AgentCommissionRecord & { id: string }

function monthMatches(dateStr: string, monthKey: string): boolean {
  return dateStr.startsWith(monthKey)
}

function paidThisMonth(c: CommissionRow, monthKey: string): boolean {
  if (c.status !== 'paid' || !c.paidAt) return false
  const paidDate = c.paidAt.toDate().toISOString().slice(0, 7)
  return paidDate === monthKey
}

export default function AgentCommissionReportsPage() {
  const { user } = useManagement()
  const [commissions, setCommissions] = useState<CommissionRow[]>([])
  const [agents, setAgents] = useState<StaffMember[]>([])
  const [loading, setLoading] = useState(true)
  const [agentFilter, setAgentFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | AgentCommissionRecord['status']>('all')
  const [monthFilter, setMonthFilter] = useState(currentMonthKey())
  const [locationFilter, setLocationFilter] = useState<StudentLocation | ''>('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null)
  const [actionMenu, setActionMenu] = useState<string | null>(null)
  const [bulkPaying, setBulkPaying] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [commSnap, usersSnap] = await Promise.all([
        getDocs(collection(db, 'agentCommissions')),
        getDocs(collection(db, 'users')),
      ])
      setCommissions(
        commSnap.docs.map((d) =>
          parseAgentCommission(d.id, d.data() as Record<string, unknown>),
        ),
      )
      setAgents(
        usersSnap.docs
          .map((d) => parseStaff(d.id, d.data() as Record<string, unknown>))
          .filter((s): s is StaffMember => s !== null && staffHasRole(s, 'agent')),
      )
    } catch (err) {
      console.error('[AgentCommissionReports]', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const monthOptions = useMemo(() => getMonthPickerOptions(12), [])

  const filtered = useMemo(() => {
    return commissions.filter((c) => {
      if (agentFilter && c.agentId !== agentFilter) return false
      if (statusFilter !== 'all' && c.status !== statusFilter) return false
      if (!monthMatches(c.enrollmentDate, monthFilter)) return false
      if (locationFilter) {
        const loc = c.location.toLowerCase()
        if (loc !== locationFilter && !loc.includes(locationFilter)) return false
      }
      return true
    })
  }, [commissions, agentFilter, statusFilter, monthFilter, locationFilter])

  const stats = useMemo(() => {
    const pendingTotal = commissions
      .filter((c) => c.status === 'pending')
      .reduce((s, c) => s + c.commissionAmount, 0)
    const paidThisMonthTotal = commissions
      .filter((c) => paidThisMonth(c, monthFilter))
      .reduce((s, c) => s + c.commissionAmount, 0)
    const activeAgentCount = agents.filter((a) => a.status === 'active').length
    const avgPerAgent =
      activeAgentCount > 0 ? Math.round(pendingTotal / activeAgentCount) : 0
    return { pendingTotal, paidThisMonthTotal, activeAgentCount, avgPerAgent }
  }, [commissions, agents, monthFilter])

  const agentSummaries = useMemo(() => {
    const map = new Map<
      string,
      {
        agentId: string
        agentName: string
        commissionRate: number
        totalEarned: number
        pending: number
        paidThisMonth: number
        items: CommissionRow[]
      }
    >()
    for (const c of commissions) {
      const existing = map.get(c.agentId) ?? {
        agentId: c.agentId,
        agentName: c.agentName,
        commissionRate: c.commissionRate,
        totalEarned: 0,
        pending: 0,
        paidThisMonth: 0,
        items: [],
      }
      if (c.status !== 'cancelled') existing.totalEarned += c.commissionAmount
      if (c.status === 'pending') existing.pending += c.commissionAmount
      if (paidThisMonth(c, monthFilter)) existing.paidThisMonth += c.commissionAmount
      existing.items.push(c)
      map.set(c.agentId, existing)
    }
    for (const agent of agents) {
      if (!map.has(agent.id)) {
        map.set(agent.id, {
          agentId: agent.id,
          agentName: agent.displayName,
          commissionRate: agent.commissionRate ?? 0,
          totalEarned: 0,
          pending: 0,
          paidThisMonth: 0,
          items: [],
        })
      } else if (agent.commissionRate) {
        const entry = map.get(agent.id)!
        entry.commissionRate = agent.commissionRate
      }
    }
    return Array.from(map.values()).sort((a, b) => a.agentName.localeCompare(b.agentName))
  }, [commissions, agents, monthFilter])

  const pendingSelected = filtered.filter((c) => c.status === 'pending' && selected.has(c.id))

  async function handleMarkPaid(c: CommissionRow) {
    if (!user) return
    await markCommissionPaid(c.id, user.uid, user.displayName)
    setActionMenu(null)
    await load()
  }

  async function handleCancel(c: CommissionRow) {
    if (!confirm(`Cancel commission for ${c.studentName}?`)) return
    await markCommissionCancelled(c.id)
    setActionMenu(null)
    await load()
  }

  async function handleBulkPay() {
    if (!user || pendingSelected.length === 0) return
    setBulkPaying(true)
    try {
      await markCommissionsPaidBulk(
        pendingSelected.map((c) => c.id),
        user.uid,
        user.displayName,
      )
      setSelected(new Set())
      await load()
    } finally {
      setBulkPaying(false)
    }
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-jakarta text-xl font-bold text-[#0D1B2A] sm:text-2xl dark:text-white">
          Agent Commission Reports
        </h2>
        <p className="mt-1 font-inter text-sm text-[#5A6A7A]">
          Track and manage enrollment agent commissions
        </p>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Pending commissions', value: formatLKR(stats.pendingTotal) },
          { label: 'Paid this month', value: formatLKR(stats.paidThisMonthTotal) },
          { label: 'Active agents', value: String(stats.activeAgentCount) },
          { label: 'Avg pending / agent', value: formatLKR(stats.avgPerAgent) },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-xl border border-[#DDE3EC] border-l-[3px] border-l-[#E8A020] bg-white p-5 dark:border-gray-600 dark:bg-gray-800"
          >
            <p className="text-xs font-medium uppercase text-[#5A6A7A]">{card.label}</p>
            <p className="mt-2 font-jakarta text-2xl font-bold text-[#0B3D6B] dark:text-white">
              {loading ? '…' : card.value}
            </p>
          </div>
        ))}
      </section>

      <div className="flex flex-col gap-4 rounded-xl border border-[#DDE3EC] bg-white p-4 dark:border-gray-600 dark:bg-gray-800 lg:flex-row lg:flex-wrap lg:items-end">
        <div>
          <label className="mb-1.5 block text-xs font-medium uppercase text-[#5A6A7A]">Agent</label>
          <select
            value={agentFilter}
            onChange={(e) => setAgentFilter(e.target.value)}
            className="rounded-lg border border-[#DDE3EC] bg-white px-3 py-2.5 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
          >
            <option value="">All agents</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.displayName}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium uppercase text-[#5A6A7A]">Status</label>
          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as typeof statusFilter)
            }
            className="rounded-lg border border-[#DDE3EC] bg-white px-3 py-2.5 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
          >
            <option value="all">All statuses</option>
            <option value="pending">Pending</option>
            <option value="paid">Paid</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium uppercase text-[#5A6A7A]">Month</label>
          <select
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            className="rounded-lg border border-[#DDE3EC] bg-white px-3 py-2.5 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
          >
            {monthOptions.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium uppercase text-[#5A6A7A]">Location</label>
          <LocationFilterSelect value={locationFilter} onChange={setLocationFilter} />
        </div>
        {pendingSelected.length > 0 && (
          <button
            type="button"
            disabled={bulkPaying}
            onClick={() => void handleBulkPay()}
            className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {bulkPaying ? 'Paying…' : `Pay Selected (${pendingSelected.length})`}
          </button>
        )}
      </div>

      {loading ? (
        <div className="h-48 animate-pulse rounded-xl bg-[#DDE3EC]/60" />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="ti-chart-dots-2"
          title="No commissions found"
          subtitle="Commissions are created automatically when registration fees are paid for students with an assigned agent."
        />
      ) : (
        <section className="rounded-xl border border-[#DDE3EC] bg-white dark:border-gray-600 dark:bg-gray-800">
          <div className="overflow-x-auto overflow-y-visible -mx-4 sm:mx-0">
            <table className="w-full min-w-[960px] text-left text-sm">
              <thead>
                <tr className="border-b border-[#DDE3EC] bg-[#F5F7FB] dark:bg-gray-900">
                  <th className="px-3 py-3 w-10" />
                  {[
                    'Agent',
                    'Student',
                    'Enrollment',
                    'Reg Fee',
                    'Rate',
                    'Commission',
                    'Status',
                    'Actions',
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-xs font-semibold uppercase text-[#5A6A7A]"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr
                    key={c.id}
                    className="border-b border-[#DDE3EC] hover:bg-[#F5F7FB]/60 dark:border-gray-600"
                  >
                    <td className="px-3 py-3">
                      {c.status === 'pending' && (
                        <input
                          type="checkbox"
                          checked={selected.has(c.id)}
                          onChange={() => toggleSelect(c.id)}
                          className="h-4 w-4"
                        />
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium text-[#0B3D6B]">{c.agentName}</td>
                    <td className="px-4 py-3">{c.studentName}</td>
                    <td className="px-4 py-3 text-[#5A6A7A]">{c.enrollmentDate}</td>
                    <td className="px-4 py-3">{formatLKR(c.registrationFee)}</td>
                    <td className="px-4 py-3">{c.commissionRate}%</td>
                    <td className="px-4 py-3 font-semibold">{formatLKR(c.commissionAmount)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${getCommissionStatusClasses(c.status)}`}
                      >
                        {formatCommissionStatus(c.status)}
                      </span>
                    </td>
                    <td className="relative px-4 py-3">
                      <button
                        type="button"
                        onClick={() => setActionMenu(actionMenu === c.id ? null : c.id)}
                        className="rounded-lg p-2 hover:bg-[#F5F7FB]"
                        aria-label="Actions"
                      >
                        <span className="ti ti-dots-vertical text-lg" />
                      </button>
                      {actionMenu === c.id && (
                        <div className="absolute right-4 z-10 mt-1 w-44 rounded-lg border border-[#DDE3EC] bg-white py-1 shadow-lg dark:border-gray-600 dark:bg-gray-800">
                          {c.status === 'pending' && (
                            <button
                              type="button"
                              onClick={() => void handleMarkPaid(c)}
                              className="block w-full px-4 py-2 text-left text-sm hover:bg-[#F5F7FB]"
                            >
                              Mark as Paid
                            </button>
                          )}
                          {c.status === 'pending' && (
                            <button
                              type="button"
                              onClick={() => void handleCancel(c)}
                              className="block w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                            >
                              Cancel
                            </button>
                          )}
                          <Link
                            href={`/students/${c.studentId}`}
                            className="block px-4 py-2 text-sm hover:bg-[#F5F7FB]"
                            onClick={() => setActionMenu(null)}
                          >
                            View Student
                          </Link>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="space-y-3">
        <h3 className="font-jakarta text-lg font-bold text-[#0B3D6B] dark:text-white">
          Agent summary
        </h3>
        {agentSummaries.map((summary) => (
          <div
            key={summary.agentId}
            className="overflow-hidden rounded-xl border border-[#DDE3EC] bg-white dark:border-gray-600 dark:bg-gray-800"
          >
            <button
              type="button"
              onClick={() =>
                setExpandedAgent((prev) =>
                  prev === summary.agentId ? null : summary.agentId,
                )
              }
              className="flex w-full flex-wrap items-center justify-between gap-3 px-5 py-4 text-left hover:bg-[#F5F7FB]/60"
            >
              <div>
                <p className="font-jakarta font-bold text-[#0D1B2A] dark:text-white">
                  {summary.agentName}
                </p>
                <p className="text-xs text-[#5A6A7A]">
                  Rate {summary.commissionRate}% · {summary.items.length} commission
                  {summary.items.length !== 1 ? 's' : ''}
                </p>
              </div>
              <dl className="flex flex-wrap gap-4 text-sm">
                <div>
                  <dt className="text-xs text-[#5A6A7A]">All-time earned</dt>
                  <dd className="font-bold">{formatLKR(summary.totalEarned)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-[#5A6A7A]">Pending</dt>
                  <dd className="font-bold text-amber-700">{formatLKR(summary.pending)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-[#5A6A7A]">Paid this month</dt>
                  <dd className="font-bold text-emerald-700">
                    {formatLKR(summary.paidThisMonth)}
                  </dd>
                </div>
              </dl>
            </button>
            {expandedAgent === summary.agentId && summary.items.length > 0 && (
              <ul className="divide-y divide-[#DDE3EC] border-t border-[#DDE3EC] dark:divide-gray-600 dark:border-gray-600">
                {summary.items.map((item) => (
                  <li
                    key={item.id}
                    className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm"
                  >
                    <span>
                      {item.studentName}{' '}
                      <span className="text-[#5A6A7A]">({item.enrollmentDate})</span>
                    </span>
                    <span className="flex items-center gap-3">
                      <span className="font-medium">{formatLKR(item.commissionAmount)}</span>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-xs ${getCommissionStatusClasses(item.status)}`}
                      >
                        {formatCommissionStatus(item.status)}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </section>
    </div>
  )
}
