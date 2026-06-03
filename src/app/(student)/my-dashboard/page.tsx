'use client'

import { useEffect, useState } from 'react'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { parseAttendance } from '@/lib/attendance/helpers'
import { parsePayment } from '@/lib/payments/helpers'
import CourseDashboard from '@/components/student/CourseDashboard'
import CompletionCertificate from '@/components/student/CompletionCertificate'
import { useStudentPortal } from '@/components/student/StudentContext'
import type { AttendanceRecord, Payment } from '@/types'

export default function MyDashboardPage() {
  const { student } = useStudentPortal()
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [examCount, setExamCount] = useState(0)
  const [loading, setLoading] = useState(true)

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
      <CompletionCertificate student={student} />
      <CourseDashboard
        student={student}
        attendance={attendance}
        examCount={examCount}
        payments={payments}
      />
    </div>
  )
}
