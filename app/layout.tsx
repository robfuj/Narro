import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Cormorant, Fraunces, IBM_Plex_Mono, Inter, Source_Serif_4 } from 'next/font/google'
import './globals.css'

const _inter = Inter({ subsets: ['latin'], variable: '--font-sans' })
const _fraunces = Fraunces({ subsets: ['latin'], variable: '--font-serif' })
// The story chamber uses the Coldharbour type system: Cormorant for display
// headings, Source Serif 4 for narration, IBM Plex Mono for eyebrow labels.
const _cormorant = Cormorant({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['400', '500', '600'],
  style: ['normal', 'italic'],
})
const _sourceSerif = Source_Serif_4({
  subsets: ['latin'],
  variable: '--font-story',
  weight: ['400', '500'],
  style: ['normal', 'italic'],
})
const _plexMono = IBM_Plex_Mono({ subsets: ['latin'], variable: '--font-mono', weight: ['400', '500'] })

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
    <html
      lang="en"
      className={`bg-background ${_inter.variable} ${_fraunces.variable} ${_cormorant.variable} ${_sourceSerif.variable} ${_plexMono.variable}`}
    >
      <body className="antialiased font-sans">
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
