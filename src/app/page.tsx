'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import AnimatedCounter from '@/components/public/AnimatedCounter'

const ParticleHero = dynamic(() => import('@/components/public/ParticleHero'), { ssr: false })
const Globe3D = dynamic(() => import('@/components/public/Globe3D'), { ssr: false })

const COURSES = [
  {
    flag: '🇯🇵',
    country: 'Japan',
    title: 'Japan SSW Program',
    desc: 'Work in Japan through the Specified Skilled Worker program. No degree required.',
    tags: ['JLPT N4', 'SSW Visa', 'Truck Driving', 'Construction'],
    color: 'from-red-50 to-white dark:from-red-900/10',
    border: 'border-red-100 dark:border-red-800/30',
    accent: 'bg-red-500',
  },
  {
    flag: '🇰🇷',
    country: 'Korea',
    title: 'Korean Language Program',
    desc: 'Study at top Korean universities. D-4 to D-2 visa pathway with scholarships.',
    tags: ['TOPIK', 'D-4 Visa', 'Full Scholarship', 'University'],
    color: 'from-blue-50 to-white dark:from-blue-900/10',
    border: 'border-blue-100 dark:border-blue-800/30',
    accent: 'bg-blue-500',
  },
  {
    flag: '🇨🇳',
    country: 'China',
    title: 'Chinese Language Program',
    desc: 'Affordable world-class education with full scholarship opportunities.',
    tags: ['HSK', 'Full Scholarship', '4-Year Degree', 'Medicine'],
    color: 'from-yellow-50 to-white dark:from-yellow-900/10',
    border: 'border-yellow-100 dark:border-yellow-800/30',
    accent: 'bg-yellow-500',
  },
  {
    flag: '📝',
    country: 'IELTS',
    title: 'IELTS Residential',
    desc: 'Intensive 10-day residential IELTS program. Achieve your target band score.',
    tags: ['Band 6.0+', 'Residential', 'Mock Exams', 'Daily Training'],
    color: 'from-purple-50 to-white dark:from-purple-900/10',
    border: 'border-purple-100 dark:border-purple-800/30',
    accent: 'bg-purple-500',
  },
  {
    flag: '🎓',
    country: 'NVQ',
    title: 'NVQ & Skill Development',
    desc: 'Nationally recognized vocational qualifications for local and international jobs.',
    tags: ['NVQ Level 3', 'IT', 'Caregiving', 'Agriculture'],
    color: 'from-emerald-50 to-white dark:from-emerald-900/10',
    border: 'border-emerald-100 dark:border-emerald-800/30',
    accent: 'bg-emerald-500',
  },
]

const STATS = [
  { value: 1500, suffix: '+', label: 'Students Placed', icon: '👥' },
  { value: 98, suffix: '%', label: 'Visa Success Rate', icon: '✅' },
  { value: 50, suffix: '+', label: 'Partner Institutions', icon: '🏛️' },
  { value: 15, suffix: '+', label: 'Years Experience', icon: '⭐' },
]

