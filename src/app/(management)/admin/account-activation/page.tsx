'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { collection, doc, getDocs, query, updateDoc, where } from 'firebase/firestore'
import toast from 'react-hot-toast'
import { db } from '@/lib/firebase/client'
import { useManagement } from '@/components/layout/ManagementContext'
import { getDistinctActiveBatches, type CampusBatchSummary } from '@/lib/campus/campusStatus'
import { parseStudent } from '@/lib/students/helpers'
import AccountActivationControl, {
  activationChoiceFromOverride,
  batchActivationLabel,
  overrideFromActivationChoice,
  type ActivationChoice,
} from '@/components/students/AccountActivationControl'
import {
  ACTIVATION_ROLES,
  getAllBatchAccountSettings,
  resolveAccountActivation,
  setBatchAccountActivation,
  type BatchAccountSettings,
} from '@/lib/access/accountActivation'
import type { Student } from '@/types'

export default function AccountActivationPage() {
  const router = useRouter()
  const { user, loading: authLoading, hasRole } = useManagement()
  const [loading, setLoading] = useState(true)
  const [savingBatchId, setSavingBatchId] = useState<string | null>(null)
  const [batches, setBatches] = useState<CampusBatchSummary[]>([])
  const [settings, setSettings] = useState<Record<string, BatchAccountSettings>>({})

  // Drill-down state — students are fetched lazily, once per batch, and kept
  // cached so collapsing and re-expanding a batch doesn't re-read Firestore.
  const [expandedBatchId, setExpandedBatchId] = useState<string | null>(null)
  const [studentsByBatch, setStudentsByBatch] = useState<Record<string, Student[]>>({})
  const [loadingBatchId, setLoadingBatchId] = useState<string | null>(null)
  const [choices, setChoices] = useState<Record<string, ActivationChoice>>({})
  const [savingStudentId, setSavingStudentId] = useState<string | null>(null)
  const [savedStudentId, setSavedStudentId] = useState<string | null>(null)

  const isAuthorized = !!user && ACTIVATION_ROLES.some((r) => hasRole(r))

  useEffect(() => {
    if (authLoading) return
    if (!user) return
    if (!isAuthorized) {
      router.replace('/dashboard')
    }
  }, [user, authLoading, router, isAuthorized])

  useEffect(() => {
    if (authLoading || !user || !isAuthorized) return

    async function load() {
      setLoading(true)
      try {
        const [batchList, settingsMap] = await Promise.all([
          getDistinctActiveBatches(),
          getAllBatchAccountSettings(),
        ])
        setBatches(batchList)
        setSettings(settingsMap)
      } catch (err) {
        console.error('[AccountActivationPage] load', err)
        toast.error('Could not load batches. Please try again.')
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [authLoading, user, isAuthorized])

  async function toggleBatch(batchId: string, next: boolean) {
    if (!user) return
    setSavingBatchId(batchId)
    try {
      await setBatchAccountActivation(batchId, next, user.uid)
      setSettings((prev) => ({
        ...prev,
        [batchId]: { batchId, accountActivated: next, updatedAt: new Date().toISOString(), updatedBy: user.uid },
      }))
      toast.success(`${batchId}: Account Activation ${next ? 'ON' : 'OFF'}`)
    } catch (err) {
      console.error('[AccountActivationPage] toggle', err)
      toast.error('Could not save. Please try again.')
    } finally {
      setSavingBatchId(null)
    }
  }

  async function loadBatchStudents(batchId: string) {
    setLoadingBatchId(batchId)
    try {
      // Same filter getDistinctActiveBatches() counts with, so the row's
      // "N active students" always matches the list that opens beneath it.
      const snap = await getDocs(
        query(collection(db, 'students'), where('status', '==', 'active'), where('batchId', '==', batchId)),
      )
      const list = snap.docs
        .map((d) => parseStudent(d.id, d.data()))
        .sort((a, b) => a.name.localeCompare(b.name))
      setStudentsByBatch((prev) => ({ ...prev, [batchId]: list }))
      setChoices((prev) => {
        const next = { ...prev }
        for (const s of list) {
          next[s.id] = activationChoiceFromOverride(s.accountActivationOverride)
        }
        return next
      })
    } catch (err) {
      console.error('[AccountActivationPage] loadBatchStudents', err)
      toast.error('Could not load students for this batch.')
      setExpandedBatchId((cur) => (cur === batchId ? null : cur))
    } finally {
      setLoadingBatchId(null)
    }
  }

  function toggleExpanded(batchId: string) {
    if (expandedBatchId === batchId) {
      setExpandedBatchId(null)
      return
    }
    setExpandedBatchId(batchId)
    if (!studentsByBatch[batchId]) {
      void loadBatchStudents(batchId)
    }
  }

  async function saveStudentActivation(student: Student) {
    const choice = choices[student.id] ?? 'inherit'
    const override = overrideFromActivationChoice(choice)
    setSavingStudentId(student.id)
    try {
      await updateDoc(doc(db, 'students', student.id), { accountActivationOverride: override })
      // Keep the cached student in sync so the source label and resolved badge
      // update without a refetch.
      setStudentsByBatch((prev) => {
        const list = prev[student.batchId]
        if (!list) return prev
        return {
          ...prev,
          [student.batchId]: list.map((s) =>
            s.id === student.id ? { ...s, accountActivationOverride: override } : s,
          ),
        }
      })
      setSavedStudentId(student.id)
      setTimeout(() => setSavedStudentId((cur) => (cur === student.id ? null : cur)), 3000)
      toast.success(`${student.name}: Account Activation saved`)
    } catch (err) {
      console.error('[AccountActivationPage] saveStudentActivation', err)
      toast.error('Could not save. Please try again.')
    } finally {
      setSavingStudentId(null)
    }
  }

  if (authLoading || !isAuthorized) return null

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-jakarta text-2xl font-bold text-[#0D1B2A] dark:text-white">Account Activation</h1>
        <p className="mt-1 text-sm text-[#5A6A7A]">
          Batch-level default for the student portal gate. A student without a per-student override inherits this
          setting; a batch with no setting here defaults to <strong>Inactive</strong>. Epic Wall, payments, and
          consultation booking always stay open regardless of this setting.
        </p>
        <p className="mt-1 text-sm text-[#5A6A7A]">
          Select a batch number to open its student list and override individual students.
        </p>
        <div className="mt-3 h-1 w-16 rounded-full bg-[#E8A020]" />
      </div>

      <section className="rounded-xl border border-[#DDE3EC] bg-white dark:border-gray-600 dark:bg-gray-800">
        <div className="border-b border-[#DDE3EC] p-4 dark:border-gray-600">
          <h2 className="font-jakarta text-base font-semibold text-[#0D1B2A] dark:text-white">Batches</h2>
        </div>

        {loading ? (
          <div className="space-y-2 p-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-700" />
            ))}
          </div>
        ) : batches.length === 0 ? (
          <p className="p-6 text-center text-sm text-[#5A6A7A]">No batches with active students found.</p>
        ) : (
          <ul className="divide-y divide-[#DDE3EC] dark:divide-gray-600">
            {batches.map((batch) => {
              const batchSettings = settings[batch.batchId] ?? null
              const activated = batchSettings?.accountActivated ?? false
              const saving = savingBatchId === batch.batchId
              const expanded = expandedBatchId === batch.batchId
              const students = studentsByBatch[batch.batchId]
              const batchLabel = batchActivationLabel(batchSettings)
              return (
                <li key={batch.batchId}>
                  <div className="flex items-center justify-between gap-3 p-4">
                    <button
                      type="button"
                      onClick={() => toggleExpanded(batch.batchId)}
                      aria-expanded={expanded}
                      aria-controls={`batch-students-${batch.batchId}`}
                      className="flex min-w-0 flex-1 items-center gap-2 rounded-lg text-left hover:opacity-80"
                    >
                      <span
                        className={`ti ti-chevron-right shrink-0 text-base text-[#5A6A7A] transition-transform ${
                          expanded ? 'rotate-90' : ''
                        }`}
                        aria-hidden="true"
                      />
                      <span className="min-w-0">
                        <span className="block font-medium text-[#0D1B2A] dark:text-white">{batch.batchId}</span>
                        <span className="block text-xs text-[#5A6A7A]">{batch.studentCount} active students</span>
                      </span>
                    </button>
                    <div className="flex shrink-0 items-center gap-3">
                      <span
                        className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                          activated
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                            : 'border-red-200 bg-red-50 text-red-700'
                        }`}
                      >
                        {activated ? 'Active' : 'Inactive'}
                      </span>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => void toggleBatch(batch.batchId, !activated)}
                        role="switch"
                        aria-checked={activated}
                        aria-label={`Account Activation for ${batch.batchId}`}
                        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
                          activated ? 'bg-[#0B3D6B]' : 'bg-gray-300 dark:bg-gray-600'
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                            activated ? 'translate-x-[22px]' : 'translate-x-0.5'
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  {expanded && (
                    <div
                      id={`batch-students-${batch.batchId}`}
                      className="border-t border-[#DDE3EC] bg-[#F5F7FB] px-4 py-3 dark:border-gray-600 dark:bg-gray-900/40"
                    >
                      {loadingBatchId === batch.batchId && !students ? (
                        <div className="space-y-2">
                          {[0, 1, 2].map((i) => (
                            <div key={i} className="h-12 animate-pulse rounded-lg bg-gray-200 dark:bg-gray-700" />
                          ))}
                        </div>
                      ) : !students || students.length === 0 ? (
                        <p className="py-4 text-center text-sm text-[#5A6A7A]">
                          No active students in this batch.
                        </p>
                      ) : (
                        <ul className="divide-y divide-[#DDE3EC] dark:divide-gray-700">
                          {students.map((student) => {
                            const resolved = resolveAccountActivation(student, batchSettings)
                            const hasOverride =
                              student.accountActivationOverride === true ||
                              student.accountActivationOverride === false
                            return (
                              <li
                                key={student.id}
                                className="flex flex-wrap items-center justify-between gap-3 py-3"
                              >
                                <div className="min-w-0">
                                  <Link
                                    href={`/students/${student.id}`}
                                    className="font-medium text-[#0D1B2A] hover:text-[#0B3D6B] hover:underline dark:text-white"
                                  >
                                    {student.name || student.studentCode}
                                  </Link>
                                  <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-[#5A6A7A]">
                                    <span
                                      className={`inline-flex rounded-full border px-2 py-0.5 font-medium ${
                                        resolved
                                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                          : 'border-red-200 bg-red-50 text-red-700'
                                      }`}
                                    >
                                      {resolved ? 'Active' : 'Inactive'}
                                    </span>
                                    <span>
                                      {hasOverride
                                        ? `Override: ${student.accountActivationOverride ? 'Active' : 'Inactive'}`
                                        : `Inherit (batch: ${batchLabel})`}
                                    </span>
                                  </p>
                                </div>
                                <AccountActivationControl
                                  compact
                                  ariaLabel={`Account Activation for ${student.name || student.studentCode}`}
                                  value={choices[student.id] ?? 'inherit'}
                                  onChange={(value) =>
                                    setChoices((prev) => ({ ...prev, [student.id]: value }))
                                  }
                                  onSave={() => void saveStudentActivation(student)}
                                  saving={savingStudentId === student.id}
                                  resolved={resolved}
                                  batchLabel={batchLabel}
                                  message={savedStudentId === student.id ? 'Saved' : undefined}
                                />
                              </li>
                            )
                          })}
                        </ul>
                      )}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
