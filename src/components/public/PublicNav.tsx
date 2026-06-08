'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import DarkModeToggle from '@/components/ui/DarkModeToggle'

const PROGRAMS = [
  { label: 'Japan SSW', href: '/japan' },
  { label: 'Korea D2/D4', href: '/korea' },
  { label: 'China', href: '/china' },
  { label: 'IELTS Program', href: 'https://epicielts.live', external: true },
  { label: 'NVQ', href: '/nvq' },
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
      className={`sticky top-0 z-50 h-[58px] border-b transition-all duration-300 bg-white/85 dark:bg-[#080d18]/85 backdrop-blur-xl ${
        scrolled
          ? 'border-[#0B3D6B]/[0.12] dark:border-white/[0.06] shadow-sm'
          : 'border-[#0B3D6B]/[0.07] dark:border-white/[0.04]'
      }`}
    >
      <div className="mx-auto flex h-full max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link href="/" className="group flex shrink-0 items-center gap-2">
          <img src="/favicon.png" alt="EPIC Campus" className="h-7 w-7 rounded-md object-cover" />
          <span className="font-jakarta text-[15px] font-semibold text-[#0B3D6B] dark:text-white transition-colors">
            EPIC Campus
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-8 lg:flex">
          {NAV_LINKS.slice(0, 1).map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-[13px] font-medium transition-colors hover:text-[#0B3D6B] dark:hover:text-white ${
                pathname === link.href ? 'text-[#0B3D6B] dark:text-white' : 'text-gray-600 dark:text-white/60'
              }`}
            >
              {link.label}
            </Link>
          ))}

          {/* Programs dropdown */}
          <div
            className="relative"
            onMouseEnter={() => setProgramsOpen(true)}
            onMouseLeave={() => setProgramsOpen(false)}
          >
            <button
              type="button"
              className="flex items-center gap-1 text-[13px] font-medium text-gray-600 dark:text-white/60 transition-colors hover:text-[#0B3D6B] dark:hover:text-white"
            >
              Programs
              <span className="ti ti-chevron-down text-xs" />
            </button>
            {programsOpen && (
              <div className="absolute left-1/2 top-full -translate-x-1/2 pt-3">
                <div className="min-w-[200px] rounded-[14px] border border-[#0B3D6B]/[0.08] dark:border-white/[0.07] bg-white/90 dark:bg-[#0d1a2e]/90 backdrop-blur-2xl py-2 shadow-xl">
                  {PROGRAMS.map((p) =>
                    'external' in p && p.external ? (
                      <a
                        key={p.href}
                        href={p.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block px-5 py-2.5 text-[13px] text-gray-700 dark:text-white/70 transition-colors hover:bg-[#0B3D6B]/[0.05] dark:hover:bg-white/[0.05] hover:text-[#0B3D6B] dark:hover:text-white"
                      >
                        {p.label}
                      </a>
                    ) : (
                      <Link
                        key={p.href}
                        href={p.href}
                        className="block px-5 py-2.5 text-[13px] text-gray-700 dark:text-white/70 transition-colors hover:bg-[#0B3D6B]/[0.05] dark:hover:bg-white/[0.05] hover:text-[#0B3D6B] dark:hover:text-white"
                      >
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
              className={`text-[13px] font-medium transition-colors hover:text-[#0B3D6B] dark:hover:text-white ${
                pathname === link.href ? 'text-[#0B3D6B] dark:text-white' : 'text-gray-600 dark:text-white/60'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Desktop CTA */}
        <div className="hidden items-center gap-2 lg:flex">
          <DarkModeToggle />
          <Link
            href="/enroll"
            className="inline-flex items-center rounded-full border-[1.5px] border-[#E8A020] px-4 py-1.5 text-[12px] font-medium text-[#E8A020] transition-all hover:bg-[#E8A020] hover:text-white"
          >
            Enroll Now
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center rounded-full bg-[#0B3D6B] px-4 py-1.5 text-[12px] font-medium text-white transition-all hover:bg-[#0a3460]"
          >
            Login to Portal
          </Link>
        </div>

        {/* Mobile menu button */}
        <button
          type="button"
          className="rounded-lg p-2 text-[#0B3D6B] dark:text-white/70 lg:hidden"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
        >
          <span className={`ti ${mobileOpen ? 'ti-x' : 'ti-menu-2'} text-xl`} />
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="border-t border-[#0B3D6B]/[0.07] dark:border-white/[0.05] bg-white/95 dark:bg-[#080d18]/95 backdrop-blur-xl px-4 py-5 lg:hidden">
          <div className="mb-4 flex items-center justify-between rounded-xl bg-[#F5F7FB] dark:bg-white/[0.04] px-4 py-3">
            <span className="text-[13px] font-medium text-gray-700 dark:text-white/60">Theme</span>
            <DarkModeToggle />
          </div>
          <div className="space-y-1">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="block rounded-xl px-4 py-3 text-[13px] font-medium text-gray-800 dark:text-white/70 hover:bg-[#0B3D6B]/[0.05] dark:hover:bg-white/[0.05]"
              >
                {link.label}
              </Link>
            ))}
            <p className="px-4 pt-4 text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-white/30">
              Programs
            </p>
            {PROGRAMS.map((p) =>
              'external' in p && p.external ? (
                <a
                  key={p.href}
                  href={p.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block rounded-xl px-4 py-3 text-[13px] text-gray-800 dark:text-white/70 hover:bg-[#0B3D6B]/[0.05] dark:hover:bg-white/[0.05]"
                >
                  {p.label}
                </a>
              ) : (
                <Link
                  key={p.href}
                  href={p.href}
                  className="block rounded-xl px-4 py-3 text-[13px] text-gray-800 dark:text-white/70 hover:bg-[#0B3D6B]/[0.05] dark:hover:bg-white/[0.05]"
                >
                  {p.label}
                </Link>
              )
            )}
            <Link
              href="/enroll"
              className="mt-4 block rounded-full border-[1.5px] border-[#E8A020] px-6 py-3.5 text-center text-[13px] font-medium text-[#E8A020]"
            >
              Enroll Now
            </Link>
            <Link
              href="/login"
              className="mt-2 block rounded-full bg-[#0B3D6B] px-6 py-3.5 text-center text-[13px] font-semibold text-white"
            >
              Login to Portal
            </Link>
          </div>
        </div>
      )}
    </header>
  )
}
