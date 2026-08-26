'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useOrg } from '@/lib/org-context'

const PAGES = [
  { label: 'Briefing Diário',       href: '/briefing',          sub: 'Visão geral do dia' },
  { label: 'Certidões Negativas',   href: '/certidoes',         sub: 'Federal, Estadual, Municipal, FGTS' },
  { label: 'Alvarás',               href: '/alvaras',           sub: 'Alvarás de funcionamento' },
  { label: 'Licenças Sanitárias',   href: '/licencas',          sub: 'VISA Municipal e ANVISA' },
  { label: 'Empresas',              href: '/empresas',          sub: 'Cadastro de clientes' },
  { label: 'Painel de Processos',   href: '/societario/painel', sub: 'Abertura, alteração, encerramento' },
  { label: 'Contratos',             href: '/contratos',         sub: 'Gestão de contratos' },
  { label: 'Dashboard',             href: '/dashboard',         sub: 'Visão executiva' },
  { label: 'Financeiro',            href: '/financeiro',        sub: 'Honorários e cobranças' },
  { label: 'Relatórios PDF',        href: '/relatorios',        sub: 'Geração de relatórios' },
]

export default function CommandPalette() {
  const [open, setOpen]       = useState(false)
  const [query, setQuery]     = useState('')
  const [empresas, setEmpresas] = useState<{ id: string; razao_social: string }[]>([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const { orgId } = useOrg()
  const [supabase] = useState(() => createClient())

  // Ctrl+K / Cmd+K
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(o => !o)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (open) {
      setQuery(''); setEmpresas([]); setSelected(0)
      setTimeout(() => inputRef.current?.focus(), 30)
    }
  }, [open])

  const searchEmpresas = useCallback(async (q: string) => {
    if (!q.trim() || !orgId) { setEmpresas([]); return }
    setLoading(true)
    const { data } = await supabase
      .from('empresas')
      .select('id, razao_social')
      .eq('org_id', orgId)
      .ilike('razao_social', `%${q}%`)
      .limit(6)
    setEmpresas(data || [])
    setLoading(false)
  }, [supabase, orgId])

  useEffect(() => {
    const t = setTimeout(() => searchEmpresas(query), 200)
    return () => clearTimeout(t)
  }, [query, searchEmpresas])

  const filteredPages = query
    ? PAGES.filter(p => p.label.toLowerCase().includes(query.toLowerCase())).slice(0, 4)
    : PAGES.slice(0, 6)

  const totalItems = empresas.length + filteredPages.length

  function go(href: string) { router.push(href); setOpen(false) }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => Math.min(s + 1, totalItems - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)) }
    if (e.key === 'Enter') {
      const allItems = [
        ...empresas.map(e => `/empresas/${e.id}`),
        ...filteredPages.map(p => p.href),
      ]
      if (allItems[selected]) go(allItems[selected])
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] px-4">
      <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setOpen(false)} />
      <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">

        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-100">
          <svg className="w-5 h-5 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={e => { setQuery(e.target.value); setSelected(0) }}
            onKeyDown={onKeyDown}
            placeholder="Buscar empresa ou página..."
            className="flex-1 text-sm text-slate-900 outline-none placeholder-slate-400 bg-transparent"
          />
          {loading && <span className="text-[10px] text-slate-400 animate-pulse">buscando...</span>}
          <kbd className="text-[10px] text-slate-300 bg-slate-100 px-1.5 py-0.5 rounded font-mono border border-slate-200">Esc</kbd>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto py-1.5">
          {empresas.length > 0 && (
            <>
              <p className="px-4 pt-2 pb-1 text-[9px] font-black uppercase tracking-widest text-slate-400">Empresas</p>
              {empresas.map((e, i) => (
                <button key={e.id} onClick={() => go(`/empresas/${e.id}`)}
                  onMouseEnter={() => setSelected(i)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 transition-colors text-left ${selected === i ? 'bg-slate-900' : 'hover:bg-slate-50'}`}>
                  <svg className={`w-4 h-4 flex-shrink-0 ${selected === i ? 'text-slate-300' : 'text-slate-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  <span className={`flex-1 text-sm font-medium truncate ${selected === i ? 'text-white' : 'text-slate-700'}`}>{e.razao_social}</span>
                  <span className={`text-xs flex-shrink-0 ${selected === i ? 'text-slate-400' : 'text-slate-300'}`}>Abrir empresa →</span>
                </button>
              ))}
            </>
          )}

          {filteredPages.length > 0 && (
            <>
              <p className="px-4 pt-2 pb-1 text-[9px] font-black uppercase tracking-widest text-slate-400">
                {empresas.length > 0 ? 'Páginas' : (query ? 'Páginas encontradas' : 'Acesso rápido')}
              </p>
              {filteredPages.map((p, i) => {
                const idx = empresas.length + i
                return (
                  <button key={p.href} onClick={() => go(p.href)}
                    onMouseEnter={() => setSelected(idx)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 transition-colors text-left ${selected === idx ? 'bg-slate-900' : 'hover:bg-slate-50'}`}>
                    <svg className={`w-4 h-4 flex-shrink-0 ${selected === idx ? 'text-slate-300' : 'text-slate-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${selected === idx ? 'text-white' : 'text-slate-700'}`}>{p.label}</p>
                      <p className={`text-xs truncate ${selected === idx ? 'text-slate-400' : 'text-slate-400'}`}>{p.sub}</p>
                    </div>
                  </button>
                )
              })}
            </>
          )}

          {totalItems === 0 && query && (
            <p className="px-4 py-8 text-center text-sm text-slate-400">
              Nenhum resultado para &quot;{query}&quot;
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 px-4 py-2.5 border-t border-slate-100 bg-slate-50">
          <span className="text-[10px] text-slate-400 flex items-center gap-2">
            <KbdPair keys="↑↓" label="navegar" />
            <KbdPair keys="Enter" label="abrir" />
            <KbdPair keys="Esc" label="fechar" />
          </span>
        </div>
      </div>
    </div>
  )
}

function KbdPair({ keys, label }: { keys: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <kbd className="bg-white border border-slate-200 rounded px-1.5 py-0.5 font-mono text-[10px] text-slate-500">{keys}</kbd>
      <span className="text-slate-400">{label}</span>
    </span>
  )
}
