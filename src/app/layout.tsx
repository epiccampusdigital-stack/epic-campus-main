import './globals.css'
import type { Metadata } from 'next'
import { Plus_Jakarta_Sans, Inter } from 'next/font/google'
import ChatBotRoot from '@/components/public/ChatBotRoot'

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-jakarta',
  display: 'swap',
})

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'EPIC Campus | We Create Your Future',
  description:
    "EPIC Campus is Sri Lanka's leading overseas education and employment institute. Work in Japan via SSW visa, study in Korea or China with full scholarships, achieve your IELTS target score, or earn government-approved NVQ qualifications. Founded in 2011. 1,500+ students placed. 98% success rate.",
  keywords:
    'EPIC Campus, Sri Lanka, Japan SSW visa, Korea study, China scholarship, IELTS, NVQ, overseas education, study abroad Sri Lanka, work in Japan',
  authors: [{ name: 'EPIC Campus' }],
  creator: 'EPIC Campus',
  publisher: 'EPIC Campus',
  metadataBase: new URL('https://epiccampus.live'),
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://epiccampus.live',
    siteName: 'EPIC Campus',
    title: 'EPIC Campus | Your Future Has No Limit',
    description:
      "Study in Korea, work in Japan, or earn your IELTS score with EPIC Campus — Sri Lanka's most trusted overseas education institute since 2011.",
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'EPIC Campus — We Create Your Future',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'EPIC Campus | Your Future Has No Limit',
    description:
      "Study in Korea, work in Japan, or earn your IELTS score with EPIC Campus — Sri Lanka's most trusted overseas education institute since 2011.",
    images: ['/og-image.png'],
  },
  icons: {
    icon: [{ url: '/favicon.ico' }, { url: '/favicon.png', type: 'image/png' }],
    apple: '/favicon.png',
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${plusJakarta.variable} ${inter.variable}`}>
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/dist/tabler-icons.min.css"
        />
      </head>
      <body className="font-inter antialiased bg-[#F5F7FB]">
        {children}
        <ChatBotRoot />
      </body>
    </html>
  )
}
