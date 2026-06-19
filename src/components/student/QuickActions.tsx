'use client'

import Link from 'next/link'
import { useStudentPortal } from '@/components/student/StudentContext'

const ALL_ACTIONS = [
  {
    label: 'Take Exam',
    href: '/exams',
    icon: 'ti-pencil',
    bg: '#E8A020',
    color: '#0B3D6B',
    japanOnly: true,
  },
  {
    label: 'Messages',
    href: '/student/messages',
    icon: 'ti-message',
    bg: '#0B3D6B',
    color: '#ffffff',
    japanOnly: false,
  },
  {
    label: 'Schedule',
    href: '/my-schedule',
    icon: 'ti-calendar',
    bg: '#0B3D6B',
    color: '#ffffff',
    japanOnly: false,
  },
  {
    label: 'My ID Card',
    href: '/my-id',
    icon: 'ti-id-badge-2',
    bg: '#0B3D6B',
    color: '#ffffff',
    japanOnly: false,
  },
  {
    label: 'My Visa',
    href: '/my-visa',
    icon: 'ti-plane',
    bg: '#0B3D6B',
    color: '#ffffff',
    japanOnly: false,
  },
  {
    label: 'Study AI',
    href: '/student/assistant',
    icon: 'ti-robot',
    bg: '#1A6BAD',
    color: '#ffffff',
    japanOnly: false,
  },
]

export default function QuickActions() {
  const { student } = useStudentPortal()

  const isJapan =
    student?.courseId === 'japan-ssw' ||
    String(student?.courseId ?? '').includes('japan')

  const actions = ALL_ACTIONS.filter(
    (a) => !a.japanOnly || isJapan
  )

  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
      {actions.map((a) => (
        <Link
          key={a.href}
          href={a.href}
          className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-[#DDE3EC] dark:border-white/[0.08] bg-white dark:bg-white/[0.04] px-2 py-3.5 text-center transition-all duration-200 hover:border-[#E8A020] hover:shadow-sm active:scale-95"
        >
          <div
            className="flex h-9 w-9 items-center justify-center rounded-xl"
            style={{ background: a.bg }}
          >
            <span
              className={`ti ${a.icon} text-base`}
              style={{ color: a.color }}
              aria-hidden="true"
            />
          </div>
          <span className="text-[10px] font-semibold text-[#0D1B2A] dark:text-white/70 leading-tight">
            {a.label}
          </span>
        </Link>
      ))}
    </div>
  )
}
