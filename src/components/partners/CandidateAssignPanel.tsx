'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { parseStudent } from '@/lib/students/helpers'
import {
  CANDIDATE_STATUS_LABELS,
  CANDIDATE_STATUS_STYLES,
  PIPELINE_STATUSES,
  assignStudentToCompany,
  fetchExamMeta,
  fetchExamResultsByStudent,
  getPlacedStudentIds,
  isJapanStudent,
  studentMeetsJapaneseExamRequirement,
  updateCandidateShortlist,
} from '@/lib/partners/helpers'
import type { CandidateShortlist, CandidateShortlistStatus, PartnerCompany, Student } from '@/types'

interface CandidateAssignPanelProps {
  open: boolean
  company: PartnerCompany | null
  shortlists: CandidateShortlist[]
  onClose: () => void
  onRefresh: () => void
}

export default function CandidateAssignPanel({
  open,
  company,
  shortlists,
  onClose,
  onRefresh,
}: CandidateAssignPanelProps) {
  const [students, setStudents] = useState<Student[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [acting, setActing] = useState<string | null>(null)
  const [examMeta, setExamMeta] = useState<
    Map<string, { title: string; officialExamType?: string; level?: string }>
  >(new Map())
  const [resultsByStudent, setResultsByStudent] = useState(
    new Map<string, import('@/types').ExamResult[]>(),
  )
  const [rawByStudent, setRawByStudent] = useState(
    new Map<string, Array<Record<string, unknown>>>(),
  )

  const loadStudents = useCallback(async () => {
    setLoading(true)
    try {
      const [studentsSnap, meta, examData] = await Promise.all([
        getDocs(collection(db, 'students')),
        fetchExamMeta(),
        fetchExamResultsByStudent(),
      ])
      setExamMeta(meta)
      setResultsByStudent(examData.byStudent)
      setRawByStudent(examData.rawByStudent)
      setStudents(
        studentsSnap.docs.map((d) =>
          parseStudent(d.id, d.data() as Record<string, unknown>),
        ),
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open) void loadStudents()
  }, [open, loadStudents])

  const placedIds = useMemo(() => getPlacedStudentIds(shortlists), [shortlists])

  const companyCandidates = useMemo(
    () => (company ? shortlists.filter((c) => c.companyId === company.id) : []),
    [shortlists, company],
  )

  const eligibleToAdd = useMemo(() => {
    if (!company) return []
    const assigned = new Set(companyCandidates.map((c) => c.studentId))
    const q = search.trim().toLowerCase()

    return students.filter((s) => {
      if (s.status !== 'active') return false
      if (!isJapanStudent(s)) return false
      if (placedIds.has(s.id)) return false
      if (assigned.has(s.id)) return false
      const results = resultsByStudent.get(s.id) ?? []
      const raw = rawByStudent.get(s.id)
      if (!studentMeetsJapaneseExamRequirement(results, examMeta, raw)) return false
      if (!q) return true
      return (
        s.name.toLowerCase().includes(q) ||
        s.studentCode.toLowerCase().includes(q) ||
        s.mobile.includes(q)
      )
    })
  }, [
    students,
    company,
    companyCandidates,
    placedIds,
    search,
    resultsByStudent,
    rawByStudent,
    examMeta,
  ])

  if (!open || !company) return null

  async function handleAssign(student: Student) {
    setActing(student.id)
    try {
      await assignStudentToCompany({
        company: company!,
        student,
        examResults: resultsByStudent.get(student.id) ?? [],
        rawExam: rawByStudent.get(student.id),
        examMeta,
      })
      onRefresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not assign student')
    } finally {
      setActing(null)
    }
  }

  async function handleStatusChange(
    candidate: CandidateShortlist,
    status: CandidateShortlistStatus,
  ) {
    setActing(candidate.id)
    try {
      const patch: Parameters<typeof updateCandidateShortlist>[1] = { status }
      if (status === 'placed') {
        patch.placedAt = new Date().toISOString()
      }
      if (status === 'interview_confirmed' && !candidate.interviewDate) {
        const date = prompt('Interview date (YYYY-MM-DD)', new Date().toISOString().slice(0, 10))
        if (!date) {
          setActing(null)
          return
        }
        patch.interviewDate = date
      }
      await updateCandidateShortlist(candidate.id, patch)
      onRefresh()
    } finally {
      setActing(null)
    }
  }

  async function handleNotes(candidate: CandidateShortlist) {
    const notes = prompt('Notes for this candidate', candidate.notes)
    if (notes === null) return
    setActing(candidate.id)
    try {
      await updateCandidateShortlist(candidate.id, { notes })
      onRefresh()
    } finally {
      setActing(null)
    }
  }

  async function handleFeePaid(candidate: CandidateShortlist, feePaid: boolean) {
    setActing(candidate.id)
    try {
      await updateCandidateShortlist(candidate.id, { feePaid })
      onRefresh()
    } finally {
      setActing(null)
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-[#0D1B2A]/40" onClick={onClose} aria-hidden="true" />
      <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-2xl flex-col bg-white shadow-2xl dark:bg-gray-800">
        <div className="flex items-center justify-between border-b border-[#DDE3EC] px-6 py-4 dark:border-gray-600">
          <div>
            <h2 className="font-jakarta text-lg font-bold text-[#0D1B2A] dark:text-white">
              Manage Candidates
            </h2>
            <p className="text-sm text-[#5A6A7A]">{company.name}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2">
            <span className="ti ti-x text-xl" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <section className="mb-8">
            <h3 className="mb-3 font-jakarta text-sm font-bold text-[#0B3D6B] dark:text-white">
              Add eligible students
            </h3>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, code, or mobile…"
              className="mb-3 w-full rounded-lg border border-[#DDE3EC] px-3 py-2.5 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            />
            {loading ? (
              <div className="h-24 animate-pulse rounded-lg bg-[#DDE3EC]/60" />
            ) : eligibleToAdd.length === 0 ? (
              <p className="text-sm text-[#5A6A7A]">
                No eligible students found. Students must be active, Japan course, and have passed
                JLPT N5+ or JFT.
              </p>
            ) : (
              <ul className="max-h-48 space-y-2 overflow-y-auto">
                {eligibleToAdd.slice(0, 20).map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-[#DDE3EC] px-3 py-2 dark:border-gray-600"
                  >
                    <div>
                      <p className="text-sm font-medium text-[#0D1B2A] dark:text-white">{s.name}</p>
                      <p className="text-xs text-[#5A6A7A]">{s.studentCode}</p>
                    </div>
                    <button
                      type="button"
                      disabled={acting === s.id}
                      onClick={() => void handleAssign(s)}
                      className="rounded-lg bg-[#0B3D6B] px-3 py-1.5 text-xs font-semibold text-white"
                    >
                      Add
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h3 className="mb-3 font-jakarta text-sm font-bold text-[#0B3D6B] dark:text-white">
              Candidate pipeline ({companyCandidates.length})
            </h3>
            {companyCandidates.length === 0 ? (
              <p className="text-sm text-[#5A6A7A]">No candidates assigned yet.</p>
            ) : (
              <div className="space-y-4">
                {companyCandidates.map((c) => (
                  <div
                    key={c.id}
                    className="rounded-xl border border-[#DDE3EC] p-4 dark:border-gray-600"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-jakarta font-bold text-[#0D1B2A] dark:text-white">
                          {c.studentName}
                        </p>
                        <p className="text-xs text-[#5A6A7A]">
                          {c.japaneseLevel} · Batch {c.batchStatus}
                        </p>
                      </div>
                      <span
                        className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${CANDIDATE_STATUS_STYLES[c.status]}`}
                      >
                        {CANDIDATE_STATUS_LABELS[c.status]}
                      </span>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-1">
                      {PIPELINE_STATUSES.map((st) => (
                        <button
                          key={st}
                          type="button"
                          disabled={acting === c.id || c.status === st}
                          onClick={() => void handleStatusChange(c, st)}
                          className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${
                            c.status === st
                              ? 'bg-[#0B3D6B] text-white'
                              : 'bg-[#F5F7FB] text-[#5A6A7A] hover:bg-[#E8A020]/20'
                          }`}
                        >
                          {st.replace(/_/g, ' ')}
                        </button>
                      ))}
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void handleNotes(c)}
                        className="text-xs font-semibold text-[#0B3D6B] hover:underline"
                      >
                        Edit notes
                      </button>
                      {c.status === 'placed' && (
                        <button
                          type="button"
                          onClick={() => void handleFeePaid(c, !c.feePaid)}
                          className="text-xs font-semibold text-emerald-700 hover:underline"
                        >
                          Fee: {c.feePaid ? 'Paid ✓' : 'Mark paid'}
                        </button>
                      )}
                    </div>
                    {c.notes && (
                      <p className="mt-2 text-xs text-[#5A6A7A]">Notes: {c.notes}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </aside>
    </>
  )
}
