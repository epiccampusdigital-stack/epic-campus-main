import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Korea Study Program | EPIC Campus',
  description:
    'Study at top Korean universities with full and partial scholarships. D-4 to D-2 pathway. TOPIK preparation. Available after O/Levels or A/Levels.',
  openGraph: {
    title: 'Korea Study Program | EPIC Campus',
    description:
      'Full scholarships to study in Korea. D-4→D-2 visa pathway. EPIC Campus Sri Lanka.',
    url: 'https://epiccampus.live/korea',
    images: [{ url: '/og-image.png' }],
  },
}

export default function KoreaLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
