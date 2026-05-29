const MILESTONES = [
  { year: '2011', event: 'Epic Campus founded in Galle by Ishara Wewalwala' },
  { year: '2013', event: 'TVEC registration and first NVQ programs launched' },
  { year: '2015', event: 'Japan SSW program established — first student placements' },
  { year: '2017', event: 'Korea D2/D4 pathway launched with partner universities' },
  { year: '2019', event: 'China scholarship program introduced' },
  { year: '2021', event: 'IELTS residential program launched — 10-day intensive format' },
  { year: '2023', event: '1,000+ students placed milestone reached' },
  { year: '2025', event: 'Digital campus portal and online examination system launched' },
]

export default function AboutPage() {
  return (
    <>
      <section className="bg-[#0B3D6B] py-20 text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h1 className="font-jakarta text-4xl font-bold sm:text-5xl">About Epic Campus</h1>
          <p className="mt-4 max-w-2xl text-lg text-white/85">
            Since 2011, Epic Campus has been Sri Lanka&apos;s trusted partner for international
            education and employment — guiding students from Galle to the world.
          </p>
        </div>
      </section>

      <section className="py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-3">
            <div className="rounded-xl border border-[#DDE3EC] bg-white p-6">
              <h2 className="font-jakarta text-xl font-bold text-[#0B3D6B]">Mission</h2>
              <p className="mt-3 text-sm leading-relaxed text-[#5A6A7A]">
                To empower Sri Lankan youth with the skills, language proficiency, and global
                opportunities needed to build successful international careers.
              </p>
            </div>
            <div className="rounded-xl border border-[#DDE3EC] bg-white p-6">
              <h2 className="font-jakarta text-xl font-bold text-[#0B3D6B]">Vision</h2>
              <p className="mt-3 text-sm leading-relaxed text-[#5A6A7A]">
                To be the leading overseas education and employment institute in Sri Lanka,
                recognized for excellence, integrity, and student success.
              </p>
            </div>
            <div className="rounded-xl border border-[#DDE3EC] bg-white p-6">
              <h2 className="font-jakarta text-xl font-bold text-[#0B3D6B]">Target</h2>
              <p className="mt-3 text-sm leading-relaxed text-[#5A6A7A]">
                To place 2,000+ Sri Lankan students in Japan, Korea, China and beyond by 2028
                — with a maintained 98% visa success rate.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="font-jakarta text-2xl font-bold text-[#0B3D6B]">Our Journey</h2>
          <div className="mt-10 space-y-0">
            {MILESTONES.map((m, i) => (
              <div key={m.year} className="flex gap-6">
                <div className="flex flex-col items-center">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#E8A020] font-jakarta text-xs font-bold text-[#0B3D6B]">
                    {m.year.slice(2)}
                  </div>
                  {i < MILESTONES.length - 1 && (
                    <div className="w-0.5 flex-1 bg-[#DDE3EC]" />
                  )}
                </div>
                <div className="pb-8">
                  <p className="font-jakarta font-bold text-[#0B3D6B]">{m.year}</p>
                  <p className="mt-1 text-sm text-[#5A6A7A]">{m.event}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-2">
            <div>
              <h2 className="font-jakarta text-2xl font-bold text-[#0B3D6B]">Our Founder</h2>
              <p className="mt-4 text-lg font-jakarta font-semibold text-[#0D1B2A]">
                Ishara Wewalwala
              </p>
              <p className="mt-3 leading-relaxed text-[#5A6A7A]">
                Ishara founded Epic Campus in 2011 with a vision to give Sri Lankan youth access
                to global opportunities. Under his leadership, Epic Campus has grown from a
                small training centre in Galle to one of the south&apos;s most trusted overseas
                education institutes — with over 1,500 successful student placements.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <span className="rounded-full bg-[#0B3D6B]/10 px-4 py-1.5 text-sm font-medium text-[#0B3D6B]">
                  TVEC Approved
                </span>
                <span className="rounded-full bg-[#0B3D6B]/10 px-4 py-1.5 text-sm font-medium text-[#0B3D6B]">
                  Company Registered
                </span>
                <span className="rounded-full bg-[#E8A020]/20 px-4 py-1.5 text-sm font-medium text-[#0B3D6B]">
                  Est. 2011
                </span>
              </div>
            </div>
            <div className="flex items-center justify-center rounded-2xl bg-gradient-to-br from-[#0B3D6B] to-[#1A6BAD] p-12 text-center text-white">
              <div>
                <span className="ti ti-users text-6xl text-[#E8A020]" />
                <p className="mt-4 font-jakarta text-xl font-bold">The Epic Campus Team</p>
                <p className="mt-2 text-sm text-white/75">
                  Dedicated trainers, counsellors, and visa specialists committed to your success.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
