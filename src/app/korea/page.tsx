'use client'

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
  { number: '2,000', label: 'Target Placements' },
  { number: 'Full', label: 'Scholarships Available' },
  { number: 'D-4→D-2', label: 'Clear Pathway' },
  { number: 'TOPIK', label: 'Exam Prep Included' },
]

const WHY_KOREA = [
  {
    emoji: '🎓',
    title: 'World-Class Universities',
    desc: "Korea ranks among Asia's top education destinations with globally recognized degrees.",
  },
  {
    emoji: '💰',
    title: 'Scholarships Available',
    desc: 'Full scholarships covering tuition, accommodation, and monthly living allowance.',
  },
  {
    emoji: '🌐',
    title: 'Booming Job Market',
    desc: "Korea's tech and manufacturing sectors actively recruit international graduates.",
  },
]

const PATHWAYS = [
  {
    title: 'After O/Levels',
    badge: 'Most Popular',
    steps: [
      '1-year Korean language program at EPIC Campus',
      'Enter Korea on D-4 Language Visa',
      'Progress to D-2 degree after TOPIK Level 2',
    ],
  },
  {
    title: 'After A/Levels',
    steps: [
      'Language + direct degree entry options',
      'TOPIK preparation at EPIC Campus',
      'D-4 visa then fast-track to degree program',
    ],
  },
  {
    title: 'IELTS Pathway',
    steps: [
      'English-medium degree programs available',
      'IELTS 6.0+ required for most universities',
      'Skip Korean language requirement in some cases',
    ],
  },
]

const PROGRAM_STEPS = [
  { title: 'Study Korean at EPIC', desc: 'TOPIK-focused training. Classes 5 days/week. All levels from beginner.' },
  { title: 'Enter Korea on D-4 Visa', desc: '1-year language school in Korea. Work part-time up to 20hrs/week.' },
  { title: 'Progress to D-2 Degree', desc: 'Transfer to university degree. Full academic life in Korea.' },
]

const SCHOLARSHIPS = [
  {
    title: 'Full Scholarship',
    badge: 'Fully Funded',
    borderClass: 'border-t-4 border-[#E8A020]',
    items: [
      '100% Tuition Fee Waiver',
      'Free On-Campus Accommodation',
      'Monthly Living Allowance',
      'Medical Insurance Included',
    ],
  },
  {
    title: 'Partial Scholarship',
    badge: 'Merit-Based',
    borderClass: 'border-t-4 border-gray-300',
    items: [
      '30%–70% Tuition Fee Waiver',
      'Performance-Based Awards',
      'Renewable Each Semester',
      'Based on Academic Results',
    ],
  },
]

const REQUIREMENTS = [
  'TOPIK Level 2 or higher (recommended)',
  'Bank statement approx. USD 10,000 equivalent',
  'Valid passport (minimum 2 years validity)',
  'Academic transcripts (O/L or A/L results)',
  'EPIC Campus language certificate',
  'Health clearance certificate',
  'Passport-size photographs',
  'Completed EPIC application form',
]

export default function KoreaPage() {
  return (
    <>
      <PublicNav />
      <PageHero
        accentGradient="linear-gradient(90deg, #003478, #cd2e3a)"
        overline="KOREA STUDY PROGRAMS"
        headline="Study & Build Your Future in Korea"
        subtext="Access world-class Korean universities through our D-4 to D-2 pathway. Full and partial scholarships available."
      />
      <StatsBar stats={STATS} />

      <section className="bg-white py-24">
        <div className="mx-auto max-w-6xl px-4">
          <SectionTitle title="Why Study in Korea?" />
          <div className="grid gap-8 md:grid-cols-3">
            {WHY_KOREA.map((item) => (
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
          <SectionTitle title="Available Study Pathways" />
          <div className="grid gap-8 md:grid-cols-3">
            {PATHWAYS.map((path) => (
              <div key={path.title} className={`${CARD} border-t-4 border-blue-500`}>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-[#0B3D6B]">{path.title}</h3>
                  {path.badge && (
                    <span className="shrink-0 rounded-full bg-[#E8A020] px-3 py-1 text-xs font-semibold text-[#0B3D6B]">
                      {path.badge}
                    </span>
                  )}
                </div>
                <ul className="mt-4 space-y-2">
                  {path.steps.map((step) => (
                    <li key={step} className="text-sm text-gray-500">
                      • {step}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white py-24">
        <div className="mx-auto max-w-6xl px-4">
          <SectionTitle title="How the Program Works" />
          <TimelineSteps steps={PROGRAM_STEPS} columns={3} />
        </div>
      </section>

      <section className="bg-[#F5F7FB] py-24">
        <div className="mx-auto max-w-6xl px-4">
          <SectionTitle title="Scholarship Opportunities" />
          <div className="grid gap-8 md:grid-cols-2">
            {SCHOLARSHIPS.map((sch) => (
              <div key={sch.title} className={`${CARD} ${sch.borderClass}`}>
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-[#0B3D6B]">{sch.title}</h3>
                  <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
                    {sch.badge}
                  </span>
                </div>
                <ul className="mt-4 space-y-2">
                  {sch.items.map((item) => (
                    <li key={item} className="text-sm text-gray-500">
                      • {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white py-24">
        <div className="mx-auto max-w-6xl px-4">
          <SectionTitle title="What You Need to Apply" />
          <div className="grid gap-4 sm:grid-cols-2">
            {REQUIREMENTS.map((req) => (
              <div key={req} className="flex items-start gap-3 rounded-xl border border-gray-100 bg-[#F5F7FB] p-4">
                <span className="text-lg" aria-hidden="true">
                  ✅
                </span>
                <span className="text-sm text-gray-700">{req}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <CtaSection
        title="Start Your Korea Journey Today"
        subtext="Limited intake slots per year. Apply early to secure your scholarship opportunity."
        button="Apply for Korea Program"
      />
      <PublicFooter />
    </>
  )
}
