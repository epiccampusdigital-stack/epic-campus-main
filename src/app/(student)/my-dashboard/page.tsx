'use client'

import { useEffect, useState } from 'react'
import { collection, getDocs, query, where, doc, getDoc, setDoc } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase/client'
import { parseAttendance } from '@/lib/attendance/helpers'
import { parsePayment } from '@/lib/payments/helpers'
import CourseDashboard from '@/components/student/CourseDashboard'
import StudentSessionsWidget from '@/components/sessions/StudentSessionsWidget'
import CompletionCertificate from '@/components/student/CompletionCertificate'
import StudyStatsWidget from '@/components/student/StudyStatsWidget'
import { useStudentPortal } from '@/components/student/StudentContext'
import type { AttendanceRecord, Payment } from '@/types'

export default function MyDashboardPage() {
  const { student } = useStudentPortal()
  const [fallbackStudent, setFallbackStudent] = useState<any | null>(null)
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [examCount, setExamCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const uid = auth.currentUser?.uid

    if (!student && !uid && !fallbackStudent) return

    async function load() {
      setLoading(true)
      try {
        const studentId = student?.id ?? fallbackStudent?.id

        const [attSnap, paySnap, examSnap] = await Promise.all([
          getDocs(
            query(
              collection(db, 'attendance'),
              where('studentId', '==', studentId),
            ),
          ).catch(() => ({ docs: [] })),
          getDocs(
            query(
              collection(db, 'payments'),
              where('studentId', '==', studentId),
            ),
          ).catch(() => ({ docs: [] })),
          getDocs(
            query(
              collection(db, 'examResults'),
              where('studentId', '==', studentId),
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

    // If there's no context student, try to hydrate a minimal student record from auth/users
    async function ensureStudentFromAuth() {
      const uid = auth.currentUser?.uid
      if (!uid) return

      try {
        const studSnap = await getDoc(doc(db, 'students', uid)).catch(() => null)
        if (studSnap && studSnap.exists()) {
          setFallbackStudent({ id: uid, ...(studSnap.data() ?? {}) })
          return
        }

        const userSnap = await getDoc(doc(db, 'users', uid)).catch(() => null)
        if (userSnap && userSnap.exists()) {
          const udata = userSnap.data() ?? {}
          const minimal = {
            id: uid,
            name: String(udata.displayName ?? udata.email ?? ''),
            uid,
            courseId: udata.courseId ?? undefined,
          }
          // create minimal students doc (merge)
          await setDoc(doc(db, 'students', uid), minimal, { merge: true }).catch(() => null)
          setFallbackStudent(minimal)
          return
        }
      } catch (err) {
        console.error('[MyDashboard] ensureStudentFromAuth error', err)
      }
    }

    // Kick off ensure first so load() has studentId available
    if (!student && !fallbackStudent) {
      ensureStudentFromAuth().then(() => load())
    } else {
      load()
    }

    return () => {
      // noop
    }
  }, [student, fallbackStudent])

  if (!student) return null

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-10 w-64 rounded bg-[#DDE3EC]" />
        <div className="h-24 rounded-xl bg-[#DDE3EC]" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
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
      <StudyStatsWidget studentId={student.id} />
      <StudentSessionsWidget studentId={student.id} />
      <CourseDashboard
        student={student}
        attendance={attendance}
        examCount={examCount}
        payments={payments}
      />
    </div>
  )
}
