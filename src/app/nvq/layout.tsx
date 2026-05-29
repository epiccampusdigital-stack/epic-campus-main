import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'NVQ Qualifications | EPIC Campus',
  description:
    'TVEC-approved NVQ Level 3 programs in IT, Hospitality, Caregiving, Construction, Logistics, and Business. Registration No. A13430. Valid until July 2027.',
  openGraph: {
    title: 'NVQ Qualifications | EPIC Campus',
    description:
      'Government-approved NVQ training. 6 categories. TVEC certified. EPIC Campus Sri Lanka.',
    url: 'https://epiccampus.live/nvq',
    images: [{ url: '/og-image.png' }],
  },
}

export default function NvqLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
