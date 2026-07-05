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

function AnimatedStat({ end, suffix = '', duration = 2000 }: { end: number; suffix?: string; duration?: number }) {
  const [count, setCount] = useState(0)
  const [started, setStarted] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting && !started) setStarted(true) },
      { threshold: 0.5 }
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [started])

  useEffect(() => {
    if (!started) return
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
  }, [started, end, duration])

  return <span ref={ref} className="tabular-nums">{count.toLocaleString()}{suffix}</span>
}

interface Destination {
  id: string
  x: number
  y: number
  lat: number
  lng: number
  label: string
  subtitle: string
  href: string
}

// Origin: Colombo, Sri Lanka (6.927, 79.861)
const DESTINATIONS: Destination[] = [
  { id: 'JP', x: 78, y: 25, lat: 35.689, lng: 139.692, label: 'Japan', subtitle: 'SSW Work Visa', href: '/japan' },
  { id: 'KR', x: 73, y: 30, lat: 37.566, lng: 126.978, label: 'Korea', subtitle: 'University', href: '/korea' },
  { id: 'CN', x: 65, y: 35, lat: 39.904, lng: 116.391, label: 'China', subtitle: 'Scholarship', href: '/china' },
  { id: 'EU', x: 25, y: 20, lat: 51.507, lng: -0.127, label: 'Europe', subtitle: 'IELTS', href: '/ielts' },
]

