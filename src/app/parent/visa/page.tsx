'use client'

import { useEffect, useState } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import {
  buildVisaChecklist,
  buildVisaTimeline,
  getVisaStageIndex,
} from '@/lib/student/portal'
import { visaStatusLabel } from '@/lib/parent/helpers'
import { VISA_STATUS_STYLES } from '@/lib/students/helpers'
import { useParentPortal } from '@/components/parent/ParentContext'

const STAGES = [
  'Not started',
  'Documents',
  'In progress',
  'Submitted',
  'Approved',
]

export default function ParentVisaPage() {
  const { student } = useParentPortal()
  const [docNames, setDocNames] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const snap = await getDocs(
          collection(db, 'students', student.id, 'documents'),
        )
        setDocNames(snap.docs.map((d) => String(d.data().name ?? '')))
      } catch {
        setDocNames([])
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [student.id])

  const checklist = buildVisaChecklist(student, docNames)
  const timeline = buildVisaTimeline(student)
  const stageIndex = getVisaStageIndex(student.visaStatus)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-jakarta text-2xl font-bold text-[#0D1B2A]">Visa</h2>
        <p className="text-sm text-[#5A6A7A]">Visa progress for {student.name}</p>
      </div>

      <div className="rounded-xl border border-[#DDE3EC] bg-white p-5">
        <p className="text-xs font-medium uppercase text-[#5A6A7A]">Current status</p>
        <span
          className={`mt-2 inline-flex rounded-full border px-3 py-1 text-sm font-medium capitalize ${
            VISA_STATUS_STYLES[student.visaStatus ?? 'not-started']
          }`}
        >
          {visaStatusLabel(student.visaStatus)}
        </span>
      </div>

      <div className="rounded-xl border border-[#DDE3EC] bg-white p-5">
        <h3 className="font-jakarta text-sm font-bold text-[#0B3D6B]">Progress</h3>
        <div className="mt-4 flex justify-between gap-1">
          {STAGES.map((label, i) => (
            <div key={label} className="flex flex-1 flex-col items-center">
              <div
                className={`h-2 w-full rounded-full ${
                  i <= stageIndex ? 'bg-[#E8A020]' : 'bg-[#DDE3EC]'
                }`}
              />
              <p className="mt-2 text-center text-[10px] text-[#5A6A7A]">{label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-[#DDE3EC] bg-white p-5">
        <h3 className="font-jakarta text-sm font-bold text-[#0B3D6B]">Document checklist</h3>
        {loading ? (
          <p className="mt-4 text-sm text-[#5A6A7A]">Loading…</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {checklist.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between rounded-lg bg-[#F5F7FB] px-3 py-2 text-sm"
              >
                <span>{item.label}</span>
                <span className="text-xs font-medium capitalize text-[#5A6A7A]">
                  {item.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {timeline.length > 0 && (
        <div className="rounded-xl border border-[#DDE3EC] bg-white p-5">
          <h3 className="font-jakarta text-sm font-bold text-[#0B3D6B]">Timeline</h3>
          <ul className="mt-4 space-y-3">
            {timeline.map((m) => (
              <li key={m.label} className="text-sm">
                <p className="font-medium text-[#0D1B2A]">{m.label}</p>
                <p className="text-xs text-[#5A6A7A]">{m.date}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
