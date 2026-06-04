'use client'

import { useEffect, useMemo, useState } from 'react'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { COURSE_MAP } from '@/lib/constants/courses'
import { useStudentPortal } from '@/components/student/StudentContext'
import StudentVisaUploads from '@/components/visa/StudentVisaUploads'
import type { VisaApplication, VisaApplicationStatus, VisaDocumentItem } from '@/types'

const STAGES: { id: VisaApplicationStatus; label: string; emoji: string }[] = [
  { id: 'documents', label: 'Documents', emoji: '📋' },
  { id: 'submitted', label: 'Submitted', emoji: '📤' },
  { id: 'processing', label: 'Processing', emoji: '⏳' },
  { id: 'approved', label: 'Approved', emoji: '✅' },
  { id: 'rejected', label: 'Rejected', emoji: '❌' },
]

const DEFAULT_DOCS = [
  'Passport',
  'Birth Certificate',
  'Medical Report',
  'Bank Statement',
  'Police Clearance',
]

function parseVisaApplication(id: string, data: Record<string, unknown>): VisaApplication {
  const rawDocs = Array.isArray(data.documents) ? data.documents : []
  const documents: VisaDocumentItem[] = rawDocs.length
    ? rawDocs.map((d) => {
        const item = d as Record<string, unknown>
        return {
          name: String(item.name ?? ''),
          uploaded: Boolean(item.uploaded),
          verified: Boolean(item.verified),
        }
      })
    : DEFAULT_DOCS.map((name) => ({ name, uploaded: false, verified: false }))

  return {
    id,
    studentId: String(data.studentId ?? ''),
    studentName: String(data.studentName ?? ''),
    program: String(data.program ?? ''),
    visaType: String(data.visaType ?? ''),
    status: (data.status as VisaApplicationStatus) ?? 'documents',
    documents,
    submittedAt: data.submittedAt ? String(data.submittedAt) : undefined,
    updatedAt: String(data.updatedAt ?? new Date().toISOString()),
    notes: String(data.notes ?? ''),
    whatsappPhone: data.whatsappPhone ? String(data.whatsappPhone) : undefined,
  }
}

function stageIndex(status: VisaApplicationStatus): number {
  return STAGES.findIndex((s) => s.id === status)
}

