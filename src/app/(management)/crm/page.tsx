'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { collection, getDocs, orderBy, query } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { COURSES } from '@/lib/constants/courses'
import { formatLKR } from '@/lib/payments/helpers'
import {
  computeAgentStats,
  computeCrmStats,
  getSourceLabel,
  getUniqueAgents,
  LEAD_SOURCES,
  parseLead,
} from '@/lib/crm/helpers'
import LeadForm from '@/components/crm/LeadForm'
import LeadKanban from '@/components/crm/LeadKanban'
import LeadTable from '@/components/crm/LeadTable'
import type { CourseId, Lead, LeadSource, LeadStatus } from '@/types'

type ViewMode = 'table' | 'kanban'

function StatCard({
  label,
  value,
  loading,
}: {
  label: string
  value: string
  loading?: boolean
}) {
  return (
    <div className="rounded-xl border border-[#DDE3EC] dark:border-white/10 bg-white dark:bg-slate-800 p-5">
      <p className="font-inter text-xs font-medium uppercase tracking-wide text-[#5A6A7A] dark:text-white/50">
        {label}
      </p>
      {loading ? (
        <div className="mt-2 h-8 w-16 animate-pulse rounded bg-[#DDE3EC] dark:bg-white/10" />
      ) : (
        <p className="mt-1 font-jakarta text-2xl font-bold text-[#0B3D6B] dark:text-[#E8A020]">{value}</p>
      )}
    </div>
  )
}

