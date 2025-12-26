import './globals.css'

export const metadata = {
  title: 'iMessage Wrapped',
  description: 'Your year in messages, visualized. Download the macOS app or use the CLI to analyze your iMessage history.',
  metadataBase: new URL('https://imessage-wrapped.fly.dev'),
  openGraph: {
    title: 'iMessage Wrapped',
    description: 'Your year in messages, visualized. Download the macOS app or use the CLI to analyze your iMessage history.',
    url: 'https://imessage-wrapped.fly.dev',
    siteName: 'iMessage Wrapped',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'iMessage Wrapped - Your year in messages, visualized',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'iMessage Wrapped',
    description: 'Your year in messages, visualized. Download the macOS app or use the CLI.',
    images: ['/og-image.png'],
  },
  icons: {
    icon: {
      url: 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>💌</text></svg>',
      type: 'image/svg+xml',
    },
  },
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}