const STEPS = [
  { step: '01', title: 'Consultation', desc: 'Meet our experts to choose the right pathway for your goals.' },
  { step: '02', title: 'Training', desc: 'Complete language and skill training at our campus.' },
  { step: '03', title: 'Application', desc: 'We handle all documentation and application processes.' },
  { step: '04', title: 'Visa Processing', desc: 'Expert handling with the highest visa success rate.' },
  { step: '05', title: 'Departure', desc: 'Pre-departure briefing and travel coordination.' },
  { step: '06', title: 'Settlement', desc: 'Continuous support after you arrive abroad.' },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-[#04090f] overflow-x-hidden">

      {/* Announcement Bar */}
      <div className="bg-gradient-to-r from-[#0B3D6B] to-[#1A6BAD] py-2.5 text-center text-xs font-semibold text-white">
        🎌 Now accepting applications for Batch 29 —{' '}
        <Link href="/enroll" className="underline text-[#E8A020] hover:text-yellow-300 transition-colors">
          Apply Now →
        </Link>
      </div>

      {/* Navbar */}
      <nav className="sticky top-0 z-50 border-b border-[#DDE3EC]/50 dark:border-white/[0.06] bg-white/80 dark:bg-[#04090f]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#0B3D6B] to-[#1A6BAD]">
              <span className="font-jakarta text-lg font-black text-white">E</span>
            </div>
            <div>
              <p className="font-jakarta text-lg font-black text-[#0B3D6B] dark:text-white leading-none">EPIC</p>
              <p className="text-[9px] font-bold text-[#E8A020] tracking-widest leading-none">CAMPUS</p>
            </div>
          </Link>

          <div className="hidden md:flex items-center gap-8 text-sm font-semibold text-[#5A6A7A] dark:text-white/60">
            <Link href="#courses" className="hover:text-[#0B3D6B] dark:hover:text-white transition-colors">Programs</Link>
            <Link href="#about" className="hover:text-[#0B3D6B] dark:hover:text-white transition-colors">About</Link>
            <Link href="#process" className="hover:text-[#0B3D6B] dark:hover:text-white transition-colors">Process</Link>
            <Link href="#contact" className="hover:text-[#0B3D6B] dark:hover:text-white transition-colors">Contact</Link>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/login"
              className="hidden sm:block rounded-xl border border-[#DDE3EC] dark:border-white/20 px-4 py-2 text-sm font-semibold text-[#0B3D6B] dark:text-white hover:bg-[#F5F7FB] dark:hover:bg-white/[0.04] transition-all">
              Login
            </Link>
            <Link href="/enroll"
              className="rounded-xl bg-gradient-to-r from-[#E8A020] to-[#c8891a] px-4 py-2 text-sm font-black text-[#0B3D6B] shadow-lg shadow-[#E8A020]/20 hover:shadow-xl hover:shadow-[#E8A020]/30 hover:-translate-y-0.5 transition-all">
              Apply Now
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-[90vh] flex items-center overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#F5F7FB] via-white to-blue-50/30 dark:from-[#04090f] dark:via-[#071428] dark:to-[#04090f]" />

        {/* Particle animation */}
        <ParticleHero />

        <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 py-20">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#E8A020]/30 bg-[#E8A020]/10 px-4 py-1.5 text-xs font-bold text-[#E8A020]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#E8A020] animate-pulse" />
                Sri Lanka&apos;s #1 Overseas Education Institute
              </div>

              <h1 className="font-jakarta text-5xl sm:text-6xl font-black leading-tight">
                <span className="text-[#0B3D6B] dark:text-white">Your Future</span>
                <br />
                <span className="bg-gradient-to-r from-[#E8A020] via-[#f0b030] to-[#E8A020] bg-clip-text text-transparent">
                  Has No Limit
                </span>
              </h1>

              <p className="text-lg text-[#5A6A7A] dark:text-white/60 max-w-lg leading-relaxed">
                We help Sri Lankan youth build global careers through world-class language training,
                visa support, and placement in Japan, Korea, and China.
              </p>

              <div className="flex flex-wrap gap-4">
                <Link href="/enroll"
                  className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-[#E8A020] to-[#c8891a] px-8 py-4 text-base font-black text-[#0B3D6B] shadow-lg shadow-[#E8A020]/30 hover:shadow-xl hover:shadow-[#E8A020]/40 hover:-translate-y-1 transition-all duration-200">
                  Start Your Journey
                  <span className="ti ti-arrow-right text-xl" />
                </Link>
                <Link href="#courses"
                  className="flex items-center gap-2 rounded-2xl border-2 border-[#0B3D6B] dark:border-white/20 px-8 py-4 text-base font-bold text-[#0B3D6B] dark:text-white hover:bg-[#0B3D6B] hover:text-white transition-all duration-200">
                  Explore Programs
                </Link>
              </div>

              <div className="flex flex-wrap gap-6 pt-4">
                {['🇯🇵 Japan SSW', '🇰🇷 Korea', '🇨🇳 China', '📝 IELTS'].map(dest => (
                  <span key={dest} className="text-sm font-semibold text-[#5A6A7A] dark:text-white/50">{dest}</span>
                ))}
              </div>
            </div>

            {/* Globe */}
            <div className="relative h-[500px] hidden lg:block">
              <Globe3D />
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="bg-gradient-to-r from-[#0B3D6B] to-[#1A6BAD] py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
            {STATS.map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-3xl mb-2">{stat.icon}</div>
                <p className="font-jakarta text-4xl font-black text-white">
                  <AnimatedCounter end={stat.value} suffix={stat.suffix} />
                </p>
                <p className="mt-1 text-sm font-semibold text-white/60">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Programs Section */}
      <section id="courses" className="py-24 bg-[#F5F7FB] dark:bg-[#04090f]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="text-center mb-16">
            <p className="text-sm font-bold text-[#E8A020] uppercase tracking-widest mb-3">Our Programs</p>
            <h2 className="font-jakarta text-4xl font-black text-[#0B3D6B] dark:text-white">
              Choose Your Destination
            </h2>
            <p className="mt-4 text-[#5A6A7A] dark:text-white/50 max-w-xl mx-auto">
              World-class training programs designed to get you working or studying abroad
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {COURSES.map((course) => (
              <div key={course.country}
                className={`group rounded-3xl border bg-gradient-to-br ${course.color} ${course.border} p-6 hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 cursor-pointer`}>
                <div className="flex items-start justify-between mb-4">
                  <span className="text-4xl group-hover:scale-110 transition-transform duration-300 inline-block">
                    {course.flag}
                  </span>
                  <div className={`h-2 w-2 rounded-full ${course.accent} animate-pulse`} />
                </div>
                <h3 className="font-jakarta text-xl font-bold text-[#0B3D6B] dark:text-white mb-2">
                  {course.title}
                </h3>
                <p className="text-sm text-[#5A6A7A] dark:text-white/50 mb-4 leading-relaxed">
                  {course.desc}
                </p>
                <div className="flex flex-wrap gap-2">
                  {course.tags.map(tag => (
                    <span key={tag} className="rounded-full bg-white/80 dark:bg-white/10 px-3 py-1 text-xs font-bold text-[#0B3D6B] dark:text-white/70">
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="mt-4 flex items-center gap-1 text-xs font-bold text-[#0B3D6B] dark:text-white/60 group-hover:text-[#E8A020] transition-colors">
                  Learn more <span className="ti ti-arrow-right group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Process Section */}
      <section id="process" className="py-24 bg-white dark:bg-[#071428]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="text-center mb-16">
            <p className="text-sm font-bold text-[#E8A020] uppercase tracking-widest mb-3">How It Works</p>
            <h2 className="font-jakarta text-4xl font-black text-[#0B3D6B] dark:text-white">
              From Dream to Departure
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {STEPS.map((step, i) => (
              <div key={step.step}
                className="group relative rounded-2xl border border-[#DDE3EC] dark:border-white/[0.08] bg-white dark:bg-white/[0.03] p-6 hover:border-[#E8A020]/50 hover:shadow-lg transition-all duration-300">
                <div className="font-jakarta text-5xl font-black text-[#DDE3EC] dark:text-white/10 mb-4 group-hover:text-[#E8A020]/20 transition-colors">
                  {step.step}
                </div>
                <h3 className="font-jakarta text-lg font-bold text-[#0B3D6B] dark:text-white mb-2">{step.title}</h3>
                <p className="text-sm text-[#5A6A7A] dark:text-white/50">{step.desc}</p>
                {i < STEPS.length - 1 && (
                  <div className="hidden lg:block absolute -right-3 top-1/2 -translate-y-1/2 z-10">
                    <span className="ti ti-chevron-right text-[#DDE3EC] dark:text-white/20 text-xl" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-gradient-to-br from-[#0B3D6B] to-[#071428] relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <ParticleHero />
        </div>
        <div className="relative z-10 mx-auto max-w-3xl px-4 sm:px-6 text-center space-y-8">
          <h2 className="font-jakarta text-4xl sm:text-5xl font-black text-white">
            Ready to Build Your
            <span className="bg-gradient-to-r from-[#E8A020] to-[#f0b030] bg-clip-text text-transparent"> Global Future?</span>
          </h2>
          <p className="text-lg text-white/60">
            Join 1,500+ Sri Lankan students who have successfully built careers abroad with EPIC Campus.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/enroll"
              className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-[#E8A020] to-[#c8891a] px-10 py-4 text-lg font-black text-[#0B3D6B] shadow-2xl shadow-[#E8A020]/30 hover:shadow-[#E8A020]/50 hover:-translate-y-1 transition-all duration-200">
              Apply for Batch 29
              <span className="ti ti-arrow-right text-xl" />
            </Link>
            <Link href="/login"
              className="flex items-center gap-2 rounded-2xl border-2 border-white/20 px-10 py-4 text-lg font-bold text-white hover:bg-white/10 transition-all duration-200">
              Student Login
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer id="contact" className="bg-[#04090f] py-16 border-t border-white/[0.06]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="grid grid-cols-1 gap-12 md:grid-cols-4">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#0B3D6B] to-[#1A6BAD]">
                  <span className="font-jakarta text-lg font-black text-white">E</span>
                </div>
                <div>
                  <p className="font-jakarta text-lg font-black text-white leading-none">EPIC</p>
                  <p className="text-[9px] font-bold text-[#E8A020] tracking-widest leading-none">CAMPUS</p>
                </div>
              </div>
              <p className="text-sm text-white/40 leading-relaxed">
                Sri Lanka&apos;s trusted gateway to global education and employment opportunities.
              </p>
              <div className="flex gap-3">
                {[
                  { icon: 'ti-brand-facebook', href: 'https://facebook.com/epicschoolofcomputing' },
                  { icon: 'ti-brand-instagram', href: 'https://instagram.com/epiccampusdigital' },
                  { icon: 'ti-brand-tiktok', href: 'https://tiktok.com/@epic_campus' },
                ].map(s => (
                  <a key={s.icon} href={s.href} target="_blank" rel="noopener noreferrer"
                    className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.06] text-white/50 hover:bg-[#E8A020]/20 hover:text-[#E8A020] transition-all">
                    <span className={`ti ${s.icon} text-lg`} />
                  </a>
                ))}
              </div>
            </div>

            {[
              {
                title: 'Programs',
                links: ['Japan SSW', 'Korean Language', 'Chinese Language', 'IELTS Residential', 'NVQ Programs'],
              },
              {
                title: 'Company',
                links: ['About Us', 'Our Team', 'Facilities', 'Success Stories', 'Partner With Us'],
              },
              {
                title: 'Contact',
                links: [
                  'No. 59/2, Sri Dewamitta Road',
                  'China Garden, Galle',
                  '+94 91 222 83 83',
                  'info@epiccampus.lk',
                  'www.epiccampus.live',
                ],
              },
            ].map(col => (
              <div key={col.title} className="space-y-4">
                <h4 className="font-jakarta font-bold text-white">{col.title}</h4>
                <ul className="space-y-2">
                  {col.links.map(link => (
                    <li key={link}>
                      <span className="text-sm text-white/40 hover:text-white/70 transition-colors cursor-pointer">{link}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-12 border-t border-white/[0.06] pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-white/30">© {new Date().getFullYear()} EPIC Campus (Pvt) Ltd. All rights reserved.</p>
            <p className="text-xs text-white/30">TVEC Approved · Company No. PV 00265988</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
