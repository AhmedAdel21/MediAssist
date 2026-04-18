import type { Metadata } from 'next'
import './globals.css'
import { Providers } from './providers'

export const metadata: Metadata = {
  title: 'MediAssist AI',
  description: 'AI-powered clinical decision support',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-surface font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
