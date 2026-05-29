import Link from 'next/link'

export default function KoreaPage() {
  return (
    <>
      <section className="bg-gradient-to-br from-[#003478]/10 via-[#F5F7FB] to-[#C60C30]/10 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <span className="text-5xl">🇰🇷</span>
          <h1 className="mt-4 font-jakarta text-4xl font-bold text-[#0B3D6B] sm:text-5xl">
            Study in Korea
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-[#5A6A7A]">
            Pursue your degree at a Korean university with scholarship opportunities — from
            language school (D-4) to full degree programs (D-2).
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
          <h2 className="font-jakarta text-2xl font-bold text-[#0B3D6B]">D-4 → D-2 Pathway</h2>
          <p className="mt-4 max-w-3xl leading-relaxed text-[#5A6A7A]">
            Start with a D-4 language training visa to learn Korean at a partner institution,
            then transition to a D-2 student visa for your degree program. Epic Campus prepares
            you for TOPIK exams and guides every step of the application process.
          </p>
          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            <div className="rounded-xl border border-[#DDE3EC] bg-white p-6">
              <h3 className="font-jakarta font-bold text-[#0B3D6B]">D-4 Language Training</h3>
              <p className="mt-2 text-sm text-[#5A6A7A]">
                6–12 months of Korean language study at a partner language institute in Korea.
              </p>
            </div>
            <div className="rounded-xl border border-[#DDE3EC] bg-white p-6">
              <h3 className="font-jakarta font-bold text-[#0B3D6B]">D-2 Degree Program</h3>
              <p className="mt-2 text-sm text-[#5A6A7A]">
                Bachelor&apos;s or Master&apos;s degree at a Korean university with scholarship
                support.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="font-jakarta text-2xl font-bold text-[#0B3D6B]">
            Scholarship Opportunities
          </h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            <div className="rounded-xl border-2 border-[#E8A020] bg-[#FFF8EB] p-6">
              <h3 className="font-jakarta font-bold text-[#0B3D6B]">Full Scholarship</h3>
              <p className="mt-2 text-sm text-[#5A6A7A]">
                Tuition, accommodation, and living allowance covered by Korean government or
                university scholarships (GKS, university-specific awards).
              </p>
            </div>
            <div className="rounded-xl border border-[#DDE3EC] p-6">
              <h3 className="font-jakarta font-bold text-[#0B3D6B]">Partial Scholarship</h3>
              <p className="mt-2 text-sm text-[#5A6A7A]">
                30–70% tuition reduction based on academic merit and TOPIK level.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="font-jakarta text-2xl font-bold text-[#0B3D6B]">Requirements</h2>
          <ul className="mt-6 space-y-3">
            {[
              'TOPIK Level 2 or higher (we train you to achieve this)',
              'Valid passport and academic transcripts (O/L or A/L)',
              'Bank statement showing sufficient funds',
              'Clean medical and police clearance',
              'Completed Epic Campus Korean language program',
            ].map((r) => (
              <li key={r} className="flex items-start gap-2 text-[#0D1B2A]">
                <span className="text-[#E8A020]">✓</span>
                {r}
              </li>
            ))}
          </ul>
          <h3 className="mt-10 font-jakarta text-xl font-bold text-[#0B3D6B]">
            Popular Courses
          </h3>
          <div className="mt-4 flex flex-wrap gap-3">
            {['Engineering', 'Business Administration', 'Arts & Design', 'IT & Computer Science', 'Nursing'].map(
              (c) => (
                <span
                  key={c}
                  className="rounded-full bg-[#0B3D6B]/10 px-4 py-1.5 text-sm font-medium text-[#0B3D6B]"
                >
                  {c}
                </span>
              ),
            )}
          </div>
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
