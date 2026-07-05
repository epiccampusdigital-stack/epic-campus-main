'use client'

import { usePathname } from 'next/navigation'
import ChatBot from '@/components/public/ChatBot'

const PORTAL_PREFIXES = [
  '/student',
  '/admin',
  '/teacher',
  '/accounts',
  '/dashboard',
  '/my-',
  '/login',
  '/signup',
  '/exams',
  '/admin-exams',
  '/payments',
  '/students',
  '/staff',
  '/crm',
  '/schedule',
  '/attendance',
  '/payroll',
  '/audit-log',
  '/reports',
  '/overview',
  '/branches',
  '/results',
  '/epic-wall',
  '/book-consultation',
]

function isPortalPath(pathname: string) {
  return PORTAL_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )
}

export default function ChatBotRoot() {
  const pathname = usePathname()
  if (isPortalPath(pathname)) return null
  return <ChatBot />
}
