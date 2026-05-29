import Link from 'next/link'

export default function NvqPage() {
  const categories = [
    { icon: 'ti-device-laptop', title: 'IT & Technology', note: 'Newly Updated' },
    { icon: 'ti-building-skyscraper', title: 'Hospitality & Hotel Management' },
    { icon: 'ti-heart-handshake', title: 'Caregiving & Healthcare' },
    { icon: 'ti-building', title: 'Construction & Technical' },
    { icon: 'ti-truck', title: 'Logistics & Driving' },
    { icon: 'ti-briefcase', title: 'Business & Service' },
  ]

  const benefits = [
    'Nationally recognized by TVEC and employers across Sri Lanka',
    'Practical, hands-on training with industry-standard equipment',
    'Pathway to employment locally and internationally',
    'Stackable qualifications from Level 3 to Level 4',
    'Affordable fees with flexible payment plans',
  ]

  return (
    <>
      <section className="bg-gradient-to-br from-[#0B3D6B] to-[#062847] py-20 text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <span className="inline-block rounded-full bg-[#E8A020] px-4 py-1 text-xs font-bold text-[#0B3D6B]">
            TVEC Approved
          </span>
          <h1 className="mt-4 font-jakarta text-4xl font-bold sm:text-5xl">
            Build Career-Ready Skills
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-white/85">
            NVQ qualifications from Epic Campus give you nationally recognized credentials
            and the practical skills employers demand — in Sri Lanka and abroad.
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
          <h2 className="font-jakarta text-2xl font-bold text-[#0B3D6B]">Available Categories</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((c) => (
              <div
                key={c.title}
                className="rounded-xl border border-[#DDE3EC] bg-white p-6 transition-shadow hover:shadow-md"
              >
                <span className={`ti ${c.icon} text-3xl text-[#0B3D6B]`} />
                <h3 className="mt-3 font-jakarta font-bold text-[#0D1B2A]">{c.title}</h3>
                {c.note && (
                  <span className="mt-2 inline-block rounded-full bg-[#E8A020]/20 px-2 py-0.5 text-xs font-semibold text-[#0B3D6B]">
                    {c.note}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="font-jakarta text-2xl font-bold text-[#0B3D6B]">
            NVQ Certification Benefits
          </h2>
          <ul className="mt-8 space-y-3">
            {benefits.map((b) => (
              <li key={b} className="flex items-start gap-2 text-[#0D1B2A]">
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
