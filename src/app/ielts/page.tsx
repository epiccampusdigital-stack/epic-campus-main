'use client'

import Link from 'next/link'
import PublicNav from '@/components/public/PublicNav'
import PublicFooter from '@/components/public/PublicFooter'
import {
  CARD,
  CtaSection,
  PageHero,
  SectionTitle,
  StatsBar,
  TimelineSteps,
} from '@/components/public/program-page-ui'

const STATS = [
  { number: '10-Day', label: 'Intensive Program' },
  { number: '6.0–7.0+', label: 'Target Band Scores' },
  { number: '4 Skills', label: 'Full Coverage' },
  { number: 'Daily', label: 'Mock Exams' },
]

const SKILLS = [
  {
    emoji: '🎧',
    title: 'Listening',
    desc: 'Academic and General Training listening tasks. Audio strategy and note-taking skills.',
  },
  {
    emoji: '📖',
    title: 'Reading',
    desc: 'Skimming, scanning, and detailed comprehension across all question types.',
  },
  {
    emoji: '✍️',
    title: 'Writing',
    desc: 'Task 1 (graphs/diagrams) and Task 2 (essays). Model answers and feedback.',
  },
  {
    emoji: '🗣️',
    title: 'Speaking',
    desc: 'All 3 parts of the speaking exam. Fluency, vocabulary, pronunciation coaching.',
  },
]

const BAND_SCORES = [
  {
    badge: 'Band 6.0',
    badgeClass: 'bg-green-100 text-green-700',
    borderClass: 'border-t-4 border-green-500',
    title: 'Foundation',
    desc: 'Accepted by many Korean and Chinese universities for foundation programs.',
    who: 'Suitable for: Students new to IELTS, O/Level completers',
  },
  {
    badge: 'Band 6.5',
    badgeClass: 'bg-blue-100 text-blue-700',
    borderClass: 'border-t-4 border-blue-500',
    title: 'Competent',
    desc: 'Entry requirement for most Korean D-4 visa English-medium programs.',
    who: 'Suitable for: A/Level completers, degree applicants',
  },
  {
    badge: 'Band 7.0+',
    badgeClass: 'bg-purple-100 text-purple-700',
    borderClass: 'border-t-4 border-purple-500',
    title: 'Advanced',
    desc: 'Opens doors to top-tier universities and professional migration programs.',
    who: 'Suitable for: Graduate applicants, professionals',
  },
]

const AUDIENCE = [
  {
    emoji: '🇰🇷🇨🇳',
    title: 'Studying in Korea or China',
    desc: 'EPIC Korea and China programs require IELTS. This program is your fastest route to meeting that requirement.',
  },
  {
    emoji: '⚡',
    title: 'Need Fast Results',
    desc: '10-day intensive residential program. No distractions. Maximum focus and rapid improvement.',
  },
  {
    emoji: '🏠',
    title: 'Distraction-Free Study',
    desc: 'Residential environment means you live, eat, and study IELTS for 10 days straight.',
  },
]

const PATHWAY_STEPS = [
  {
    title: 'Join Residential Program',
    desc: 'Check-in at EPIC Campus residential facility. 10 days of full-time IELTS preparation.',
  },
  {
    title: 'Take the IELTS Exam',
    desc: 'Sit the official IELTS exam at a registered test center. EPIC Campus handles registration guidance.',
  },
  {
    title: 'Apply to Universities',
    desc: 'Use your band score to apply for Korea, China, or other international university programs.',
  },
]

export default function IeltsPage() {
  return (
    <>
      <PublicNav />
      <div className="bg-[#E8A020] py-3">
        <div className="mx-auto flex max-w-6xl items-center justify-center gap-4 px-4">
          <span className="font-semibold text-white">🌐 We have a dedicated IELTS platform!</span>
          <a
            href="https://epicielts.live"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full bg-white px-6 py-1.5 text-sm font-bold text-[#E8A020] transition-all hover:bg-gray-50"
          >
            Visit epicielts.live →
          </a>
        </div>
      </div>
      <PageHero
        flag="🎓"
        overline="IELTS RESIDENTIAL PROGRAM"
        headline="Fast-Track Your English to Global Success"
        subtext="Intensive 10-day residential IELTS training. Expert trainers, daily mock exams, personalized band score guidance."
      />
      <StatsBar stats={STATS} />

      <section className="bg-white py-24">
        <div className="mx-auto max-w-6xl px-4">
          <SectionTitle title="Everything You Need to Hit Your Target Score" />
          <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
            {SKILLS.map((skill) => (
              <div key={skill.title} className={CARD}>
                <div className="text-4xl">{skill.emoji}</div>
                <h3 className="mt-3 font-semibold text-[#0B3D6B]">{skill.title}</h3>
                <p className="mt-1 text-sm text-gray-500">{skill.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#F5F7FB] py-24">
        <div className="mx-auto max-w-6xl px-4">
          <SectionTitle title="Target Band Scores" />
          <div className="grid gap-8 md:grid-cols-3">
            {BAND_SCORES.map((band) => (
              <div key={band.title} className={`${CARD} ${band.borderClass}`}>
                <span className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${band.badgeClass}`}>
                  {band.badge}
                </span>
                <h3 className="mt-4 font-semibold text-[#0B3D6B]">{band.title}</h3>
                <p className="mt-2 text-sm text-gray-500">{band.desc}</p>
                <p className="mt-3 text-xs text-gray-400">{band.who}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white py-24">
        <div className="mx-auto max-w-6xl px-4">
          <SectionTitle title="Who Is This Program For?" />
          <div className="grid gap-8 md:grid-cols-3">
            {AUDIENCE.map((item) => (
              <div key={item.title} className={CARD}>
                <div className="text-4xl">{item.emoji}</div>
                <h3 className="mt-4 font-semibold text-[#0B3D6B]">{item.title}</h3>
                <p className="mt-2 text-sm text-gray-500">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="programs" className="bg-[#F5F7FB] py-24">
        <div className="mx-auto max-w-6xl px-4">
          <SectionTitle title="Pathway" />
          <TimelineSteps steps={PATHWAY_STEPS} columns={3} />
        </div>
      </section>

      <CtaSection
        title="Ready to Achieve Your Target Band Score?"
        subtext="Limited residential spots per intake. Book your place before it fills."
      >
        <div className="flex flex-wrap justify-center gap-4">
          <Link
            href="/contact"
            className="rounded-full bg-[#E8A020] px-10 py-4 text-lg font-semibold text-[#0B3D6B] transition-all hover:bg-[#F5B942]"
          >
            Enroll in IELTS Program
          </Link>
          <a
            href="https://epicielts.live"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full border-2 border-white px-10 py-4 text-lg font-semibold text-white transition-all hover:bg-white hover:text-[#0B3D6B]"
          >
            Visit epicielts.live →
          </a>
        </div>
      </CtaSection>
      <PublicFooter />
    </>
  )
}
