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
  { number: '1,500+', label: 'Students Placed' },
  { number: '98%', label: 'Visa Success Rate' },
  { number: '50+', label: 'Partner Companies' },
  { number: '2011', label: 'Est. in Sri Lanka' },
]

const WHY_JAPAN = [
  {
    emoji: '💴',
    title: 'High Earning Potential',
    desc: 'Average ¥200,000–¥350,000/month with overtime. Accommodation often provided by employer.',
  },
  {
    emoji: '🛡️',
    title: 'Safe & Legal Employment',
    desc: 'SSW visa guarantees full legal employment rights, healthcare, and pension contributions.',
  },
  {
    emoji: '🌏',
    title: 'Long-Term Career Path',
    desc: 'SSW holders can renew visas and progress toward permanent residency after 5+ years.',
  },
]

const JOB_CATEGORIES = [
  { emoji: '🚛', title: 'Truck Driving', desc: "Japan's largest SSW intake category. Logistics and freight delivery." },
  { emoji: '🏗️', title: 'Construction', desc: 'Building and civil infrastructure projects across Japan.' },
  { emoji: '🏭', title: 'Manufacturing', desc: 'Factory and production line work in automotive and electronics sectors.' },
  { emoji: '🌾', title: 'Agriculture', desc: 'Farm work, harvesting, and food processing roles.' },
  { emoji: '🤝', title: 'Caregiving', desc: 'Elderly care facilities. High demand and growing sector.' },
  { emoji: '✈️', title: 'Airport Handling', desc: 'Ground operations, baggage, and aircraft servicing.' },
]

const PATHWAY_STEPS = [
  { title: 'Language Training', desc: 'Study Japanese at EPIC Campus. JLPT N5 to N3 levels.' },
  { title: 'Pass Exams', desc: 'Clear JLPT/JFT + SSW Skills Test with our expert coaching.' },
  { title: 'Job Offer & Visa', desc: 'Secure employer match. We handle full SSW visa documentation.' },
  { title: 'Travel & Work', desc: 'Pre-departure orientation, then fly to Japan and start earning.' },
]

const LANGUAGE_COURSES = [
  {
    badge: 'N5 — Beginner',
    badgeClass: 'bg-green-100 text-green-700',
    title: 'Foundation Japanese',
    duration: '3 months',
    content: 'Hiragana, Katakana, basic grammar, survival phrases. Prepares for JLPT N5 / JFT-Basic.',
  },
  {
    badge: 'N4 — Elementary',
    badgeClass: 'bg-blue-100 text-blue-700',
    title: 'Elementary Japanese',
    duration: '6 months',
    content: 'Daily conversation, reading simple sentences. Minimum required for most SSW jobs.',
  },
  {
    badge: 'N3 — Intermediate',
    badgeClass: 'bg-purple-100 text-purple-700',
    title: 'Working Japanese',
    duration: '9 months',
    content: 'Workplace Japanese, reading notices, professional communication. Opens higher-tier SSW roles.',
  },
]

export default function JapanPage() {
  return (
    <>
      <PublicNav />
      <PageHero
        accentGradient="linear-gradient(90deg, #bc002d, #0B3D6B)"
        overline="JAPAN SSW & STUDY PROGRAMS"
        headline="Work & Study in Japan"
        subtext="Enter Japan legally through the Specified Skilled Worker (SSW) program. No university degree required for many categories."
      />
      <StatsBar stats={STATS} />

      <section className="bg-white py-24">
        <div className="mx-auto max-w-6xl px-4">
          <SectionTitle title="Why Choose Japan?" />
          <div className="grid gap-8 md:grid-cols-3">
            {WHY_JAPAN.map((item) => (
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
          <SectionTitle title="High-Demand SSW Job Categories" />
          <div className="grid grid-cols-2 gap-6 md:grid-cols-3">
            {JOB_CATEGORIES.map((job) => (
              <div key={job.title} className={CARD}>
                <div className="text-4xl">{job.emoji}</div>
                <h3 className="mt-3 font-semibold text-[#0B3D6B]">{job.title}</h3>
                <p className="mt-1 text-sm text-gray-500">{job.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white py-24">
        <div className="mx-auto max-w-6xl px-4">
          <SectionTitle title="Your Pathway to Japan" />
          <TimelineSteps steps={PATHWAY_STEPS} columns={4} />
        </div>
      </section>

      <section className="bg-[#F5F7FB] py-24">
        <div className="mx-auto max-w-6xl px-4">
          <SectionTitle title="Japanese Language Training" />
          <div className="grid gap-8 md:grid-cols-3">
            {LANGUAGE_COURSES.map((course) => (
              <div key={course.title} className={CARD}>
                <span className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${course.badgeClass}`}>
                  {course.badge}
                </span>
                <h3 className="mt-4 font-semibold text-[#0B3D6B]">{course.title}</h3>
                <p className="mt-1 text-sm font-medium text-[#E8A020]">{course.duration}</p>
                <p className="mt-3 text-sm text-gray-500">{course.content}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <CtaSection
        title="Ready to Start Your Japan Journey?"
        subtext="Join 1,500+ Sri Lankan students who have successfully built careers in Japan through EPIC Campus."
        button="Book Free Consultation"
      />
      <PublicFooter />
    </>
  )
}
