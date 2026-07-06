'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { parseStudent } from '@/lib/students/helpers'
import { useManagement } from '@/components/layout/ManagementContext'

function StatSkeleton() {
  return (
    <div className="animate-pulse rounded-xl border border-[#DDE3EC] bg-white p-5 dark:bg-gray-800">
      <div className="mb-3 h-3 w-24 rounded bg-[#DDE3EC]" />
      <div className="h-8 w-16 rounded bg-[#DDE3EC]" />
    </div>
  )
}

export default function ReceptionDashboard() {
  const { user } = useManagement()
  const [loading, setLoading] = useState(true)
  const [pendingEnrollments, setPendingEnrollments] = useState<any[]>([])
  const [newStudentsCount, setNewStudentsCount] = useState(0)
  const [unreadMessages, setUnreadMessages] = useState(0)
  const [todayConsultations, setTodayConsultations] = useState(0)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const thisMonth = new Date().toISOString().slice(0, 7)
        const today = new Date().toISOString().slice(0, 10)

        const [pendingSnap, studentsSnap, messagesSnap, consultationsSnap] = await Promise.all([
          getDocs(
            query(
              collection(db, 'enrollmentApplications'),
              where('status', '==', 'pending'),
              orderBy('createdAt', 'desc')
            )
          ).catch(() => ({ docs: [] as any[] })),
          getDocs(
            query(
              collection(db, 'students'),
              where('enrollmentDate', '>=', thisMonth)
            )
          ).catch(() => ({ docs: [] as any[] })),
          getDocs(
            collection(db, 'messages')
          ).catch(() => ({ docs: [] as any[] })),
          getDocs(
            query(
              collection(db, 'roomBookings'),
              where('date', '==', today)
            )
          ).catch(() => ({ docs: [] as any[] })),
        ])

        setPendingEnrollments(pendingSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) })))

        // Keep parsing aligned with existing student data conventions in dashboard components.
        const parsedNewStudents = studentsSnap.docs.map((d) =>
          parseStudent(d.id, d.data() as Record<string, unknown>)
        )
        setNewStudentsCount(parsedNewStudents.length)

        const unreadTotal = messagesSnap.docs.reduce(
          (sum, d) => sum + (Number(d.data().unreadByAdmin) || 0),
          0,
        )
        setUnreadMessages(unreadTotal)

        setTodayConsultations(consultationsSnap.docs.length)
      } catch (err) {
        console.error('[ReceptionDashboard]', err)
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [])

  const quickActions = [
    { label: 'New Enrollment', href: '/enrollments', icon: 'ti-clipboard-list' },
    { label: 'Students', href: '/students', icon: 'ti-users' },
    { label: 'Payments', href: '/payments', icon: 'ti-credit-card' },
    { label: 'Messages', href: '/messages', icon: 'ti-message' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-jakarta text-2xl font-bold text-[#0B3D6B] dark:text-white">Reception Dashboard</h1>
        <p className="mt-1 text-sm text-[#5A6A7A] dark:text-white/60">Good morning, {user?.displayName}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <StatSkeleton key={i} />)
        ) : (
          <>
            <div className="rounded-xl border border-[#DDE3EC] bg-white p-5 dark:bg-gray-800">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#5A6A7A] dark:text-white/50">Pending Enrollments</p>
                <span className="ti ti-clipboard-list text-base text-[#0B3D6B] dark:text-[#E8A020]" aria-hidden="true" />
              </div>
              <p className={`mt-2 text-2xl font-bold ${pendingEnrollments.length > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-[#0B3D6B] dark:text-[#E8A020]'}`}>
                {pendingEnrollments.length}
              </p>
            </div>

            <div className="rounded-xl border border-[#DDE3EC] bg-white p-5 dark:bg-gray-800">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#5A6A7A] dark:text-white/50">New Students This Month</p>
                <span className="ti ti-user-plus text-base text-[#0B3D6B] dark:text-[#E8A020]" aria-hidden="true" />
              </div>
              <p className="mt-2 text-2xl font-bold text-[#0B3D6B] dark:text-[#E8A020]">{newStudentsCount}</p>
            </div>

            <div className="rounded-xl border border-[#DDE3EC] bg-white p-5 dark:bg-gray-800">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#5A6A7A] dark:text-white/50">Unread Messages</p>
                <span className="ti ti-message text-base text-[#0B3D6B] dark:text-[#E8A020]" aria-hidden="true" />
              </div>
              <p className={`mt-2 text-2xl font-bold ${unreadMessages > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-[#0B3D6B] dark:text-[#E8A020]'}`}>
                {unreadMessages}
              </p>
            </div>

            <div className="rounded-xl border border-[#DDE3EC] bg-white p-5 dark:bg-gray-800">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#5A6A7A] dark:text-white/50">Today's Consultations</p>
                <span className="ti ti-calendar-event text-base text-[#0B3D6B] dark:text-[#E8A020]" aria-hidden="true" />
              </div>
              <p className="mt-2 text-2xl font-bold text-[#0B3D6B] dark:text-[#E8A020]">{todayConsultations}</p>
            </div>
          </>
        )}
      </div>

      <div className="rounded-xl border border-[#DDE3EC] bg-white p-5 dark:border-white/[0.08] dark:bg-white/[0.04]">
        <h2 className="mb-4 font-jakarta text-lg font-bold text-[#0B3D6B] dark:text-white">Pending Enrollments</h2>

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-10 animate-pulse rounded bg-[#DDE3EC] dark:bg-white/10" />
            ))}
          </div>
        ) : pendingEnrollments.length === 0 ? (
          <p className="text-sm text-[#5A6A7A] dark:text-white/50">No pending enrollments</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-[#DDE3EC] dark:border-white/[0.08]">
                  <tr>
                    <th className="px-2 py-2 font-semibold text-[#0B3D6B] dark:text-white">Name</th>
                    <th className="px-2 py-2 font-semibold text-[#0B3D6B] dark:text-white">Program</th>
                    <th className="px-2 py-2 font-semibold text-[#0B3D6B] dark:text-white">Applied</th>
                    <th className="px-2 py-2 font-semibold text-[#0B3D6B] dark:text-white">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingEnrollments.slice(0, 5).map((d) => (
                    <tr key={String(d.id)} className="border-b border-[#DDE3EC] dark:border-white/[0.08]">
                      <td className="px-2 py-2 text-[#0D1B2A] dark:text-white">{String(d.firstName ?? '')} {String(d.lastName ?? '')}</td>
                      <td className="px-2 py-2 text-[#5A6A7A] dark:text-white/60">{String(d.program ?? '')}</td>
                      <td className="px-2 py-2 text-[#5A6A7A] dark:text-white/60">
                        {d.createdAt?.toDate?.().toLocaleDateString() ?? '—'}
                      </td>
                      <td className="px-2 py-2">
                        <Link href="/enrollments" className="text-sm font-medium text-[#0B3D6B] dark:text-[#E8A020] hover:underline">
                          Review
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {pendingEnrollments.length > 5 && (
              <div className="mt-3">
                <Link href="/enrollments" className="text-sm font-medium text-[#0B3D6B] dark:text-[#E8A020] hover:underline">
                  View all {pendingEnrollments.length} →
                </Link>
              </div>
            )}
          </>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {quickActions.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className="flex items-center gap-2 rounded-xl bg-[#0B3D6B] dark:bg-white/[0.06] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0a3460] transition-colors"
          >
            <span className={`ti ${action.icon}`} aria-hidden="true" />
            {action.label}
          </Link>
        ))}
      </div>
    </div>
  )
}
