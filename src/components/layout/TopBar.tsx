'use client'

import { usePathname } from 'next/navigation'
import { ROLE_LABELS } from '@/lib/constants/roles'
import { useManagement } from '@/components/layout/ManagementContext'
import DarkModeToggle from '@/components/ui/DarkModeToggle'

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/students': 'Students',
  '/payments': 'Payments',
  '/attendance': 'Attendance',
  '/staff': 'Staff',
  '/audit-log': 'Audit Log',
  '/reports': 'Reports',
  '/partner-companies': 'Partner Companies',
  '/broadcast': 'WhatsApp Broadcast',
  '/enrollments': 'Online Enrollments',
  '/materials': 'Study Materials',
  '/chat-logs': 'AI Chat Logs',
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'EC'
}

export default function TopBar() {
  const pathname = usePathname()
  const { user, setSidebarOpen } = useManagement()

  const pageTitle =
    Object.entries(PAGE_TITLES).find(([path]) =>
      pathname === path || pathname.startsWith(`${path}/`)
    )?.[1] ?? 'Epic Campus'

  return (
    <header className="flex h-[52px] shrink-0 items-center justify-between border-b border-white/80 dark:border-white/[0.05] bg-white/70 dark:bg-[#080d18]/75 backdrop-blur-xl px-4 sticky top-0 z-50 transition-all duration-300 sm:px-6">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          className="rounded-lg p-2 text-[#0B3D6B] dark:text-white/70 hover:bg-[#0B3D6B]/[0.06] dark:hover:bg-white/[0.06] md:hidden transition-colors duration-200"
          aria-label="Open menu"
        >
          <span className="ti ti-menu-2 text-xl" aria-hidden="true" />
        </button>
        <h1 className="font-jakarta text-[15px] font-semibold text-[#0D1B2A] dark:text-white/90">
          {pageTitle}
        </h1>
      </div>

      <div className="flex items-center gap-2">
        <DarkModeToggle />

        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-[#5A6A7A] dark:text-white/50 hover:bg-[#0B3D6B]/[0.06] dark:hover:bg-white/[0.06] transition-colors duration-200"
          aria-label="Notifications"
        >
          <span className="ti ti-bell text-[18px]" aria-hidden="true" />
        </button>

        {user && (
          <div className="flex items-center gap-2 ml-1">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0B3D6B] text-[11px] font-bold text-white">
              {getInitials(user.displayName)}
            </div>
            <div className="hidden sm:block">
              <p className="text-[12px] font-medium text-[#0D1B2A] dark:text-white/90 leading-tight">
                {user.displayName}
              </p>
              <p className="text-[11px] text-[#5A6A7A] dark:text-white/40 leading-tight">
                {ROLE_LABELS[user.role] ?? user.role}
              </p>
            </div>
          </div>
        )}
      </div>
    </header>
  )
}
