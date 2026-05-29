import Link from 'next/link'

export default function ChinaPage() {
  return (
    <>
      <section className="bg-gradient-to-br from-[#DE2910]/10 via-[#F5F7FB] to-[#FFDE00]/10 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <span className="text-5xl">🇨🇳</span>
          <h1 className="mt-4 font-jakarta text-4xl font-bold text-[#0B3D6B] sm:text-5xl">
            Study in China
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-[#5A6A7A]">
            Access world-class universities with generous scholarship packages — medicine, IT,
            business and more, taught in English or Chinese.
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
          <h2 className="font-jakarta text-2xl font-bold text-[#0B3D6B]">Scholarship Programs</h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            <div className="rounded-xl border-2 border-[#E8A020] bg-[#FFF8EB] p-6">
              <h3 className="font-jakarta font-bold text-[#0B3D6B]">Full Scholarship (CSC)</h3>
              <p className="mt-2 text-sm text-[#5A6A7A]">
                Chinese Government Scholarship covers tuition, accommodation, medical insurance,
                and monthly stipend for the full duration of study.
              </p>
            </div>
            <div className="rounded-xl border border-[#DDE3EC] bg-white p-6">
              <h3 className="font-jakarta font-bold text-[#0B3D6B]">Partial Scholarship</h3>
              <p className="mt-2 text-sm text-[#5A6A7A]">
                University-specific awards covering 25–75% of tuition fees based on academic
                performance.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="font-jakarta text-2xl font-bold text-[#0B3D6B]">Popular Courses</h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-3">
            {[
              {
                title: 'Medicine (MBBS)',
                desc: 'WHO-recognized medical degrees at top Chinese universities.',
                icon: 'ti-stethoscope',
              },
              {
                title: 'Business & Economics',
                desc: 'MBA and BBA programs at internationally ranked institutions.',
                icon: 'ti-briefcase',
              },
              {
                title: 'IT & Artificial Intelligence',
                desc: 'Cutting-edge tech programs in China\'s innovation hubs.',
                icon: 'ti-cpu',
              },
            ].map((c) => (
              <div key={c.title} className="rounded-xl border border-[#DDE3EC] p-6">
                <span className={`ti ${c.icon} text-3xl text-[#0B3D6B]`} />
                <h3 className="mt-3 font-jakarta font-bold text-[#0B3D6B]">{c.title}</h3>
                <p className="mt-2 text-sm text-[#5A6A7A]">{c.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="font-jakarta text-2xl font-bold text-[#0B3D6B]">Entry Pathways</h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            <div className="rounded-xl border border-[#DDE3EC] bg-white p-6">
              <h3 className="font-jakarta font-bold text-[#0B3D6B]">After O/L</h3>
              <p className="mt-2 text-sm text-[#5A6A7A]">
                Foundation year + language preparation, then direct entry to undergraduate
                programs in selected fields.
              </p>
            </div>
            <div className="rounded-xl border border-[#DDE3EC] bg-white p-6">
              <h3 className="font-jakarta font-bold text-[#0B3D6B]">After A/L</h3>
              <p className="mt-2 text-sm text-[#5A6A7A]">
                Direct entry to Bachelor&apos;s or Master&apos;s programs with scholarship
                application support from Epic Campus.
              </p>
            </div>
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
