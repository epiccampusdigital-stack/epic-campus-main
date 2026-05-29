import Link from 'next/link'

const PROGRAMS = [
  { label: 'Japan SSW', href: '/japan' },
  { label: 'Korea', href: '/korea' },
  { label: 'China', href: '/china' },
  { label: 'IELTS', href: '/ielts' },
  { label: 'NVQ', href: '/nvq' },
]

const SOCIAL = [
  {
    label: 'Facebook',
    href: 'https://www.facebook.com/epicschoolofcomputing',
    icon: 'ti-brand-facebook',
  },
  {
    label: 'Instagram',
    href: 'https://www.instagram.com/epiccampusdigital/',
    icon: 'ti-brand-instagram',
  },
  {
    label: 'TikTok',
    href: 'https://www.tiktok.com/@epic_campus',
    icon: 'ti-brand-tiktok',
  },
]

export default function PublicFooter() {
  return (
    <footer className="bg-[#0B3D6B] text-white">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="font-jakarta text-xl font-bold">
              <span className="text-[#1A6BAD]">EPIC</span> Campus
            </p>
            <p className="mt-2 text-sm text-white/70">We Create Your Future</p>
            <p className="mt-4 text-sm leading-relaxed text-white/60">
              Sri Lanka&apos;s trusted gateway to Japan, Korea, China and global careers since 2011.
            </p>
          </div>

          <div>
            <h3 className="font-jakarta text-sm font-semibold uppercase tracking-wide text-[#E8A020]">
              Programs
            </h3>
            <ul className="mt-4 space-y-2">
              {PROGRAMS.map((p) => (
                <li key={p.href}>
                  <Link
                    href={p.href}
                    className="text-sm text-white/75 transition-colors hover:text-white"
                  >
                    {p.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="font-jakarta text-sm font-semibold uppercase tracking-wide text-[#E8A020]">
              Company
            </h3>
            <ul className="mt-4 space-y-2">
              <li>
                <Link href="/about" className="text-sm text-white/75 hover:text-white">
                  About
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-sm text-white/75 hover:text-white">
                  Contact
                </Link>
              </li>
              <li>
                <Link href="/login" className="text-sm text-white/75 hover:text-white">
                  Login
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-jakarta text-sm font-semibold uppercase tracking-wide text-[#E8A020]">
              Contact
            </h3>
            <ul className="mt-4 space-y-2 text-sm text-white/75">
              <li>No. 59/2, Sri Dewamitta Road, China Garden, Galle</li>
              <li>
                <a href="tel:+94912228383" className="hover:text-white">
                  +94 91 222 83 83
                </a>
              </li>
              <li>
                <a href="mailto:info@epiccampus.lk" className="hover:text-white">
                  info@epiccampus.lk
                </a>
              </li>
            </ul>
            <div className="mt-4 flex gap-3">
              {SOCIAL.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={s.label}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-[#E8A020] hover:text-[#0B3D6B]"
                >
                  <span className={`ti ${s.icon} text-lg`} />
                </a>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-10 border-t border-white/10 pt-6 text-center text-sm text-white/50">
          © 2026 Epic Campus (Pvt) Ltd. All rights reserved.
        </div>
      </div>
    </footer>
  )
}
