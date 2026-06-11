'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { signOut } from 'firebase/auth'
import { auth } from '@/lib/firebase/client'
import { logAuditEvent } from '@/lib/audit/helpers'
import { useCompanyPortal } from '@/components/company/CompanyContext'
import DarkModeToggle from '@/components/ui/DarkModeToggle'
import { isNavActive, navLinkClasses } from '@/lib/utils/nav'

const NAV = [
  { label: 'Dashboard', href: '/company/dashboard', icon: 'ti-layout-dashboard' },
  { label: 'Candidates', href: '/company/candidates', icon: 'ti-users' },
]

export default function CompanySidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, company, sidebarOpen, setSidebarOpen } = useCompanyPortal()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  async function handleLogout() {
    if (user) {
      await logAuditEvent({
        userId: user.uid,
        userEmail: user.email,
        userRole: user.role,
        action: 'logout',
        entityType: 'auth',
        entityId: user.uid,
        details: 'Partner company signed out',
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

      <nav className="flex-1 space-y-0.5 px-3 py-3">
        {NAV.map((item) => {
          const active = isNavActive(pathname, item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setSidebarOpen(false)}
              className={navLinkClasses(active)}
            >
              <span className={`ti ${item.icon} text-[14px]`} aria-hidden="true" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="mx-4 border-t border-[#0B3D6B]/10 dark:border-white/[0.06]" />

      <div className="p-3">
        {company && (
          <p className="mb-2 truncate px-1 text-[12px] font-medium text-[#0B3D6B] dark:text-white/80">{company.name}</p>
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
