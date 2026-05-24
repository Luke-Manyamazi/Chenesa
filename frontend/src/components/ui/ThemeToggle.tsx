'use client'
import { useState, useEffect } from 'react'
import { Sun, Moon } from 'lucide-react'

export default function ThemeToggle({ className = '' }: { className?: string }) {
  const [dark, setDark] = useState(true)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const saved = localStorage.getItem('chenesa-theme')
    const isDark = saved ? saved === 'dark' : true
    apply(isDark)
    setDark(isDark)
  }, [])

  function apply(isDark: boolean) {
    const html = document.documentElement
    if (isDark) {
      html.classList.add('dark')
      html.classList.remove('light')
    } else {
      html.classList.add('light')
      html.classList.remove('dark')
    }
  }

  function toggle() {
    const next = !dark
    setDark(next)
    apply(next)
    localStorage.setItem('chenesa-theme', next ? 'dark' : 'light')
  }

  // Avoid hydration mismatch — render nothing until mounted
  if (!mounted) return <div className={`w-7 h-7 ${className}`} />

  return (
    <button
      onClick={toggle}
      title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      className={`w-7 h-7 rounded-lg flex items-center justify-center
        text-slate-500 hover:text-slate-300 hover:bg-slate-700/50
        transition-all duration-150 flex-shrink-0 ${className}`}
    >
      {dark
        ? <Sun  size={14} className="text-amber-400" />
        : <Moon size={14} className="text-primary-400" />
      }
    </button>
  )
}
