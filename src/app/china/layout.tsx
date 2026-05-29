import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'China Study Program | EPIC Campus',
  description:
    'Affordable world-class education in China with full scholarships. Medicine, Business, IT, Engineering. HSK preparation included. EPIC Campus Sri Lanka.',
  openGraph: {
    title: 'China Study Program | EPIC Campus',
    description:
      'Study in China with full scholarships. Top universities, affordable costs. EPIC Campus.',
    url: 'https://epiccampus.live/china',
    images: [{ url: '/og-image.png' }],
  },
}

export default function ChinaLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
