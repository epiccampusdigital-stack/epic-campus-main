'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS = [
  { href: '/kitchen/dashboard', label: 'Home', emoji: '🏠' },
  { href: '/kitchen/inventory', label: 'Stock', emoji: '📦' },
  { href: '/kitchen/meal-log', label: 'Meals', emoji: '🍽️' },
  { href: '/kitchen/waste', label: 'Waste', emoji: '🗑️' },
  { href: '/kitchen/orders', label: 'Orders', emoji: '📋' },
]

export default function KitchenBottomNav() {
  const pathname = usePathname()

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-30 border-t border-[#DDE3EC] bg-white/95 backdrop-blur-xl md:hidden dark:border-white/[0.08] dark:bg-[#080d18]/95"
      aria-label="Kitchen navigation"
    >
      <div className="flex h-14">
        {TABS.map((tab) => {
          const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`)
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-1 flex-col items-center justify-center gap-0.5 px-1 ${
                active ? 'text-[#E8A020]' : 'text-gray-400 dark:text-gray-500'
              }`}
            >
              <span className="text-xl leading-none" aria-hidden="true">
                {tab.emoji}
              </span>
              <span className={`text-[11px] font-semibold ${active ? 'text-[#E8A020]' : ''}`}>
                {tab.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
