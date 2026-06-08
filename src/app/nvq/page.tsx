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

const NVQ_PROGRAMS = [
  {
    emoji: '💻',
    title: 'Information Technology',
    borderClass: 'border-t-4 border-green-500',
    badge: 'NEWLY UPDATED',
    desc: 'Computer applications, software basics, digital literacy, and office productivity tools.',
    tags: ['NVQ Level 3', '3-6 Months', 'TVEC Certified'],
  },
  {
    emoji: '🏨',
    title: 'Hospitality & Hotel Management',
    borderClass: 'border-t-4 border-blue-500',
    desc: 'Front office, food & beverage, housekeeping. Pathway to hotel careers locally and abroad.',
    tags: ['NVQ Level 3', '6 Months', 'TVEC Certified'],
  },
  {
    emoji: '🤝',
    title: 'Caregiving & Healthcare Support',
    borderClass: 'border-t-4 border-pink-500',
    desc: 'Elderly care, patient support, and healthcare assistance. High demand in Japan and Korea.',
    tags: ['NVQ Level 3', '6 Months', 'TVEC Certified'],
  },
  {
    emoji: '🏗️',
    title: 'Construction & Technical Skills',
    borderClass: 'border-t-4 border-orange-500',
    desc: 'Masonry, carpentry, plumbing basics, and site safety. Overseas construction pathway included.',
    tags: ['NVQ Level 3', '6 Months', 'TVEC Certified'],
  },
  {
    emoji: '🚚',
    title: 'Logistics & Driving',
    borderClass: 'border-t-4 border-[#0B3D6B]',
    desc: 'Logistics management and driving skills. Direct pathway to Japan SSW Truck Driving category.',
    tags: ['NVQ Level 3', '6 Months', 'TVEC Certified'],
  },
  {
    emoji: '💼',
    title: 'Business & Service Sectors',
    borderClass: 'border-t-4 border-purple-500',
    desc: 'Business administration, customer service, and retail management for local and overseas roles.',
    tags: ['NVQ Level 3', '3-6 Months', 'TVEC Certified'],
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
      />
      <StatsBar stats={STATS} />

      <section id="programs" className="bg-white py-24">
        <div className="mx-auto max-w-6xl px-4">
          <SectionTitle title="NVQ Program Categories" />
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {NVQ_PROGRAMS.map((program) => (
              <div key={program.title} className={`${CARD} relative ${program.borderClass}`}>
                {program.badge && (
                  <span className="absolute right-6 top-6 rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">
                    {program.badge}
                  </span>
                )}
                <div className="text-4xl">{program.emoji}</div>
                <h3 className="mt-3 font-semibold text-[#0B3D6B]">{program.title}</h3>
                <p className="mt-2 text-sm text-gray-500">{program.desc}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {program.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-600"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
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
