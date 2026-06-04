'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { signOut } from 'firebase/auth'
import { auth } from '@/lib/firebase/client'
import { logAuditEvent } from '@/lib/audit/helpers'
import { useCompanyPortal } from '@/components/company/CompanyContext'

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
    <div className="flex h-full w-[240px] flex-col bg-[#0B3D6B]">
      <div className="px-4 py-4">
        <div className="flex items-center justify-center rounded-lg px-3 py-2">
          <img
            src="/images/logo-transparent.png"
            alt="Epic Campus"
            className="h-12 w-auto"
          />
        </div>
      </div>
      <div className="mx-4 border-t border-white/10" />
      <nav className="flex-1 space-y-1 px-3 py-4">
        {NAV.map((item) => {
          const active = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm ${
                active
                  ? 'border-l-[3px] border-[#E8A020] bg-white/12 pl-[9px] font-medium text-white'
                  : 'border-l-[3px] border-transparent text-white/75 hover:bg-white/[0.08]'
              }`}
            >
              <span className={`ti ${item.icon} text-lg`} aria-hidden="true" />
              {item.label}
            </Link>
          )
        })}
      </nav>
      <div className="mx-4 border-t border-white/10" />
      <div className="p-4">
        {company && (
          <p className="mb-3 truncate text-sm font-medium text-white">{company.name}</p>
        )}
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-white/75 hover:bg-white/[0.08]"
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
      <aside className="hidden shrink-0 md:block">{sidebarContent}</aside>
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-50 transform transition-transform md:hidden ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {sidebarContent}
      </aside>
    </>
  )
}
