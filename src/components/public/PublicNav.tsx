'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const PROGRAMS = [
  { label: 'Japan SSW', href: '/japan', flag: '🇯🇵' },
  { label: 'Korea D2/D4', href: '/korea', flag: '🇰🇷' },
  { label: 'China', href: '/china', flag: '🇨🇳' },
  { label: 'IELTS Program', href: 'https://epicielts.live', flag: '📝', external: true },
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
      className={`sticky top-0 z-50 border-b bg-white transition-all duration-300 ${
        scrolled
          ? 'border-gray-200 shadow-md'
          : 'border-gray-100 shadow-sm'
      }`}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <Link href="/" className="group flex shrink-0 items-center gap-1.5">
          <span className="text-2xl transition-transform group-hover:scale-110" aria-hidden="true">
            🎓
          </span>
          <span className="font-jakarta text-xl font-bold tracking-tight">
            <span className="text-[#1A6BAD]">EPIC</span>{' '}
            <span className="text-[#0B3D6B]">Campus</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-10 lg:flex">
          {NAV_LINKS.slice(0, 1).map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-sm font-medium transition-colors hover:text-[#0B3D6B] ${
                pathname === link.href ? 'text-[#0B3D6B]' : 'text-gray-500'
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
              className="flex items-center gap-1 text-sm font-medium text-gray-500 transition-colors hover:text-[#0B3D6B]"
            >
              Programs
              <span className="ti ti-chevron-down text-xs" />
            </button>
            {programsOpen && (
              <div className="absolute left-1/2 top-full -translate-x-1/2 pt-3">
                <div className="min-w-[240px] rounded-2xl border border-gray-100 bg-white py-2 shadow-xl">
                  {PROGRAMS.map((p) =>
                    'external' in p && p.external ? (
                      <a
                        key={p.href}
                        href={p.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 px-5 py-3 text-sm text-gray-700 transition-colors hover:bg-[#F5F7FB]"
                      >
                        <span className="text-xl">{p.flag}</span>
                        {p.label}
                      </a>
                    ) : (
                      <Link
                        key={p.href}
                        href={p.href}
                        className="flex items-center gap-3 px-5 py-3 text-sm text-gray-700 transition-colors hover:bg-[#F5F7FB]"
                      >
                        <span className="text-xl">{p.flag}</span>
                        {p.label}
                      </Link>
                    )
                  )}
                </div>
              </div>
            )}
          </div>

          {NAV_LINKS.slice(1).map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-sm font-medium transition-colors hover:text-[#0B3D6B] ${
                pathname === link.href ? 'text-[#0B3D6B]' : 'text-gray-500'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden lg:block">
          <Link
            href="/login"
            className="inline-flex items-center rounded-full bg-[#0B3D6B] px-7 py-3 text-sm font-semibold text-white shadow-md transition-all hover:bg-[#0a3460] hover:shadow-lg"
          >
            Login to Portal
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
        <div className="border-t border-gray-100 bg-white px-4 py-5 lg:hidden">
          <div className="space-y-1">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="block rounded-xl px-4 py-3 text-sm font-medium text-gray-800 hover:bg-[#F5F7FB]"
              >
                {link.label}
              </Link>
            ))}
            <p className="px-4 pt-4 text-xs font-semibold uppercase tracking-widest text-gray-400">
              Programs
            </p>
            {PROGRAMS.map((p) =>
              'external' in p && p.external ? (
                <a
                  key={p.href}
                  href={p.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm text-gray-800 hover:bg-[#F5F7FB]"
                >
                  <span className="text-xl">{p.flag}</span>
                  {p.label}
                </a>
              ) : (
                <Link
                  key={p.href}
                  href={p.href}
                  className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm text-gray-800 hover:bg-[#F5F7FB]"
                >
                  <span className="text-xl">{p.flag}</span>
                  {p.label}
                </Link>
              )
            )}
            <Link
              href="/login"
              className="mt-4 block rounded-full bg-[#0B3D6B] px-6 py-3.5 text-center text-sm font-semibold text-white shadow-md"
            >
              Login to Portal
            </Link>
          </div>
        </div>
      )}
    </header>
  )
}
