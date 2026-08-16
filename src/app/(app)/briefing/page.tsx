'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

// ── Date helpers ─────────────────────────────────────────────────────────────
const DIAS_PT  = ['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado']
const MESES_PT = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro']

function daysRemaining(d: string) {
  const a = new Date(d); a.setHours(0,0,0,0)
  const b = new Date();  b.setHours(0,0,0,0)
  return Math.round((a.getTime() - b.getTime()) / 86_400_000)
}
function daysSinceMs(ms: number) {
  return Math.round((Date.now() - ms) / 86_400_000)
}
function vencTxt(dias: number, fem = false) {
  const venc = fem ? 'vencida' : 'vencido'
  if (dias < 0)  return `${venc} há ${Math.abs(dias)}d`
  if (dias === 0) return 'vence hoje'
  return `vence em ${dias}d`
}

// ── Types ────────────────────────────────────────────────────────────────────
type Urgency  = 'red' | 'yellow' | 'green'
type Category = 'proc_critico' | 'venc_critico' | 'proc_atencao' | 'venc_proximo' | 'incompleto' | 'meta'

interface Item {
  key: string
  category: Category
  urgency: Urgency
  badge: string
  icon: React.ReactNode
  empresaNome: string
  href: string
  descricao: string
  detalhe: string
  detalheColor: 'red' | 'amber' | 'gray'
  score: number
  subList?: string[]  // Lista de nomes para itens de gap/meta
}

// ── Icons ────────────────────────────────────────────────────────────────────
const IconProcesso = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
  </svg>
)
const IconCertidao = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
)
const IconAlvara = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138z" />
  </svg>
)
const IconLicenca = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
  </svg>
)
const IconCertDig = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
  </svg>
)
const IconMeta = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
  </svg>
)
const IconWarning = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
  </svg>
)

