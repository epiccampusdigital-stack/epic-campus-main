'use client'

import { usePathname } from 'next/navigation'
import { ROLE_LABELS } from '@/lib/constants/roles'
import { useManagement } from '@/components/layout/ManagementContext'

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/students': 'Students',
  '/payments': 'Payments',
  '/attendance': 'Attendance',
  '/staff': 'Staff',
  '/audit-log': 'Audit Log',
  '/reports': 'Reports',
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
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-[#DDE3EC] bg-white px-6">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          className="rounded-lg p-2 text-[#0B3D6B] hover:bg-[#F5F7FB] lg:hidden"
          aria-label="Open menu"
        >
          <span className="ti ti-menu-2 text-xl" aria-hidden="true" />
        </button>
        <h1 className="font-jakarta text-lg font-bold text-[#0D1B2A]">
          {pageTitle}
        </h1>
      </div>

      <div className="flex items-center gap-4">
        <button
          type="button"
          className="rounded-lg p-2 text-[#5A6A7A] hover:bg-[#F5F7FB] hover:text-[#0B3D6B]"
          aria-label="Notifications"
        >
          <span className="ti ti-bell text-xl" aria-hidden="true" />
        </button>

        {user && (
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#0B3D6B] text-xs font-bold text-white">
              {getInitials(user.displayName)}
            </div>
            <div className="hidden sm:block">
              <p className="text-sm font-medium text-[#0D1B2A]">{user.displayName}</p>
              <p className="text-xs text-[#5A6A7A]">
                {ROLE_LABELS[user.role] ?? user.role}
              </p>
            </div>
          </div>
        )}
      </div>
    </header>
  )
}
