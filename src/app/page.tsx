import Link from 'next/link'
import PublicNav from '@/components/public/PublicNav'
import PublicFooter from '@/components/public/PublicFooter'

const STATS = [
  { value: '15+', label: 'Years Experience' },
  { value: '1,500+', label: 'Students Placed' },
  { value: '98%', label: 'Visa Success' },
  { value: '50+', label: 'Partner Institutions' },
]

const PROGRAMS = [
  {
    flag: '🇯🇵',
    title: 'JAPAN SSW',
    description:
      'Work in Japan with the Specified Skilled Worker visa. No degree required. High-demand industries.',
    tags: ['Truck Driving', 'Construction', 'Caregiving'],
    href: '/japan',
  },
  {
    flag: '🇰🇷',
    title: 'KOREA D2/D4',
    description:
      'Study at Korean universities with scholarship opportunities. Available after O/L or A/L.',
    tags: ['Engineering', 'Business', 'Arts'],
    href: '/korea',
  },
  {
    flag: '🇨🇳',
    title: 'CHINA',
    description:
      'World-class education with full & partial scholarships. Medicine, IT, Business programs available.',
    tags: ['Medicine', 'IT', 'Business'],
    href: '/china',
  },
  {
    flag: '📝',
    title: 'IELTS',
    description: 'Intensive 10-day residential IELTS program. Target band 6.0 to 7.0+',
    tags: ['Residential', 'Fast-track', 'Expert trainers'],
    href: '/ielts',
  },
  {
    flag: '🎓',
    title: 'NVQ',
    description:
      'Nationally recognized vocational qualifications. IT, Hospitality, Caregiving, Construction.',
    tags: ['NVQ Level 3/4', 'TVEC Approved'],
    href: '/nvq',
  },
]

const STEPS = [
  { icon: 'ti-message-circle', title: 'Consultation & Assessment' },
  { icon: 'ti-book', title: 'Training & Language Preparation' },
  { icon: 'ti-file-text', title: 'Application & Documentation' },
  { icon: 'ti-passport', title: 'Visa Processing' },
  { icon: 'ti-plane-departure', title: 'Departure & Support' },
]

