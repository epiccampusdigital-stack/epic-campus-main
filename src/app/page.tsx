import Link from 'next/link'
import PublicNav from '@/components/public/PublicNav'
import PublicFooter from '@/components/public/PublicFooter'
import OnlineTradingCard from '@/components/public/OnlineTradingCard'

function SectionTitle({
  title,
  subtitle,
}: {
  title: string
  subtitle?: string
}) {
  return (
    <div className="text-center">
      <h2 className="font-jakarta text-4xl font-bold text-[#0B3D6B] dark:text-white">{title}</h2>
      <div className="mx-auto mt-4 h-1 w-16 rounded-full bg-[#E8A020]" />
      {subtitle && (
        <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-gray-600 dark:text-white/60">
          {subtitle}
        </p>
      )}
    </div>
  )
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

const STATS = [
  { value: '1,500+', label: 'Students Placed' },
  { value: '15 Years', label: 'Since 2011' },
  { value: '98%', label: 'Visa Success Rate' },
  { value: '50+', label: 'Partner Companies' },
]

const PROGRAMS = [
  {
    accentStyle: { background: 'linear-gradient(90deg, #bc002d, #0B3D6B)' },
    country: 'Japan',
    title: 'Japan SSW',
    description:
      'Work in Japan with the Specified Skilled Worker visa. No degree required. High-demand industries.',
    tags: ['Truck Driving', 'Construction', 'Caregiving'],
    href: '/japan',
  },
  {
    accentStyle: { background: 'linear-gradient(90deg, #003478, #cd2e3a)' },
    country: 'Korea',
    title: 'Korea D2/D4',
    description:
      'Study at Korean universities with scholarship opportunities. Available after O/L or A/L.',
    tags: ['Engineering', 'Business', 'Arts'],
    href: '/korea',
  },
  {
    accentStyle: { background: 'linear-gradient(90deg, #de2910, #ffde00)' },
    country: 'China',
    title: 'China Programs',
    description:
      'World-class education with full & partial scholarships. Medicine, IT, Business programs available.',
    tags: ['Medicine', 'IT', 'Business'],
    href: '/china',
  },
  {
    accentStyle: { background: 'linear-gradient(90deg, #003087, #CF142B)' },
    country: 'English',
    title: 'IELTS Residential',
    description: 'Intensive 10-day residential IELTS program. Target band 6.0 to 7.0+',
    tags: ['Residential', 'Fast-track', 'Expert trainers'],
    href: '/ielts',
  },
  {
    accentStyle: { background: 'linear-gradient(90deg, #0B3D6B, #E8A020)' },
    country: 'Sri Lanka',
    title: 'NVQ Qualifications',
    description:
      'Nationally recognized vocational qualifications. IT, Hospitality, Caregiving, Construction.',
    tags: ['NVQ Level 3/4', 'TVEC Approved'],
    href: '/nvq',
  },
]

const STEPS = [
  {
    title: 'Consultation & Assessment',
    description: 'Personal guidance to identify the right program for your goals and eligibility.',
  },
  {
    title: 'Training & Language Preparation',
    description: 'Expert-led language and skills training tailored to your destination country.',
  },
  {
    title: 'Application & Documentation',
    description: 'Complete support preparing applications, transcripts, and required documents.',
  },
  {
    title: 'Visa Processing',
    description: 'End-to-end visa guidance with our experienced documentation team.',
  },
  {
    title: 'Departure & Support',
    description: 'Pre-departure briefing and ongoing support as you begin your global journey.',
  },
]

const FEATURES = [
  {
    icon: 'ti-award',
    bg: 'bg-blue-50',
    iconColor: 'text-[#1A6BAD]',
    title: '15+ Years Experience',
    desc: 'Established in 2011, trusted by thousands of Sri Lankan families.',
  },
  {
    icon: 'ti-certificate',
    bg: 'bg-amber-50',
    iconColor: 'text-[#E8A020]',
    title: 'TVEC Approved',
    desc: 'Nationally accredited institute with recognized qualifications.',
  },
  {
    icon: 'ti-route',
    bg: 'bg-emerald-50',
    iconColor: 'text-emerald-600',
    title: 'End-to-End Support',
    desc: 'From training and documentation to departure and settlement guidance.',
  },
  {
    icon: 'ti-chart-line',
    bg: 'bg-violet-50',
    iconColor: 'text-violet-600',
    title: '98% Success Rate',
    desc: 'Proven visa placement record across Japan, Korea, and China programs.',
  },
]

const TESTIMONIALS = [
  {
    quote:
      "Epic Campus changed my life. I'm now working in Japan earning 5x what I made in Sri Lanka.",
    name: 'Kasun Perera',
    program: 'Japan SSW Graduate',
  },
  {
    quote:
      'The Korean language classes and visa support were exceptional. I got into my dream university.',
    name: 'Dilini Fernando',
    program: 'Korea D2 Student',
  },
  {
    quote:
      'The IELTS residential program got me from 5.5 to 7.0 in just 3 weeks. Incredible results.',
    name: 'Nuwan Silva',
    program: 'IELTS Graduate',
  },
]

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <PublicNav />

      {/* Hero */}
      <section className="relative overflow-hidden pb-32 pt-20 sm:pt-28" style={{ background: 'linear-gradient(135deg, #0B3D6B 0%, #1A6BAD 50%, #0B3D6B 100%)' }}>
        {/* Glowing blobs */}
        <div
          className="pointer-events-none absolute -left-20 top-10 h-72 w-72 rounded-full opacity-30"
          style={{ background: '#E8A020', filter: 'blur(60px)' }}
        />
        <div
          className="pointer-events-none absolute -right-20 bottom-10 h-80 w-80 rounded-full opacity-20"
          style={{ background: '#1A6BAD', filter: 'blur(60px)' }}
        />

        <div className="relative mx-auto max-w-6xl px-4 text-center sm:px-6 lg:px-8">
          <p className="font-jakarta text-xs font-semibold uppercase tracking-[0.35em] text-[#E8A020] sm:text-sm">
            Japan · Korea · China · IELTS · NVQ
          </p>
          <h1 className="mt-6 font-jakarta leading-[1.1]">
            <span className="block text-[28px] font-semibold text-white sm:text-[42px] lg:text-[52px]">Your Future</span>
            <span className="block text-[28px] font-bold text-[#E8A020] sm:text-[42px] lg:text-[52px]">Starts Here</span>
          </h1>
          <p className="mx-auto mt-6 max-w-md text-[13px] leading-relaxed text-white/70 sm:text-[15px]">
            Epic Campus opens doors to Japan, Korea, China and beyond. Study, work, and build
            your global career from Sri Lanka.
          </p>
          <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:flex-wrap sm:justify-center sm:gap-4">
            <a
              href="#programs"
              className="inline-flex rounded-full bg-[#E8A020] px-6 py-3 font-semibold text-[#0B3D6B] transition-all duration-300 hover:bg-[#F5B942] hover:shadow-lg"
            >
              Explore Programs
            </a>
            <Link
              href="/login"
              className="inline-flex rounded-full border border-white/25 bg-white/15 px-6 py-3 font-semibold text-white backdrop-blur-sm transition-all duration-300 hover:bg-white/20"
            >
              Login to Portal
            </Link>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="relative z-10 mx-auto -mb-16 mt-20 max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 overflow-hidden rounded-2xl bg-white shadow-xl lg:grid-cols-4">
            {STATS.map((s, i) => (
              <div
                key={s.label}
                className={`px-6 py-8 text-center sm:px-8 sm:py-10 ${
                  i < STATS.length - 1 ? 'lg:border-r lg:border-gray-100' : ''
                } ${i % 2 === 0 ? 'border-r border-gray-100 lg:border-r' : ''} ${
                  i < 2 ? 'border-b border-gray-100 lg:border-b-0' : ''
                }`}
              >
                <p className="font-jakarta text-[16px] font-black text-[#0B3D6B] sm:text-[22px] lg:text-4xl">
                  {s.value}
                </p>
                <p className="mt-2 text-xs font-medium uppercase tracking-widest text-gray-500">
                  {s.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Programs */}
      <section id="programs" className="bg-[#F5F7FB] dark:bg-[#080d18] py-24 pt-32 transition-colors duration-300">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <SectionTitle
            title="Choose Your Path"
            subtitle="Five proven pathways to study and work abroad — each backed by Epic Campus training and visa support."
          />
          <div className="mt-16 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {PROGRAMS.map((p) => (
              <div
                key={p.href}
                className="flex flex-col rounded-[14px] border border-[#0B3D6B]/[0.08] dark:border-white/[0.07] bg-white dark:bg-white/[0.04] p-5 transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_12px_32px_rgba(11,61,107,0.1)] cursor-pointer"
              >
                {/* Colored accent bar */}
                <div
                  className="mb-4 h-[3px] w-full rounded-[3px]"
                  style={p.accentStyle}
                />
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-400 dark:text-white/40">
                  {p.country}
                </p>
                <h3 className="mt-1 text-[15px] font-semibold text-[#0B3D6B] dark:text-white">
                  {p.title}
                </h3>
                <p className="mt-2 flex-1 text-[12px] leading-relaxed text-gray-500 dark:text-white/55">
                  {p.description}
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {p.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-[8px] bg-[#0B3D6B]/[0.06] dark:bg-white/[0.06] px-2 py-0.5 text-[10px] font-medium text-[#0B3D6B] dark:text-white/70"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <Link
                  href={p.href}
                  className="mt-4 text-[12px] font-semibold text-[#E8A020] transition-colors hover:text-[#d4911c]"
                >
                  Learn More →
                </Link>
              </div>
            ))}
            <OnlineTradingCard />
          </div>
        </div>
      </section>

      {/* Process */}
      <section className="bg-white dark:bg-[#0d1a2e] py-24 transition-colors duration-300">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <SectionTitle
            title="From Dream to Departure"
            subtitle="A clear, guided pathway from your first consultation to boarding your flight abroad."
          />
          <div className="relative mt-20 hidden lg:block">
            <div className="absolute left-0 right-0 top-8 h-0.5 bg-gray-200 dark:bg-white/10" />
            <div className="relative grid grid-cols-5 gap-6">
              {STEPS.map((step, i) => (
                <div key={step.title} className="text-center">
                  <div className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-full border-[3px] border-[#E8A020] bg-white dark:bg-[#0d1a2e] shadow-sm">
                    <span className="font-jakarta text-lg font-bold text-[#E8A020]">
                      {i + 1}
                    </span>
                  </div>
                  <p className="mt-6 font-jakarta text-sm font-semibold text-[#0B3D6B] dark:text-white">
                    {step.title}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-gray-500 dark:text-white/50">
                    {step.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-12 space-y-10 lg:hidden">
            {STEPS.map((step, i) => (
              <div key={step.title} className="flex gap-5">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-[3px] border-[#E8A020] bg-white dark:bg-[#0d1a2e] shadow-sm">
                  <span className="font-jakarta font-bold text-[#E8A020]">{i + 1}</span>
                </div>
                <div>
                  <p className="font-jakarta font-semibold text-[#0B3D6B] dark:text-white">{step.title}</p>
                  <p className="mt-1 text-sm text-gray-500 dark:text-white/50">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why Epic Campus */}
      <section className="bg-[#F5F7FB] dark:bg-[#080d18] py-24 transition-colors duration-300">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <SectionTitle title="Why Choose Epic Campus?" />
          <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="rounded-2xl border border-gray-100 dark:border-white/[0.07] bg-white dark:bg-white/[0.04] p-8 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
              >
                <div
                  className={`flex h-14 w-14 items-center justify-center rounded-2xl ${f.bg}`}
                >
                  <span className={`ti ${f.icon} text-2xl ${f.iconColor}`} />
                </div>
                <h3 className="mt-6 font-jakarta text-lg font-bold text-[#0B3D6B] dark:text-white">
                  {f.title}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-gray-600 dark:text-white/55">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="bg-white dark:bg-[#0d1a2e] py-24 transition-colors duration-300">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <SectionTitle title="Student Success Stories" />
          <div className="mt-16 grid gap-8 lg:grid-cols-3">
            {TESTIMONIALS.map((t) => (
              <blockquote
                key={t.name}
                className="flex flex-col rounded-2xl border border-gray-100 dark:border-white/[0.07] bg-white dark:bg-white/[0.04] p-8 shadow-sm transition-all duration-300 hover:shadow-md"
              >
                <span className="font-serif text-5xl leading-none text-[#E8A020]">❝</span>
                <p className="mt-4 flex-1 text-sm italic leading-relaxed text-gray-700 dark:text-white/60">
                  {t.quote}
                </p>
                <footer className="mt-8 flex items-center gap-4 border-t border-gray-100 dark:border-white/[0.06] pt-6">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#0B3D6B] font-jakarta text-sm font-bold text-white">
                    {getInitials(t.name)}
                  </div>
                  <div>
                    <p className="font-jakarta font-semibold text-[#0B3D6B] dark:text-white">{t.name}</p>
                    <p className="text-xs text-gray-500 dark:text-white/40">{t.program}</p>
                  </div>
                </footer>
              </blockquote>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Banner */}
      <section className="bg-[#0B3D6B] py-24 text-white">
        <div className="mx-auto max-w-6xl px-4 text-center sm:px-6">
          <h2 className="font-jakarta text-4xl font-bold">Ready to Start Your Journey?</h2>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-white/80">
            Join 1,500+ Sri Lankan students who have built global careers with Epic Campus.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <Link
              href="/enroll"
              className="inline-flex items-center gap-2 rounded-full bg-[#E8A020] px-8 py-4 font-semibold text-white transition-all hover:bg-[#d4911c] hover:shadow-lg"
            >
              <span>Enroll Now</span>
              <span className="ti ti-arrow-right" />
            </Link>
            <a
              href="tel:+94912228383"
              className="inline-flex rounded-full border-2 border-white/80 px-8 py-4 font-semibold text-white transition-all hover:bg-white/10"
            >
              Call Us
            </a>
          </div>
        </div>
      </section>

      {/* Enroll Now CTA */}
      <section className="bg-white dark:bg-[#0d1a2e] py-20 transition-colors duration-300">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-[#0B3D6B] to-[#1A6BAD] p-10 sm:p-14">
            <div className="flex flex-col items-center gap-6 text-center lg:flex-row lg:text-left">
              <div className="flex-1 text-white">
                <h2 className="font-jakarta text-3xl font-bold sm:text-4xl">
                  Apply Online in Minutes
                </h2>
                <p className="mt-4 max-w-xl text-base text-white/75">
                  Complete our simple enrollment form, choose your program, and pay securely with
                  Stripe. Your student account will be created within 24 hours.
                </p>
                <ul className="mt-5 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-white/80 lg:justify-start">
                  {['3 simple steps', 'Secure online payment', 'Account in 24 hours'].map(
                    (item) => (
                      <li key={item} className="flex items-center gap-1.5">
                        <span className="ti ti-check text-[#E8A020]" />
                        {item}
                      </li>
                    ),
                  )}
                </ul>
              </div>
              <Link
                href="/enroll"
                className="shrink-0 rounded-2xl bg-[#E8A020] px-10 py-4 font-jakarta font-bold text-white shadow-lg transition-all hover:bg-[#d4911c] hover:shadow-xl"
              >
                Enroll Now →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Contact strip */}
      <section className="border-t border-gray-100 dark:border-white/[0.06] bg-[#F5F7FB] dark:bg-[#080d18] py-12 transition-colors duration-300">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-8 px-4 text-sm text-gray-600 dark:text-white/50 sm:px-6">
          <span>No. 59/2, Sri Dewamitta Road, China Garden, Galle</span>
          <a href="tel:+94912228383" className="transition-colors hover:text-[#0B3D6B] dark:hover:text-white">
            +94 91 222 83 83
          </a>
          <a href="mailto:info@epiccampus.lk" className="transition-colors hover:text-[#0B3D6B] dark:hover:text-white">
            info@epiccampus.lk
          </a>
        </div>
      </section>

      <PublicFooter />
    </div>
  )
}
