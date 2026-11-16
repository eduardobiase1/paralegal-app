'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Search } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useOrg } from '@/lib/org-context'
import { gruposDoPerfil } from '@/lib/navigation'
import { formatCNPJ } from '@/lib/utils'

type EmpresaBusca = { id: string; razao_social: string; cnpj?: string | null; nome_fantasia?: string | null }
type Linha = { key: string; titulo: string; sub: string; href: string; grupo: string }

const ACOES: Array<{ label: string; sub: string; href: string }> = [
  { label: 'Nova certidão',                   sub: 'Certidões',             href: '/certidoes?novo=1' },
  { label: 'Novo alvará',                     sub: 'Alvarás',               href: '/alvaras?novo=1' },
  { label: 'Nova licença sanitária',          sub: 'Licenças sanitárias',   href: '/licencas?novo=1' },
  { label: 'Cliente pagou: novo certificado', sub: 'Certificados digitais', href: '/certificados?novo=1' },
  { label: 'Nova empresa',                    sub: 'Carteira',              href: '/empresas/nova' },
]

const RECENTES_KEY = 'paralegal_empresas_recentes'

function lerRecentes(): EmpresaBusca[] {
  try { return JSON.parse(localStorage.getItem(RECENTES_KEY) || '[]') } catch { return [] }
}
/** Guarda as últimas empresas abertas, para aparecerem na busca sem digitar nada */
export function lembrarEmpresa(e: EmpresaBusca) {
  try {
    const lista = [{ id: e.id, razao_social: e.razao_social, cnpj: e.cnpj }, ...lerRecentes().filter(x => x.id !== e.id)].slice(0, 6)
    localStorage.setItem(RECENTES_KEY, JSON.stringify(lista))
  } catch {}
}

const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export default function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [empresas, setEmpresas] = useState<EmpresaBusca[]>([])
  const [recentes, setRecentes] = useState<EmpresaBusca[]>([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const { orgId, role } = useOrg()
  const [supabase] = useState(() => createClient())
  const restrito = role === 'viewer' || role === 'financeiro'

  // Ctrl+K / Cmd+K, ou o botão "Buscar" do menu
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setOpen(o => !o) }
      if (e.key === 'Escape') setOpen(false)
    }
    const abrir = () => setOpen(true)
    window.addEventListener('keydown', onKey)
    window.addEventListener('paralegal:buscar', abrir)
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('paralegal:buscar', abrir) }
  }, [])

  useEffect(() => {
    if (!open) return
    setQuery(''); setEmpresas([]); setSelected(0); setRecentes(lerRecentes())
    setTimeout(() => inputRef.current?.focus(), 30)
  }, [open])

  // Busca por razão social, nome fantasia ou CNPJ (com ou sem pontuação)
  const buscar = useCallback(async (q: string) => {
    const termo = q.trim().replace(/[,()]/g, ' ')
    if (termo.length < 2 || !orgId || restrito) { setEmpresas([]); return }
    setLoading(true)
    const digitos = termo.replace(/\D/g, '')
    const filtros = [`razao_social.ilike.%${termo}%`, `nome_fantasia.ilike.%${termo}%`]
    if (digitos.length >= 3) filtros.push(`cnpj.ilike.%${digitos}%`, `cnpj.ilike.%${termo}%`)
    const { data } = await supabase.from('empresas').select('id, razao_social, cnpj, nome_fantasia')
      .eq('org_id', orgId).or(filtros.join(',')).order('razao_social').limit(7)
    setEmpresas(data || [])
    setLoading(false)
  }, [supabase, orgId, restrito])

  useEffect(() => {
    const t = setTimeout(() => buscar(query), 180)
    return () => clearTimeout(t)
  }, [query, buscar])

  const q = semAcento(query.trim())
  const paginas = gruposDoPerfil(role).flatMap(g => g.pages.map(p => ({ label: p.label, sub: g.label, href: p.href })))
  const linhas: Linha[] = [
    ...(q ? empresas : restrito ? [] : recentes).map(e => ({
      key: `e-${e.id}`, titulo: e.razao_social, grupo: q ? 'Empresas' : 'Empresas abertas recentemente',
      sub: [e.cnpj ? formatCNPJ(e.cnpj) : '', e.nome_fantasia && /[^*\s]/.test(e.nome_fantasia) ? e.nome_fantasia : ''].filter(Boolean).join(' · '),
      href: `/empresas/${e.id}`,
    })),
    ...(restrito ? [] : ACOES.filter(a => !q || semAcento(a.label).includes(q))).map(a => ({ key: `a-${a.href}`, titulo: a.label, sub: a.sub, href: a.href, grupo: 'Ações' })),
    ...paginas.filter(p => !q || semAcento(p.label).includes(q) || semAcento(p.sub).includes(q))
      .map(p => ({ key: `p-${p.href}`, titulo: p.label, sub: p.sub === p.label ? '' : p.sub, href: p.href, grupo: 'Ir para' })),
  ]

  function go(l: Linha) {
    router.push(l.href)
    setOpen(false)
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => Math.min(s + 1, linhas.length - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)) }
    if (e.key === 'Enter' && linhas[selected]) { e.preventDefault(); go(linhas[selected]) }
  }

  // mantém o item selecionado visível ao navegar com as setas
  useEffect(() => {
    document.querySelector('[data-busca-ativo="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [selected])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] px-4" role="dialog" aria-modal="true" aria-label="Busca rápida">
      <div className="fixed inset-0 bg-slate-900/50" onClick={() => setOpen(false)} />
      <div className="relative w-full max-w-xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden">

        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-200">
          <Search className="w-5 h-5 text-slate-500 flex-shrink-0" aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => { setQuery(e.target.value); setSelected(0) }}
            onKeyDown={onKeyDown}
            aria-label="Buscar empresa, CNPJ, ação ou tela"
            placeholder="Buscar empresa, CNPJ, ação ou tela"
            className="flex-1 text-sm text-slate-900 outline-none placeholder:text-slate-500 bg-transparent"
          />
          {loading && <span className="text-xs text-slate-500">buscando...</span>}
          <kbd className="text-xs text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">Esc</kbd>
        </div>

        <div className="max-h-[26rem] overflow-y-auto py-1.5">
          {linhas.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-slate-600">Nenhum resultado para “{query}”.</p>
          ) : linhas.map((l, i) => (
            <div key={l.key}>
              {(i === 0 || linhas[i - 1].grupo !== l.grupo) && (
                <p className="px-4 pt-3 pb-1 text-xs font-semibold text-slate-500">{l.grupo}</p>
              )}
              <button onClick={() => go(l)} onMouseEnter={() => setSelected(i)} data-busca-ativo={selected === i}
                className={`w-full flex items-center gap-3 px-4 py-2 text-left ${selected === i ? 'bg-slate-900 text-white' : 'text-slate-900'}`}>
                <span className="flex-1 min-w-0 text-sm font-medium truncate">{l.titulo}</span>
                {l.sub && <span className={`text-xs flex-shrink-0 ${selected === i ? 'text-slate-300' : 'text-slate-500'}`}>{l.sub}</span>}
              </button>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 border-t border-slate-200 bg-slate-50 text-xs text-slate-600">
          <span><kbd className="bg-white border border-slate-200 rounded px-1.5 py-0.5">↑↓</kbd> navegar</span>
          <span><kbd className="bg-white border border-slate-200 rounded px-1.5 py-0.5">Enter</kbd> abrir</span>
          <span><kbd className="bg-white border border-slate-200 rounded px-1.5 py-0.5">Ctrl K</kbd> abre a busca em qualquer tela</span>
        </div>
      </div>
    </div>
  )
}
