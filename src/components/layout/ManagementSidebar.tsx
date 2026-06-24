'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore'
import { signOut } from 'firebase/auth'
import { auth, db } from '@/lib/firebase/client'
import { ROLE_LABELS } from '@/lib/constants/roles'
import { useManagement } from '@/components/layout/ManagementContext'
import { logAuditEvent } from '@/lib/audit/helpers'
import DarkModeToggle from '@/components/ui/DarkModeToggle'
import { isNavActive, navLinkClasses } from '@/lib/utils/nav'
import type { Role } from '@/types'

interface NavItem {
  label: string
  href: string
  icon: string
  roles: Role[]
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: 'ti-layout-dashboard', roles: ['admin', 'owner', 'reception', 'accountant', 'teacher'] },
  { label: 'Students', href: '/students', icon: 'ti-users', roles: ['admin', 'owner', 'reception', 'teacher'] },
  { label: 'CRM', href: '/crm', icon: 'ti-address-book', roles: ['admin', 'owner', 'reception'] },
  { label: 'Payments', href: '/payments', icon: 'ti-credit-card', roles: ['admin', 'owner', 'reception', 'accountant'] },
  { label: 'Payment Tracker', href: '/payments/tracker', icon: 'ti-checkbox', roles: ['admin', 'owner', 'reception', 'accountant'] },
  { label: 'Utility Bills', href: '/utility-bills', icon: 'ti-receipt', roles: ['admin', 'owner', 'accountant'] },
  { label: 'Accommodation', href: '/accommodation', icon: 'ti-home', roles: ['admin', 'owner', 'accountant'] },
  {
    label: 'Supplies',
    href: '/supplies',
    icon: 'ti-clipboard-list',
    roles: ['admin', 'owner', 'accountant', 'reception', 'teacher'],
  },
  { label: 'Attendance', href: '/attendance', icon: 'ti-calendar-check', roles: ['admin', 'owner', 'reception', 'teacher'] },
  { label: 'Schedule', href: '/schedule', icon: 'ti-calendar', roles: ['admin', 'owner', 'reception', 'teacher'] },
  { label: 'Sessions', href: '/sessions', icon: 'ti-chalkboard', roles: ['teacher'] },
  { label: 'Consultations', href: '/consultations', icon: 'ti-calendar-event', roles: ['admin', 'owner', 'reception', 'teacher'] },
  { label: 'Payroll', href: '/payroll', icon: 'ti-report-money', roles: ['admin', 'owner', 'accountant'] },
  { label: 'Staff', href: '/staff', icon: 'ti-id-badge', roles: ['admin', 'owner'] },
  { label: 'Audit Log', href: '/audit-log', icon: 'ti-shield-check', roles: ['admin', 'owner'] },
  { label: 'Reports', href: '/reports', icon: 'ti-chart-bar', roles: ['admin', 'owner', 'accountant'] },
  { label: 'Agent Reports', href: '/agent-reports', icon: 'ti-chart-dots-2', roles: ['admin', 'owner', 'accountant'] },
  { label: 'Partners', href: '/partner-companies', icon: 'ti-building', roles: ['admin', 'owner'] },
  { label: 'Analytics', href: '/admin/analytics', icon: 'ti-chart-dots', roles: ['admin', 'owner'] },
  { label: 'Student Risk', href: '/admin/student-risk', icon: 'ti-alert-triangle', roles: ['admin', 'owner'] },
  { label: 'Kitchen Orders', href: '/admin/kitchen-orders', icon: 'ti-soup', roles: ['admin', 'owner'] },
  { label: 'Kitchen Finance', href: '/accountant/dashboard', icon: 'ti-coin', roles: ['accountant', 'admin', 'owner'] },
  { label: 'Visa Tracker', href: '/admin/visa', icon: 'ti-plane', roles: ['admin', 'owner', 'reception'] },
  { label: 'Messages', href: '/messages', icon: 'ti-message', roles: ['admin', 'owner', 'reception'] },
  { label: 'Broadcast', href: '/broadcast', icon: 'ti-speakerphone', roles: ['admin', 'owner', 'reception'] },
  { label: 'Enrollments', href: '/enrollments', icon: 'ti-clipboard-list', roles: ['admin', 'owner', 'reception'] },
  { label: 'Exam Manager', href: '/admin-exams', icon: 'ti-writing', roles: ['admin', 'owner', 'examCoordinator', 'teacher'] },
  { label: 'Materials', href: '/materials', icon: 'ti-book', roles: ['admin', 'owner', 'teacher'] },
  { label: 'Chat Logs', href: '/chat-logs', icon: 'ti-message-dots', roles: ['admin', 'owner'] },
  { label: 'AI Importer', href: '/admin/import', icon: 'ti-sparkles', roles: ['admin', 'owner'] },
]

export default function ManagementSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, sidebarOpen, setSidebarOpen } = useManagement()
  const [mounted, setMounted] = useState(false)
  const [unreadMessages, setUnreadMessages] = useState(0)
  const [pendingKitchenOrders, setPendingKitchenOrders] = useState(0)

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    const q = query(
      collection(db, 'messages'),
      orderBy('lastAt', 'desc')
    )
    const unsub = onSnapshot(q, (snap) => {
      const total = snap.docs.reduce(
        (sum, d) => sum + (Number(d.data().unreadByAdmin) || 0),
        0,
      )
      setUnreadMessages(total)
    }, () => setUnreadMessages(0))
    return () => unsub()
  }, [])

  useEffect(() => {
    if (!user || (user.role !== 'admin' && user.role !== 'owner')) return
    const q = query(collection(db, 'kitchenOrders'), where('status', '==', 'submitted'))
    const unsub = onSnapshot(q, (snap) => setPendingKitchenOrders(snap.size))
    return () => unsub()
  }, [user])

  const visibleItems = NAV_ITEMS.filter(
    (item) => user && item.roles.includes(user.role)
  )

  async function handleLogout() {
    if (user) {
      await logAuditEvent({
        userId: user.uid,
        userEmail: user.email,
        userRole: user.role,
        action: 'logout',
        entityType: 'auth',
        entityId: user.uid,
        details: 'User signed out',
      })
    }
    await fetch('/api/auth/session', { method: 'DELETE' })
    await signOut(auth)
    router.replace('/login')
  }

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
        {visibleItems.map((item) => {
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
              {item.href === '/messages' && unreadMessages > 0 && (
                <span className="ml-auto rounded-full bg-[#E8A020] px-2 py-0.5 text-[10px] font-bold text-[#0B3D6B]">
                  {unreadMessages}
                </span>
              )}
              {item.href === '/admin/kitchen-orders' && pendingKitchenOrders > 0 && (
                <span className="ml-auto rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white">
                  {pendingKitchenOrders}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      <div className="mx-4 border-t border-[#0B3D6B]/10 dark:border-white/[0.06]" />

      <div className="p-3">
        {user && (
          <div className="mb-2 px-1">
            <p className="truncate text-[12px] font-medium text-[#0B3D6B] dark:text-white/80">{user.displayName}</p>
            <span className="mt-0.5 inline-block rounded-full bg-[#E8A020]/15 px-2 py-0.5 text-[10px] font-medium text-[#E8A020]">
              {ROLE_LABELS[user.role] ?? user.role}
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
      {/* Desktop sidebar */}
      <aside className="hidden shrink-0 md:block">{sidebarContent}</aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/40 md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Mobile drawer */}
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
