'use client'
/**
 * ForceDark — mounts on marketing (and auth) pages to always render them
 * in dark mode, regardless of the user's dashboard theme preference.
 *
 * On unmount (navigating back into the dashboard) it restores the user's
 * saved preference from localStorage so the dashboard picks up where it left off.
 */
import { useEffect } from 'react'

export default function ForceDark() {
  useEffect(() => {
    const html = document.documentElement
    html.classList.add('dark')
    html.classList.remove('light')

    return () => {
      // Restore the user's saved preference when leaving the marketing/auth section
      const saved = localStorage.getItem('chenesa-theme')
      const isDark = saved !== 'light' // default to dark if nothing saved
      if (isDark) {
        html.classList.add('dark')
        html.classList.remove('light')
      } else {
        html.classList.add('light')
        html.classList.remove('dark')
      }
    }
  }, [])

  return null
}
