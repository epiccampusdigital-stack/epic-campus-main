'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import PublicNav from '@/components/public/PublicNav'
import PublicFooter from '@/components/public/PublicFooter'

interface Course {
  flag: string
  flagClass: string
  title: string
  desc: string
  tags: string[]
  href: string
  comingSoon?: boolean
}

const COURSES: Course[] = [
  {
    flag: 'JP',
    flagClass: 'bg-[#0B3D6B]/10 text-[#0B3D6B] dark:bg-[#0B3D6B]/30 dark:text-blue-300',
    title: 'Japan SSW Program',
    desc: 'Work in Japan through the Specified Skilled Worker program. No university degree required for most categories.',
    tags: ['JLPT N4', 'SSW Visa', 'No degree required'],
    href: '/japan',
  },
  {
    flag: 'KR',
    flagClass: 'bg-[#0B3D6B]/10 text-[#0B3D6B] dark:bg-[#0B3D6B]/30 dark:text-blue-300',
    title: 'Korean Language Program',
    desc: 'Study at top Korean universities with full and partial scholarship opportunities.',
    tags: ['TOPIK', 'D-4 Visa', 'Scholarship'],
    href: '/korea',
  },
  {
    flag: 'CN',
    flagClass: 'bg-[#0B3D6B]/10 text-[#0B3D6B] dark:bg-[#0B3D6B]/30 dark:text-blue-300',
    title: 'Chinese Language Program',
    desc: 'Affordable world-class education with full scholarships covering tuition and accommodation.',
    tags: ['HSK', 'Full Scholarship', '4-Year Degree'],
    href: '/china',
  },
  {
    flag: 'IELTS',
    flagClass: 'bg-[#E8A020] text-white',
    title: 'IELTS Residential',
    desc: 'Intensive residential IELTS program. Daily training in all four skills with personalized guidance.',
    tags: ['Band 6.0+', 'Residential', '10 Days'],
    href: '/ielts',
  },
  {
    flag: 'NVQ',
    flagClass: 'bg-emerald-600 text-white',
    title: 'NVQ & Skill Development',
    desc: 'Nationally recognized vocational qualifications for local and international job markets.',
    tags: ['NVQ Level 3', 'IT', 'Caregiving'],
    href: '/nvq',
  },
  {
    flag: 'AI',
    flagClass: 'bg-indigo-600 text-white',
    title: 'NVQ AI Program',
    desc: 'First AI-integrated NVQ program in Sri Lanka — pioneered by EPIC Campus. Combining vocational skills with artificial intelligence.',
    tags: ['First in Sri Lanka', 'AI Integration', 'Coming Soon'],
    href: '#',
    comingSoon: true,
  },
]

const STEPS = [
  { n: '01', title: 'Consultation', desc: 'Meet our experts to choose the right pathway.' },
  { n: '02', title: 'Training', desc: 'Language and skill training at our campus.' },
  { n: '03', title: 'Documentation', desc: 'We prepare all required application documents.' },
  { n: '04', title: 'Visa Processing', desc: 'Expert handling for the highest approval rate.' },
  { n: '05', title: 'Departure', desc: 'Pre-departure orientation and travel coordination.' },
  { n: '06', title: 'Settlement', desc: 'Continuous support after you arrive abroad.' },
]

const TIMELINE_STEPS = [
  { n: 1, title: 'Consult', desc: 'Meet our counsellors and find your best pathway' },
  { n: 2, title: 'Train', desc: 'Language and skill training at EPIC Campus' },
  { n: 3, title: 'Exam', desc: 'Sit your JLPT, TOPIK, IELTS or skills exam' },
  { n: 4, title: 'Apply', desc: 'We handle your visa application end-to-end' },
  { n: 5, title: 'Depart', desc: 'Fly to Japan, Korea, China or beyond' },
]

