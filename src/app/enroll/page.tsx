import Link from 'next/link'
import PublicNav from '@/components/public/PublicNav'
import PublicFooter from '@/components/public/PublicFooter'

export const metadata = {
  title: 'Enroll — EPIC Campus',
  description: 'Choose between the residential campus programme in Galle or the online JFT Foundation course.',
}

interface ChooserCard {
  title: string
  headline: string
  price: string
  whoFor: string
  bullets: string[]
  buttonLabel: string
  href: string
}

const CARDS: ChooserCard[] = [
  {
    title: 'Study at Campus',
    headline: '45-day residential programme in Galle',
    price: '',
    whoFor: "Who it's for: you can relocate for 45 days, and you're within the SSW age limit",
    bullets: [
      'Full campus facilities, daily classes',
      'Accommodation and meals included',
    ],
    buttonLabel: 'Apply for Campus Programme',
    href: '/enroll/residential',
  },
  {
    title: 'Learn Online',
    headline: '5-month JFT Foundation course — LKR 25,000 plus postage',
    price: '',
    whoFor: "Who it's for: any age, anywhere in Sri Lanka, can't relocate",
    bullets: [
      'Video lessons at home, at your own pace',
      'Printed study pack posted to you',
      'One campus day a month',
    ],
    buttonLabel: 'Start Online Course',
    href: '/enroll/online',
  },
]

export default function EnrollChooserPage() {
  return (
    <div className="min-h-screen bg-[#F5F7FB] dark:bg-[#130F2A]">
      <PublicNav />
      <main className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="mb-10 text-center">
          <Link
            href="/"
            className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-[#5A6A7A] transition-colors hover:text-[#0B3D6B] dark:text-white/50 dark:hover:text-white"
          >
            <span className="ti ti-arrow-left" /> Back to home
          </Link>
          <h1 className="font-jakarta text-[32px] font-black text-[#0B3D6B] dark:text-white">
            How would you like to prepare?
          </h1>
          <p className="mx-auto mt-2 max-w-xl text-[15px] text-[#5A6A7A] dark:text-white/50">
            Both paths lead to the same JFT Foundation qualification — pick whichever fits your life right now.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {CARDS.map((card) => (
            <div
              key={card.href}
              className="flex flex-col rounded-2xl border border-[#DDE3EC] bg-white p-8 shadow-sm dark:border-white/[0.08] dark:bg-white/[0.04]"
            >
              <h2 className="font-jakarta text-[22px] font-black text-[#0B3D6B] dark:text-white">{card.title}</h2>
              <p className="mt-1 font-inter text-sm font-semibold text-[#E8A020]">{card.headline}</p>
              <p className="mt-4 font-inter text-sm font-medium text-[#0D1B2A] dark:text-white/80">{card.whoFor}</p>

              <ul className="mt-4 flex-1 space-y-2.5">
                {card.bullets.map((b) => (
                  <li key={b} className="flex items-start gap-2.5 text-sm text-[#5A6A7A] dark:text-white/60">
                    <span className="ti ti-circle-check mt-0.5 shrink-0 text-[#0B3D6B] dark:text-[#E8A020]" aria-hidden="true" />
                    {b}
                  </li>
                ))}
              </ul>

              <Link
                href={card.href}
                className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-[#E8A020] px-6 py-3.5 font-jakarta text-sm font-bold text-[#0B3D6B] transition-colors hover:bg-[#F5B942]"
              >
                {card.buttonLabel}
                <span className="ti ti-arrow-right" aria-hidden="true" />
              </Link>
            </div>
          ))}
        </div>
      </main>
      <PublicFooter />
    </div>
  )
}
