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
import DarkModeToggle from '@/components/ui/DarkModeToggle'
import { isNavActive, navLinkClasses } from '@/lib/utils/nav'

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

  const courseLabel = student ? getCourseBadge(student.courseId) : ''
  const courseName = student ? (COURSE_MAP[student.courseId]?.label ?? courseLabel) : ''

  const showExamLink =
    student?.courseId === 'japan-ssw' ||
    (student?.courseId != null && String(student.courseId).includes('japan'))

  const navItems = showExamLink
    ? [...BASE_NAV_ITEMS.slice(0, 1), EXAM_NAV_ITEM, ...BASE_NAV_ITEMS.slice(1)]
    : BASE_NAV_ITEMS

  const sidebarContent = (
    <div className="flex h-full w-[240px] flex-col bg-white/60 dark:bg-[#0B3D6B]/20 backdrop-blur-2xl border-r border-white/80 dark:border-white/[0.06] transition-all duration-300">
      {/* Logo */}
      <div className="px-4 py-4">
        <div className="flex items-center gap-2 px-2 py-1">
          <img src="/favicon.png" alt="EPIC Campus" className="h-7 w-7 rounded-md object-cover" />
          <span className="text-[14px] font-semibold text-[#0B3D6B] dark:text-[#E8A020] transition-colors duration-300">
            EPIC Campus
          </span>
        </div>
      </div>

      <div className="mx-4 border-t border-[#0B3D6B]/10 dark:border-white/[0.06]" />

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-3">
        {navItems.map((item) => {
          const active = isNavActive(pathname, item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setSidebarOpen(false)}
              className={navLinkClasses(active)}
            >
              <span className={`ti ${item.icon} text-[14px] leading-none`} aria-hidden="true" />
              {item.label}
              {item.href === '/student/messages' && unreadMessages > 0 && (
                <span className="ml-auto rounded-full bg-[#E8A020] px-2 py-0.5 text-[10px] font-bold text-[#0B3D6B]">
                  {unreadMessages}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      <div className="mx-4 border-t border-[#0B3D6B]/10 dark:border-white/[0.06]" />

      <div className="p-3">
        {student && (
          <div className="mb-2 px-1">
            <p className="truncate text-[12px] font-medium text-[#0B3D6B] dark:text-white/80">{student.name}</p>
            <span className="mt-0.5 inline-flex max-w-full items-center gap-1 truncate rounded-full bg-[#E8A020]/15 px-2 py-0.5 text-[10px] font-medium text-[#E8A020]">
              <span className="truncate">{courseName || courseLabel}</span>
            </span>
          </div>
        )}
        <div className="flex items-center gap-2 px-1">
          <DarkModeToggle />
          <button
            type="button"
            onClick={handleLogout}
            className="flex flex-1 items-center gap-2 rounded-[9px] px-[10px] py-[8px] text-[12px] font-medium text-gray-500 dark:text-white/45 transition-all duration-200 hover:bg-[#0B3D6B]/[0.06] dark:hover:bg-white/[0.05] hover:text-[#0B3D6B] dark:hover:text-white/70"
          >
            <span className="ti ti-logout text-[14px]" aria-hidden="true" />
            Logout
          </button>
        </div>
      </div>
    </div>
  )

  if (!mounted) return null

  return (
    <>
      <aside className="hidden shrink-0 md:block">{sidebarContent}</aside>

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/40 backdrop-blur-sm md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 transform transition-transform duration-200 md:hidden ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {sidebarContent}
      </aside>
    </>
  )
}