function HowItWorksTimeline() {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6">
      <div className="mb-16 text-center">
        <p className="mb-3 text-[11px] font-bold uppercase tracking-[4px] text-[#E8A020]">How it works</p>
        <h2 className="font-jakarta text-[40px] font-black text-[#0B3D6B] dark:text-white">
          From first consultation to your flight — we guide every step
        </h2>
      </div>

      {/* Desktop: horizontal timeline */}
      <div className="relative hidden lg:block">
        <div className="absolute left-0 right-0 top-6 h-[2px] bg-gradient-to-r from-[#0B3D6B] to-[#E8A020]" />
        <div className="relative grid grid-cols-5 gap-4">
          {TIMELINE_STEPS.map(step => (
            <div key={step.n} className="group flex flex-col items-center text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#0B3D6B] font-jakarta text-[16px] font-black text-white ring-0 ring-[#E8A020] transition-all duration-200 group-hover:ring-4">
                {step.n}
              </div>
              <h3 className="mt-5 font-jakarta text-[16px] font-bold text-[#0B1220] dark:text-white">{step.title}</h3>
              <p className="mt-2 max-w-[180px] text-[13px] leading-relaxed text-gray-500 dark:text-white/40">{step.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Mobile/tablet: vertical timeline */}
      <div className="lg:hidden">
        {TIMELINE_STEPS.map((step, i) => (
          <div key={step.n} className="relative flex gap-5 pb-10 last:pb-0">
            {i < TIMELINE_STEPS.length - 1 && (
              <div className="absolute left-6 top-12 h-full w-[2px] bg-gradient-to-b from-[#0B3D6B] to-[#E8A020]" />
            )}
            <div className="z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#0B3D6B] font-jakarta text-[16px] font-black text-white">
              {step.n}
            </div>
            <div className="pt-2">
              <h3 className="font-jakarta text-[16px] font-bold text-[#0B1220] dark:text-white">{step.title}</h3>
              <p className="mt-1 text-[13px] leading-relaxed text-gray-500 dark:text-white/40">{step.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function AnimatedStat({ end, suffix = '', duration = 1800 }: { end: number; suffix?: string; duration?: number }) {
  const [count, setCount] = useState(0)
  const hasAnimated = useRef(false)
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || hasAnimated.current) return
        hasAnimated.current = true
        let startTime: number | null = null
        function animate(ts: number) {
          if (!startTime) startTime = ts
          const progress = Math.min((ts - startTime) / duration, 1)
          const eased = 1 - Math.pow(1 - progress, 3)
          setCount(Math.floor(eased * end))
          if (progress < 1) requestAnimationFrame(animate)
          else setCount(end)
        }
        requestAnimationFrame(animate)
      },
      { threshold: 0.5 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [end, duration])

  return <span ref={ref} className="tabular-nums">{count.toLocaleString()}{suffix}</span>
}

function HeroParticles() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const isDarkRef = useRef(true)
  const [isDark, setIsDark] = useState(true)

  // Track theme so the canvas can restyle without restarting the animation.
  useEffect(() => {
    function syncTheme() {
      const dark = document.documentElement.classList.contains('dark')
      isDarkRef.current = dark
      setIsDark(dark)
    }
    syncTheme()
    const observer = new MutationObserver(syncTheme)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = canvas.offsetWidth
    canvas.height = canvas.offsetHeight

    const particleCount = window.innerWidth < 768 ? 80 : 160
    const particles: { x: number; y: number; vx: number; vy: number; r: number; a: number; va: number }[] = []
    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.32,
        vy: (Math.random() - 0.5) * 0.32,
        r: Math.random() * 2.5 + 0.6,
        a: Math.random() * 0.5 + 0.25,
        va: (Math.random() - 0.5) * 0.005,
      })
    }

    let animId: number
    function draw() {
      if (!ctx || !canvas) return
      const dark = isDarkRef.current
      const rgb = dark ? '232,160,32' : '11,61,107'
      const alphaScale = dark ? 1 : 0.5
      const lineBaseAlpha = dark ? 0.14 : 0.08

      ctx.clearRect(0, 0, canvas.width, canvas.height)
      particles.forEach(p => {
        p.x += p.vx
        p.y += p.vy
        p.a += p.va
        if (p.a <= 0.2 || p.a >= 0.8) p.va *= -1
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${rgb},${p.a * alphaScale})`
        ctx.fill()
      })
      // Connect nearby particles with faint lines
      particles.forEach((a, i) => {
        particles.slice(i + 1).forEach(b => {
          const d = Math.hypot(a.x - b.x, a.y - b.y)
          if (d < 80) {
            ctx.beginPath()
            ctx.moveTo(a.x, a.y)
            ctx.lineTo(b.x, b.y)
            ctx.strokeStyle = `rgba(${rgb},${lineBaseAlpha * (1 - d / 80)})`
            ctx.lineWidth = 0.5
            ctx.stroke()
          }
        })
      })
      animId = requestAnimationFrame(draw)
    }
    draw()
    return () => cancelAnimationFrame(animId)
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 z-[1] h-full w-full pointer-events-none"
      style={{ opacity: isDark ? 0.85 : 0.4 }}
    />
  )
}

export default function HomePage() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-white dark:bg-[#04090f]">
      <PublicNav />

      {/* ── HERO ── */}
      <section className="relative flex min-h-[92vh] items-center justify-center overflow-hidden bg-[#F8FAFC] dark:bg-[#03080f] pt-24 pb-16 sm:pt-0 sm:pb-0">
        <HeroParticles />
        {/* Grid — light mode */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(11,61,107,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(11,61,107,0.06)_1px,transparent_1px)] bg-[size:40px_40px] dark:hidden" />
        {/* Grid — dark mode */}
        <div className="absolute inset-0 hidden bg-[linear-gradient(rgba(26,107,173,0.07)_1px,transparent_1px),linear-gradient(90deg,rgba(26,107,173,0.07)_1px,transparent_1px)] bg-[size:40px_40px] dark:block" />
        {/* Center glow */}
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(11,61,107,0.45)_0%,transparent_70%)] opacity-0 dark:opacity-100" />
        {/* Side glows */}
        <div className="pointer-events-none absolute -left-32 top-1/2 h-[400px] w-[400px] -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(232,160,32,0.04)_0%,transparent_70%)] opacity-0 dark:opacity-100" />

        {/* Floating ghost numbers */}
        {[
          { text: '1,500+', top: '12%', left: '6%', delay: '0s' },
          { text: '98%', top: '72%', left: '4%', delay: '1.2s' },
          { text: '15yr', top: '15%', right: '5%', delay: '0.6s' },
          { text: '50+', top: '68%', right: '6%', delay: '1.8s' },
          { text: 'Japan', top: '30%', left: '2%', delay: '0.3s' },
          { text: 'Korea', top: '55%', right: '3%', delay: '0.9s' },
        ].map((f, i) => (
          <div
            key={i}
            className="pointer-events-none absolute font-jakarta font-black text-white/[0.04] select-none"
            style={{
              top: f.top,
              left: 'left' in f ? f.left : undefined,
              right: 'right' in f ? f.right : undefined,
              fontSize: 'clamp(24px, 4vw, 48px)',
              animation: `floatGhost 6s ease-in-out infinite`,
              animationDelay: f.delay,
            }}
          >
            {f.text}
          </div>
        ))}

        {/* Content */}
        <div className="relative z-10 mx-auto max-w-4xl px-6 text-center">
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-[#E8A020]/20 bg-[#E8A020]/[0.08] px-4 py-2 text-sm font-bold text-[#E8A020] tracking-[1px] sm:tracking-[2px] text-center">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#E8A020]" />
            Sri Lanka's #1 Overseas Institute
          </div>

          <h1 className="font-jakarta font-black leading-[1.1] tracking-[-2px] text-4xl sm:text-5xl md:text-6xl lg:text-7xl">
            <span className="block text-gray-900 dark:text-white">We create</span>
            <span className="block hero-stroke-text">
              your future
            </span>
            <span className="block text-[#E8A020]">abroad.</span>
          </h1>

          <p className="mx-auto mt-6 max-w-sm md:max-w-xl text-base leading-relaxed text-gray-500 dark:text-gray-300">
            Language training, visa support and overseas placement in Japan, Korea and China.
            Over 1,500 students placed since 2011.
          </p>

          <div className="mt-8 sm:mt-10 flex flex-col sm:flex-row justify-center gap-4">
            <Link href="/enroll"
              className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-[#E8A020] px-9 py-4 text-base font-semibold text-[#03080f] shadow-[0_0_40px_rgba(232,160,32,0.2)] hover:bg-[#f0b030] hover:-translate-y-0.5 transition-all duration-200">
              Apply now
              <span className="ti ti-arrow-right text-[16px]" />
            </Link>
            <a href="#programs"
              className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl border border-gray-300 dark:border-white/20 px-9 py-4 text-[14px] font-semibold text-gray-700 dark:text-white/60 hover:border-gray-400 dark:hover:border-white/20 hover:text-gray-900 dark:hover:text-white transition-all duration-200">
              Explore programs
            </a>
          </div>

          <div className="mt-6 sm:mt-8 flex flex-wrap justify-center gap-3">
            {['TVEC Approved', 'Est. 2011', 'Galle, Sri Lanka', 'PV 00265988'].map(b => (
              <span key={b} className="rounded-md border border-gray-200 dark:border-white/[0.05] bg-white/80 dark:bg-white/[0.02] px-3 py-1 text-[10px] text-gray-600 dark:text-white/20">
                {b}
              </span>
            ))}
          </div>
        </div>

        <style jsx global>{`
          @keyframes floatGhost {
            0%, 100% { transform: translateY(0px); opacity: 0.04; }
            50% { transform: translateY(-12px); opacity: 0.07; }
          }
          .hero-stroke-text {
            color: transparent;
            -webkit-text-stroke: 1.5px rgba(11,61,107,0.35);
          }
          @media (min-width: 640px) {
            .dark .hero-stroke-text {
              -webkit-text-stroke: 1.5px rgba(255,255,255,0.22);
            }
          }
          @media (max-width: 639px) {
            .hero-stroke-text {
              color: #E8A020;
              -webkit-text-stroke: 0;
            }
          }
        `}</style>
      </section>

      {/* ── STATS BAR ── */}
      <section className="relative overflow-hidden bg-[#F8FAFC] py-20 dark:bg-[#0B1A2E]">
        <div className="section-fade-top" />
        <div className="section-fade-bottom" />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(26,107,173,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(26,107,173,0.08)_1px,transparent_1px)] bg-[size:30px_30px]" />
        <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6">
          <div className="grid grid-cols-2 items-stretch gap-3 sm:gap-6 md:mx-auto md:max-w-4xl md:grid-cols-4">
            {[
              { end: 1500, suffix: '+', label: 'Students Placed Abroad' },
              { end: 98, suffix: '%', label: 'Visa Approval Rate' },
              { end: 50, suffix: '+', label: 'Partner Institutions' },
              { end: 15, suffix: ' Years', label: 'Established in Sri Lanka' },
            ].map(s => (
              <div key={s.label} className="rounded-2xl border-x border-b border-t-2 border-gray-100 border-t-[#E8A020] bg-white p-6 text-center shadow-sm dark:border-x-0 dark:border-b-0 dark:bg-white/5 dark:shadow-none dark:backdrop-blur-sm">
                <p className="font-jakarta text-5xl font-black text-[#0B3D6B] dark:text-[#E8A020]">
                  <AnimatedStat end={s.end} suffix={s.suffix} />
                </p>
                <p className="mt-2 text-xs font-semibold uppercase tracking-widest text-gray-500 dark:text-gray-400">
                  {s.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PROGRAMS ── */}
      <section id="programs" className="relative bg-[#F8FAFC] py-28 dark:bg-[#04090f]">
        <div className="section-fade-top" />
        <div className="section-fade-bottom" />
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mb-20 text-center">
            <p className="mb-3 text-[11px] font-bold uppercase tracking-[4px] text-[#E8A020]">Our programs</p>
            <h2 className="font-jakarta text-[40px] font-black text-[#0B1220] dark:text-white">Choose your destination</h2>
            <p className="mx-auto mt-4 max-w-xl text-[15px] text-gray-600 dark:text-white/40">
              World-class training programs designed to get you working or studying abroad.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {COURSES.map(course => (
              course.comingSoon ? (
                <div key={course.title}
                  className="group relative rounded-2xl border border-gray-100 shadow-sm bg-white p-7 opacity-75 dark:border-[#1A6BAD]/40 dark:bg-[#0B3D6B]/20 overflow-hidden">
                  <div className="absolute top-3 right-3 rounded-full bg-[#E8A020] px-2.5 py-0.5 text-[9px] font-black text-white uppercase tracking-wider">Coming Soon</div>
                  <div className="mb-5 flex items-center justify-between">
                    <span className={`inline-flex items-center justify-center rounded-lg px-3 py-1.5 text-[13px] font-black tracking-wide ${course.flagClass}`}>{course.flag}</span>
                  </div>
                  <h3 className="font-jakarta text-[17px] font-bold text-gray-900 dark:text-white mb-2">{course.title}</h3>
                  <p className="text-[13px] leading-relaxed text-gray-600 dark:text-white/40 mb-4">{course.desc}</p>
                  <div className="flex flex-wrap gap-2">
                    {course.tags.map(tag => (
                      <span key={tag} className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-[#0B3D6B] dark:bg-[#0B3D6B]/30 dark:text-blue-300">{tag}</span>
                    ))}
                  </div>
                </div>
              ) : (
                <Link key={course.title} href={course.href}
                  className="group rounded-2xl border border-gray-100 shadow-sm bg-white p-7 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_4px_20px_rgba(11,61,107,0.2)] dark:border-[#1A6BAD]/40 dark:bg-[#0B3D6B]/20">
                  <div className="mb-5 flex items-center justify-between">
                    <span className={`inline-flex items-center justify-center rounded-lg px-3 py-1.5 text-[13px] font-black tracking-wide ${course.flagClass}`}>{course.flag}</span>
                    <span className="ti ti-arrow-right text-[#DDE3EC] transition-all group-hover:translate-x-1 group-hover:text-[#E8A020] dark:text-white/20" />
                  </div>
                  <h3 className="font-jakarta text-[17px] font-bold text-gray-900 dark:text-white mb-2">{course.title}</h3>
                  <p className="text-[13px] leading-relaxed text-gray-600 dark:text-white/40 mb-4">{course.desc}</p>
                  <div className="flex flex-wrap gap-2">
                    {course.tags.map(tag => (
                      <span key={tag} className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-[#0B3D6B] dark:bg-[#0B3D6B]/30 dark:text-blue-300">
                        {tag}
                      </span>
                    ))}
                  </div>
                </Link>
              )
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS TIMELINE ── */}
      <section className="relative py-28">
        <div className="section-fade-top" />
        <div className="section-fade-bottom" />
        <HowItWorksTimeline />
      </section>

      {/* ── PROCESS ── */}
      <section id="process" className="bg-white py-28 dark:bg-[#071428]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mb-16 text-center">
            <p className="mb-3 text-[11px] font-bold uppercase tracking-[4px] text-[#E8A020]">How it works</p>
            <h2 className="font-jakarta text-[40px] font-black text-[#0B3D6B] dark:text-white">From dream to departure</h2>
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {STEPS.map((step, i) => (
              <div key={step.n}
                className="group relative rounded-2xl border border-[#DDE3EC] bg-white p-7 hover:border-[#E8A020]/30 hover:shadow-lg transition-all duration-300 dark:border-white/[0.08] dark:bg-white/[0.03]">
                <div className="font-jakarta text-[64px] font-black leading-none text-[#0B3D6B]/20 group-hover:text-[#E8A020]/40 transition-colors dark:text-white/20 dark:group-hover:text-[#E8A020]/50">
                  {step.n}
                </div>
                <h3 className="mt-2 font-jakarta text-[17px] font-bold text-[#0B1220] dark:text-white">{step.title}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-gray-500 dark:text-white/40">{step.desc}</p>
                {i < STEPS.length - 1 && (
                  <div className="absolute -right-3 top-8 hidden lg:block">
                    <span className="ti ti-chevron-right text-[#0B3D6B]/30 text-xl dark:text-white/20" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="relative overflow-hidden bg-[#03080f] py-28">
        <div className="section-fade-top" />
        <div className="section-fade-bottom" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(26,107,173,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(26,107,173,0.06)_1px,transparent_1px)] bg-[size:40px_40px]" />
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(11,61,107,0.4)_0%,transparent_70%)]" />
        <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6">
          <h2 className="font-jakarta font-black leading-tight text-white" style={{ fontSize: 'clamp(32px, 5vw, 52px)' }}>
            Ready to build your
            <span className="block text-[#E8A020]">global future?</span>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-[15px] text-white/35">
            Join over 1,500 Sri Lankans who have built careers and education paths abroad with EPIC Campus.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <Link href="/enroll"
              className="flex items-center gap-2 rounded-xl bg-[#E8A020] px-10 py-4 text-[15px] font-black text-[#03080f] shadow-[0_0_40px_rgba(232,160,32,0.2)] hover:bg-[#f0b030] hover:-translate-y-0.5 transition-all duration-200">
              Apply now
              <span className="ti ti-arrow-right text-[16px]" />
            </Link>
            <Link href="/login"
              className="flex items-center gap-2 rounded-xl border border-white/10 px-10 py-4 text-[15px] font-semibold text-white/55 hover:border-white/20 hover:text-white transition-all duration-200">
              Student login
            </Link>
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  )
}
