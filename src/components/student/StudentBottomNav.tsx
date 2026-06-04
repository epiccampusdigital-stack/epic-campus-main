'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV = [
  { label: 'Dashboard', href: '/my-dashboard', icon: 'ti-layout-dashboard' },
  { label: 'Exams', href: '/exams', icon: 'ti-writing' },
  { label: 'Results', href: '/my-results', icon: 'ti-certificate' },
  { label: 'Book', href: '/book-consultation', icon: 'ti-calendar' },
  { label: 'Profile', href: '/my-payments', icon: 'ti-user' },
]

export default function StudentBottomNav() {
  const pathname = usePathname()

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(`${href}/`)
  }

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-[#DDE3EC] bg-white pb-[env(safe-area-inset-bottom)] md:hidden"
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
                  active ? 'text-[#E8A020]' : 'text-[#5A6A7A]'
                }`}
              >
                <span
                  className={`ti ${item.icon} text-xl ${active ? 'text-[#E8A020]' : 'text-[#0B3D6B]'}`}
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
