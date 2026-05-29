'use client'

import { usePathname } from 'next/navigation'
import { useStudentPortal } from '@/components/student/StudentContext'
import { getInitials } from '@/lib/students/helpers'

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
        <h1 className="font-jakarta text-lg font-bold text-[#0D1B2A]">{pageTitle}</h1>
      </div>

      {student && (
        <div className="flex items-center gap-3">
          <div className="hidden text-right sm:block">
            <p className="text-sm font-medium text-[#0D1B2A]">{student.name}</p>
            <p className="text-xs text-[#5A6A7A]">{student.studentCode}</p>
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#0B3D6B] text-xs font-bold text-white">
            {getInitials(student.name)}
          </div>
        </div>
      )}
    </header>
  )
}