function formatDate(iso?: string): string {
  if (!iso) return '—'
  return new Date(iso.slice(0, 10) + 'T12:00:00').toLocaleDateString('en-LK', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function buildTimeline(app: VisaApplication) {
  const events: { label: string; date: string; emoji: string }[] = []
  events.push({
    label: 'Application created',
    date: app.updatedAt,
    emoji: '📋',
  })
  if (app.submittedAt) {
    events.push({ label: 'Documents submitted', date: app.submittedAt, emoji: '📤' })
  }
  const stage = STAGES.find((s) => s.id === app.status)
  if (stage && app.status !== 'documents') {
    events.push({
      label: `Status: ${stage.label}`,
      date: app.updatedAt,
      emoji: stage.emoji,
    })
  }
  return events
}

export default function StudentVisaPage() {
  const { student } = useStudentPortal()
  const [application, setApplication] = useState<VisaApplication | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!student) return

    async function load() {
      setLoading(true)
      try {
        const snap = await getDocs(
          query(collection(db, 'visaApplications'), where('studentId', '==', student!.id)),
        )
        if (!snap.empty) {
          const d = snap.docs[0]
          setApplication(parseVisaApplication(d.id, d.data() as Record<string, unknown>))
        } else {
          setApplication(null)
        }
      } catch (err) {
        console.error('[StudentVisa]', err)
        setApplication(null)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [student])

  const whatsappUrl = useMemo(() => {
    const phone = application?.whatsappPhone ?? '94771234567'
    const code = student?.studentCode ?? ''
    return `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(
      `Hi Epic Campus, I need help with my visa application. Student ID: ${code}`,
    )}`
  }, [application, student])

  if (!student) return null

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded bg-[#DDE3EC]" />
        <div className="h-64 animate-pulse rounded-xl bg-[#DDE3EC]/60" />
      </div>
    )
  }

  if (!application) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="font-jakarta text-2xl font-bold text-[#0D1B2A]">Visa Tracker</h2>
          <p className="text-sm text-[#5A6A7A]">Track your visa application progress</p>
          <div className="mt-3 h-1 w-16 rounded-full bg-[#E8A020]" />
        </div>
        <div className="rounded-xl border border-[#DDE3EC] bg-white p-10 text-center">
          <span className="mb-4 block text-5xl" aria-hidden="true">
            ✈️
          </span>
          <h3 className="font-jakarta text-lg font-bold text-[#0B3D6B]">No visa application yet</h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-[#5A6A7A]">
            Your visa application hasn&apos;t been started. Contact Epic Campus to begin the process
            — our team will set up your tracker once documents are ready.
          </p>
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[#25D366] px-5 py-3 font-jakarta text-sm font-bold text-white hover:bg-[#20bd5a]"
          >
            <span className="ti ti-brand-whatsapp text-xl" aria-hidden="true" />
            Contact Epic Campus
          </a>
          <p className="mt-4 text-xs text-[#5A6A7A]">WhatsApp: +94 77 123 4567 · info@epiccampus.lk</p>
        </div>
        <StudentVisaUploads />
      </div>
    )
  }

  const currentIdx = stageIndex(application.status)
  const progressPct = ((currentIdx + 1) / STAGES.length) * 100
  const timeline = buildTimeline(application)
  const programLabel =
    application.program || COURSE_MAP[student.courseId]?.label || student.courseId

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-jakarta text-2xl font-bold text-[#0D1B2A]">Visa Tracker</h2>
        <p className="text-sm text-[#5A6A7A]">
          {programLabel} · {application.visaType || 'Visa Application'}
        </p>
        <div className="mt-3 h-1 w-16 rounded-full bg-[#E8A020]" />
      </div>

      {/* Progress bar */}
      <div className="rounded-xl border border-[#DDE3EC] bg-white p-5">
        <h3 className="mb-4 font-jakarta font-bold text-[#0B3D6B]">Application Progress</h3>
        <div className="relative mb-4 h-2 overflow-hidden rounded-full bg-[#DDE3EC]">
          <div
            className="h-full rounded-full bg-[#E8A020] transition-all"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {STAGES.map((stage, i) => {
            const active = i === currentIdx
            const done = i < currentIdx
            return (
              <div
                key={stage.id}
                className={`rounded-lg border px-2 py-3 text-center text-xs ${
                  active
                    ? 'border-[#E8A020] bg-[#E8A020]/10 font-semibold text-[#0B3D6B]'
                    : done
                      ? 'border-[#DDE3EC] bg-[#F5F7FB] text-[#5A6A7A]'
                      : 'border-[#DDE3EC] text-[#5A6A7A]'
                }`}
              >
                <span className="block text-lg" aria-hidden="true">
                  {stage.emoji}
                </span>
                {stage.label}
              </div>
            )
          })}
        </div>
      </div>

      {/* Kanban-style stage board (read-only) */}
      <div className="overflow-x-auto rounded-xl border border-[#DDE3EC] bg-white p-4">
        <h3 className="mb-4 font-jakarta font-bold text-[#0B3D6B]">Status Board</h3>
        <div className="flex min-w-[640px] gap-3">
          {STAGES.map((stage) => {
            const isCurrent = stage.id === application.status
            return (
              <div
                key={stage.id}
                className={`min-h-[120px] flex-1 rounded-lg border p-3 ${
                  isCurrent ? 'border-[#E8A020] bg-[#E8A020]/5' : 'border-[#DDE3EC] bg-[#F5F7FB]'
                }`}
              >
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#5A6A7A]">
                  {stage.emoji} {stage.label}
                </p>
                {isCurrent && (
                  <div className="rounded-lg border border-[#DDE3EC] bg-white p-3 shadow-sm">
                    <p className="font-jakarta text-sm font-semibold text-[#0D1B2A]">
                      {application.studentName}
                    </p>
                    <p className="mt-1 text-xs text-[#5A6A7A]">{programLabel}</p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <StudentVisaUploads />

      {/* Document checklist */}
      <div className="rounded-xl border border-[#DDE3EC] bg-white p-5">
        <h3 className="mb-4 font-jakarta font-bold text-[#0B3D6B]">Document Checklist</h3>
        <ul className="space-y-3">
          {application.documents.map((doc) => (
            <li
              key={doc.name}
              className="flex items-center justify-between rounded-lg border border-[#DDE3EC] px-4 py-3"
            >
              <span className="font-medium text-[#0D1B2A]">{doc.name}</span>
              <span className="flex items-center gap-3 text-sm text-[#5A6A7A]">
                <span className={doc.uploaded ? 'text-emerald-600' : 'text-red-500'}>
                  {doc.uploaded ? '✓ Uploaded' : '✗ Missing'}
                </span>
                {doc.uploaded && (
                  <span className={doc.verified ? 'text-emerald-600' : 'text-amber-600'}>
                    {doc.verified ? '✓ Verified' : '⏳ Pending review'}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* Notes (read-only) */}
      {application.notes && (
        <div className="rounded-xl border border-[#DDE3EC] bg-white p-5">
          <h3 className="mb-3 font-jakarta font-bold text-[#0B3D6B]">Notes from Epic Campus</h3>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#5A6A7A]">
            {application.notes}
          </p>
        </div>
      )}

      {/* Timeline */}
      <div className="rounded-xl border border-[#DDE3EC] bg-white p-5">
        <h3 className="mb-4 font-jakarta font-bold text-[#0B3D6B]">Status Timeline</h3>
        <ol className="relative space-y-4 border-l-2 border-[#DDE3EC] pl-6">
          {timeline.map((m, i) => (
            <li key={i} className="relative">
              <span className="absolute -left-[1.65rem] top-0 text-sm" aria-hidden="true">
                {m.emoji}
              </span>
              <p className="font-medium text-[#0D1B2A]">{m.label}</p>
              <p className="text-xs text-[#5A6A7A]">{formatDate(m.date)}</p>
            </li>
          ))}
        </ol>
      </div>

      <a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 rounded-lg bg-[#25D366] px-5 py-3 font-jakarta text-sm font-bold text-white hover:bg-[#20bd5a]"
      >
        <span className="ti ti-brand-whatsapp text-xl" aria-hidden="true" />
        Contact Epic Campus
      </a>
    </div>
  )
}
