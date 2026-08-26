'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

const ACTIONS = [
  { label: 'Nova Certidão',       href: '/certidoes', hint: 'Alt+C' },
  { label: 'Novo Alvará',         href: '/alvaras',   hint: 'Alt+A' },
  { label: 'Nova Empresa',        href: '/empresas/nova', hint: 'Alt+E' },
  { label: 'Nova Licença',        href: '/licencas',  hint: 'Alt+L' },
]
const NAV = [
  { label: 'Briefing do Dia',     href: '/briefing',         hint: 'Alt+B' },
  { label: 'Painel de Processos', href: '/societario/painel', hint: '' },
]

export default function QuickActions() {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!e.altKey) return
      const map: Record<string, string> = {
        c: '/certidoes', a: '/alvaras', e: '/empresas/nova',
        l: '/licencas',  b: '/briefing',
      }
      const href = map[e.key.toLowerCase()]
      if (href) { e.preventDefault(); router.push(href) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [router])

  return (
    <div className="fixed bottom-6 right-6 z-40">
      {open && (
        <>
          <div className="fixed inset-0" onClick={() => setOpen(false)} />
          <div className="absolute bottom-14 right-0 bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden w-60 py-1.5">
            <p className="px-4 pt-2 pb-1 text-[9px] font-black uppercase tracking-widest text-slate-400">Novo cadastro</p>
            {ACTIONS.map(a => (
              <button key={a.href} onClick={() => { router.push(a.href); setOpen(false) }}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors text-left">
                <PlusIcon />
                <span className="flex-1 text-sm font-medium text-slate-700">{a.label}</span>
                {a.hint && <span className="text-[10px] text-slate-300 font-mono">{a.hint}</span>}
              </button>
            ))}
            <div className="my-1 border-t border-slate-100" />
            <p className="px-4 pt-2 pb-1 text-[9px] font-black uppercase tracking-widest text-slate-400">Acesso rápido</p>
            {NAV.map(a => (
              <button key={a.href} onClick={() => { router.push(a.href); setOpen(false) }}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors text-left">
                <ArrowIcon />
                <span className="flex-1 text-sm font-medium text-slate-700">{a.label}</span>
                {a.hint && <span className="text-[10px] text-slate-300 font-mono">{a.hint}</span>}
              </button>
            ))}
            <p className="px-4 pb-2 pt-1.5 text-[10px] text-slate-300 text-right">Ctrl+K para buscar</p>
          </div>
        </>
      )}

      <button onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white rounded-full pl-4 pr-5 py-2.5 shadow-lg transition-all text-sm font-semibold">
        <BoltIcon />
        Ações rápidas
      </button>
    </div>
  )
}

function PlusIcon() {
  return (
    <svg className="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
    </svg>
  )
}

function ArrowIcon() {
  return (
    <svg className="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
    </svg>
  )
}

function BoltIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  )
}
