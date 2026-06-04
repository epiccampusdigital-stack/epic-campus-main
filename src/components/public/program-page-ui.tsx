import Link from 'next/link'
import type { ReactNode } from 'react'

export function SectionTitle({
  title,
  subtitle,
}: {
  title: string
  subtitle?: string
}) {
  return (
    <div className="mb-16 text-center">
      <h2 className="text-4xl font-bold text-[#0B3D6B]">{title}</h2>
      <div className="mx-auto mt-4 h-1 w-16 bg-[#E8A020]" />
      {subtitle && (
        <p className="mx-auto mt-4 max-w-2xl text-gray-600">{subtitle}</p>
      )}
    </div>
  )
}

export function PageHero({
  flag,
  overline,
  headline,
  subtext,
}: {
  flag: string
  overline: string
  headline: string
  subtext: string
}) {
  return (
    <section className="relative bg-gradient-to-br from-[#0B3D6B] via-[#1A6BAD] to-[#0B3D6B] pb-48 pt-32">
      <div className="mx-auto max-w-6xl px-4 text-center">
        <div className="mb-6 text-6xl">{flag}</div>
        <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-[#E8A020]">
          {overline}
        </p>
        <h1 className="mb-6 text-5xl font-bold text-white md:text-6xl">{headline}</h1>
        <p className="mx-auto mb-10 max-w-2xl text-lg text-white/80">{subtext}</p>
        <div className="flex flex-wrap justify-center gap-4">
          <Link
            href="/contact"
            className="rounded-full bg-[#E8A020] px-8 py-4 font-semibold text-[#0B3D6B] transition-all hover:bg-[#F5B942]"
          >
            Book Free Consultation
          </Link>
          <a
            href="#programs"
            className="rounded-full border-2 border-white px-8 py-4 font-semibold text-white transition-all hover:bg-white hover:text-[#0B3D6B]"
          >
            Explore Programs
          </a>
        </div>
      </div>
    </section>
  )
}

export function StatsBar({
  stats,
}: {
  stats: { number: string; label: string }[]
}) {
  return (
    <section className="relative z-10 -mt-16">
      <div className="mx-auto max-w-5xl px-4">
        <div className="grid grid-cols-2 rounded-2xl bg-white shadow-xl md:grid-cols-4">
          {stats.map((s, i) => (
            <div
              key={s.label}
              className={`px-6 py-8 text-center ${
                i < stats.length - 1 ? 'border-r border-gray-100' : ''
              }`}
            >
              <div className="text-4xl font-black text-[#0B3D6B]">{s.number}</div>
              <div className="mt-1 text-xs uppercase tracking-wide text-gray-500">
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export function TimelineSteps({
  steps,
  columns = 4,
}: {
  steps: { title: string; desc: string }[]
  columns?: 3 | 4
}) {
  const colClass = columns === 3 ? 'md:grid-cols-3' : 'md:grid-cols-4'
  return (
    <div className="relative">
      <div className="absolute left-0 right-0 top-6 hidden h-0.5 bg-[#E8A020]/30 md:block" />
      <div className={`grid grid-cols-1 gap-8 ${colClass}`}>
        {steps.map((step, i) => (
          <div key={step.title} className="relative text-center">
            <div className="relative z-10 mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border-2 border-[#E8A020] bg-white">
              <span className="font-bold text-[#E8A020]">{i + 1}</span>
            </div>
            <h3 className="mb-2 font-semibold text-[#0B3D6B]">{step.title}</h3>
            <p className="text-sm text-gray-500">{step.desc}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

export function CtaSection({
  title,
  subtext,
  button,
  children,
}: {
  title: string
  subtext: string
  button?: string
  children?: ReactNode
}) {
  return (
    <section className="bg-[#0B3D6B] py-24">
      <div className="mx-auto max-w-4xl px-4 text-center">
        <h2 className="mb-4 text-4xl font-bold text-white">{title}</h2>
        <p className="mb-8 text-white/70">{subtext}</p>
        {children ?? (
          <Link
            href="/contact"
            className="inline-block rounded-full bg-[#E8A020] px-10 py-4 text-lg font-semibold text-[#0B3D6B] transition-all hover:bg-[#F5B942]"
          >
            {button}
          </Link>
        )}
      </div>
    </section>
  )
}

export const CARD =
  'bg-white rounded-2xl shadow-sm border border-gray-100 p-8 hover:shadow-lg hover:-translate-y-1 transition-all duration-300'