function AsiaMap() {
  const [activeDest, setActiveDest] = useState<string | null>(null)
  const progressRef = useRef(0)
  const [tick, setTick] = useState(0)

  const SL = { x: 57, y: 65 }

  useEffect(() => {
    progressRef.current = 0
  }, [activeDest])

  useEffect(() => {
    let id: number
    function animate() {
      progressRef.current = Math.min(1, progressRef.current + 0.01)
      setTick(t => t + 1)
      id = requestAnimationFrame(animate)
    }
    id = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(id)
  }, [])

  function bezierPt(t: number, from: {x:number;y:number}, to: {x:number;y:number}) {
    const mx = (from.x + to.x) / 2
    const my = (from.y + to.y) / 2
    const dist = Math.hypot(to.x - from.x, to.y - from.y)
    const cp = { x: mx, y: my - dist * 0.45 }
    const mt = 1 - t
    return { x: mt*mt*from.x + 2*mt*t*cp.x + t*t*to.x, y: mt*mt*from.y + 2*mt*t*cp.y + t*t*to.y }
  }

  function arcPath(from: {x:number;y:number}, to: {x:number;y:number}, steps: number) {
    const mx = (from.x + to.x) / 2
    const my = (from.y + to.y) / 2
    const dist = Math.hypot(to.x - from.x, to.y - from.y)
    const cp = { x: mx, y: my - dist * 0.45 }
    const pts = Array.from({ length: steps + 1 }, (_, i) => {
      const t = i / steps
      const mt = 1 - t
      return `${(mt*mt*from.x + 2*mt*t*cp.x + t*t*to.x).toFixed(2)},${(mt*mt*from.y + 2*mt*t*cp.y + t*t*to.y).toFixed(2)}`
    })
    return `M ${pts.join(' L ')}`
  }

  const active = activeDest ? DESTINATIONS.find(d => d.id === activeDest) ?? null : null
  const prog = progressRef.current
  const dot = active ? bezierPt(Math.min(prog, 0.98), SL, active) : null

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-stretch">
      <div className="relative flex-1 overflow-hidden rounded-2xl border border-white/[0.06] bg-[#061220] min-h-[280px] md:min-h-[400px]">
        <svg viewBox="0 0 100 85" className="h-full w-full" preserveAspectRatio="xMidYMid meet">

          {/* Dot grid */}
          {Array.from({length:21}, (_,i) => Array.from({length:18}, (_,j) => (
            <circle key={`${i}-${j}`} cx={i*5} cy={j*5} r="0.15" fill="rgba(26,107,173,0.25)" />
          )))}

          {/* ── LANDMASSES ── */}

          {/* Europe */}
          <path d="M 15 10 Q 20 8 28 9 Q 34 8 36 12 Q 38 16 34 19 Q 28 22 22 20 Q 16 18 15 14 Z"
            fill="rgba(26,107,173,0.18)" stroke="rgba(26,107,173,0.35)" strokeWidth="0.25" />

          {/* Middle East / Arabian Peninsula */}
          <path d="M 38 30 Q 44 28 48 30 Q 52 33 50 38 Q 47 42 43 40 Q 38 38 37 34 Z"
            fill="rgba(26,107,173,0.14)" stroke="rgba(26,107,173,0.28)" strokeWidth="0.25" />

          {/* India */}
          <path d="M 52 38 Q 56 36 60 37 Q 63 40 62 46 Q 60 52 56 56 Q 53 54 51 49 Q 49 44 52 38 Z"
            fill="rgba(26,107,173,0.18)" stroke="rgba(26,107,173,0.35)" strokeWidth="0.25" />

          {/* Sri Lanka */}
          <ellipse cx="57" cy="65" rx="1.5" ry="2.2"
            fill="rgba(232,160,32,0.2)" stroke="rgba(232,160,32,0.5)" strokeWidth="0.3" />

          {/* Mainland Southeast Asia */}
          <path d="M 62 42 Q 68 40 70 44 Q 71 49 68 54 Q 65 58 62 56 Q 60 52 61 47 Z"
            fill="rgba(26,107,173,0.15)" stroke="rgba(26,107,173,0.3)" strokeWidth="0.25" />

          {/* China */}
          <path d="M 58 24 Q 65 20 74 22 Q 80 24 80 30 Q 79 36 73 39 Q 67 42 61 39 Q 56 36 57 30 Z"
            fill="rgba(26,107,173,0.18)" stroke="rgba(26,107,173,0.35)" strokeWidth="0.25" />

          {/* Korea */}
          <path d="M 72 27 Q 75 26 76 28 Q 77 31 75 34 Q 73 35 71 33 Q 70 30 72 27 Z"
            fill="rgba(26,107,173,0.2)" stroke="rgba(26,107,173,0.4)" strokeWidth="0.25" />

          {/* Japan — Honshu */}
          <path d="M 77 20 Q 81 18 83 21 Q 84 24 82 27 Q 80 28 78 26 Q 76 23 77 20 Z"
            fill="rgba(26,107,173,0.2)" stroke="rgba(26,107,173,0.4)" strokeWidth="0.25" />
          {/* Japan — Kyushu */}
          <path d="M 76 27 Q 78 27 78 29 Q 78 31 76 31 Q 75 29 76 27 Z"
            fill="rgba(26,107,173,0.18)" stroke="rgba(26,107,173,0.35)" strokeWidth="0.2" />

          {/* Russia/Central Asia rough fill */}
          <path d="M 30 5 Q 55 3 80 8 Q 85 12 82 18 Q 78 20 74 18 Q 65 14 55 16 Q 44 18 36 14 Q 28 12 28 8 Z"
            fill="rgba(26,107,173,0.08)" stroke="rgba(26,107,173,0.15)" strokeWidth="0.2" />

          {/* ── ARCS (resting state: all 4 shown faint blue; hovered one drawn gold on top) ── */}
          {DESTINATIONS.map(d => d.id === activeDest ? null : (
            <path key={d.id}
              d={arcPath(SL, d, 30)}
              fill="none" stroke="#1A6BAD" strokeOpacity={0.25}
              strokeWidth="0.4" />
          ))}

          {/* ── ACTIVE (HOVERED) ARC ── */}
          {active && (
            <path
              d={arcPath(SL, active, Math.max(2, Math.floor(prog * 30)))}
              fill="none"
              stroke="#E8A020"
              strokeOpacity={1}
              strokeWidth={2}
            />
          )}

          {/* ── TRAVELING DOT ── */}
          {active && dot && prog > 0.02 && prog < 0.99 && (
            <circle cx={dot.x} cy={dot.y} r={4} fill="#E8A020" />
          )}

          {/* ── SRI LANKA DOT ── */}
          <circle cx={SL.x} cy={SL.y} r="2" fill="rgba(232,160,32,0.12)" />
          <circle cx={SL.x} cy={SL.y} r="0.9" fill="#E8A020" />
          <circle cx={SL.x} cy={SL.y} r="1.5" fill="none" stroke="rgba(232,160,32,0.35)" strokeWidth="0.4" />
          <text x={SL.x + 1.8} y={SL.y - 1.2} fontSize="2.4" fill="rgba(232,160,32,0.85)" fontWeight="bold">Colombo</text>

          {/* ── DESTINATION DOTS + LABELS ── */}
          {DESTINATIONS.map(d => {
            const isActive = d.id === activeDest
            const arrived = isActive && prog >= 0.96
            return (
              <g key={d.id}>
                {arrived && <circle cx={d.x} cy={d.y} r="2.5" fill="rgba(232,160,32,0.12)" />}
                <circle cx={d.x} cy={d.y} r={isActive ? 1.1 : 0.6} fill={isActive ? '#E8A020' : 'rgba(232,160,32,0.22)'} />
                <text x={d.x + 1.8} y={d.y - 1} fontSize="2.4"
                  fill={isActive ? 'rgba(232,160,32,0.95)' : 'rgba(232,160,32,0.3)'}
                  fontWeight="bold">{d.label}</text>
              </g>
            )
          })}
        </svg>
        <p className="absolute bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] tracking-widest text-white/30 hidden sm:block">
          HOVER A DESTINATION
        </p>
        <p className="absolute bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] tracking-widest text-white/30 sm:hidden">
          TAP A DESTINATION
        </p>
      </div>

      {/* Destination cards */}
      <div className="hidden md:flex flex-row gap-3 sm:gap-4 overflow-x-auto pb-1 lg:flex-col lg:overflow-x-visible lg:pb-0 lg:justify-center" style={{ minWidth: '190px' }}>
        {DESTINATIONS.map(d => (
          <Link key={d.id} href={d.href}
            onMouseEnter={() => setActiveDest(d.id)}
            onMouseLeave={() => setActiveDest(prev => (prev === d.id ? null : prev))}
            className={`flex shrink-0 items-center gap-3 rounded-xl border p-4 transition-all duration-200 lg:w-full ${
              activeDest === d.id
                ? 'border-[#E8A020]/35 bg-[#E8A020]/[0.08]'
                : 'border-white/[0.06] bg-white/[0.03] hover:border-white/[0.14]'
            }`}
          >
            {d.id === 'EU' ? (
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#E8A020] text-white">
                <span className="ti ti-world text-[18px]" />
              </span>
            ) : (
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#0B3D6B]/30 text-[13px] font-black tracking-wide text-blue-300">
                {d.id}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-bold text-white/85 truncate">{d.label}</p>
              <p className="text-[12px] text-white/30 truncate">{d.subtitle}</p>
            </div>
            <span className={`ti ti-arrow-right shrink-0 text-[11px] ${activeDest === d.id ? 'text-[#E8A020]' : 'text-white/15'}`} />
          </Link>
        ))}
      </div>
    </div>
  )
}

function HeroParticles() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = canvas.offsetWidth
    canvas.height = canvas.offsetHeight

    const particles: { x: number; y: number; vx: number; vy: number; r: number; a: number; va: number }[] = []
    for (let i = 0; i < 160; i++) {
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
        ctx.fillStyle = `rgba(232,160,32,${p.a})`
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
            ctx.strokeStyle = `rgba(232,160,32,${0.14 * (1 - d / 80)})`
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
      style={{ opacity: 0.85 }}
    />
  )
}

