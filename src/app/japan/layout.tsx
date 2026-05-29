import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Japan SSW Program | EPIC Campus',
  description:
    'Work in Japan legally via the Specified Skilled Worker (SSW) visa. Truck driving, construction, caregiving and more. JLPT training included. EPIC Campus Sri Lanka.',
  openGraph: {
    title: 'Japan SSW Program | EPIC Campus',
    description:
      'Work in Japan via SSW visa. No degree required. 1,500+ Sri Lankan students placed.',
    url: 'https://epiccampus.live/japan',
    images: [{ url: '/og-image.png' }],
  },
}

export default function JapanLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
