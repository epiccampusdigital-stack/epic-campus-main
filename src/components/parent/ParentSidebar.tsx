'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { signOut } from 'firebase/auth'
import { auth } from '@/lib/firebase/client'
import { useParentPortalOptional } from '@/components/parent/ParentContext'

const NAV_ITEMS = [
  { label: 'Dashboard', href: '/parent/dashboard', icon: 'ti-layout-dashboard' },
  { label: 'Payments', href: '/parent/payments', icon: 'ti-credit-card' },
  { label: 'Results', href: '/parent/results', icon: 'ti-certificate' },
  { label: 'Attendance', href: '/parent/attendance', icon: 'ti-calendar-check' },
  { label: 'Visa', href: '/parent/visa', icon: 'ti-plane' },
]

export default function ParentSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const ctx = useParentPortalOptional()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  async function handleSignOut() {
    await signOut(auth)
    await fetch('/api/auth/session', { method: 'DELETE' }).catch(() => {})
    router.replace('/login')
  }

  const studentName = ctx?.student?.name ?? 'Student'
  const parentName = ctx?.parent?.parentName ?? ctx?.user?.displayName ?? 'Parent'

  return (
    <>
      {ctx?.sidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          aria-label="Close menu"
          onClick={() => ctx.setSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-[#0B3D6B] text-white transition-transform md:static md:translate-x-0 ${
          ctx?.sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="border-b border-white/10 px-5 py-5">
          <img
            src="/images/logo-transparent.png"
            alt="Epic Campus"
            className="h-10 w-auto"
          />
          <p className="mt-4 font-jakarta text-xs font-semibold uppercase tracking-wide text-white/60">
            Parent portal
          </p>
          <p className="mt-1 truncate font-jakarta text-sm font-bold">{parentName}</p>
          <p className="truncate font-inter text-xs text-[#E8A020]">{studentName}</p>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-4">
          {NAV_ITEMS.map((item) => {
            const active = mounted && pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => ctx?.setSidebarOpen(false)}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 font-inter text-sm font-medium transition-colors ${
                  active
                    ? 'border-l-[3px] border-[#E8A020] bg-white/10 text-white'
                    : 'border-l-[3px] border-transparent text-white/75 hover:bg-white/[0.08] hover:text-white'
                }`}
              >
                <span className={`ti ${item.icon} text-lg`} aria-hidden="true" />
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="border-t border-white/10 p-4">
          <button
            type="button"
            onClick={() => void handleSignOut()}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 font-inter text-sm text-white/80 hover:bg-white/10"
          >
            <span className="ti ti-logout" aria-hidden="true" />
            Sign out
          </button>
        </div>
      </aside>
    </>
  )
}