export default function CrmPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<ViewMode>('table')
  const [formOpen, setFormOpen] = useState(false)
  const [editLead, setEditLead] = useState<Lead | null>(null)

  const [search, setSearch] = useState('')
  const [sourceFilter, setSourceFilter] = useState<LeadSource | ''>('')
  const [statusFilter, setStatusFilter] = useState<LeadStatus | ''>('')
  const [courseFilter, setCourseFilter] = useState<CourseId | ''>('')
  const [agentFilter, setAgentFilter] = useState('')
  const [page, setPage] = useState(1)

  const loadLeads = useCallback(async () => {
    setLoading(true)
    try {
      const snap = await getDocs(
        query(collection(db, 'leads'), orderBy('createdAt', 'desc')),
      )
      setLeads(
        snap.docs.map((d) => parseLead(d.id, d.data() as Record<string, unknown>)),
      )
    } catch (err) {
      console.error('[CrmPage]', err)
      setLeads([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadLeads()
  }, [loadLeads])

  const stats = useMemo(() => computeCrmStats(leads), [leads])
  const agentStats = useMemo(() => computeAgentStats(leads), [leads])
  const agents = useMemo(() => getUniqueAgents(leads), [leads])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return leads.filter((l) => {
      if (sourceFilter && l.source !== sourceFilter) return false
      if (statusFilter && l.status !== statusFilter) return false
      if (courseFilter && l.courseId !== courseFilter) return false
      if (agentFilter && l.agentName !== agentFilter) return false
      if (q) {
        const hay = `${l.name} ${l.phone} ${l.email ?? ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [leads, search, sourceFilter, statusFilter, courseFilter, agentFilter])

  useEffect(() => {
    setPage(1)
  }, [search, sourceFilter, statusFilter, courseFilter, agentFilter])

  function openEdit(lead: Lead) {
    setEditLead(lead)
    setFormOpen(true)
  }

  function openAdd() {
    setEditLead(null)
    setFormOpen(true)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-jakarta text-2xl font-bold text-[#0B3D6B] dark:text-white">CRM</h1>
          <p className="mt-1 font-inter text-sm text-[#5A6A7A] dark:text-white/60">
            Lead pipeline management
          </p>
        </div>
        <button
          type="button"
          onClick={openAdd}
          className="inline-flex items-center gap-2 rounded-lg bg-[#E8A020] px-4 py-2.5 font-jakarta text-sm font-bold text-[#0B3D6B] hover:bg-[#F5B942]"
        >
          <span className="ti ti-plus" aria-hidden="true" />
          Add Lead
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total Leads" value={String(stats.total)} loading={loading} />
        <StatCard label="Converted" value={String(stats.converted)} loading={loading} />
        <StatCard label="In Progress" value={String(stats.inProgress)} loading={loading} />
        <StatCard label="Lost" value={String(stats.lost)} loading={loading} />
      </div>

      {agentStats.length > 0 && (
        <div className="rounded-xl border border-[#DDE3EC] dark:border-white/10 bg-white dark:bg-slate-800 p-5">
          <h2 className="font-jakarta text-sm font-bold text-[#0B3D6B] dark:text-white">
            Agent Commission Tracking
          </h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-[#DDE3EC] dark:border-white/10">
                  {['Agent', 'Total Leads', 'Enrolled', 'Conversion', 'Commission Owed'].map(
                    (h) => (
                      <th
                        key={h}
                        className="pb-2 font-jakarta text-xs font-semibold uppercase text-[#5A6A7A] dark:text-white/50"
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DDE3EC] dark:divide-white/10">
                {agentStats.map((a) => (
                  <tr key={a.agentName}>
                    <td className="py-2.5 font-medium text-[#0D1B2A] dark:text-white">
                      {a.agentName}
                    </td>
                    <td className="py-2.5 text-[#5A6A7A] dark:text-white/60">{a.totalLeads}</td>
                    <td className="py-2.5 text-[#5A6A7A] dark:text-white/60">{a.enrolled}</td>
                    <td className="py-2.5 text-[#5A6A7A] dark:text-white/60">{a.conversionRate}%</td>
                    <td className="py-2.5 font-semibold text-[#0B3D6B] dark:text-[#E8A020]">
                      {formatLKR(a.commissionOwed)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4 rounded-xl border border-[#DDE3EC] dark:border-white/10 bg-white dark:bg-slate-800 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="inline-flex rounded-lg border border-[#DDE3EC] dark:border-white/10 p-1">
          <button
            type="button"
            onClick={() => setViewMode('table')}
            className={`rounded-md px-4 py-2 font-jakarta text-sm font-semibold transition-colors ${
              viewMode === 'table'
                ? 'bg-[#0B3D6B] text-white'
                : 'text-[#5A6A7A] dark:text-white/60 hover:bg-[#F5F7FB] dark:hover:bg-white/10'
            }`}
          >
            Table View
          </button>
          <button
            type="button"
            onClick={() => setViewMode('kanban')}
            className={`rounded-md px-4 py-2 font-jakarta text-sm font-semibold transition-colors ${
              viewMode === 'kanban'
                ? 'bg-[#0B3D6B] text-white'
                : 'text-[#5A6A7A] dark:text-white/60 hover:bg-[#F5F7FB] dark:hover:bg-white/10'
            }`}
          >
            Kanban View
          </button>
        </div>

        {viewMode === 'table' && (
          <div className="flex flex-wrap gap-3">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, phone, email…"
              className="min-w-[200px] rounded-lg border border-[#DDE3EC] dark:border-white/10 bg-white dark:bg-slate-900 px-3 py-2 font-inter text-sm text-[#0D1B2A] dark:text-white outline-none placeholder-gray-400 focus:border-[#E8A020]"
            />
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value as LeadSource | '')}
              className="rounded-lg border border-[#DDE3EC] dark:border-white/10 bg-white dark:bg-slate-900 px-3 py-2 font-inter text-sm text-[#0D1B2A] dark:text-white outline-none focus:border-[#E8A020]"
            >
              <option value="">All sources</option>
              {LEAD_SOURCES.map((s) => (
                <option key={s} value={s}>
                  {getSourceLabel(s)}
                </option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as LeadStatus | '')}
              className="rounded-lg border border-[#DDE3EC] dark:border-white/10 bg-white dark:bg-slate-900 px-3 py-2 font-inter text-sm text-[#0D1B2A] dark:text-white outline-none focus:border-[#E8A020]"
            >
              <option value="">All statuses</option>
              <option value="new">New Inquiry</option>
              <option value="contacted">Contacted</option>
              <option value="interested">Interested</option>
              <option value="applied">Applied</option>
              <option value="enrolled">Enrolled</option>
              <option value="lost">Lost</option>
            </select>
            <select
              value={courseFilter}
              onChange={(e) => setCourseFilter(e.target.value as CourseId | '')}
              className="rounded-lg border border-[#DDE3EC] dark:border-white/10 bg-white dark:bg-slate-900 px-3 py-2 font-inter text-sm text-[#0D1B2A] dark:text-white outline-none focus:border-[#E8A020]"
            >
              <option value="">All courses</option>
              {COURSES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
            <select
              value={agentFilter}
              onChange={(e) => setAgentFilter(e.target.value)}
              className="rounded-lg border border-[#DDE3EC] dark:border-white/10 bg-white dark:bg-slate-900 px-3 py-2 font-inter text-sm text-[#0D1B2A] dark:text-white outline-none focus:border-[#E8A020]"
            >
              <option value="">All agents</option>
              {agents.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {viewMode === 'table' ? (
        <LeadTable
          leads={filtered}
          loading={loading}
          page={page}
          onPageChange={setPage}
          onEdit={openEdit}
        />
      ) : (
        <LeadKanban
          leads={filtered}
          loading={loading}
          onEdit={openEdit}
          onRefresh={loadLeads}
        />
      )}

      <LeadForm
        open={formOpen}
        onClose={() => {
          setFormOpen(false)
          setEditLead(null)
        }}
        lead={editLead}
        onSaved={loadLeads}
      />
    </div>
  )
}
