export const metadata = {
  title: 'About Us — EPIC Campus',
  description: 'Learn about EPIC Campus, Sri Lanka\'s #1 overseas education institute. Est. 2011.',
}

export default function AboutPage() {
  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden bg-[#03080f] py-24">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(26,107,173,0.07)_1px,transparent_1px),linear-gradient(90deg,rgba(26,107,173,0.07)_1px,transparent_1px)] bg-[size:40px_40px]" />
        <div className="pointer-events-none absolute left-1/2 top-0 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(11,61,107,0.45)_0%,transparent_70%)]" />
        <div className="relative mx-auto max-w-4xl px-4 text-center sm:px-6">
          <p className="mb-3 text-[11px] font-bold uppercase tracking-[4px] text-[#E8A020]">Our story</p>
          <h1 className="font-jakarta text-[52px] font-black leading-tight text-white">
            Building futures<br />
            <span style={{ color: 'transparent', WebkitTextStroke: '1.5px rgba(255,255,255,0.25)' }}>since 2011</span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-[16px] leading-relaxed text-white/40">
            EPIC Campus is Sri Lanka's most trusted overseas education and employment institute,
            helping over 1,500 students build global careers in Japan, Korea and China.
          </p>
        </div>
      </section>

      {/* Mission + Vision */}
      <section className="bg-white py-24 dark:bg-[#04090f]">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            {[
              {
                icon: 'ti-eye',
                title: 'Our Vision',
                desc: 'To empower Sri Lankan youth through quality training and international employment opportunities, becoming a trusted gateway for professionals to achieve global career success.',
              },
              {
                icon: 'ti-target',
                title: 'Our Mission',
                desc: 'To provide ethical, transparent and sustainable overseas employment and education opportunities that contribute to Sri Lanka\'s socioeconomic development.',
              },
              {
                icon: 'ti-trophy',
                title: 'Our Goal',
                desc: 'To create overseas education and employment opportunities for thousands of Sri Lankan students, equipping them with language proficiency and career-focused training.',
              },
            ].map(item => (
              <div key={item.title} className="rounded-2xl border border-gray-100 border-l-4 border-l-[#0B3D6B] shadow-sm bg-white p-8 dark:border-white/[0.08] dark:bg-white/[0.03]">
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-[#0B3D6B]/10 dark:bg-[#0B3D6B]/30">
                  <span className={`ti ${item.icon} text-[22px] text-[#0B3D6B] dark:text-blue-300`} />
                </div>
                <h3 className="font-jakarta text-[18px] font-bold text-[#0B3D6B] dark:text-white mb-3">{item.title}</h3>
                <p className="text-[14px] leading-relaxed text-[#5A6A7A] dark:text-white/40">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Story */}
      <section className="bg-[#F5F7FB] py-24 dark:bg-[#071428]">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid grid-cols-1 gap-16 lg:grid-cols-2 lg:items-center">
            <div>
              <p className="mb-3 text-[11px] font-bold uppercase tracking-[4px] text-[#E8A020]">Who we are</p>
              <h2 className="font-jakarta text-[36px] font-black text-[#0B3D6B] dark:text-white mb-6">
                15 years of opening doors to the world
              </h2>
              <div className="space-y-4 text-[15px] leading-relaxed text-[#5A6A7A] dark:text-white/40">
                <p>Founded in 2011 in Galle, Sri Lanka, EPIC Campus began as a small training institute with one goal — to help Sri Lankan youth access world-class opportunities abroad.</p>
                <p>Today we are the country's most trusted overseas education partner, with campuses in Ahangama, Galle, Waduraba and Pinnaduwa, serving students across all of Southern Sri Lanka.</p>
                <p>We hold TVEC accreditation, government licenses for Student Visa, Engineering Visa and SSW Visa processing, and partnerships with 50+ universities and companies across Japan, Korea and China.</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { num: '1,500+', label: 'Students placed abroad', color: 'bg-[#0B3D6B]' },
                { num: '98%', label: 'Visa approval rate', color: 'bg-[#E8A020]' },
                { num: '50+', label: 'Partner institutions', color: 'bg-[#1A6BAD]' },
                { num: '15yr', label: 'Years of experience', color: 'bg-[#0B3D6B]' },
              ].map(s => (
                <div key={s.label} className={`${s.color} rounded-2xl p-6 text-white`}>
                  <p className="font-jakarta text-[36px] font-black leading-none">{s.num}</p>
                  <p className="mt-2 text-[12px] font-semibold text-white/70">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Milestones */}
      <section className="bg-white py-24 dark:bg-[#04090f]">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="mb-16 text-center">
            <p className="mb-3 text-[11px] font-bold uppercase tracking-[4px] text-[#E8A020]">Our journey</p>
            <h2 className="font-jakarta text-[36px] font-black text-[#0B3D6B] dark:text-white">Key milestones</h2>
          </div>
          <div className="space-y-6">
            {[
              { year: '2011', text: 'EPIC Campus founded in Galle, Sri Lanka.' },
              { year: '2012', text: 'Launched the first international exchange program.' },
              { year: '2015', text: 'Established partnerships with leading overseas institutions.' },
              { year: '2018', text: 'Expanded into corporate training programs.' },
              { year: '2022', text: 'Began the SSW Visa process to support overseas employment in Japan.' },
              { year: '2023', text: 'Increased intakes and saw a significant rise in JLPT and JFT pass rates. Launched Korean language program.' },
              { year: '2024', text: 'Launched online e-learning platform and expanded into digital education.' },
              { year: '2025', text: 'Obtained licenses for Student Visa, Engineering Visa and SSW Visa. Received TVEC accreditation.' },
            ].map((m, i) => (
              <div key={m.year} className="flex gap-6 items-start">
                <div className="flex-shrink-0 w-16 text-right">
                  <span className="font-jakarta text-[14px] font-black text-[#E8A020]">{m.year}</span>
                </div>
                <div className="flex flex-col items-center">
                  <div className="h-3 w-3 rounded-full bg-[#0B3D6B] dark:bg-[#E8A020] mt-0.5" />
                  {i < 7 && <div className="w-0.5 flex-1 bg-[#DDE3EC] dark:bg-white/10 mt-2 min-h-[24px]" />}
                </div>
                <div className="flex-1 pb-6">
                  <p className="text-[15px] text-[#0D1B2A] dark:text-white/70 leading-relaxed">{m.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Accreditations */}
      <section className="bg-[#F5F7FB] py-20 dark:bg-[#071428]">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 text-center">
          <p className="mb-3 text-[11px] font-bold uppercase tracking-[4px] text-[#E8A020]">Recognised and approved</p>
          <h2 className="font-jakarta text-[32px] font-black text-[#0B3D6B] dark:text-white mb-12">Accreditations</h2>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            {[
              { icon: 'ti-certificate', title: 'TVEC Approved', desc: 'Tertiary and Vocational Education Commission accredited training institute. Approval No. A13430.' },
              { icon: 'ti-building', title: 'Company Registered', desc: 'Registered private company in Sri Lanka. Company No. PV 00265988, incorporated November 2022.' },
              { icon: 'ti-license', title: 'Visa Licensed', desc: 'Licensed by the relevant government bureaus for Student Visa, Engineering Visa and SSW Visa processing.' },
            ].map(a => (
              <div key={a.title} className="rounded-2xl border border-[#DDE3EC] bg-white p-7 dark:border-white/[0.08] dark:bg-white/[0.03] text-left">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-[#0B3D6B]">
                  <span className={`ti ${a.icon} text-[18px] text-[#E8A020]`} />
                </div>
                <h3 className="font-jakarta font-bold text-[#0B3D6B] dark:text-white mb-2">{a.title}</h3>
                <p className="text-[13px] leading-relaxed text-[#5A6A7A] dark:text-white/40">{a.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-[#03080f] py-20">
        <div className="mx-auto max-w-2xl px-4 text-center sm:px-6">
          <h2 className="font-jakarta text-[36px] font-black text-white mb-4">
            Ready to start your journey?
          </h2>
          <p className="text-[15px] text-white/40 mb-10">
            Join over 1,500 Sri Lankans who have built careers abroad with EPIC Campus.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <a href="/enroll"
              className="flex items-center justify-center gap-2 rounded-xl bg-[#E8A020] px-8 py-4 text-[14px] font-black text-[#03080f] hover:bg-[#f0b030] transition-colors">
              Apply now
              <span className="ti ti-arrow-right" />
            </a>
            <a href="/contact"
              className="flex items-center justify-center gap-2 rounded-xl border border-white/10 px-8 py-4 text-[14px] font-semibold text-white/60 hover:border-white/20 hover:text-white transition-all">
              Contact us
            </a>
          </div>
        </div>
      </section>
    </div>
  )
}
