'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import CompanyForm from '@/components/partners/CompanyForm'
import CandidateAssignPanel from '@/components/partners/CandidateAssignPanel'
import CompanyTable, { PlacementSummaryCards } from '@/components/partners/CompanyTable'
import {
  computePlacementSummary,
  countCandidatesByCompany,
  fetchCandidateShortlists,
  fetchPartnerCompanies,
  formatPartnerFee,
  updateCandidateShortlist,
} from '@/lib/partners/helpers'
import type { CandidateShortlist, PartnerCompany } from '@/types'

type Tab = 'companies' | 'placements'

const FEE_STATUS_STYLES = {
  paid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  unpaid: 'bg-amber-50 text-amber-800 border-amber-200',
  na: 'bg-slate-100 text-slate-600 border-slate-200',
}

export default function PartnerCompaniesPage() {
  const [tab, setTab] = useState<Tab>('companies')
  const [companies, setCompanies] = useState<PartnerCompany[]>([])
  const [shortlists, setShortlists] = useState<CandidateShortlist[]>([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [editCompany, setEditCompany] = useState<PartnerCompany | null>(null)
  const [manageCompany, setManageCompany] = useState<PartnerCompany | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [co, sl] = await Promise.all([
        fetchPartnerCompanies(),
        fetchCandidateShortlists(),
      ])
      setCompanies(co)
      setShortlists(sl)
    } catch (err) {
      console.error('[PartnerCompaniesPage]', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const placements = useMemo(
    () => shortlists.filter((c) => c.status === 'placed'),
    [shortlists],
  )

  const placementSummary = useMemo(
    () => computePlacementSummary(shortlists),
    [shortlists],
  )

  function openAdd() {
    setEditCompany(null)
    setFormOpen(true)
  }

  async function handleMarkFeePaid(candidate: CandidateShortlist) {
    await updateCandidateShortlist(candidate.id, { feePaid: true })
    await load()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-jakarta text-2xl font-bold text-[#0D1B2A] dark:text-white">
            Partner Companies
          </h2>
          <p className="font-inter text-sm text-[#5A6A7A]">
            Manage Japanese employer partnerships
          </p>
        </div>
        {tab === 'companies' && (
          <button
            type="button"
            onClick={openAdd}
            className="inline-flex items-center gap-2 rounded-lg bg-[#E8A020] px-5 py-2.5 font-jakarta text-sm font-bold text-[#0B3D6B] hover:bg-[#F5B942]"
          >
            <span className="ti ti-plus" aria-hidden="true" />
            Add Company
          </button>
        )}
      </div>

      <div className="flex gap-2 border-b border-[#DDE3EC] dark:border-gray-600">
        {(
          [
            { id: 'companies' as Tab, label: 'Companies' },
            { id: 'placements' as Tab, label: 'Placements' },
          ] as const
        ).map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`border-b-2 px-4 py-2 font-jakarta text-sm font-semibold transition-colors ${
              tab === id
                ? 'border-[#E8A020] text-[#0B3D6B] dark:text-white'
                : 'border-transparent text-[#5A6A7A]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'companies' && (
        <>
          {loading ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-48 animate-pulse rounded-xl bg-[#DDE3EC]/60" />
              ))}
            </div>
          ) : companies.length === 0 ? (
            <p className="rounded-xl border border-dashed border-[#DDE3EC] px-6 py-16 text-center text-sm text-[#5A6A7A]">
              No partner companies yet. Add your first Japanese employer partner.
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {companies.map((co) => {
                const counts = countCandidatesByCompany(shortlists, co.id)
                return (
                  <div
                    key={co.id}
                    className="flex flex-col rounded-xl border border-[#DDE3EC] bg-white p-5 dark:border-gray-700 dark:bg-gray-800"
                  >
                    <div className="flex items-start gap-3">
                      {co.logoUrl ? (
                        <img
                          src={co.logoUrl}
                          alt=""
                          className="h-12 w-12 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#0B3D6B]/10">
                          <span className="ti ti-building text-2xl text-[#0B3D6B]" aria-hidden="true" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-jakarta font-bold text-[#0D1B2A] dark:text-white">
                          {co.name}
                        </p>
                        <p className="text-xs text-[#5A6A7A]">{co.industry || '—'}</p>
                        <span
                          className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${
                            FEE_STATUS_STYLES[co.feeStatus]
                          }`}
                        >
                          Fee {co.feeStatus}
                        </span>
                      </div>
                    </div>

                    <p className="mt-3 text-xs text-[#5A6A7A]">
                      {co.contactName}
                      {co.contactEmail ? ` · ${co.contactEmail}` : ''}
                    </p>

                    <div className="mt-4 flex gap-4 text-sm">
                      <div>
                        <p className="text-xs text-[#5A6A7A]">Active</p>
                        <p className="font-bold text-[#0B3D6B] dark:text-white">{counts.active}</p>
                      </div>
                      <div>
                        <p className="text-xs text-[#5A6A7A]">Placed</p>
                        <p className="font-bold text-[#0B3D6B] dark:text-white">{counts.placed}</p>
                      </div>
                      <div>
                        <p className="text-xs text-[#5A6A7A]">Fee</p>
                        <p className="font-bold text-[#0B3D6B] dark:text-white">
                          {formatPartnerFee(co.placementFee, co.placementFeeCurrency)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setManageCompany(co)}
                        className="flex-1 rounded-lg bg-[#0B3D6B] px-3 py-2 text-xs font-semibold text-white"
                      >
                        Manage Candidates
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditCompany(co)
                          setFormOpen(true)
                        }}
                        className="rounded-lg border border-[#DDE3EC] px-3 py-2 text-xs font-semibold text-[#0B3D6B] dark:border-gray-600"
                      >
                        Edit
                      </button>
                    </div>

                    {co.status === 'inactive' && (
                      <span className="mt-2 text-xs font-medium text-red-600">Inactive</span>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {tab === 'placements' && (
        <div className="space-y-6">
          <PlacementSummaryCards
            totalPlaced={placementSummary.totalPlaced}
            feesCollected={placementSummary.feesCollected}
            feesOutstanding={placementSummary.feesOutstanding}
          />
          <CompanyTable
            placements={placements}
            companies={companies}
            loading={loading}
            onMarkFeePaid={handleMarkFeePaid}
          />
        </div>
      )}

      <CompanyForm
        open={formOpen}
        onClose={() => {
          setFormOpen(false)
          setEditCompany(null)
        }}
        company={editCompany}
        onSaved={load}
      />

      <CandidateAssignPanel
        open={!!manageCompany}
        company={manageCompany}
        shortlists={shortlists}
        onClose={() => setManageCompany(null)}
        onRefresh={load}
      />
    </div>
  )
}
