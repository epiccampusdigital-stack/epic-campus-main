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
      <h2 className="font-jakarta text-4xl font-bold text-[#0B3D6B]">{title}</h2>
      <div className="mx-auto mt-4 h-1 w-16 rounded-full bg-[#E8A020]" />
      {subtitle && (
        <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-gray-600">
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
  { value: '15+', label: 'Years Experience' },
  { value: '1,500+', label: 'Students Placed' },
  { value: '98%', label: 'Visa Success' },
  { value: '50+', label: 'Partner Institutions' },
]

const PROGRAMS = [
  {
    flag: '🇯🇵',
    country: 'Japan',
    title: 'Japan SSW',
    description:
      'Work in Japan with the Specified Skilled Worker visa. No degree required. High-demand industries.',
    tags: ['Truck Driving', 'Construction', 'Caregiving'],
    href: '/japan',
  },
  {
    flag: '🇰🇷',
    country: 'Korea',
    title: 'Korea D2/D4',
    description:
      'Study at Korean universities with scholarship opportunities. Available after O/L or A/L.',
    tags: ['Engineering', 'Business', 'Arts'],
    href: '/korea',
  },
  {
    flag: '🇨🇳',
    country: 'China',
    title: 'China Programs',
    description:
      'World-class education with full & partial scholarships. Medicine, IT, Business programs available.',
    tags: ['Medicine', 'IT', 'Business'],
    href: '/china',
  },
  {
    flag: '🎓',
    country: 'English',
    title: 'IELTS Residential',
    description: 'Intensive 10-day residential IELTS program. Target band 6.0 to 7.0+',
    tags: ['Residential', 'Fast-track', 'Expert trainers'],
    href: '/ielts',
  },
  {
    flag: '📜',
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
      <section className="relative overflow-hidden pb-32 pt-20 text-white sm:pt-28">
        <div className="hero-gradient-animated absolute inset-0" />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />

        <div className="relative mx-auto max-w-6xl px-4 text-center sm:px-6 lg:px-8">
          <p className="font-jakarta text-xs font-semibold uppercase tracking-[0.35em] text-[#E8A020] sm:text-sm">
            We Create Your Future
          </p>
          <h1 className="mt-8 font-jakarta text-5xl font-normal leading-[1.1] sm:text-6xl lg:text-7xl">
            Your Future Has
            <br />
            <span className="font-bold text-[#E8A020]">No Limit.</span>
          </h1>
          <p className="mx-auto mt-8 max-w-2xl text-lg leading-relaxed text-white/80">
            Epic Campus opens doors to Japan, Korea, China and beyond. Study, work, and build
            your global career from Sri Lanka.
          </p>
          <div className="mt-12 flex flex-wrap items-center justify-center gap-4">
            <a
              href="#programs"
              className="inline-flex rounded-full bg-[#E8A020] px-8 py-4 font-semibold text-white transition-all duration-300 hover:bg-[#d4911c] hover:shadow-lg"
            >
              Explore Programs
            </a>
            <Link
              href="/login"
              className="inline-flex rounded-full border-2 border-white/80 px-8 py-4 font-semibold text-white transition-all duration-300 hover:bg-white/10"
            >
              Login to Portal
            </Link>
          </div>
        </div>

        {/* Floating stats strip */}
        <div className="relative z-10 mx-auto -mb-16 mt-20 max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 overflow-hidden rounded-2xl bg-white shadow-xl lg:grid-cols-4">
            {STATS.map((s, i) => (
              <div
                key={s.label}
                className={`px-6 py-10 text-center sm:px-8 sm:py-12 ${
                  i < STATS.length - 1 ? 'lg:border-r lg:border-gray-200' : ''
                } ${i % 2 === 0 ? 'border-r border-gray-200 lg:border-r' : ''} ${
                  i < 2 ? 'border-b border-gray-200 lg:border-b-0' : ''
                }`}
              >
                <p className="font-jakarta text-4xl font-black text-[#0B3D6B] sm:text-5xl">
                  {s.value}
                </p>
                <p className="mt-3 text-xs font-medium uppercase tracking-widest text-gray-500">
                  {s.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Programs */}
      <section id="programs" className="bg-[#F5F7FB] py-24 pt-32">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <SectionTitle
            title="Choose Your Path"
            subtitle="Six proven pathways to study and work abroad — each backed by Epic Campus training and visa support."
          />
          <div className="mt-16 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {PROGRAMS.map((p) => (
              <div
                key={p.href}
                className="flex flex-col rounded-2xl border border-white/10 bg-[#1a2744] p-8 transition-all duration-300 hover:-translate-y-1 hover:border-[#E8A020]/50 hover:shadow-lg"
              >
                <span className="mb-4 block text-center text-5xl">{p.flag}</span>
                <p className="mb-1 text-center text-xs uppercase tracking-widest text-gray-400">
                  {p.country}
                </p>
                <h3 className="mb-3 text-center text-xl font-bold text-white">{p.title}</h3>
                <p className="flex-1 text-center text-sm text-gray-300">{p.description}</p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  {p.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-white/10 px-3 py-1 text-xs text-gray-300"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <Link
                  href={p.href}
                  className="mt-6 text-center text-sm font-semibold text-[#E8A020] transition-colors hover:text-[#d4911c]"
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
      <section className="bg-white py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <SectionTitle
            title="From Dream to Departure"
            subtitle="A clear, guided pathway from your first consultation to boarding your flight abroad."
          />
          <div className="relative mt-20 hidden lg:block">
            <div className="absolute left-0 right-0 top-8 h-0.5 bg-gray-200" />
            <div className="relative grid grid-cols-5 gap-6">
              {STEPS.map((step, i) => (
                <div key={step.title} className="text-center">
                  <div className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-full border-[3px] border-[#E8A020] bg-white shadow-sm">
                    <span className="font-jakarta text-lg font-bold text-[#E8A020]">
                      {i + 1}
                    </span>
                  </div>
                  <p className="mt-6 font-jakarta text-sm font-semibold text-[#0B3D6B]">
                    {step.title}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-gray-500">
                    {step.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-12 space-y-10 lg:hidden">
            {STEPS.map((step, i) => (
              <div key={step.title} className="flex gap-5">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-[3px] border-[#E8A020] bg-white shadow-sm">
                  <span className="font-jakarta font-bold text-[#E8A020]">{i + 1}</span>
                </div>
                <div>
                  <p className="font-jakarta font-semibold text-[#0B3D6B]">{step.title}</p>
                  <p className="mt-1 text-sm text-gray-500">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why Epic Campus */}
      <section className="bg-[#F5F7FB] py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <SectionTitle title="Why Choose Epic Campus?" />
          <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="rounded-2xl border border-gray-100 bg-white p-8 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
              >
                <div
                  className={`flex h-14 w-14 items-center justify-center rounded-2xl ${f.bg}`}
                >
                  <span className={`ti ${f.icon} text-2xl ${f.iconColor}`} />
                </div>
                <h3 className="mt-6 font-jakarta text-lg font-bold text-[#0B3D6B]">
                  {f.title}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-gray-600">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="bg-white py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <SectionTitle title="Student Success Stories" />
          <div className="mt-16 grid gap-8 lg:grid-cols-3">
            {TESTIMONIALS.map((t) => (
              <blockquote
                key={t.name}
                className="flex flex-col rounded-2xl border border-gray-100 bg-white p-8 shadow-sm transition-all duration-300 hover:shadow-md"
              >
                <span className="font-serif text-5xl leading-none text-[#E8A020]">❝</span>
                <p className="mt-4 flex-1 text-sm italic leading-relaxed text-gray-700">
                  {t.quote}
                </p>
                <footer className="mt-8 flex items-center gap-4 border-t border-gray-100 pt-6">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#0B3D6B] font-jakarta text-sm font-bold text-white">
                    {getInitials(t.name)}
                  </div>
                  <div>
                    <p className="font-jakarta font-semibold text-[#0B3D6B]">{t.name}</p>
                    <p className="text-xs text-gray-500">{t.program}</p>
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
              href="/contact"
              className="inline-flex rounded-full bg-[#E8A020] px-8 py-4 font-semibold text-white transition-all hover:bg-[#d4911c] hover:shadow-lg"
            >
              Apply Now
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

      {/* Contact strip */}
      <section className="border-t border-gray-100 bg-[#F5F7FB] py-12">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-8 px-4 text-sm text-gray-600 sm:px-6">
          <span>📍 No. 59/2, Sri Dewamitta Road, China Garden, Galle</span>
          <a href="tel:+94912228383" className="transition-colors hover:text-[#0B3D6B]">
            📞 +94 91 222 83 83
          </a>
          <a href="mailto:info@epiccampus.lk" className="transition-colors hover:text-[#0B3D6B]">
            📧 info@epiccampus.lk
          </a>
          <div className="flex gap-4">
            {['ti-brand-facebook', 'ti-brand-instagram', 'ti-brand-tiktok'].map((icon) => (
              <span
                key={icon}
                className={`ti ${icon} text-xl text-[#0B3D6B]`}
                aria-hidden="true"
              />
            ))}
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  )
}
