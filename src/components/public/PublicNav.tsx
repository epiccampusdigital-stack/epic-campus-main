'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const PROGRAMS = [
  { label: 'Japan SSW', href: '/japan', flag: '🇯🇵' },
  { label: 'Korea D2/D4', href: '/korea', flag: '🇰🇷' },
  { label: 'China', href: '/china', flag: '🇨🇳' },
  { label: 'IELTS', href: '/ielts', flag: '📝' },
  { label: 'NVQ', href: '/nvq', flag: '🎓' },
]

const NAV_LINKS = [
  { label: 'Home', href: '/' },
  { label: 'About', href: '/about' },
  { label: 'Contact', href: '/contact' },
]

export default function PublicNav() {
  const pathname = usePathname()
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [programsOpen, setProgramsOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    setMobileOpen(false)
    setProgramsOpen(false)
  }, [pathname])

  return (
    <header
      className={`sticky top-0 z-50 bg-white transition-shadow ${
        scrolled ? 'shadow-md' : 'shadow-sm'
      }`}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <span className="font-jakarta text-xl font-bold tracking-tight">
            <span className="text-[#1A6BAD]">EPIC</span>{' '}
            <span className="text-[#0B3D6B]">Campus</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-8 lg:flex">
          {NAV_LINKS.slice(0, 1).map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-sm font-medium transition-colors hover:text-[#0B3D6B] ${
                pathname === link.href ? 'text-[#0B3D6B]' : 'text-[#5A6A7A]'
              }`}
            >
              {link.label}
            </Link>
          ))}

          <div
            className="relative"
            onMouseEnter={() => setProgramsOpen(true)}
            onMouseLeave={() => setProgramsOpen(false)}
          >
            <button
              type="button"
              className="flex items-center gap-1 text-sm font-medium text-[#5A6A7A] transition-colors hover:text-[#0B3D6B]"
            >
              Programs
              <span className="ti ti-chevron-down text-xs" />
            </button>
            {programsOpen && (
              <div className="absolute left-0 top-full pt-2">
                <div className="min-w-[220px] rounded-xl border border-[#DDE3EC] bg-white py-2 shadow-lg">
                  {PROGRAMS.map((p) => (
                    <Link
                      key={p.href}
                      href={p.href}
                      className="flex items-center gap-2 px-4 py-2.5 text-sm text-[#0D1B2A] hover:bg-[#F5F7FB]"
                    >
                      <span>{p.flag}</span>
                      {p.label}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          {NAV_LINKS.slice(1).map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-sm font-medium transition-colors hover:text-[#0B3D6B] ${
                pathname === link.href ? 'text-[#0B3D6B]' : 'text-[#5A6A7A]'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden lg:block">
          <Link
            href="/login"
            className="rounded-lg bg-[#0B3D6B] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#0a3560]"
          >
            Login
          </Link>
        </div>

        <button
          type="button"
          className="rounded-lg p-2 text-[#0B3D6B] lg:hidden"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
        >
          <span className={`ti ${mobileOpen ? 'ti-x' : 'ti-menu-2'} text-2xl`} />
        </button>
      </div>

      {mobileOpen && (
        <div className="border-t border-[#DDE3EC] bg-white px-4 py-4 lg:hidden">
          <div className="space-y-1">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="block rounded-lg px-3 py-2.5 text-sm font-medium text-[#0D1B2A] hover:bg-[#F5F7FB]"
              >
                {link.label}
              </Link>
            ))}
            <p className="px-3 pt-3 text-xs font-semibold uppercase tracking-wide text-[#5A6A7A]">
              Programs
            </p>
            {PROGRAMS.map((p) => (
              <Link
                key={p.href}
                href={p.href}
                className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-[#0D1B2A] hover:bg-[#F5F7FB]"
              >
                <span>{p.flag}</span>
                {p.label}
              </Link>
            ))}
            <Link
              href="/login"
              className="mt-3 block rounded-lg bg-[#0B3D6B] px-4 py-2.5 text-center text-sm font-semibold text-white"
            >
              Login
            </Link>
          </div>
        </div>
      )}
    </header>
  )
}
