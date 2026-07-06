import './globals.css'
import type { Metadata, Viewport } from 'next'
import { Plus_Jakarta_Sans, Inter } from 'next/font/google'
import ChatBotRoot from '@/components/public/ChatBotRoot'
import AppToaster from '@/components/ui/AppToaster'
import ThemeInit from '@/components/theme/ThemeInit'

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-jakarta',
  display: 'swap',
  preload: false,
})

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-inter',
  display: 'swap',
  preload: false,
})

export const metadata: Metadata = {
  title: 'EPIC Campus — We Create Your Future',
  description:
    "Epic Campus — Sri Lanka's leading overseas education institute for Japan SSW, Korea, China, IELTS and NVQ programs. Based in Galle.",
  keywords:
    'Japan SSW Sri Lanka, Korea study visa, overseas education Galle, IELTS residential, NVQ certification, EPIC Campus, study abroad Sri Lanka',
  authors: [{ name: 'EPIC Campus' }],
  creator: 'EPIC Campus',
  publisher: 'EPIC Campus',
  metadataBase: new URL('https://www.epiccampus.live'),
  openGraph: {
    title: 'EPIC Campus — We Create Your Future',
    description:
      "Sri Lanka's trusted gateway to Japan, Korea, China and global careers since 2011.",
    url: 'https://www.epiccampus.live',
    siteName: 'EPIC Campus',
    images: [
      {
        url: 'https://www.epiccampus.live/og-image.png',
        width: 1200,
        height: 630,
        alt: 'EPIC Campus — We Create Your Future',
        type: 'image/png',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'EPIC Campus — We Create Your Future',
    description:
      "Sri Lanka's trusted gateway to Japan, Korea, China and global careers since 2011.",
    images: ['https://www.epiccampus.live/og-image.png'],
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon.png', type: 'image/png', sizes: '32x32' },
    ],
    apple: [{ url: '/favicon.png', sizes: '180x180' }],
    shortcut: '/favicon.ico',
  },
  robots: {
    index: true,
    follow: true,
  },
}

export const viewport: Viewport = {
  themeColor: '#0B3D6B',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`dark ${plusJakarta.variable} ${inter.variable}`}>
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/favicon.png" type="image/png" />
        <link rel="apple-touch-icon" href="/favicon.png" />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/dist/tabler-icons.min.css"
        />
      </head>
      <body className="overflow-x-hidden font-inter antialiased bg-[#F5F7FB]">
        <ThemeInit />
        <div className="noise-overlay" aria-hidden="true" />
        {children}
        <ChatBotRoot />
        <AppToaster />
      </body>
    </html>
  )
}
