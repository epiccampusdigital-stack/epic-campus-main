'use client'

import { useEffect, useState } from 'react'
import { COURSE_MAP } from '@/lib/constants/courses'
import {
  downloadPDF,
  generateExamCertificate,
} from '@/lib/generatePDF'
import { checkCertificateEligibility } from '@/lib/student/certificate'
import type { Student } from '@/types'

interface CompletionCertificateProps {
  student: Student
}

export default function CompletionCertificate({ student }: CompletionCertificateProps) {
  const [loading, setLoading] = useState(true)
  const [certLoading, setCertLoading] = useState(false)
  const [eligible, setEligible] = useState(false)
  const [message, setMessage] = useState('')
  const [progress, setProgress] = useState({ passed: 0, total: 0 })

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const result = await checkCertificateEligibility(student.id)
        if (cancelled) return
        setEligible(result.eligible)
        setMessage(result.message)
        setProgress({ passed: result.passedPapers, total: result.totalPapers })
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [student.id])

  async function handleDownload() {
    if (!eligible) return
    setCertLoading(true)
    try {
      const program = COURSE_MAP[student.courseId]?.label ?? student.courseId
      const bytes = await generateExamCertificate({
        studentName: student.name,
        paperName: `${program} — All Course Exams`,
        score: 'Completed',
        grade: 'Pass',
        date: new Date().toISOString().slice(0, 10),
        remarks: `Certificate issued after passing all ${progress.total} assigned exam papers.`,
      })
      downloadPDF(bytes, `completion-${student.studentCode}.pdf`)
    } finally {
      setCertLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="h-24 animate-pulse rounded-xl border border-[#DDE3EC] bg-[#DDE3EC]/40" />
    )
  }

  if (!eligible) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-[#DDE3EC] bg-white p-5">
        <span className="ti ti-lock text-2xl text-[#94a3b8]" aria-hidden="true" />
        <div>
          <p className="font-jakarta font-semibold text-[#0D1B2A]">Completion Certificate</p>
          <p className="mt-1 text-sm text-[#5A6A7A]">{message}</p>
          {progress.total > 0 && (
            <p className="mt-2 text-xs text-[#5A6A7A]">
              Progress: {progress.passed} of {progress.total} exams passed
            </p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-[#DDE3EC] bg-white p-5">
      <p className="font-jakarta font-semibold text-[#0D1B2A]">Completion Certificate</p>
      <p className="mt-1 text-sm text-[#5A6A7A]">{message}</p>
      <button
        type="button"
        onClick={handleDownload}
        disabled={certLoading}
        className="mt-4 flex items-center gap-2 rounded-full bg-[#E8A020] px-6 py-3 font-semibold text-white transition-all hover:bg-[#d4911c] disabled:opacity-60"
      >
        📄 {certLoading ? 'Generating…' : 'Download Completion Certificate'}
      </button>
    </div>
  )
}
