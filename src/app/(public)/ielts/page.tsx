import Link from 'next/link'

export default function IeltsPage() {
  const bands = [
    { level: '6.0 Foundation', desc: 'Entry-level university and migration requirements.' },
    { level: '6.5 Competent', desc: 'Most undergraduate and professional registration standards.' },
    { level: '7.0+ Advanced', desc: 'Postgraduate, medical, and top-tier university entry.' },
  ]

  const included = [
    'Expert IELTS trainers with proven track records',
    'Daily mock tests under real exam conditions',
    'Personalized feedback on writing and speaking',
    'Residential environment — zero distractions',
    'Listening, Reading, Writing & Speaking mastery',
    'Small class sizes for individual attention',
  ]

  return (
    <>
      <section className="bg-gradient-to-br from-[#0B3D6B] to-[#1A6BAD] py-20 text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <span className="text-5xl">📝</span>
          <h1 className="mt-4 font-jakarta text-4xl font-bold sm:text-5xl">
            Achieve Your Target Band Score
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-white/85">
            Epic Campus&apos;s intensive 10-day residential IELTS program is designed to lift
            your score fast — with expert trainers, daily mocks, and zero distractions.
          </p>
          <Link
            href="/contact"
            className="mt-8 inline-block rounded-lg bg-[#E8A020] px-8 py-3.5 font-jakarta text-sm font-bold text-[#0B3D6B]"
          >
            Apply Now
          </Link>
        </div>
      </section>

      <section className="py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="font-jakarta text-2xl font-bold text-[#0B3D6B]">
            10-Day Residential Program
          </h2>
          <p className="mt-4 max-w-3xl leading-relaxed text-[#5A6A7A]">
            Live on campus for 10 days of focused IELTS preparation. Our residential format
            eliminates daily distractions and immerses you in English — the fastest path to
            your target band.
          </p>
        </div>
      </section>

      <section className="bg-white py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="font-jakarta text-2xl font-bold text-[#0B3D6B]">Target Bands</h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-3">
            {bands.map((b) => (
              <div
                key={b.level}
                className="rounded-xl border border-[#DDE3EC] p-6 text-center"
              >
                <p className="font-jakarta text-2xl font-bold text-[#E8A020]">{b.level}</p>
                <p className="mt-2 text-sm text-[#5A6A7A]">{b.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="font-jakarta text-2xl font-bold text-[#0B3D6B]">
            What&apos;s Included
          </h2>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2">
            {included.map((item) => (
              <li key={item} className="flex items-start gap-3 rounded-xl border border-[#DDE3EC] bg-white p-4">
                <span className="text-[#E8A020]">✓</span>
                <span className="text-[#0D1B2A]">{item}</span>
              </li>
            ))}
          </ul>
          <Link
            href="/contact"
            className="mt-10 inline-block rounded-lg bg-[#E8A020] px-8 py-3.5 font-jakarta text-sm font-bold text-[#0B3D6B]"
          >
            Apply Now
          </Link>
        </div>
      </section>
    </>
  )
}
