import './globals.css'

export const metadata = {
  title: 'iMessage Wrapped',
  description: 'Your year in messages',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}

