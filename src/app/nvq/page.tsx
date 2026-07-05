'use client'

import PublicNav from '@/components/public/PublicNav'
import PublicFooter from '@/components/public/PublicFooter'
import {
  CARD,
  CtaSection,
  PageHero,
  SectionTitle,
  StatsBar,
} from '@/components/public/program-page-ui'

const STATS = [
  { number: 'TVEC', label: 'Approved Institute' },
  { number: 'A13430', label: 'Our Reg. Number' },
  { number: '6', label: 'Skill Categories' },
  { number: 'Jul 2027', label: 'Approved Until' },
]

interface NvqProgram {
  emoji: string
  title: string
  badge?: string
  desc: string
  tags: string[]
  comingSoon?: boolean
}

const NVQ_PROGRAMS: NvqProgram[] = [
  {
    emoji: '💻',
    title: 'Information Technology',
    badge: 'NEWLY UPDATED',
    desc: 'Computer applications, software basics, digital literacy, and office productivity tools.',
    tags: ['NVQ Level 3', '3-6 Months', 'TVEC Certified'],
  },
  {
    emoji: '🏨',
    title: 'Hospitality & Hotel Management',
    desc: 'Front office, food & beverage, housekeeping. Pathway to hotel careers locally and abroad.',
    tags: ['NVQ Level 3', '6 Months', 'TVEC Certified'],
  },
  {
    emoji: '🤝',
    title: 'Caregiving & Healthcare Support',
    desc: 'Elderly care, patient support, and healthcare assistance. High demand in Japan and Korea.',
    tags: ['NVQ Level 3', '6 Months', 'TVEC Certified'],
  },
  {
    emoji: '🏗️',
    title: 'Construction & Technical Skills',
    desc: 'Masonry, carpentry, plumbing basics, and site safety. Overseas construction pathway included.',
    tags: ['NVQ Level 3', '6 Months', 'TVEC Certified'],
  },
  {
    emoji: '🚚',
    title: 'Logistics & Driving',
    desc: 'Logistics management and driving skills. Direct pathway to Japan SSW Truck Driving category.',
    tags: ['NVQ Level 3', '6 Months', 'TVEC Certified'],
  },
  {
    emoji: '💼',
    title: 'Business & Service Sectors',
    desc: 'Business administration, customer service, and retail management for local and overseas roles.',
    tags: ['NVQ Level 3', '3-6 Months', 'TVEC Certified'],
  },
  {
    emoji: '🤖',
    title: 'NVQ AI Program',
    desc: 'First AI-integrated NVQ program in Sri Lanka — pioneered by EPIC Campus. Combining vocational skills with artificial intelligence.',
    tags: ['First in Sri Lanka', 'AI Integration', 'Coming Soon'],
    comingSoon: true,
  },
]

const WHY_NVQ = [
  {
    emoji: '✅',
    title: 'Nationally Recognized',
    desc: 'TVEC-approved certificates accepted by employers across Sri Lanka and internationally.',
  },
  {
    emoji: '🔧',
    title: 'Hands-On Training',
    desc: 'Practical, industry-focused training. You learn by doing, not just studying theory.',
  },
  {
    emoji: '🌏',
    title: 'Global Career Pathways',
    desc: 'NVQ certification supports Japan SSW visa applications and other overseas employment routes.',
  },
  {
    emoji: '⚡',
    title: 'Fast Career Start',
    desc: 'Programs run 3–6 months. Start your career faster than a traditional university degree.',
  },
]

