import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Chenesa — AI Email Cleaner',
  description: 'Automatically delete spam, marketing emails, and old clutter from any email account using AI.',
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
  },
  openGraph: {
    title: 'Chenesa — AI Email Cleaner',
    description: 'Connect any email account. AI deletes the junk. You keep the important stuff.',
    type: 'website',
  },
}

// Runs before React hydrates — sets the correct theme class immediately,
// preventing the flash of wrong background colour on page load.
const themeScript = `
(function(){
  try {
    var t = localStorage.getItem('chenesa-theme');
    var dark = t ? t === 'dark' : true;
    document.documentElement.classList.add(dark ? 'dark' : 'light');
  } catch(e) {
    document.documentElement.classList.add('dark');
  }
})();
`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Inject theme before first paint — no React, runs synchronously */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={inter.className}>{children}</body>
    </html>
  )
}
