import PublicNav from '@/components/public/PublicNav'
import PublicFooter from '@/components/public/PublicFooter'
import PublicEpicWall from '@/components/public/PublicEpicWall'

export const metadata = {
  title: 'Epic Wall | EPIC Campus',
  description: 'Real moments from EPIC Campus students — campus life, achievements, and journeys to Japan, Korea and China.',
}

export default function PublicEpicWallPage() {
  return (
    <div className="flex min-h-screen flex-col bg-[#F5F7FB] dark:bg-[#0D0B1E]">
      <PublicNav />
      <main className="flex-1">
        {/* Header */}
        <section className="relative overflow-hidden bg-[#0D0B1E] py-20 sm:py-24">
          <div className="absolute inset-0 bg-[linear-gradient(rgba(26,107,173,0.07)_1px,transparent_1px),linear-gradient(90deg,rgba(26,107,173,0.07)_1px,transparent_1px)] bg-[size:40px_40px]" />
          <div className="pointer-events-none absolute left-1/2 top-0 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(11,61,107,0.45)_0%,transparent_70%)]" />
          <div className="relative mx-auto max-w-4xl px-4 text-center sm:px-6">
            <p className="mb-3 text-[11px] font-bold uppercase tracking-[4px] text-[#E8A020]">Campus life</p>
            <h1 className="font-jakarta text-[40px] font-black leading-tight text-white sm:text-[52px]">
              <span className="text-[#E8A020]">Epic</span> Wall
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-[15px] leading-relaxed text-white/40 sm:text-[16px]">
              Real moments from our students and campus life.
            </p>
          </div>
        </section>

        {/* Feed */}
        <section className="bg-[#F5F7FB] py-16 dark:bg-[#0D0B1E]">
          <div className="mx-auto max-w-2xl px-4 sm:px-6">
            <PublicEpicWall />
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  )
}
