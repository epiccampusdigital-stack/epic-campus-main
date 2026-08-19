'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { doc, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { useManagement } from '@/components/layout/ManagementContext'
import {
  getCampusStatus,
  getDistinctActiveBatches,
  type CampusBatchSummary,
} from '@/lib/campus/campusStatus'

function StatCard({
  label,
  value,
  sub,
  loading,
}: {
  label: string
  value: string
  sub?: string
  loading?: boolean
}) {
  return (
    <div className="rounded-xl border border-[#DDE3EC] bg-white p-4 dark:border-gray-600 dark:bg-gray-800">
      <p className="text-xs font-medium uppercase tracking-wide text-[#5A6A7A]">{label}</p>
      {loading ? (
        <div className="mt-2 h-8 w-16 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
      ) : (
        <>
          <p className="mt-1 font-jakarta text-2xl font-bold text-[#0B3D6B] dark:text-white">{value}</p>
          {sub && <p className="mt-1 text-xs text-[#5A6A7A]">{sub}</p>}
        </>
      )}
    </div>
  )
}

export default function CampusStatusPage() {
  const router = useRouter()
  const { user, loading: authLoading, hasRole } = useManagement()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [batches, setBatches] = useState<CampusBatchSummary[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (authLoading) return
    if (!user) return
    if (!(hasRole('admin') || hasRole('owner'))) {
      router.replace('/dashboard')
    }
  }, [user, authLoading, router, hasRole])

  useEffect(() => {
    if (authLoading || !user || !(hasRole('admin') || hasRole('owner'))) return

    async function load() {
      setLoading(true)
      try {
        const [batchList, status] = await Promise.all([getDistinctActiveBatches(), getCampusStatus()])
        setBatches(batchList)
        setSelected(new Set(status?.activeBatchIds ?? []))
      } catch (err) {
        console.error('[CampusStatusPage] load', err)
        setBatches([])
        setSelected(new Set())
        toast.error('Could not load batches. Please try again.')
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [authLoading, user, hasRole])

  const totalActive = useMemo(() => batches.reduce((sum, b) => sum + b.studentCount, 0), [batches])

  // Live head-count of the current checkbox selection. An empty selection means
  // "no filter" — every active student counts, matching the helper's fallback.
  const selectedCount = useMemo(() => {
    if (selected.size === 0) return totalActive
    return batches.reduce((sum, b) => (selected.has(b.batchId) ? sum + b.studentCount : sum), 0)
  }, [batches, selected, totalActive])

  function toggleBatch(batchId: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(batchId)) next.delete(batchId)
      else next.add(batchId)
      return next
    })
  }

  function selectAll() {
    setSelected(new Set(batches.map((b) => b.batchId)))
  }

  function clearAll() {
    setSelected(new Set())
  }

  async function handleSave() {
    if (!user) return
    setSaving(true)
    try {
      await setDoc(
        doc(db, 'settings', 'campusStatus'),
        {
          activeBatchIds: Array.from(selected),
          updatedAt: serverTimestamp(),
          updatedBy: user.uid,
        },
        { merge: true },
      )
      toast.success('Campus status saved')
    } catch (err) {
      console.error('[CampusStatusPage] save', err)
      toast.error('Could not save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const isAuthorized = user && (hasRole('admin') || hasRole('owner'))
  if (authLoading || !isAuthorized) return null

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-jakarta text-2xl font-bold text-[#0D1B2A] dark:text-white">Active Campus Batches</h1>
        <p className="mt-1 text-sm text-[#5A6A7A]">
          Choose which batches are physically on campus. Kitchen head counts and order scaling use this selection.
        </p>
        <div className="mt-3 h-1 w-16 rounded-full bg-[#E8A020]" />
      </div>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="On Campus Now"
          value={String(selectedCount)}
          sub={selected.size === 0 ? 'No batches selected — counting all' : `${selected.size} batch(es) selected`}
          loading={loading}
        />
        <StatCard label="All Active Students" value={String(totalActive)} sub="Across every batch" loading={loading} />
        <StatCard label="Batches" value={String(batches.length)} sub="With active students" loading={loading} />
      </section>

      <section className="rounded-xl border border-[#DDE3EC] bg-white dark:border-gray-600 dark:bg-gray-800">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#DDE3EC] p-4 dark:border-gray-600">
          <h2 className="font-jakarta text-base font-semibold text-[#0D1B2A] dark:text-white">Batches</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={selectAll}
              disabled={loading || batches.length === 0}
              className="rounded-lg border border-[#DDE3EC] px-3 py-1.5 text-xs font-medium text-[#0B3D6B] transition hover:bg-[#F5F7FB] disabled:opacity-50 dark:border-gray-600 dark:text-white dark:hover:bg-gray-700"
            >
              Select all
            </button>
            <button
              type="button"
              onClick={clearAll}
              disabled={loading || selected.size === 0}
              className="rounded-lg border border-[#DDE3EC] px-3 py-1.5 text-xs font-medium text-[#5A6A7A] transition hover:bg-[#F5F7FB] disabled:opacity-50 dark:border-gray-600 dark:hover:bg-gray-700"
            >
              Clear
            </button>
          </div>
        </div>

        {loading ? (
          <div className="space-y-2 p-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-700" />
            ))}
          </div>
        ) : batches.length === 0 ? (
          <p className="p-6 text-center text-sm text-[#5A6A7A]">No batches with active students found.</p>
        ) : (
          <ul className="divide-y divide-[#DDE3EC] dark:divide-gray-600">
            {batches.map((batch) => {
              const checked = selected.has(batch.batchId)
              return (
                <li key={batch.batchId}>
                  <label className="flex cursor-pointer items-center gap-3 p-4 transition hover:bg-[#F5F7FB] dark:hover:bg-gray-700">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleBatch(batch.batchId)}
                      className="h-4 w-4 rounded border-[#DDE3EC] text-[#0B3D6B] focus:ring-[#1A6BAD]"
                    />
                    <span className="flex-1 font-medium text-[#0D1B2A] dark:text-white">{batch.batchId}</span>
                    <span className="text-sm text-[#5A6A7A]">{batch.studentCount} active students</span>
                  </label>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={loading || saving}
          className="rounded-lg bg-[#0B3D6B] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1A6BAD] disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save Campus Status'}
        </button>
        <p className="text-xs text-[#5A6A7A]">
          Saving with nothing selected keeps the default behaviour — every active student is counted.
        </p>
      </div>
    </div>
  )
}
