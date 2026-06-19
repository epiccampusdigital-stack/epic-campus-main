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
import DashboardHero from '@/components/student/DashboardHero'
import QuickActions from '@/components/student/QuickActions'
import { useStudentPortal } from '@/components/student/StudentContext'
import type { AttendanceRecord, Payment } from '@/types'

export default function MyDashboardPage() {
  const { student } = useStudentPortal()
  const [fallbackStudent, setFallbackStudent] = useState<any | null>(null)
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [examCount, setExamCount] = useState(0)
  const [houseInfo, setHouseInfo] = useState<{
    name: string
    address: string
    landlordPhone: string
  } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const uid = auth.currentUser?.uid

    if (!student && !uid && !fallbackStudent) return

    let cancelled = false

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

        if (cancelled) return

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

        const activeStudentId = student?.id ?? fallbackStudent?.id
        if (activeStudentId) {
          const studSnap = await getDoc(
            doc(db, 'students', activeStudentId)
          ).catch(() => null)
          if (studSnap?.exists()) {
            const houseId = studSnap.data()?.houseId
            if (houseId) {
              const houseSnap = await getDoc(
                doc(db, 'accommodation', houseId)
              ).catch(() => null)
              if (houseSnap?.exists() && !cancelled) {
                const h = houseSnap.data()
                setHouseInfo({
                  name: String(h?.name ?? ''),
                  address: String(h?.address ?? ''),
                  landlordPhone: String(
                    h?.landlordPhone ?? ''),
                })
              }
            }
          }
        }
      } catch (err) {
        if (!cancelled) {
          console.error('[MyDashboard]', err)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    // If there's no context student, try to hydrate a minimal student record from auth/users
    async function ensureStudentFromAuth() {
      const uid = auth.currentUser?.uid
      if (!uid) return

      try {
        const studSnap = await getDoc(doc(db, 'students', uid)).catch(() => null)
        if (studSnap && studSnap.exists()) {
          if (!cancelled) {
            setFallbackStudent({ id: uid, ...(studSnap.data() ?? {}) })
          }
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
          if (!cancelled) {
            setFallbackStudent(minimal)
          }
          return
        }
      } catch (err) {
        if (!cancelled) {
          console.error('[MyDashboard] ensureStudentFromAuth error', err)
        }
      }
    }

    // Kick off ensure first so load() has studentId available
    if (!student && !fallbackStudent) {
      ensureStudentFromAuth().then(() => load())
    } else {
      load()
    }

    return () => {
      cancelled = true
    }
  }, [student, fallbackStudent])

  const activeStudent = student ?? fallbackStudent
  if (!activeStudent) {
    if (loading) {
      return (
        <div className="animate-pulse space-y-4 p-4">
          <div className="h-32 rounded-2xl bg-[#DDE3EC] dark:bg-white/10" />
          <div className="h-20 rounded-2xl bg-[#DDE3EC] dark:bg-white/10" />
          <div className="h-20 rounded-2xl bg-[#DDE3EC] dark:bg-white/10" />
        </div>
      )
    }
    return null
  }

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
      <DashboardHero
        student={activeStudent}
        attendance={attendance}
        payments={payments}
        examCount={examCount}
      />
      <QuickActions />
      <CompletionCertificate student={activeStudent} />
      <StudyStatsWidget studentId={activeStudent.id} />
      <StudentSessionsWidget studentId={activeStudent.id} />
      <CourseDashboard
        student={activeStudent}
        attendance={attendance}
        examCount={examCount}
        payments={payments}
      />
      {houseInfo && (
        <div className="rounded-2xl border border-[#DDE3EC] dark:border-white/[0.08] bg-white dark:bg-white/[0.04] p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="ti ti-home text-lg text-[#0B3D6B] dark:text-[#E8A020]" aria-hidden="true" />
            <h3 className="font-jakarta font-bold text-[#0B3D6B] dark:text-white">
              My Accommodation
            </h3>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2 text-[#0D1B2A] dark:text-white">
              <span className="ti ti-building text-[#5A6A7A] dark:text-white/40" aria-hidden="true" />
              <span className="font-medium">
                {houseInfo.name}
              </span>
            </div>
            {houseInfo.address && (
              <div className="flex items-center gap-2 text-[#5A6A7A] dark:text-white/50">
                <span className="ti ti-map-pin" aria-hidden="true" />
                {houseInfo.address}
              </div>
            )}
            {houseInfo.landlordPhone && (
              <div className="flex items-center gap-2 text-[#5A6A7A] dark:text-white/50">
                <span className="ti ti-phone" aria-hidden="true" />
                <a href={`tel:${houseInfo.landlordPhone}`}
                  className="hover:text-[#0B3D6B] dark:hover:text-[#E8A020] hover:underline">
                  {houseInfo.landlordPhone}
                </a>
              </div>
            )}
            <p className="text-xs text-[#5A6A7A] dark:text-white/40 mt-2">
              For accommodation issues contact
              Epic Campus: 076 254 8383
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
