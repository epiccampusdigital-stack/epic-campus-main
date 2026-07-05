'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV = [
  { label: 'Wall', href: '/epic-wall', icon: 'ti-home' },
  { label: 'Dashboard', href: '/my-dashboard', icon: 'ti-layout-dashboard' },
  { label: 'Exams', href: '/exams', icon: 'ti-writing' },
  { label: 'Messages', href: '/student/messages', icon: 'ti-message' },
  { label: 'Profile', href: '/my-id', icon: 'ti-user' },
]

export default function StudentBottomNav() {
  const pathname = usePathname()

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(`${href}/`)
  }

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-[#DDE3EC] dark:border-white/[0.08] bg-white dark:bg-white/[0.04] pb-[env(safe-area-inset-bottom)] md:hidden"
      aria-label="Student navigation"
    >
      <ul className="flex items-stretch justify-around">
        {NAV.map((item) => {
          const active = isActive(item.href)
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                className={`flex flex-col items-center gap-0.5 px-1 py-2.5 text-[10px] font-medium transition-colors ${
                  active ? 'text-[#E8A020] dark:text-[#E8A020]' : 'text-[#5A6A7A] dark:text-white/40'
                }`}
              >
                <span
                  className={`ti ${item.icon} text-xl ${active ? 'text-[#E8A020]' : 'text-[#0B3D6B] dark:text-white/60'}`}
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
