import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { EB_Garamond, Fraunces, Inter } from 'next/font/google'
import './globals.css'

const _inter = Inter({ subsets: ['latin'], variable: '--font-sans' })
const _fraunces = Fraunces({ subsets: ['latin'], variable: '--font-serif' })
// Google Fonts ships the Garamond revival as "EB Garamond" — used for the
// story reading experience itself (narration, in-story headings).
const _ebGaramond = EB_Garamond({ subsets: ['latin'], variable: '--font-story' })

export const metadata: Metadata = {
  title: 'Narro — Living Story Worlds',
  description:
    'Narro is an interactive storytelling engine. Awaken in another world with memories of a life before, and control your own adventure.',
  generator: 'v0.app',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: '#f7f6f4',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`bg-background ${_inter.variable} ${_fraunces.variable} ${_ebGaramond.variable}`}>
      <body className="antialiased font-sans">
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
