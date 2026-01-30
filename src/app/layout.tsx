import type { Metadata } from 'next'
import './globals.css'
import { Providers } from './providers'

export const metadata: Metadata = {
  title: 'Resupply Loop',
  description: 'Loop your stables for amplified yield',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="bg-dark-900 text-white min-h-screen antialiased">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}
