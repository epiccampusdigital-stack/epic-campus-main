'use client'

import { useEffect, useState } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import {
  buildVisaChecklist,
  buildVisaTimeline,
  getVisaStageIndex,
} from '@/lib/student/portal'
import type { VisaChecklistItem } from '@/lib/student/portal'
import { useStudentPortal } from '@/components/student/StudentContext'

const VISA_STAGES = ['Not Started', 'Documents', 'Submitted', 'Under Review', 'Approved']

function ChecklistIcon({ status }: { status: VisaChecklistItem['status'] }) {
  if (status === 'submitted') {
    return <span className="text-emerald-600" aria-hidden="true">✓</span>
  }
  if (status === 'review') {
    return <span className="text-amber-600" aria-hidden="true">⏳</span>
  }
  return <span className="text-red-500" aria-hidden="true">✗</span>
}

export default function MyVisaPage() {
  const { student } = useStudentPortal()
  const [docNames, setDocNames] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!student) return

    async function load() {
      setLoading(true)
      try {
        const snap = await getDocs(
          collection(db, 'students', student!.id, 'documents'),
        ).catch(() => ({ docs: [] }))
        setDocNames(snap.docs.map((d) => String(d.data().name ?? '')))
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [student])

  if (!student) return null

  const stageIndex = getVisaStageIndex(student.visaStatus)
  const checklist = buildVisaChecklist(student, docNames)
  const timeline = buildVisaTimeline(student)
  const whatsappUrl = `https://wa.me/94771234567?text=${encodeURIComponent(
    `Hi Epic Campus, I need help with my visa application. Student ID: ${student.studentCode}`,
  )}`

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-jakarta text-2xl font-bold text-[#0D1B2A]">Visa Tracking</h2>
        <p className="text-sm text-[#5A6A7A]">Monitor your visa application progress</p>
      </div>

      <div className="rounded-xl border border-[#DDE3EC] bg-white p-5">
        <h3 className="mb-4 font-jakarta font-bold text-[#0B3D6B]">Application Progress</h3>
        <div className="relative mb-2 h-2 overflow-hidden rounded-full bg-[#DDE3EC]">
          <div
            className="h-full rounded-full bg-[#E8A020] transition-all"
            style={{ width: `${((stageIndex + 1) / VISA_STAGES.length) * 100}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-[#5A6A7A]">
          {VISA_STAGES.map((s, i) => (
            <span
              key={s}
              className={i === stageIndex ? 'font-semibold text-[#0B3D6B]' : ''}
            >
              {s}
            </span>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-[#DDE3EC] bg-white p-5">
        <h3 className="mb-4 font-jakarta font-bold text-[#0B3D6B]">Document Checklist</h3>
        {loading ? (
          <div className="h-32 animate-pulse rounded bg-[#DDE3EC]/50" />
        ) : (
          <ul className="space-y-3">
            {checklist.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between rounded-lg border border-[#DDE3EC] px-4 py-3"
              >
                <span className="font-medium text-[#0D1B2A]">{item.label}</span>
                <span className="flex items-center gap-2 text-sm capitalize text-[#5A6A7A]">
                  <ChecklistIcon status={item.status} />
                  {item.status === 'submitted'
                    ? 'Submitted'
                    : item.status === 'review'
                      ? 'Under Review'
                      : 'Missing'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-xl border border-[#DDE3EC] bg-white p-5">
        <h3 className="mb-4 font-jakarta font-bold text-[#0B3D6B]">Timeline</h3>
        {timeline.length === 0 ? (
          <p className="text-sm text-[#5A6A7A]">Your visa journey will appear here as milestones are recorded.</p>
        ) : (
          <ol className="relative space-y-4 border-l-2 border-[#DDE3EC] pl-6">
            {timeline.map((m, i) => (
              <li key={i} className="relative">
                <span className="absolute -left-[1.65rem] top-1 h-3 w-3 rounded-full bg-[#E8A020]" />
                <p className="font-medium text-[#0D1B2A]">{m.label}</p>
                <p className="text-xs text-[#5A6A7A]">
                  {new Date(m.date + 'T12:00:00').toLocaleDateString('en-LK', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </p>
              </li>
            ))}
          </ol>
        )}
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