export default function NvqPage() {
  return (
    <>
      <PublicNav />
      <PageHero
        accentGradient="linear-gradient(90deg, #0B3D6B, #E8A020)"
        overline="NVQ & SKILL DEVELOPMENT"
        headline="Nationally Recognized Qualifications for Global Careers"
        subtext="TVEC-approved NVQ training programs. Build practical skills for local employment and international career pathways."
        verifiedBadge="TVEC Approved — Reg. No. A13430"
      />
      <StatsBar stats={STATS} />

      <section id="programs" className="bg-white py-24 dark:bg-[#04090f]">
        <div className="mx-auto max-w-6xl px-4">
          <SectionTitle title="NVQ Program Categories" />
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {NVQ_PROGRAMS.map((program) => (
              program.comingSoon ? (
                <div key={program.title}
                  className="relative rounded-2xl border-2 border-[#E8A020] bg-white p-8 dark:border-[#E8A020]/60 dark:bg-[#0B3D6B]/20">
                  <span className="absolute right-6 top-6 rounded-full bg-[#E8A020] px-3 py-1 text-xs font-bold text-white">
                    Coming Soon
                  </span>
                  <div className="text-4xl">{program.emoji}</div>
                  <h3 className="mt-3 font-semibold text-gray-900 dark:text-white">{program.title}</h3>
                  <p className="mt-2 text-sm text-gray-600 dark:text-white/60">{program.desc}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {program.tags.map((tag) => (
                      <span key={tag} className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-[#0B3D6B] dark:bg-[#0B3D6B]/30 dark:text-blue-300">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <div key={program.title}
                  className="relative rounded-2xl border border-[#0B3D6B] bg-white p-8 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_4px_20px_rgba(11,61,107,0.2)] dark:border-[#1A6BAD]/40 dark:bg-[#0B3D6B]/20">
                  {program.badge && (
                    <span className="absolute right-6 top-6 rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700 dark:bg-green-900/30 dark:text-green-300">
                      {program.badge}
                    </span>
                  )}
                  <div className="text-4xl">{program.emoji}</div>
                  <h3 className="mt-3 font-semibold text-gray-900 dark:text-white">{program.title}</h3>
                  <p className="mt-2 text-sm text-gray-600 dark:text-white/60">{program.desc}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {program.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-[#0B3D6B] dark:bg-[#0B3D6B]/30 dark:text-blue-300"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#F5F7FB] py-24">
        <div className="mx-auto max-w-6xl px-4">
          <SectionTitle title="Why Choose NVQ?" />
          <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
            {WHY_NVQ.map((item) => (
              <div key={item.title} className={CARD}>
                <div className="text-4xl">{item.emoji}</div>
                <h3 className="mt-3 font-semibold text-[#0B3D6B]">{item.title}</h3>
                <p className="mt-2 text-sm text-gray-500">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white py-24">
        <div className="mx-auto max-w-6xl px-4">
          <SectionTitle title="TVEC Approved & Government Certified" />
          <div className="mx-auto max-w-3xl rounded-2xl bg-[#F5F7FB] p-12 text-center">
            <div className="mb-4 text-5xl">🏛️</div>
            <h3 className="mb-2 text-2xl font-bold text-[#0B3D6B]">
              Tertiary & Vocational Education Commission
            </h3>
            <p className="mb-6 text-gray-600">
              EPIC Campus is a registered and accredited training institute authorized to deliver
              vocational training and award nationally recognized NVQ qualifications.
            </p>
            <div className="mt-8 grid grid-cols-3 gap-6">
              <div className="text-center">
                <div className="text-2xl font-black text-[#0B3D6B]">A13430</div>
                <div className="mt-1 text-xs uppercase tracking-wide text-gray-500">
                  Registration Number
                </div>
              </div>
              <div className="border-x border-gray-200 text-center">
                <div className="text-2xl font-black text-[#0B3D6B]">P04/0223</div>
                <div className="mt-1 text-xs uppercase tracking-wide text-gray-500">
                  TVEC Reg. No.
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-black text-[#0B3D6B]">Jul 2027</div>
                <div className="mt-1 text-xs uppercase tracking-wide text-gray-500">
                  Valid Until
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <CtaSection
        title="Start Your NVQ Journey"
        subtext="Government-certified training that opens doors locally and internationally."
        button="Apply for NVQ Program"
      />
      <PublicFooter />
    </>
  )
}
