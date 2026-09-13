import Link from 'next/link'
import PublicNav from '@/components/public/PublicNav'
import PublicFooter from '@/components/public/PublicFooter'
import EnrollmentForm from '@/components/enrollment/EnrollmentForm'

export const metadata = {
  title: 'Enroll — EPIC Campus',
  description: 'Start your journey to Japan, Korea, China or global career success. Enroll at EPIC Campus today.',
}

export default function EnrollPage() {
  return (
    <div className="min-h-screen bg-[#F5F7FB] dark:bg-[#130F2A]">
      <PublicNav />
      <main className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-5">
          {/* Trust panel */}
          <div className="lg:col-span-2">
            <Link href="/" className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-[#5A6A7A] dark:text-white/50 hover:text-[#0B3D6B] dark:hover:text-white transition-colors">
              <span className="ti ti-arrow-left" /> Back to home
            </Link>
            <div className="rounded-2xl bg-[#0B3D6B] p-7 text-white sticky top-24">
              <h2 className="font-jakarta text-[22px] font-black mb-2">Start your journey</h2>
              <p className="text-[13px] text-white/50 mb-8 leading-relaxed">
                Fill in your details and our team will contact you within 24 hours.
              </p>
              <div className="space-y-4">
                {[
                  { icon: 'ti-shield-check', text: '98% visa approval rate — highest in Sri Lanka' },
                  { icon: 'ti-certificate', text: 'TVEC approved and government registered' },
                  { icon: 'ti-headset', text: 'Full support from application to settlement' },
                  { icon: 'ti-building', text: '50+ partner universities and companies' },
                  { icon: 'ti-users', text: '1,500+ students placed since 2011' },
                ].map(item => (
                  <div key={item.icon} className="flex items-start gap-3">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#E8A020]/20">
                      <span className={`ti ${item.icon} text-[#E8A020] text-[13px]`} />
                    </div>
                    <p className="text-[13px] text-white/60 leading-relaxed">{item.text}</p>
                  </div>
                ))}
              </div>
              <div className="mt-8 grid grid-cols-2 gap-4 border-t border-white/10 pt-6">
                {[['1,500+', 'Students placed'], ['98%', 'Visa success'], ['50+', 'Partners'], ['15yr', 'Experience']].map(([num, label]) => (
                  <div key={label}>
                    <p className="font-jakarta text-[20px] font-black text-[#E8A020]">{num}</p>
                    <p className="text-[10px] text-white/30 uppercase tracking-wider">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
          {/* Form */}
          <div className="lg:col-span-3">
            <div className="rounded-2xl border border-[#DDE3EC] bg-white p-8 dark:border-white/[0.08] dark:bg-white/[0.04]">
              <h1 className="font-jakarta text-[28px] font-black text-[#0B3D6B] dark:text-white mb-1">Enroll at EPIC Campus</h1>
              <p className="text-[14px] text-[#5A6A7A] dark:text-white/50 mb-8">Start your journey to Japan, Korea, China or global career success.</p>
              <EnrollmentForm />
            </div>
          </div>
        </div>
      </main>
      <PublicFooter />
    </div>
  )
}
