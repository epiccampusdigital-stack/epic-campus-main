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
  { number: 'Full', label: 'Scholarships Available' },
  { number: '4 Years', label: 'Degree Programs' },
  { number: 'HSK', label: 'Exam Prep Included' },
  { number: '50+', label: 'Partner Universities' },
]

const WHY_CHINA = [
  {
    emoji: '🌍',
    title: 'Globally Recognized Degrees',
    desc: 'Chinese university degrees are recognized worldwide, especially in Asia, Africa, and the Middle East.',
  },
  {
    emoji: '💴',
    title: 'Affordable Education',
    desc: 'Tuition and living costs significantly lower than UK, Australia, or USA programs.',
  },
  {
    emoji: '🔬',
    title: 'Advanced Research',
    desc: 'China invests heavily in R&D. Top universities for Medicine, AI, and Engineering.',
  },
]

const STUDY_FIELDS = [
  { emoji: '🏥', title: 'Medicine & Health Sciences', desc: 'MBBS programs, nursing, pharmacy. High demand globally.' },
  { emoji: '📈', title: 'Business & Economics', desc: 'MBA, finance, international trade. Taught in English or Chinese.' },
  { emoji: '💻', title: 'IT, AI & Data Science', desc: 'Computer science, machine learning, software engineering.' },
  { emoji: '⚙️', title: 'Engineering', desc: 'Civil, mechanical, electrical. Strong industry partnerships.' },
  { emoji: '🏛️', title: 'Architecture', desc: 'Design, urban planning, structural engineering.' },
  { emoji: '🎨', title: 'Arts & Humanities', desc: 'Chinese language, international relations, cultural studies.' },
]

const PATHWAY_STEPS = [
  {
    title: 'Language Preparation',
    desc: 'Learn Chinese at EPIC Campus. HSK preparation if required. English-medium options also available.',
  },
  {
    title: 'Foundation Year',
    desc: '1-year foundation program if needed (after O/Levels). Covers core subjects in your chosen field.',
  },
  {
    title: '4-Year Degree',
    desc: 'Full university degree at a top Chinese institution. Graduation with internationally recognized certificate.',
  },
]

const SCHOLARSHIPS = [
  {
    title: 'Full Scholarship',
    badge: 'Fully Funded',
    borderClass: 'border-t-4 border-[#E8A020]',
    items: [
      '100% Tuition Fee Covered',
      'Free On-Campus Accommodation',
      'Monthly Stipend Provided',
      'Comprehensive Medical Insurance',
    ],
  },
  {
    title: 'Partial Scholarship',
    badge: 'Merit-Based',
    borderClass: 'border-t-4 border-gray-300',
    items: [
      '25%–60% Tuition Fee Waiver',
      'Merit & Need-Based Options',
      'Renewable with Good Performance',
      'Wide Selection of Universities',
    ],
  },
]

export default function ChinaPage() {
  return (
    <>
      <PublicNav />
      <PageHero
        accentGradient="linear-gradient(90deg, #de2910, #ffde00)"
        overline="CHINA STUDY PROGRAMS"
        headline="World-Class Education, Affordable Costs"
        subtext="Study at top Chinese universities with full and partial scholarships. Medicine, Business, IT, Engineering and more."
      />
      <StatsBar stats={STATS} />

      <section className="bg-white py-24">
        <div className="mx-auto max-w-6xl px-4">
          <SectionTitle title="Why Study in China?" />
          <div className="grid gap-8 md:grid-cols-3">
            {WHY_CHINA.map((item) => (
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
          <SectionTitle title="What Can You Study?" />
          <div className="grid grid-cols-2 gap-6 md:grid-cols-3">
            {STUDY_FIELDS.map((field) => (
              <div key={field.title} className={CARD}>
                <div className="text-4xl">{field.emoji}</div>
                <h3 className="mt-3 font-semibold text-[#0B3D6B]">{field.title}</h3>
                <p className="mt-1 text-sm text-gray-500">{field.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white py-24">
        <div className="mx-auto max-w-6xl px-4">
          <SectionTitle title="Your Pathway to China" />
          <TimelineSteps steps={PATHWAY_STEPS} columns={3} />
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

      <CtaSection
        title="Explore China Programs"
        subtext="Scholarships are competitive. Strong academic performance and early application increase your chances significantly."
        button="Apply for China Program"
      />
      <PublicFooter />
    </>
  )
}