const FEATURES = [
  {
    title: '15+ Years Experience',
    desc: 'Established in 2011, trusted by thousands of Sri Lankan families.',
  },
  {
    title: 'TVEC Approved',
    desc: 'Nationally accredited institute with recognized qualifications.',
  },
  {
    title: 'End-to-End Support',
    desc: 'From training and documentation to departure and settlement guidance.',
  },
  {
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
      <section className="relative flex min-h-[90vh] flex-col justify-center overflow-hidden bg-gradient-to-br from-[#0B3D6B] via-[#0a3560] to-[#062847] text-white">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />
        <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <p className="font-jakarta text-sm font-semibold uppercase tracking-[0.2em] text-[#E8A020]">
            We Create Your Future
          </p>
          <h1 className="mt-4 font-jakarta text-4xl font-bold leading-tight sm:text-5xl lg:text-6xl">
            Your Future Has
            <br />
            <span className="text-[#E8A020]">No Limit</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-white/85">
            Epic Campus opens doors to Japan, Korea, China and beyond. Study, work, and build
            your global career from Sri Lanka.
          </p>
          <div className="mt-10 flex flex-wrap gap-4">
            <a
              href="#programs"
              className="rounded-lg bg-[#E8A020] px-8 py-3.5 font-jakarta text-sm font-bold text-[#0B3D6B] transition-transform hover:scale-[1.02]"
            >
              Explore Programs
            </a>
            <Link
              href="/login"
              className="rounded-lg border-2 border-white px-8 py-3.5 font-jakarta text-sm font-bold text-white transition-colors hover:bg-white/10"
            >
              Login to Portal
            </Link>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-b border-[#DDE3EC] bg-white">
        <div className="mx-auto grid max-w-7xl grid-cols-2 divide-x divide-[#DDE3EC] lg:grid-cols-4">
          {STATS.map((s) => (
            <div key={s.label} className="px-4 py-8 text-center sm:px-6">
              <p className="font-jakarta text-3xl font-bold text-[#0B3D6B]">{s.value}</p>
              <p className="mt-1 text-sm text-[#5A6A7A]">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Programs */}
      <section id="programs" className="py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-center font-jakarta text-3xl font-bold text-[#0B3D6B] sm:text-4xl">
            Choose Your Path
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-[#5A6A7A]">
            Five proven pathways to study and work abroad — each backed by Epic Campus training
            and visa support.
          </p>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {PROGRAMS.map((p) => (
              <article
                key={p.href}
                className="group flex flex-col rounded-2xl border border-[#DDE3EC] bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:border-[#E8A020]/40 hover:shadow-lg"
              >
                <span className="text-4xl">{p.flag}</span>
                <h3 className="mt-4 font-jakarta text-xl font-bold text-[#0B3D6B]">
                  {p.title}
                </h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-[#5A6A7A]">
                  {p.description}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {p.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-[#F5F7FB] px-2.5 py-0.5 text-xs font-medium text-[#0B3D6B]"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <Link
                  href={p.href}
                  className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-[#1A6BAD] group-hover:text-[#0B3D6B]"
                >
                  Learn More
                  <span className="ti ti-arrow-right text-sm transition-transform group-hover:translate-x-1" />
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-white py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-center font-jakarta text-3xl font-bold text-[#0B3D6B]">
            From Dream to Departure
          </h2>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
            {STEPS.map((step, i) => (
              <div key={step.title} className="relative text-center">
                {i < STEPS.length - 1 && (
                  <div className="absolute left-[calc(50%+28px)] top-7 hidden h-0.5 w-[calc(100%-56px)] bg-[#DDE3EC] lg:block" />
                )}
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#0B3D6B] text-white shadow-md">
                  <span className={`ti ${step.icon} text-2xl`} />
                </div>
                <p className="mt-1 text-xs font-bold text-[#E8A020]">Step {i + 1}</p>
                <p className="mt-2 font-jakarta text-sm font-semibold text-[#0D1B2A]">
                  {step.title}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why Epic Campus */}
      <section className="py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-center font-jakarta text-3xl font-bold text-[#0B3D6B]">
            Why Choose Epic Campus?
          </h2>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="rounded-2xl border border-[#DDE3EC] bg-white p-6 transition-shadow hover:shadow-md"
              >
                <span className="text-2xl text-[#E8A020]">✅</span>
                <h3 className="mt-3 font-jakarta font-bold text-[#0B3D6B]">{f.title}</h3>
                <p className="mt-2 text-sm text-[#5A6A7A]">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="bg-white py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-center font-jakarta text-3xl font-bold text-[#0B3D6B]">
            Student Success Stories
          </h2>
          <div className="mt-12 grid gap-6 lg:grid-cols-3">
            {TESTIMONIALS.map((t) => (
              <blockquote
                key={t.name}
                className="rounded-2xl border border-[#DDE3EC] bg-[#F5F7FB] p-6"
              >
                <div className="text-[#E8A020]">★★★★★</div>
                <p className="mt-4 text-sm leading-relaxed text-[#0D1B2A]">&ldquo;{t.quote}&rdquo;</p>
                <footer className="mt-4 border-t border-[#DDE3EC] pt-4">
                  <p className="font-jakarta font-semibold text-[#0B3D6B]">{t.name}</p>
                  <p className="text-xs text-[#5A6A7A]">{t.program}</p>
                </footer>
              </blockquote>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Banner */}
      <section className="bg-[#0B3D6B] py-16 text-white">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
          <h2 className="font-jakarta text-3xl font-bold">Ready to Start Your Journey?</h2>
          <p className="mt-4 text-white/80">
            Join 1,500+ Sri Lankan students who have built global careers with Epic Campus.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link
              href="/contact"
              className="rounded-lg bg-[#E8A020] px-8 py-3.5 font-jakarta text-sm font-bold text-[#0B3D6B]"
            >
              Apply Now
            </Link>
            <a
              href="tel:+94912228383"
              className="rounded-lg border-2 border-white px-8 py-3.5 font-jakarta text-sm font-bold text-white hover:bg-white/10"
            >
              Call Us
            </a>
          </div>
        </div>
      </section>

      {/* Contact strip */}
      <section className="border-t border-[#DDE3EC] bg-white py-8">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-6 px-4 text-sm text-[#5A6A7A] sm:gap-10 sm:px-6">
          <span>📍 No. 59/2, Sri Dewamitta Road, China Garden, Galle</span>
          <a href="tel:+94912228383" className="hover:text-[#0B3D6B]">
            📞 +94 91 222 83 83
          </a>
          <a href="mailto:info@epiccampus.lk" className="hover:text-[#0B3D6B]">
            📧 info@epiccampus.lk
          </a>
          <div className="flex gap-3">
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