// ── Component ────────────────────────────────────────────────────────────────
export default function BriefingPage() {
  const [items,       setItems]       = useState<Item[]>([])
  const [loading,     setLoading]     = useState(true)
  const [updatedAt,   setUpdatedAt]   = useState<Date | null>(null)
  const [counts,      setCounts]      = useState({ red: 0, yellow: 0, green: 0, total: 0 })
  const [expanded,    setExpanded]    = useState<Record<string, boolean>>({})
  const [supabase]                    = useState(createClient)

  const hoje      = new Date()
  const diaLabel  = DIAS_PT[hoje.getDay()]
  const dateLabel = `${hoje.getDate()} de ${MESES_PT[hoje.getMonth()]} de ${hoje.getFullYear()}`

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const [
        { data: processos },
        { data: certidoes },
        { data: alvaras },
        { data: licencas },
        { data: certificados },
        { data: empresasAtivas },
        { data: empComCert },
        { data: empComAlvara },
      ] = await Promise.all([
        supabase.from('processos_societarios')
          .select('id, titulo, tipo, updated_at, empresa_id, empresa:empresas(razao_social), etapas:processo_etapas(id, updated_at)')
          .eq('status', 'em_andamento'),
        supabase.from('certidoes')
          .select('id, tipo, data_vencimento, empresa_id, empresa:empresas(razao_social)')
          .not('data_vencimento', 'is', null),
        supabase.from('alvaras')
          .select('id, tipo, data_vencimento, empresa_id, empresa:empresas(razao_social)')
          .not('data_vencimento', 'is', null),
        supabase.from('licencas_sanitarias')
          .select('id, data_vencimento, empresa_id, empresa:empresas(razao_social)')
          .not('data_vencimento', 'is', null),
        supabase.from('certificados_digitais')
          .select('id, tipo, uso, data_vencimento, empresa_id, empresa:empresas(razao_social)')
          .not('data_vencimento', 'is', null),
        supabase.from('empresas').select('id, razao_social').eq('status', 'ativa'),
        supabase.from('certidoes').select('empresa_id').not('empresa_id', 'is', null),
        supabase.from('alvaras').select('empresa_id').not('empresa_id', 'is', null),
      ])

      const candidates: Item[] = []

      // ── Processos parados ────────────────────────────────────────────────
      for (const p of processos || []) {
        const etapas = (p as any).etapas || []
        const lastMs = etapas.length
          ? Math.max(new Date(p.updated_at).getTime(), ...etapas.map((e: any) => new Date(e.updated_at).getTime()))
          : new Date(p.updated_at).getTime()
        const dias = daysSinceMs(lastMs)
        if (dias < 7) continue
        const critico = dias > 15
        candidates.push({
          key: `proc-${p.id}`,
          category: critico ? 'proc_critico' : 'proc_atencao',
          urgency: critico ? 'red' : 'yellow',
          badge: critico ? 'Processo Parado' : 'Processo em Atenção',
          icon: <IconProcesso />,
          empresaNome: (p as any).empresa?.razao_social || '—',
          href: `/societario/${p.id}`,
          descricao: (p as any).titulo || (p as any).tipo || 'Processo societário',
          detalhe: `${dias} dias parado`,
          detalheColor: critico ? 'red' : 'amber',
          score: critico ? dias * 6 : dias * 4,
        })
      }

      // ── Certidões ────────────────────────────────────────────────────────
      for (const c of certidoes || []) {
        const dias = daysRemaining(c.data_vencimento)
        if (dias > 30) continue
        const critico = dias <= 5
        candidates.push({
          key: `cert-${c.id}`,
          category: critico ? 'venc_critico' : 'venc_proximo',
          urgency: critico ? 'red' : 'yellow',
          badge: 'Certidão Negativa',
          icon: <IconCertidao />,
          empresaNome: (c as any).empresa?.razao_social || '—',
          href: `/empresas/${c.empresa_id}`,
          descricao: c.tipo || 'Certidão',
          detalhe: vencTxt(dias, true),
          detalheColor: dias < 0 ? 'red' : 'amber',
          score: critico
            ? (dias < 0 ? 100 + Math.abs(dias) * 2 : 100 - dias * 10)
            : 50 - dias,
        })
      }

      // ── Alvarás ──────────────────────────────────────────────────────────
      for (const a of alvaras || []) {
        const dias = daysRemaining(a.data_vencimento)
        if (dias > 30) continue
        const critico = dias <= 5
        candidates.push({
          key: `alv-${a.id}`,
          category: critico ? 'venc_critico' : 'venc_proximo',
          urgency: critico ? 'red' : 'yellow',
          badge: 'Alvará',
          icon: <IconAlvara />,
          empresaNome: (a as any).empresa?.razao_social || '—',
          href: `/empresas/${a.empresa_id}`,
          descricao: `Alvará ${a.tipo || ''}`.trim(),
          detalhe: vencTxt(dias),
          detalheColor: dias < 0 ? 'red' : 'amber',
          score: critico
            ? (dias < 0 ? 95 + Math.abs(dias) * 2 : 95 - dias * 10)
            : 48 - dias,
        })
      }

      // ── Licenças Sanitárias ──────────────────────────────────────────────
      for (const l of licencas || []) {
        const dias = daysRemaining(l.data_vencimento)
        if (dias > 30) continue
        const critico = dias <= 5
        candidates.push({
          key: `lic-${l.id}`,
          category: critico ? 'venc_critico' : 'venc_proximo',
          urgency: critico ? 'red' : 'yellow',
          badge: 'Licença Sanitária',
          icon: <IconLicenca />,
          empresaNome: (l as any).empresa?.razao_social || '—',
          href: `/empresas/${l.empresa_id}`,
          descricao: 'Licença Sanitária',
          detalhe: vencTxt(dias, true),
          detalheColor: dias < 0 ? 'red' : 'amber',
          score: critico
            ? (dias < 0 ? 90 + Math.abs(dias) * 2 : 90 - dias * 10)
            : 46 - dias,
        })
      }

      // ── Certificados Digitais (apenas vencimentos) ───────────────────────
      for (const cd of certificados || []) {
        const dias = daysRemaining(cd.data_vencimento)
        if (dias > 30) continue
        const critico = dias <= 7
        candidates.push({
          key: `certdig-${cd.id}`,
          category: critico ? 'venc_critico' : 'venc_proximo',
          urgency: critico ? 'red' : 'yellow',
          badge: 'Certificado Digital',
          icon: <IconCertDig />,
          empresaNome: (cd as any).empresa?.razao_social || '—',
          href: `/empresas/${cd.empresa_id}`,
          descricao: [(cd as any).tipo, (cd as any).uso].filter(Boolean).join(' ') || 'Certificado Digital',
          detalhe: vencTxt(dias),
          detalheColor: dias < 0 ? 'red' : 'amber',
          score: critico
            ? (dias < 0 ? 88 + Math.abs(dias) * 2 : 88 - dias * 8)
            : 44 - dias,
        })
      }

      // ── Algoritmo: processos têm slots garantidos ────────────────────────
      candidates.sort((a, b) => b.score - a.score)

      const PROC_CATS = ['proc_critico', 'proc_atencao']
      const procCandidates  = candidates.filter(i => PROC_CATS.includes(i.category))
      const otherCandidates = candidates.filter(i => !PROC_CATS.includes(i.category))

      // Slots de processo: até 3 garantidos
      const procSlots = procCandidates.slice(0, 3)

      // Slots restantes: até (8 - processos) de outros, max 3 por sub-categoria
      const remaining = 8 - procSlots.length
      const otherCatCount: Record<string, number> = {}
      const otherSlots: Item[] = []
      for (const item of otherCandidates) {
        if (otherSlots.length >= remaining) break
        otherCatCount[item.category] = (otherCatCount[item.category] || 0) + 1
        if (otherCatCount[item.category] <= 3) otherSlots.push(item)
      }

      // Combina e reordena por score
      const final: Item[] = [...procSlots, ...otherSlots].sort((a, b) => b.score - a.score)

      // ── Cadastro incompleto (slot 9) — certidão e alvará ─────────────────
      const comCertIds   = new Set((empComCert   || []).map((r: any) => r.empresa_id))
      const comAlvaraIds = new Set((empComAlvara || []).map((r: any) => r.empresa_id))
      const semCertNomes:   string[] = []
      const semAlvaraNomes: string[] = []
      for (const e of empresasAtivas || []) {
        if (!comCertIds.has(e.id))   semCertNomes.push(e.razao_social)
        if (!comAlvaraIds.has(e.id)) semAlvaraNomes.push(e.razao_social)
      }
      const gaps = [
        { count: semCertNomes.length,   nomes: semCertNomes,   label: `${semCertNomes.length} empresas ativas sem certidão cadastrada`,  href: '/certidoes' },
        { count: semAlvaraNomes.length, nomes: semAlvaraNomes, label: `${semAlvaraNomes.length} empresas ativas sem alvará cadastrado`,   href: '/alvaras' },
      ].filter(g => g.count > 0).sort((a, b) => b.count - a.count)

      if (gaps[0] && final.length < 10) {
        final.push({
          key: 'incompleto',
          category: 'incompleto',
          urgency: 'green',
          badge: 'Cadastro Pendente',
          icon: <IconWarning />,
          empresaNome: 'Varredura do sistema',
          href: gaps[0].href,
          descricao: gaps[0].label,
          detalhe: 'dados faltando',
          detalheColor: 'gray',
          score: 20,
          subList: gaps[0].nomes,
        })
      }

      // ── Meta da semana (slot 10) ─────────────────────────────────────────
      const metaGap = gaps[1] || gaps[0]
      if (metaGap && final.length < 10) {
        final.push({
          key: 'meta',
          category: 'meta',
          urgency: 'green',
          badge: 'Meta da Semana',
          icon: <IconMeta />,
          empresaNome: '',
          href: metaGap.href,
          descricao: `${metaGap.label} — regularize pelo menos 3 esta semana`,
          detalhe: '',
          detalheColor: 'gray',
          score: 10,
          subList: metaGap.nomes,
        })
      }

      // ── Contadores para o cabeçalho ──────────────────────────────────────
      const red    = final.filter(i => i.urgency === 'red').length
      const yellow = final.filter(i => i.urgency === 'yellow').length
      const green  = final.filter(i => i.urgency === 'green').length
      setCounts({ red, yellow, green, total: candidates.length })
      setItems(final.slice(0, 10))
      setUpdatedAt(new Date())
    } catch (e) {
      console.error('Briefing error:', e)
    }
    setLoading(false)
  }

  // ── Estilos por urgência ─────────────────────────────────────────────────
  const U = {
    red:    { border: 'border-l-red-500',     icon: 'text-red-500',    badgeBg: 'bg-red-50 text-red-700 ring-1 ring-red-200' },
    yellow: { border: 'border-l-amber-400',   icon: 'text-amber-500',  badgeBg: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200' },
    green:  { border: 'border-l-emerald-500', icon: 'text-emerald-500',badgeBg: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' },
  }
  const DC = {
    red:   'bg-red-100 text-red-700',
    amber: 'bg-amber-100 text-amber-700',
    gray:  'bg-gray-100 text-gray-600',
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">

      {/* ── Cabeçalho ─────────────────────────────────────────────────────── */}
      <div className="mb-8">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center text-2xl shadow-sm border border-amber-100">
              ☀️
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Briefing Diário</h1>
              <p className="text-sm text-gray-500">{diaLabel} · {dateLabel}</p>
            </div>
          </div>
          {updatedAt && (
            <span className="text-xs text-gray-400 mt-1">
              Atualizado às {updatedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>

        {/* Pills de contagem */}
        {!loading && (
          <div className="mt-5 flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 rounded-full ring-1 ring-red-200">
              <span className="w-2 h-2 rounded-full bg-red-500" />
              <span className="text-xs font-semibold text-red-700">{counts.red} crítico{counts.red !== 1 ? 's' : ''}</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 rounded-full ring-1 ring-amber-200">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              <span className="text-xs font-semibold text-amber-700">{counts.yellow} em atenção</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 rounded-full ring-1 ring-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-xs font-semibold text-emerald-700">{counts.green} meta</span>
            </div>
            <span className="text-xs text-gray-400 ml-1">
              de {counts.total} pendências encontradas · exibindo top {items.length}
            </span>
          </div>
        )}
      </div>

      {/* ── Lista de prioridades ───────────────────────────────────────────── */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-[76px] bg-gray-50 rounded-2xl animate-pulse border border-gray-100" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-gray-100 shadow-sm">
          <p className="text-5xl mb-4">🎉</p>
          <p className="text-lg font-bold text-gray-900">Tudo em dia!</p>
          <p className="text-sm text-gray-500 mt-1">Nenhuma pendência encontrada. Continue assim!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item, idx) => {
            const u = U[item.urgency]
            const isExpanded = expanded[item.key]
            const hasSubList = item.subList && item.subList.length > 0

            return (
              <div key={item.key} className={`bg-white rounded-2xl border border-gray-100 border-l-[5px] ${u.border} shadow-sm hover:shadow-md transition-all`}>
                <Link href={item.href}
                  className="flex items-center gap-4 px-5 py-4 group">

                {/* Número */}
                <div className="flex-shrink-0 w-8 h-8 bg-gray-50 rounded-xl flex items-center justify-center text-xs font-bold text-gray-400 border border-gray-100 group-hover:border-gray-200">
                  {String(idx + 1).padStart(2, '0')}
                </div>

                {/* Ícone */}
                <div className={`flex-shrink-0 ${u.icon}`}>
                  {item.icon}
                </div>

                {/* Conteúdo */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${u.badgeBg}`}>
                      {item.badge}
                    </span>
                  </div>
                  {item.empresaNome && (
                    <p className="text-sm font-bold text-gray-900 truncate group-hover:text-primary-600 transition-colors leading-tight">
                      {item.empresaNome}
                    </p>
                  )}
                  <p className="text-xs text-gray-500 truncate mt-0.5">{item.descricao}</p>
                </div>

                {/* Detalhe temporal */}
                {item.detalhe && (
                  <div className="flex-shrink-0">
                    <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${DC[item.detalheColor]}`}>
                      {item.detalhe}
                    </span>
                  </div>
                )}

                {/* Detalhe ou botão expandir */}
                {hasSubList ? (
                  <button
                    onClick={e => { e.preventDefault(); setExpanded(prev => ({ ...prev, [item.key]: !prev[item.key] })) }}
                    className="flex-shrink-0 flex items-center gap-1 text-xs text-emerald-600 font-semibold hover:text-emerald-700 transition-colors px-2"
                  >
                    {isExpanded ? 'ocultar' : 'ver lista'}
                    <svg className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                ) : (
                  <svg className="w-4 h-4 text-gray-300 group-hover:text-primary-400 flex-shrink-0 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                )}
                </Link>

                {/* Lista expandível de empresas */}
                {hasSubList && isExpanded && (
                  <div className="px-5 pb-4 border-t border-gray-50">
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mt-3 mb-2">Empresas</p>
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      {item.subList!.sort().map((nome, i) => (
                        <p key={i} className="text-xs text-gray-700 flex items-center gap-1.5">
                          <span className="w-1 h-1 rounded-full bg-gray-400 flex-shrink-0" />
                          {nome}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── Rodapé ────────────────────────────────────────────────────────── */}
      {!loading && (
        <div className="mt-6 flex items-center justify-between">
          <p className="text-xs text-gray-400">
            Prioridades distribuídas entre todos os módulos para manter o equilíbrio.
          </p>
          <button onClick={load}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-700 transition-colors font-medium">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Atualizar briefing
          </button>
        </div>
      )}
    </div>
  )
}
