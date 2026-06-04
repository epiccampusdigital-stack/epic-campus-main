'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore'
import { signOut } from 'firebase/auth'
import { auth, db } from '@/lib/firebase/client'
import { ROLE_LABELS } from '@/lib/constants/roles'
import { useManagement } from '@/components/layout/ManagementContext'
import { logAuditEvent } from '@/lib/audit/helpers'
import ThemeToggle from '@/components/ui/ThemeToggle'
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
  { label: 'Utility Bills', href: '/utility-bills', icon: 'ti-receipt', roles: ['admin', 'owner', 'accountant'] },
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
  { label: 'Visa Tracker', href: '/admin/visa', icon: 'ti-plane', roles: ['admin', 'owner', 'reception'] },
  { label: 'Messages', href: '/messages', icon: 'ti-message', roles: ['admin', 'owner', 'reception'] },
  { label: 'Exams', href: '/admin-exams', icon: 'ti-writing', roles: ['admin', 'owner', 'examCoordinator', 'teacher'] },
]

export default function ManagementSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, sidebarOpen, setSidebarOpen } = useManagement()
  const [mounted, setMounted] = useState(false)
  const [unreadMessages, setUnreadMessages] = useState(0)

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    const q = query(collection(db, 'conversations'), orderBy('lastMessageAt', 'desc'))
    const unsub = onSnapshot(q, (snap) => {
      const total = snap.docs.reduce(
        (sum, d) => sum + (Number(d.data().unreadCount) || 0),
        0,
      )
      setUnreadMessages(total)
    })
    return () => unsub()
  }, [])

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

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(`${href}/`)
  }

  const sidebarContent = (
    <div className="flex h-full w-[260px] flex-col bg-[#0B3D6B]">
      <div className="px-4 py-4">
        <div
          className="flex items-center justify-center rounded-lg px-3 py-2"
          style={{ background: '#0B3D6B' }}
        >
          <img
            src="/images/logo-transparent.png"
            alt="Epic Campus"
            style={{ height: 60, width: 'auto' }}
          />
        </div>
      </div>

      <div className="mx-4 border-t border-white/10" />

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {visibleItems.map((item) => {
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
              {item.href === '/messages' && unreadMessages > 0 && (
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
        {user && (
          <div className="mb-3">
            <p className="truncate text-sm font-medium text-white">{user.displayName}</p>
            <span className="mt-1 inline-block rounded-full bg-[#E8A020]/20 px-2 py-0.5 text-xs font-medium text-[#E8A020]">
              {ROLE_LABELS[user.role] ?? user.role}
            </span>
          </div>
        )}
        <div className="mb-3 flex justify-center">
          <ThemeToggle />
        </div>
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
      {/* Desktop sidebar */}
      <aside className="hidden shrink-0 md:block">{sidebarContent}</aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
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
