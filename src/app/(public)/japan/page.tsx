import Link from 'next/link'

export default function JapanPage() {
  const sectors = [
    { icon: 'ti-truck', label: 'Truck Driving & Logistics' },
    { icon: 'ti-building', label: 'Construction & Engineering' },
    { icon: 'ti-heart-handshake', label: 'Caregiving & Healthcare' },
    { icon: 'ti-tools-kitchen-2', label: 'Food Service & Hospitality' },
    { icon: 'ti-seeding', label: 'Agriculture & Farming' },
  ]

  const pathway = [
    'Japanese language training at Epic Campus (Irodori + JLPT prep)',
    'Pass JLPT N4/N5 or JFT-Basic + SSW Skill Exam',
    'Secure job offer from a Japanese employer',
    'Apply for Specified Skilled Worker (SSW) Visa',
    'Travel to Japan and begin your career',
  ]

  const benefits = [
    'Competitive salary in yen — often 3–5× Sri Lankan earnings',
    'Legal work visa with renewal pathways',
    'No university degree required for most SSW categories',
    'High demand across multiple industries',
    'Epic Campus support from training through departure',
  ]

  return (
    <>
      <section className="bg-gradient-to-br from-[#BC002D]/10 via-[#F5F7FB] to-[#0B3D6B]/10 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <span className="text-5xl">🇯🇵</span>
          <h1 className="mt-4 font-jakarta text-4xl font-bold text-[#0B3D6B] sm:text-5xl">
            Work in Japan
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-[#5A6A7A]">
            The Specified Skilled Worker (SSW) visa opens Japan&apos;s job market to Sri Lankan
            workers — with Epic Campus guiding you from language training to visa approval.
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
            Specified Skilled Worker (SSW) Program
          </h2>
          <p className="mt-4 max-w-3xl leading-relaxed text-[#5A6A7A]">
            Japan&apos;s SSW visa program allows foreign workers to live and work in Japan in
            14 designated industries facing labour shortages. Epic Campus provides comprehensive
            Japanese language training, exam preparation, and full visa documentation support.
          </p>
        </div>
      </section>

      <section className="bg-white py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="font-jakarta text-2xl font-bold text-[#0B3D6B]">
            High-Demand Job Sectors
          </h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sectors.map((s) => (
              <div
                key={s.label}
                className="flex items-center gap-4 rounded-xl border border-[#DDE3EC] p-5"
              >
                <span className={`ti ${s.icon} text-3xl text-[#0B3D6B]`} />
                <span className="font-jakarta font-semibold text-[#0D1B2A]">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="font-jakarta text-2xl font-bold text-[#0B3D6B]">Your Pathway to Japan</h2>
          <ol className="mt-8 space-y-4">
            {pathway.map((step, i) => (
              <li
                key={step}
                className="flex gap-4 rounded-xl border border-[#DDE3EC] bg-white p-5"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#0B3D6B] font-jakarta font-bold text-white">
                  {i + 1}
                </span>
                <span className="pt-2 text-[#0D1B2A]">{step}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="bg-[#0B3D6B] py-16 text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="font-jakarta text-2xl font-bold">SSW Visa Benefits</h2>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {benefits.map((b) => (
              <li key={b} className="flex items-start gap-2 text-white/90">
                <span className="text-[#E8A020]">✓</span>
                {b}
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
