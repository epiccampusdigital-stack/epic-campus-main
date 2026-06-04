'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { signOut } from 'firebase/auth'
import { auth, db } from '@/lib/firebase/client'
import { COURSE_MAP } from '@/lib/constants/courses'
import { getCourseBadge } from '@/lib/student/portal'
import { logAuditEvent } from '@/lib/audit/helpers'
import { useStudentPortal } from '@/components/student/StudentContext'

const BASE_NAV_ITEMS = [
  { label: 'My Dashboard', href: '/my-dashboard', icon: 'ti-layout-dashboard' },
  { label: 'My Payments', href: '/my-payments', icon: 'ti-credit-card' },
  { label: 'Pay Online', href: '/student/payments', icon: 'ti-wallet' },
  { label: 'My Results', href: '/my-results', icon: 'ti-certificate' },
  { label: 'My Materials', href: '/my-materials', icon: 'ti-books' },
  { label: 'Messages', href: '/student/messages', icon: 'ti-message' },
  { label: 'AI Study Assistant', href: '/student/assistant', icon: 'ti-robot' },
  { label: 'Book Consultation', href: '/book-consultation', icon: 'ti-calendar' },
  { label: 'My Visa', href: '/student/visa', icon: 'ti-plane' },
]

const EXAM_NAV_ITEM = { label: 'Take Exam', href: '/exams', icon: 'ti-pencil' }

export default function StudentSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, student, sidebarOpen, setSidebarOpen } = useStudentPortal()
  const [mounted, setMounted] = useState(false)
  const [unreadMessages, setUnreadMessages] = useState(0)

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (!student) return
    const q = query(
      collection(db, 'conversations'),
      where('studentId', '==', student.id),
    )
    const unsub = onSnapshot(q, (snap) => {
      const total = snap.docs.reduce(
        (sum, d) => sum + (Number(d.data().unreadByStudent) || 0),
        0,
      )
      setUnreadMessages(total)
    })
    return () => unsub()
  }, [student])

  async function handleLogout() {
    if (user) {
      await logAuditEvent({
        userId: user.uid,
        userEmail: user.email,
        userRole: user.role,
        action: 'logout',
        entityType: 'auth',
        entityId: user.uid,
        details: 'Student signed out',
      })
    }
    await fetch('/api/auth/session', { method: 'DELETE' })
    await signOut(auth)
    router.replace('/login')
  }

  function isActive(href: string) {
    return pathname === href
  }

  const courseLabel = student ? getCourseBadge(student.courseId) : ''
  const courseFlag = student ? COURSE_MAP[student.courseId]?.flag ?? '🎓' : '🎓'

  const showExamLink =
    student?.courseId === 'japan-ssw' ||
    (student?.courseId != null && String(student.courseId).includes('japan'))

  const navItems = showExamLink
    ? [...BASE_NAV_ITEMS.slice(0, 1), EXAM_NAV_ITEM, ...BASE_NAV_ITEMS.slice(1)]
    : BASE_NAV_ITEMS

  const sidebarContent = (
    <div className="flex h-full w-[240px] flex-col bg-[#0B3D6B]">
      <div className="px-4 py-4">
        <div className="flex items-center justify-center rounded-lg px-3 py-2">
          <img
            src="/images/logo-transparent.png"
            alt="Epic Campus"
            style={{ height: 52, width: 'auto' }}
          />
        </div>
      </div>

      <div className="mx-4 border-t border-white/10" />

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {navItems.map((item) => {
          const active = isActive(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                active
                  ? 'border-l-[3px] border-[#E8A020] bg-white/12 pl-[9px] font-medium text-white'
                  : 'border-l-[3px] border-transparent text-white/75 hover:bg-white/[0.08] hover:text-white'
              }`}
            >
              <span className={`ti ${item.icon} text-lg leading-none`} aria-hidden="true" />
              {item.label}
              {item.href === '/student/messages' && unreadMessages > 0 && (
                <span className="ml-auto rounded-full bg-[#E8A020] px-2 py-0.5 text-xs font-bold text-[#0B3D6B]">
                  {unreadMessages}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      <div className="mx-4 border-t border-white/10" />

      <div className="p-4">
        {student && (
          <div className="mb-3">
            <p className="truncate text-sm font-medium text-white">{student.name}</p>
            <span className="mt-1 inline-flex max-w-full items-center gap-1 truncate rounded-full bg-[#E8A020]/20 px-2 py-0.5 text-xs font-medium text-[#E8A020]">
              <span aria-hidden="true">{courseFlag}</span>
              <span className="truncate">{courseLabel}</span>
            </span>
          </div>
        )}
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-white/75 transition-colors hover:bg-white/[0.08] hover:text-white"
        >
          <span className="ti ti-logout text-lg" aria-hidden="true" />
          Logout
        </button>
      </div>
    </div>
  )

  if (!mounted) return null

  return (
    <>
      <aside className="hidden shrink-0 lg:block">{sidebarContent}</aside>

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 transform transition-transform duration-200 lg:hidden ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {sidebarContent}
      </aside>
    </>
  )
}
