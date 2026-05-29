import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'IELTS Residential Program | EPIC Campus',
  description:
    '10-day intensive residential IELTS program. Target Band 6.0 to 7.0+. Expert trainers, daily mock exams. Also visit epicielts.live for our dedicated IELTS platform.',
  openGraph: {
    title: 'IELTS Residential Program | EPIC Campus',
    description:
      'Fast-track your IELTS score with our 10-day residential program. Target 6.0–7.0+.',
    url: 'https://epiccampus.live/ielts',
    images: [{ url: '/og-image.png' }],
  },
}

export default function IeltsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
