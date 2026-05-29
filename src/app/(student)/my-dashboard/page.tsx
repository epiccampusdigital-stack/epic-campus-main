'use client'

import { useEffect, useState } from 'react'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { parseAttendance } from '@/lib/attendance/helpers'
import { parsePayment } from '@/lib/payments/helpers'
import { COURSE_MAP } from '@/lib/constants/courses'
import {
  downloadPDF,
  generateEnrollmentCertificate,
} from '@/lib/generatePDF'
import CourseDashboard from '@/components/student/CourseDashboard'
import { useStudentPortal } from '@/components/student/StudentContext'
import type { AttendanceRecord, Payment } from '@/types'

export default function MyDashboardPage() {
  const { student } = useStudentPortal()
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [examCount, setExamCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [certLoading, setCertLoading] = useState(false)

  useEffect(() => {
    if (!student) return

    async function load() {
      setLoading(true)
      try {
        const [attSnap, paySnap, examSnap] = await Promise.all([
          getDocs(
            query(
              collection(db, 'attendance'),
              where('studentId', '==', student!.id),
            ),
          ).catch(() => ({ docs: [] })),
          getDocs(
            query(
              collection(db, 'payments'),
              where('studentId', '==', student!.id),
            ),
          ),
          getDocs(
            query(
              collection(db, 'examResults'),
              where('studentId', '==', student!.id),
            ),
          ).catch(() => ({ docs: [] })),
        ])

        const att = attSnap.docs
          .map((d) => parseAttendance(d.id, d.data() as Record<string, unknown>))
          .sort((a, b) => b.date.localeCompare(a.date))

        setAttendance(att)
        setPayments(
          paySnap.docs.map((d) =>
            parsePayment(d.id, d.data() as Record<string, unknown>),
          ),
        )
        setExamCount(examSnap.docs.length)
      } catch (err) {
        console.error('[MyDashboard]', err)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [student])

  if (!student) return null

  async function handleEnrollmentCert() {
    if (!student) return
    setCertLoading(true)
    try {
      const program = COURSE_MAP[student.courseId]?.label ?? student.courseId
      const bytes = await generateEnrollmentCertificate({
        studentName: student.name,
        program,
        enrollmentDate: student.enrollmentDate ?? new Date().toISOString().slice(0, 10),
        studentId: student.studentCode,
      })
      downloadPDF(bytes, `enrollment-${student.studentCode}.pdf`)
    } finally {
      setCertLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-10 w-64 rounded bg-[#DDE3EC]" />
        <div className="h-24 rounded-xl bg-[#DDE3EC]" />
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 rounded-xl bg-[#DDE3EC]" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={handleEnrollmentCert}
        disabled={certLoading}
        className="flex items-center gap-2 rounded-full bg-[#E8A020] px-6 py-3 font-semibold text-white transition-all hover:bg-[#d4911c] disabled:opacity-60"
      >
        📄 Download Certificate
      </button>
      <CourseDashboard
        student={student}
        attendance={attendance}
        examCount={examCount}
        payments={payments}
      />
    </div>
  )
}
