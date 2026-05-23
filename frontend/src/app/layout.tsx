import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Chenesa — AI Email Cleaner',
  description: 'Automatically delete spam, marketing emails, and old clutter from any email account using AI.',
  openGraph: {
    title: 'Chenesa — AI Email Cleaner',
    description: 'Connect any email account. AI deletes the junk. You keep the important stuff.',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  )
}
