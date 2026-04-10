'use client'

import { useState, useEffect } from 'react'
import Sidebar from '@/components/layout/Sidebar'

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(true)

  // On mobile (< 768px), default to closed
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setOpen(false)
    }
  }, [])

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* Mobile overlay backdrop */}
      {open && (
        <div
          className="fixed inset-0 bg-black/60 z-20 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <Sidebar isOpen={open} onToggle={() => setOpen(o => !o)} />

      {/* Main content */}
      <div
        className={`flex-1 flex flex-col min-w-0 transition-all duration-300 overflow-hidden ${
          open ? 'md:ml-64' : 'ml-0'
        }`}
      >
        {/* Mobile top bar (hamburger) */}
        <div className="flex md:hidden items-center gap-3 px-4 py-3 bg-[#0d0d0d] border-b border-white/[0.06] sticky top-0 z-10">
          <button
            onClick={() => setOpen(true)}
            className="text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
            aria-label="Abrir menu"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="font-bold text-white text-sm tracking-wide">
            PARALEGAL <span className="text-amber-400">PRO</span>
          </span>
        </div>

        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>

      {/* Desktop: floating button to reopen when sidebar is hidden */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="hidden md:flex fixed left-3 top-3 z-30 w-8 h-8 bg-[#0d0d0d] border border-white/10 rounded-lg items-center justify-center text-white hover:bg-white/10 transition-all shadow-lg"
          aria-label="Abrir menu"
          title="Abrir menu"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      )}
    </div>
  )
}
