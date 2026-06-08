'use client'

import { usePathname } from 'next/navigation'
import { useStudentPortal } from '@/components/student/StudentContext'
import { getInitials } from '@/lib/students/helpers'
import DarkModeToggle from '@/components/ui/DarkModeToggle'

const PAGE_TITLES: Record<string, string> = {
  '/my-dashboard': 'My Dashboard',
  '/my-payments': 'My Payments',
  '/my-results': 'My Results',
  '/my-materials': 'Study Materials',
  '/my-visa': 'Visa Tracking',
}

export default function StudentTopBar() {
  const pathname = usePathname()
  const { student, setSidebarOpen } = useStudentPortal()

  const pageTitle = PAGE_TITLES[pathname] ?? 'Student Portal'

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
        <h1 className="font-jakarta text-[15px] font-semibold text-[#0D1B2A] dark:text-white/90">{pageTitle}</h1>
      </div>

      <div className="flex items-center gap-2">
        <DarkModeToggle />
        {student && (
          <div className="flex items-center gap-2 ml-1">
            <div className="hidden text-right sm:block">
              <p className="text-[12px] font-medium text-[#0D1B2A] dark:text-white/90 leading-tight">{student.name}</p>
              <p className="text-[11px] text-[#5A6A7A] dark:text-white/40 leading-tight">{student.studentCode}</p>
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0B3D6B] text-[11px] font-bold text-white">
              {getInitials(student.name)}
            </div>
          </div>
        )}
      </div>
    </header>
  )
}
