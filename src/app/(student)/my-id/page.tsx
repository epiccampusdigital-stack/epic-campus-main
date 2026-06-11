'use client'

import { useState } from 'react'
import StudentIDCard from '@/components/students/StudentIDCard'
import { useStudentPortal } from '@/components/student/StudentContext'
import { studentToIdCardProps } from '@/lib/students/idCard'
import { downloadIDCard } from '@/lib/utils/downloadIDCard'

export default function MyIdPage() {
  const { student, user } = useStudentPortal()
  const [downloading, setDownloading] = useState(false)

  if (!student) return null

  const fallbackId = user?.uid
    ? `EC-${new Date().getFullYear()}-${user.uid.slice(0, 4).toUpperCase()}`
    : undefined

  const cardProps = studentToIdCardProps(student, fallbackId)

  async function handleDownload() {
    setDownloading(true)
    try {
      await downloadIDCard('student-id-card', student!.name)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="font-jakarta text-2xl font-bold text-[#0D1B2A] dark:text-white">
          My Student ID Card
        </h1>
        <p className="mt-1 text-sm text-[#5A6A7A] dark:text-white/50">
          Download your official Epic Campus ID
        </p>
      </div>

      <div className="flex justify-center rounded-xl bg-[#F5F7FB] dark:bg-white/[0.04] p-6 sm:p-8">
        <div id="student-id-card">
          <StudentIDCard {...cardProps} />
        </div>
      </div>

      <button
        type="button"
        onClick={handleDownload}
        disabled={downloading}
        className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-[#E8A020] text-base font-bold text-[#0B3D6B] hover:bg-[#d4911c] disabled:opacity-60"
      >
        <span className="ti ti-download" aria-hidden="true" />
        {downloading ? 'Preparing download…' : 'Download ID Card'}
      </button>

      <p className="text-center text-xs text-[#5A6A7A] dark:text-white/40">
        Your QR code can be scanned for quick check-in
      </p>
    </div>
  )
}