export default function HomePage() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-white dark:bg-[#04090f]">
      <PublicNav />

      {/* ── HERO ── */}
      <section className="relative flex min-h-[92vh] items-center justify-center overflow-hidden bg-[#03080f]">
        <HeroParticles />
        {/* Grid */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(26,107,173,0.07)_1px,transparent_1px),linear-gradient(90deg,rgba(26,107,173,0.07)_1px,transparent_1px)] bg-[size:40px_40px]" />
        {/* Center glow */}
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(11,61,107,0.45)_0%,transparent_70%)]" />
        {/* Side glows */}
        <div className="pointer-events-none absolute -left-32 top-1/2 h-[400px] w-[400px] -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(232,160,32,0.04)_0%,transparent_70%)]" />

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
        <div className="relative z-10 mx-auto max-w-4xl px-4 text-center sm:px-6">
          <div className="mb-6 sm:mb-8 inline-flex items-center gap-2 rounded-full border border-[#E8A020]/20 bg-[#E8A020]/[0.08] px-4 py-1.5 text-[9px] sm:text-[11px] font-bold text-[#E8A020] tracking-[1px] sm:tracking-[2px] text-center">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#E8A020]" />
            Sri Lanka's #1 Overseas Institute
          </div>

          <h1 className="font-jakarta font-black leading-[0.95] tracking-[-2px] text-3xl sm:text-4xl md:text-5xl lg:text-7xl">
            <span className="block text-white">We create</span>
            <span className="block" style={{ color: 'transparent', WebkitTextStroke: '1.5px rgba(255,255,255,0.22)' }}>
              your future
            </span>
            <span className="block text-[#E8A020]">abroad.</span>
          </h1>

          <p className="mx-auto mt-6 max-w-xs sm:max-w-sm md:max-w-xl text-[14px] sm:text-[16px] leading-relaxed text-white/35">
            Language training, visa support and overseas placement in Japan, Korea and China.
            Over 1,500 students placed since 2011.
          </p>

          <div className="mt-8 sm:mt-10 flex flex-col sm:flex-row justify-center gap-3 sm:gap-4">
            <Link href="/enroll"
              className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-[#E8A020] px-9 py-4 text-[14px] font-black text-[#03080f] shadow-[0_0_40px_rgba(232,160,32,0.2)] hover:bg-[#f0b030] hover:-translate-y-0.5 transition-all duration-200">
              Apply now
              <span className="ti ti-arrow-right text-[16px]" />
            </Link>
            <a href="#programs"
              className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl border border-white/20 px-9 py-4 text-[14px] font-semibold text-white/60 hover:border-white/20 hover:text-white transition-all duration-200">
              Explore programs
            </a>
          </div>

          <div className="mt-6 sm:mt-8 flex flex-wrap justify-center gap-3">
            {['TVEC Approved', 'Est. 2011', 'Galle, Sri Lanka', 'PV 00265988'].map(b => (
              <span key={b} className="rounded-md border border-white/[0.05] bg-white/[0.02] px-3 py-1 text-[10px] text-white/20">
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
        `}</style>
      </section>

      {/* ── STATS BAR ── */}
      <section className="relative overflow-hidden py-20" style={{ background: 'linear-gradient(135deg, #071428 0%, #0B3D6B 50%, #071428 100%)' }}>
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(26,107,173,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(26,107,173,0.08)_1px,transparent_1px)] bg-[size:30px_30px]" />
        <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6">
          <div className="grid grid-cols-2 gap-8 sm:gap-12 md:grid-cols-4">
            {[
              { end: 1500, suffix: '+', label: 'Students placed abroad' },
              { end: 98, suffix: '%', label: 'Visa approval rate' },
              { end: 50, suffix: '+', label: 'Partner institutions' },
              { end: 15, suffix: '+', label: 'Years of experience' },
            ].map(s => (
              <div key={s.label} className="text-center">
                <p className="font-jakarta text-[48px] sm:text-[56px] font-black text-[#E8A020]">
                  <AnimatedStat end={s.end} suffix={s.suffix} />
                </p>
                <p className="mt-1 text-[12px] font-semibold uppercase tracking-[2px] text-white/50">
                  {s.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PROGRAMS ── */}
      <section id="programs" className="bg-[#F5F7FB] py-28 dark:bg-[#04090f]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mb-20 text-center">
            <p className="mb-3 text-[11px] font-bold uppercase tracking-[4px] text-[#E8A020]">Our programs</p>
            <h2 className="font-jakarta text-[40px] font-black text-[#0B3D6B] dark:text-white">Choose your destination</h2>
            <p className="mx-auto mt-4 max-w-xl text-[15px] text-[#5A6A7A] dark:text-white/40">
              World-class training programs designed to get you working or studying abroad.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {COURSES.map(course => (
              course.comingSoon ? (
                <div key={course.title}
                  className="group relative rounded-2xl border border-[#0B3D6B] bg-white p-7 opacity-75 dark:border-[#1A6BAD]/40 dark:bg-[#0B3D6B]/20 overflow-hidden">
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
                  className="group rounded-2xl border border-[#0B3D6B] bg-white p-7 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_4px_20px_rgba(11,61,107,0.2)] dark:border-[#1A6BAD]/40 dark:bg-[#0B3D6B]/20">
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

      {/* ── FLIGHT MAP ── */}
      <section className="bg-[#03080f] py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mb-16 text-center">
            <p className="mb-3 text-[11px] font-bold uppercase tracking-[4px] text-[#E8A020]">Where we send students</p>
            <h2 className="font-jakarta text-[40px] font-black text-white">From Sri Lanka to the world</h2>
            <p className="mx-auto mt-4 max-w-lg text-[15px] text-white/35">
              Hover a destination to see the flight path animate across Asia.
            </p>
          </div>
          <AsiaMap />
        </div>
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
                <h3 className="mt-2 font-jakarta text-[17px] font-bold text-[#0B3D6B] dark:text-white">{step.title}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-[#5A6A7A] dark:text-white/40">{step.desc}</p>
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
