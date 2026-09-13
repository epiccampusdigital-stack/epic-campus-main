'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useStudentPortal } from '@/components/student/StudentContext'
import { LOCKED_ROUTES } from '@/lib/access/accountActivation'
import { getVisibleTabs } from '@/lib/student/navTabs'

const ACTIVATION_TOOLTIP = 'Your account is not activated yet — contact your teacher.'

const NAV = [
  { label: 'Wall', href: '/epic-wall', icon: 'ti-home' },
  { label: 'Dashboard', href: '/my-dashboard', icon: 'ti-layout-dashboard' },
  { label: 'Exams', href: '/exams', icon: 'ti-writing' },
  { label: 'Messages', href: '/student/messages', icon: 'ti-message' },
  { label: 'Profile', href: '/my-id', icon: 'ti-user' },
]

export default function StudentBottomNav() {
  const pathname = usePathname()
  const { isAccountActive, enrollmentType } = useStudentPortal()
  // For enrollmentType 'residential'/'both'/undefined this returns NAV
  // unchanged — only 'online' would get a different list, but online
  // students don't get a bottom bar at all (see the early return below):
  // StudentSidebar renders their nav as a top bar across every breakpoint
  // instead, so there's only ever one nav surface.
  const navItems = getVisibleTabs(enrollmentType, NAV)

  if (enrollmentType === 'online') return null

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(`${href}/`)
  }

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/[0.08] bg-[#080d18]/95 backdrop-blur-xl pb-[env(safe-area-inset-bottom)] md:hidden"
      aria-label="Student navigation"
    >
      <ul className="flex items-stretch justify-around">
        {navItems.map((item) => {
          const active = isActive(item.href)
          const locked = !isAccountActive && LOCKED_ROUTES.includes(item.href)

          if (locked) {
            return (
              <li key={item.href} className="flex-1">
                <div
                  title={ACTIVATION_TOOLTIP}
                  aria-disabled="true"
                  className="relative flex cursor-not-allowed flex-col items-center gap-0.5 px-1 py-3 text-[10px] font-medium text-[#5A6A7A] opacity-40 dark:text-white/40"
                >
                  <span className={`ti ${item.icon} text-[22px] text-[#0B3D6B] dark:text-white/60`} aria-hidden="true" />
                  {item.label}
                  <span className="ti ti-lock absolute -top-0.5 right-3 text-[10px]" aria-hidden="true" />
                </div>
              </li>
            )
          }

          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                className={`relative flex flex-col items-center gap-0.5 px-1 py-3 text-[10px] font-medium transition-colors ${
                  active ? 'text-[#E8A020] dark:text-[#E8A020]' : 'text-[#5A6A7A] dark:text-white/40'
                }`}
              >
                {active && <span className="absolute top-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#E8A020]" />}
                <span
                  className={`ti ${item.icon} text-[22px] ${active ? 'text-[#E8A020]' : 'text-[#0B3D6B] dark:text-white/60'}`}
                  aria-hidden="true"
                />
                {item.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
