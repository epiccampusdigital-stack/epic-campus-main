import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PUBLIC_PREFIXES = ['/verify']

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )
}

// Finance-only areas. Roles outside FINANCE_ROLES are bounced to /dashboard.
const FINANCE_ROLES = ['admin', 'owner', 'accountant']
const FINANCE_PREFIXES = [
  '/accountant',
  '/payroll',
  '/utility-bills',
  '/reports',
  '/agent-reports',
  '/expenses',
]

function isFinancePath(pathname: string): boolean {
  return FINANCE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )
}

/** Best-effort read of the `role` custom claim from the Firebase session cookie.
 *  This is UX-level route gating only — the authoritative enforcement is the
 *  Firestore security rules. Returns null when there is no readable role. */
function getSessionRole(request: NextRequest): string | null {
  const token = request.cookies.get('epic-session')?.value
  if (!token) return null
  try {
    const payload = token.split('.')[1]
    if (!payload) return null
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
    const claims = JSON.parse(json) as { role?: unknown }
    return typeof claims.role === 'string' ? claims.role : null
  } catch {
    return null
  }
}

export function middleware(request: NextRequest) {
  const host = request.headers.get('host') || ''
  const { pathname } = request.nextUrl

  // Public routes — no auth gate (e.g. QR verify scan)
  if (isPublicPath(pathname)) {
    return NextResponse.next()
  }

  // Redirect non-www to www
  if (host === 'epiccampus.live') {
    const url = request.nextUrl.clone()
    url.host = 'www.epiccampus.live'
    return NextResponse.redirect(url, { status: 301 })
  }

  // Finance route protection — non-finance roles cannot reach finance pages.
  if (isFinancePath(pathname)) {
    const role = getSessionRole(request)
    if (!role || !FINANCE_ROLES.includes(role)) {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      url.search = ''
      return NextResponse.redirect(url)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
