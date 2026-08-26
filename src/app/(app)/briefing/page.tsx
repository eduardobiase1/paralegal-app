'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useOrg } from '@/lib/org-context'
import Link from 'next/link'

// ── Helpers ───────────────────────────────────────────────────────────────────
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
  if (dias < 0)   return `${fem ? 'vencida' : 'vencido'} há ${Math.abs(dias)}d`
  if (dias === 0)  return 'vence hoje'
  return `vence em ${dias}d`
}
function getInitials(name: string) {
  const skip = new Set(['LTDA','EIRELI','MEI','ME','EPP','SA','EI','DE','DA','DO','DOS','DAS','E','EM','A'])
  const w = name.split(/\s+/).filter(x => x.length > 1 && !skip.has(x.toUpperCase().replace(/[.,]/g, '')))
  return w.length >= 2 ? (w[0][0] + w[1][0]).toUpperCase() : name.substring(0, 2).toUpperCase()
}
function getCompType(name: string) {
  const n = name.toUpperCase()
  if (n.includes('LTDA'))   return 'LTDA'
  if (n.includes('EIRELI')) return 'EIRELI'
  if (n.includes('MEI'))    return 'MEI'
  if (/ ME($| )/.test(n))  return 'ME'
  if (n.includes('EPP'))    return 'EPP'
  if (n.includes('S/A') || / SA($| )/.test(n)) return 'S/A'
  if (/ EI($| )/.test(n))  return 'EI'
  return ''
}

// ── Tipos ─────────────────────────────────────────────────────────────────────
type Tier = 'critico' | 'urgente' | 'atencao' | 'controle'

interface PriorityDoc {
  key: string; tipo: 'certidao' | 'alvara' | 'licenca'
  empresaNome: string; empresaId: string; docId: string
  descricao: string; dataVencimento: string | null
  diasRestantes: number | null; href: string
}

interface WorkItem {
  key: string; tier: Tier; icon: React.ReactNode
  badge: string; empresaNome: string; empresaId: string
  href: string; descricao: string; detalhe: string
  detalheColor: 'red' | 'orange' | 'amber' | 'blue' | 'gray'
  score: number; subList?: string[]
}

interface CompanyGroup {
  empresaNome: string; empresaId: string; worstTier: Tier
  items: WorkItem[]; initials: string; compType: string
}

// ── Cores por tier ─────────────────────────────────────────────────────────────
const TS = {
  critico: {
    border: 'border-l-red-500',
    av: 'bg-red-100 text-red-700 border border-red-200',
    chip: 'bg-red-50 text-red-700 border border-red-200',
    chipDot: 'bg-red-500',
    strip: '#EF4444',
    led: '#EF4444', glow: 'rgba(239,68,68,.4)',
    days: 'bg-red-100 text-red-700',
    text: 'text-red-700',
  },
  urgente: {
    border: 'border-l-orange-400',
    av: 'bg-orange-100 text-orange-700 border border-orange-200',
    chip: 'bg-orange-50 text-orange-700 border border-orange-200',
    chipDot: 'bg-orange-500',
    strip: '#F97316',
    led: '#F97316', glow: 'rgba(249,115,22,.4)',
    days: 'bg-orange-100 text-orange-700',
    text: 'text-orange-700',
  },
  atencao: {
    border: 'border-l-amber-400',
    av: 'bg-amber-100 text-amber-800 border border-amber-200',
    chip: 'bg-amber-50 text-amber-800 border border-amber-200',
    chipDot: 'bg-amber-500',
    strip: '#F59E0B',
    led: '#D97706', glow: 'rgba(217,119,6,.4)',
    days: 'bg-amber-100 text-amber-800',
    text: 'text-amber-700',
  },
  controle: {
    border: 'border-l-blue-400',
    av: 'bg-blue-100 text-blue-700 border border-blue-200',
    chip: 'bg-blue-50 text-blue-700 border border-blue-200',
    chipDot: 'bg-blue-400',
    strip: '#60A5FA',
    led: '#3B82F6', glow: 'rgba(59,130,246,.4)',
    days: 'bg-blue-50 text-blue-700',
    text: 'text-blue-700',
  },
}

// ── Badge do tipo de documento ────────────────────────────────────────────────
function DocTypeBadge({ badge }: { badge: string }) {
  const cls =
    badge === 'Alvará'            ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
    badge === 'Licença Sanitária' ? 'bg-purple-50  border-purple-200  text-purple-700'  :
    badge === 'Processo Societário' ? 'bg-slate-100 border-slate-200 text-slate-600'    :
    'bg-sky-50 border-sky-200 text-sky-700'
  return (
    <span className={`text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border flex-shrink-0 whitespace-nowrap ${cls}`}>
      {badge}
    </span>
  )
}

// ── Ícones ────────────────────────────────────────────────────────────────────
const IcoProcesso = () => <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
const IcoCertidao = () => <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
const IcoAlvara   = () => <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138z" /></svg>
const IcoLicenca  = () => <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
const IcoCertDig  = () => <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>
const IcoWarning  = () => <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>

// ── Agrupa itens por empresa ───────────────────────────────────────────────────
function buildCompanyGroups(g: Record<Tier, WorkItem[]>): CompanyGroup[] {
  const map = new Map<string, CompanyGroup>()
  for (const tier of ['critico', 'urgente', 'atencao'] as Tier[]) {
    for (const item of g[tier]) {
      if (!map.has(item.empresaNome)) {
        map.set(item.empresaNome, {
          empresaNome: item.empresaNome,
          empresaId:   item.empresaId,
          worstTier:   tier,
          items:       [],
          initials:    getInitials(item.empresaNome),
          compType:    getCompType(item.empresaNome),
        })
      }
      map.get(item.empresaNome)!.items.push(item)
    }
  }
  const ord = { critico: 0, urgente: 1, atencao: 2, controle: 3 }
  return Array.from(map.values()).sort((a, b) => {
    if (ord[a.worstTier] !== ord[b.worstTier]) return ord[a.worstTier] - ord[b.worstTier]
    return b.items.filter(i => i.tier === 'critico').length - a.items.filter(i => i.tier === 'critico').length
  })
}

// ── Seção Revisão Mensal ──────────────────────────────────────────────────────
function MensalCard({ docs, expanded, onToggle }: {
  docs: PriorityDoc[]; expanded: boolean; onToggle: () => void
}) {
  if (docs.length === 0) return null
  const tipoLabel = { certidao: 'Certidão', alvara: 'Alvará', licenca: 'Licença Sanitária' }

  return (
    <div className="bg-white rounded-xl border border-gray-200 border-l-4 border-l-violet-500 shadow-sm overflow-hidden">
      <button onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-violet-50 transition-colors text-left">
        <div className="w-9 h-9 rounded-xl bg-violet-100 border border-violet-200 flex items-center justify-center text-base flex-shrink-0">⭐</div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-violet-700 leading-tight">Revisão Mensal</p>
          <p className="text-xs text-violet-500 mt-0.5">Empresas prioritárias · ciclo de 30 dias</p>
        </div>
        <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-violet-100 text-violet-700 border border-violet-200 flex-shrink-0">
          {docs.length} {docs.length === 1 ? 'item' : 'itens'}
        </span>
        <svg className={`w-4 h-4 text-violet-400 flex-shrink-0 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="border-t border-violet-100">
          {docs.map(doc => {
            const diasCls = doc.diasRestantes === null ? 'bg-gray-100 text-gray-500'
              : doc.diasRestantes < 0   ? 'bg-red-100 text-red-700'
              : doc.diasRestantes <= 15  ? 'bg-orange-100 text-orange-700'
              : 'bg-violet-50 text-violet-700'
            const diasTxt = doc.diasRestantes === null ? 'sem data'
              : doc.diasRestantes < 0   ? `vencida há ${Math.abs(doc.diasRestantes)}d`
              : doc.diasRestantes === 0  ? 'vence hoje'
              : `vence em ${doc.diasRestantes}d`
            return (
              <Link key={doc.key} href={doc.href}
                className="flex items-center gap-2.5 px-4 py-2.5 border-b border-violet-50 last:border-0 hover:bg-violet-50 transition-colors group">
                <span className="w-1.5 h-1.5 rounded-full bg-violet-400 flex-shrink-0" />
                <span className={`text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border flex-shrink-0 whitespace-nowrap
                  ${doc.tipo === 'alvara'  ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                  : doc.tipo === 'licenca' ? 'bg-purple-50  border-purple-200  text-purple-700'
                  : 'bg-sky-50 border-sky-200 text-sky-700'}`}>
                  {tipoLabel[doc.tipo]}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-900 truncate group-hover:text-violet-700 transition-colors">{doc.descricao}</p>
                  <p className="text-[10px] text-gray-400 truncate">{doc.empresaNome}</p>
                </div>
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 whitespace-nowrap ${diasCls}`}>{diasTxt}</span>
                <svg className="w-3.5 h-3.5 text-gray-300 group-hover:text-violet-400 flex-shrink-0 transition-colors"
                  fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Card de empresa ───────────────────────────────────────────────────────────
function CompanyCard({ group, expanded, onToggle, onSnooze, subListExpanded, onToggleSubList }: {
  group: CompanyGroup; expanded: boolean; onToggle: () => void; onSnooze: () => void
  subListExpanded: Record<string, boolean>; onToggleSubList: (key: string) => void
}) {
  const ts   = TS[group.worstTier]
  const crit = group.items.filter(i => i.tier === 'critico').length
  const urg  = group.items.filter(i => i.tier === 'urgente').length
  const att  = group.items.filter(i => i.tier === 'atencao').length
  const tot  = group.items.length

  return (
    <div className={`bg-white rounded-xl border border-gray-200 border-l-4 ${ts.border} shadow-sm hover:shadow-md transition-shadow`}>
      {/* Header */}
      <button onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 transition-colors text-left">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black flex-shrink-0 tracking-tight ${ts.av}`}>
          {group.initials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-bold text-gray-900 leading-tight truncate">{group.empresaNome}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            {group.compType && (
              <span className="text-[9px] font-bold uppercase tracking-wide text-gray-400 bg-gray-100 border border-gray-200 px-1.5 py-0.5 rounded">
                {group.compType}
              </span>
            )}
            <span className="text-[11px] text-gray-400">
              {tot} {tot === 1 ? 'pendência' : 'pendências'}
            </span>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-1.5 flex-shrink-0">
          {crit > 0 && (
            <span className={`flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full border ${TS.critico.chip}`}>
              <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
              {crit} {crit === 1 ? 'crítico' : 'críticos'}
            </span>
          )}
          {urg > 0 && (
            <span className={`flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full border ${TS.urgente.chip}`}>
              <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
              {urg} {urg === 1 ? 'urgente' : 'urgentes'}
            </span>
          )}
          {att > 0 && crit === 0 && urg === 0 && (
            <span className={`flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full border ${TS.atencao.chip}`}>
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              {att} atenção
            </span>
          )}
        </div>
        <svg className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <>
          {/* Urgency strip */}
          <div className="flex h-[3px]">
            {crit > 0 && <div style={{ width: `${(crit/tot*100).toFixed(1)}%`, background: TS.critico.strip }} />}
            {urg  > 0 && <div style={{ width: `${(urg /tot*100).toFixed(1)}%`, background: TS.urgente.strip }} />}
            {att  > 0 && <div style={{ width: `${(att /tot*100).toFixed(1)}%`, background: TS.atencao.strip }} />}
          </div>

          {/* Doc rows */}
          <div className="border-t border-gray-50">
            {group.items.map(item => {
              const its    = TS[item.tier]
              const hasSub = (item.subList?.length ?? 0) > 0
              const subOpen = subListExpanded[item.key]
              return (
                <div key={item.key} className="border-b border-gray-50 last:border-0">
                  <div className="flex items-center gap-2.5 px-4 py-2.5 hover:bg-gray-50 transition-colors group/row">
                    <span className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ background: its.led, boxShadow: `0 0 6px ${its.glow}` }} />
                    <DocTypeBadge badge={item.badge} />
                    <Link href={item.href} className="flex-1 min-w-0">
                      <span className="text-[13px] font-medium text-gray-900 truncate block hover:text-blue-700 transition-colors">
                        {item.descricao}
                      </span>
                    </Link>
                    <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full flex-shrink-0 whitespace-nowrap ${its.days}`}>
                      {item.detalhe}
                    </span>
                    {!hasSub ? (
                      <Link href={item.href}
                        className="opacity-0 group-hover/row:opacity-100 transition-opacity text-[11px] font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2.5 py-0.5 rounded-full flex-shrink-0 whitespace-nowrap">
                        Renovar →
                      </Link>
                    ) : (
                      <button onClick={() => onToggleSubList(item.key)}
                        className={`text-xs font-semibold flex items-center gap-1 flex-shrink-0 ${its.text}`}>
                        {subOpen ? 'ocultar' : 'ver lista'}
                        <svg className={`w-3 h-3 transition-transform ${subOpen ? 'rotate-180' : ''}`}
                          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    )}
                  </div>
                  {hasSub && subOpen && (
                    <div className="px-12 pb-3 border-t border-gray-50">
                      <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wide mt-3 mb-2">Empresas</p>
                      <div className="space-y-1 max-h-40 overflow-y-auto">
                        {item.subList!.map((nome, i) => (
                          <p key={i} className="text-xs text-gray-600 flex items-center gap-1.5">
                            <span className="w-1 h-1 rounded-full bg-gray-300 flex-shrink-0" />{nome}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Footer */}
          <div className="flex items-center gap-1 px-4 py-2 bg-gray-50 border-t border-gray-100">
            <Link href={`/certidoes?empresa=${group.empresaId}`}
              className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2.5 py-1.5 rounded-lg transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              Ver empresa
            </Link>
            <div className="w-px h-3.5 bg-gray-200 mx-0.5" />
            <button onClick={onSnooze}
              className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-800 hover:bg-gray-100 px-2.5 py-1.5 rounded-lg transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Adiar hoje
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// ── Card de controle ──────────────────────────────────────────────────────────
function ControleCard({ item, subListExpanded, onToggleSubList }: {
  item: WorkItem; subListExpanded: Record<string, boolean>; onToggleSubList: (key: string) => void
}) {
  const subOpen = subListExpanded[item.key]
  return (
    <div className="bg-white rounded-xl border border-gray-200 border-l-4 border-l-blue-400 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center gap-3 px-4 py-3.5">
        <div className="w-9 h-9 rounded-xl bg-blue-100 border border-blue-200 flex items-center justify-center flex-shrink-0 text-blue-600">
          <IcoWarning />
        </div>
        <div className="flex-1 min-w-0">
          <Link href={item.href} className="group">
            <p className="text-sm font-bold text-gray-900 leading-tight group-hover:text-blue-700 transition-colors">{item.empresaNome}</p>
            <p className="text-xs text-gray-500 mt-0.5">{item.descricao}</p>
          </Link>
        </div>
        <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 flex-shrink-0 whitespace-nowrap">
          {item.detalhe}
        </span>
        {(item.subList?.length ?? 0) > 0 && (
          <button onClick={() => onToggleSubList(item.key)}
            className="text-xs font-semibold text-blue-700 flex items-center gap-1 flex-shrink-0">
            {subOpen ? 'ocultar' : 'ver lista'}
            <svg className={`w-3 h-3 transition-transform ${subOpen ? 'rotate-180' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        )}
      </div>
      {subOpen && item.subList && (
        <div className="px-14 pb-3 border-t border-gray-50">
          <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wide mt-3 mb-2">Empresas</p>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {item.subList.map((nome, i) => (
              <p key={i} className="text-xs text-gray-600 flex items-center gap-1.5">
                <span className="w-1 h-1 rounded-full bg-gray-300 flex-shrink-0" />{nome}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function BriefingPage() {
  const { orgId } = useOrg()
  const [groups,       setGroups]       = useState<Record<Tier, WorkItem[]>>({ critico: [], urgente: [], atencao: [], controle: [] })
  const [compGroups,   setCompGroups]   = useState<CompanyGroup[]>([])
  const [priorityDocs, setPriorityDocs] = useState<PriorityDoc[]>([])
  const [loading,      setLoading]      = useState(true)
  const [updatedAt,    setUpdatedAt]    = useState<Date | null>(null)
  const [subExpanded,  setSubExpanded]  = useState<Record<string, boolean>>({})
  const [coExpanded,   setCoExpanded]   = useState<Record<string, boolean>>({})
  const [mensalOpen,   setMensalOpen]   = useState(false)
  const [searchQ,      setSearchQ]      = useState('')
  const [filterTier,   setFilterTier]   = useState<Tier | 'todos'>('todos')
  const [snoozed,      setSnoozed]      = useState<Set<string>>(new Set())
  const [supabase]                      = useState(createClient)

  const hoje     = new Date()
  const diaLabel = DIAS_PT[hoje.getDay()]
  const dateLbl  = `${hoje.getDate()} de ${MESES_PT[hoje.getMonth()]} de ${hoje.getFullYear()}`

  useEffect(() => { load() }, [])

  function tierForDias(dias: number): Tier | null {
    if (dias < 0 || dias <= 5) return 'critico'
    if (dias <= 15)            return 'urgente'
    if (dias <= 30)            return 'atencao'
    return null
  }
  function tierForProcDias(dias: number): Tier | null {
    if (dias > 30)  return 'critico'
    if (dias > 15)  return 'urgente'
    if (dias >= 7)  return 'atencao'
    return null
  }

  async function load() {
    setLoading(true)
    try {
      // Passo 1: buscar SOMENTE as empresas desta organização
      const { data: orgEmpresas } = await supabase
        .from('empresas')
        .select('id, razao_social, situacao, status')
        .eq('org_id', orgId)

      const orgEmpresaIds = (orgEmpresas || []).map(e => e.id)

      // Passo 2: buscar documentos filtrando pelos IDs das empresas do org
      const [
        { data: processos },
        { data: certidoes },
        { data: alvaras },
        { data: licencas },
        { data: certificados },
        { data: empComCert },
        { data: empComAlvara },
      ] = await Promise.all([
        orgEmpresaIds.length === 0 ? Promise.resolve({ data: [] }) :
        supabase.from('processos_societarios')
          .select('id, titulo, tipo, updated_at, empresa_id, empresa:empresas(razao_social), etapas:processo_etapas(id, updated_at)')
          .in('empresa_id', orgEmpresaIds)
          .eq('status', 'em_andamento'),
        orgEmpresaIds.length === 0 ? Promise.resolve({ data: [] }) :
        supabase.from('certidoes')
          .select('id, tipo, data_vencimento, updated_at, empresa_id, empresa:empresas(razao_social)')
          .in('empresa_id', orgEmpresaIds)
          .not('data_vencimento', 'is', null),
        orgEmpresaIds.length === 0 ? Promise.resolve({ data: [] }) :
        supabase.from('alvaras')
          .select('id, tipo, data_vencimento, empresa_id, empresa:empresas(razao_social)')
          .in('empresa_id', orgEmpresaIds)
          .not('data_vencimento', 'is', null),
        orgEmpresaIds.length === 0 ? Promise.resolve({ data: [] }) :
        supabase.from('licencas_sanitarias')
          .select('id, data_vencimento, empresa_id, empresa:empresas(razao_social)')
          .in('empresa_id', orgEmpresaIds)
          .not('data_vencimento', 'is', null),
        orgEmpresaIds.length === 0 ? Promise.resolve({ data: [] }) :
        supabase.from('certificados_digitais')
          .select('id, tipo, uso, data_vencimento, empresa_id, empresa:empresas(razao_social)')
          .in('empresa_id', orgEmpresaIds)
          .not('data_vencimento', 'is', null),
        orgEmpresaIds.length === 0 ? Promise.resolve({ data: [] }) :
        supabase.from('certidoes').select('empresa_id').in('empresa_id', orgEmpresaIds),
        orgEmpresaIds.length === 0 ? Promise.resolve({ data: [] }) :
        supabase.from('alvaras').select('empresa_id').in('empresa_id', orgEmpresaIds),
      ])

      const result: Record<Tier, WorkItem[]> = { critico: [], urgente: [], atencao: [], controle: [] }

      for (const p of processos || []) {
        const etapas = (p as any).etapas || []
        const lastMs = etapas.length
          ? Math.max(new Date(p.updated_at).getTime(), ...etapas.map((e: any) => new Date(e.updated_at).getTime()))
          : new Date(p.updated_at).getTime()
        const dias = daysSinceMs(lastMs)
        const tier = tierForProcDias(dias)
        if (!tier) continue
        result[tier].push({
          key: `proc-${p.id}`, tier, icon: <IcoProcesso />, badge: 'Processo Societário',
          empresaNome: (p as any).empresa?.razao_social || '—', empresaId: p.empresa_id || '',
          href: `/societario/${p.id}`,
          descricao: (p as any).titulo || (p as any).tipo || 'Processo societário',
          detalhe: `${dias}d parado`,
          detalheColor: tier === 'critico' ? 'red' : tier === 'urgente' ? 'orange' : 'amber',
          score: tier === 'critico' ? dias * 6 : tier === 'urgente' ? dias * 4 : dias * 2,
        })
      }

      for (const c of certidoes || []) {
        const dias = daysRemaining(c.data_vencimento)
        const tier = tierForDias(dias)
        if (!tier) continue
        if (c.updated_at && dias > 5) {
          if (daysSinceMs(new Date(c.updated_at).getTime()) < 7) continue
        }
        result[tier].push({
          key: `cert-${c.id}`, tier, icon: <IcoCertidao />, badge: 'Certidão Negativa',
          empresaNome: (c as any).empresa?.razao_social || '—', empresaId: c.empresa_id || '',
          href: `/certidoes?empresa=${c.empresa_id}`,
          descricao: c.tipo || 'Certidão', detalhe: vencTxt(dias, true),
          detalheColor: dias < 0 ? 'red' : tier === 'urgente' ? 'orange' : 'amber',
          score: dias < 0 ? 200 + Math.abs(dias) * 3 : tier === 'critico' ? 150 - dias * 10 : tier === 'urgente' ? 80 - dias * 2 : 50 - dias,
        })
      }

      for (const a of alvaras || []) {
        const dias = daysRemaining(a.data_vencimento)
        const tier = tierForDias(dias)
        if (!tier) continue
        result[tier].push({
          key: `alv-${a.id}`, tier, icon: <IcoAlvara />, badge: 'Alvará',
          empresaNome: (a as any).empresa?.razao_social || '—', empresaId: a.empresa_id || '',
          href: `/alvaras?empresa=${a.empresa_id}`,
          descricao: `Alvará ${(a as any).tipo || ''}`.trim(), detalhe: vencTxt(dias),
          detalheColor: dias < 0 ? 'red' : tier === 'urgente' ? 'orange' : 'amber',
          score: dias < 0 ? 195 + Math.abs(dias) * 3 : tier === 'critico' ? 145 - dias * 10 : tier === 'urgente' ? 78 - dias * 2 : 48 - dias,
        })
      }

      for (const l of licencas || []) {
        const dias = daysRemaining(l.data_vencimento)
        const tier = tierForDias(dias)
        if (!tier) continue
        result[tier].push({
          key: `lic-${l.id}`, tier, icon: <IcoLicenca />, badge: 'Licença Sanitária',
          empresaNome: (l as any).empresa?.razao_social || '—', empresaId: l.empresa_id || '',
          href: `/licencas?empresa=${l.empresa_id}`,
          descricao: 'Licença Sanitária', detalhe: vencTxt(dias, true),
          detalheColor: dias < 0 ? 'red' : tier === 'urgente' ? 'orange' : 'amber',
          score: dias < 0 ? 190 + Math.abs(dias) * 3 : tier === 'critico' ? 140 - dias * 10 : tier === 'urgente' ? 76 - dias * 2 : 46 - dias,
        })
      }

      for (const cd of certificados || []) {
        const dias = daysRemaining(cd.data_vencimento)
        const tier = tierForDias(dias)
        if (!tier) continue
        result[tier].push({
          key: `certdig-${cd.id}`, tier, icon: <IcoCertDig />, badge: 'Certificado Digital',
          empresaNome: (cd as any).empresa?.razao_social || '—', empresaId: cd.empresa_id || '',
          href: `/certificados?empresa=${cd.empresa_id}`,
          descricao: [(cd as any).tipo, (cd as any).uso].filter(Boolean).join(' ') || 'Certificado Digital',
          detalhe: vencTxt(dias),
          detalheColor: dias < 0 ? 'red' : tier === 'urgente' ? 'orange' : 'amber',
          score: dias < 0 ? 185 + Math.abs(dias) * 3 : tier === 'critico' ? 135 - dias * 10 : tier === 'urgente' ? 74 - dias * 2 : 44 - dias,
        })
      }

      const comCertIds   = new Set((empComCert   || []).map((r: any) => r.empresa_id))
      const comAlvaraIds = new Set((empComAlvara || []).map((r: any) => r.empresa_id))
      const semCertNomes:   string[] = []
      const semAlvaraNomes: string[] = []
      // Apenas empresas ativas desta organização sem documentos cadastrados
      const ativas = (orgEmpresas || []).filter(e => {
        const sit = (e.situacao || '').toUpperCase()
        const sta = (e.status || '').toLowerCase()
        return sit === 'ativa' || sit === 'ATIVA' || sit === '' || sta === 'ativa'
      })
      for (const e of ativas) {
        if (!comCertIds.has(e.id))   semCertNomes.push(e.razao_social)
        if (!comAlvaraIds.has(e.id)) semAlvaraNomes.push(e.razao_social)
      }
      if (semCertNomes.length > 0) {
        result.controle.push({
          key: 'gap-cert', tier: 'controle', icon: <IcoWarning />, badge: 'Cadastro Pendente',
          empresaNome: 'Certidões Negativas', empresaId: '', href: '/certidoes',
          descricao: `${semCertNomes.length} empresa${semCertNomes.length !== 1 ? 's' : ''} ativa${semCertNomes.length !== 1 ? 's' : ''} sem certidão cadastrada`,
          detalhe: `${semCertNomes.length} empresa${semCertNomes.length !== 1 ? 's' : ''}`,
          detalheColor: 'blue', score: semCertNomes.length * 5, subList: semCertNomes.sort(),
        })
      }
      if (semAlvaraNomes.length > 0) {
        result.controle.push({
          key: 'gap-alv', tier: 'controle', icon: <IcoWarning />, badge: 'Cadastro Pendente',
          empresaNome: 'Alvarás de Funcionamento', empresaId: '', href: '/alvaras',
          descricao: `${semAlvaraNomes.length} empresa${semAlvaraNomes.length !== 1 ? 's' : ''} ativa${semAlvaraNomes.length !== 1 ? 's' : ''} sem alvará cadastrado`,
          detalhe: `${semAlvaraNomes.length} empresa${semAlvaraNomes.length !== 1 ? 's' : ''}`,
          detalheColor: 'blue', score: semAlvaraNomes.length * 4, subList: semAlvaraNomes.sort(),
        })
      }

      for (const tier of Object.keys(result) as Tier[]) {
        result[tier].sort((a, b) => b.score - a.score)
      }
      setGroups(result)
      setCompGroups(buildCompanyGroups(result))

      // ── Revisão Mensal ────────────────────────────────────────────────────
      const trintaDiasAtras = new Date(Date.now() - 30 * 86_400_000).toISOString()
      const { data: empPriori } = await supabase
        .from('empresas')
        .select('id, razao_social')
        .eq('org_id', orgId)
        .eq('prioritaria', true)

      if (empPriori && empPriori.length > 0) {
        const ids = empPriori.map((e: any) => e.id)
        const nomeMap: Record<string, string> = {}
        for (const e of empPriori) nomeMap[(e as any).id] = (e as any).razao_social

        const [{ data: certPriori }, { data: alvPriori }, { data: licPriori }] = await Promise.all([
          supabase.from('certidoes').select('id, tipo, data_vencimento, briefing_revisado_em, empresa_id')
            .in('empresa_id', ids).or(`briefing_revisado_em.is.null,briefing_revisado_em.lt.${trintaDiasAtras}`),
          supabase.from('alvaras').select('id, tipo, data_vencimento, briefing_revisado_em, empresa_id')
            .in('empresa_id', ids).or(`briefing_revisado_em.is.null,briefing_revisado_em.lt.${trintaDiasAtras}`),
          supabase.from('licencas_sanitarias').select('id, data_vencimento, briefing_revisado_em, empresa_id')
            .in('empresa_id', ids).or(`briefing_revisado_em.is.null,briefing_revisado_em.lt.${trintaDiasAtras}`),
        ])

        const docs: PriorityDoc[] = []
        for (const c of certPriori || []) {
          docs.push({ key: `priori-cert-${c.id}`, tipo: 'certidao', empresaNome: nomeMap[c.empresa_id] || '—',
            empresaId: c.empresa_id, docId: c.id, descricao: c.tipo || 'Certidão Negativa',
            dataVencimento: c.data_vencimento, diasRestantes: c.data_vencimento ? daysRemaining(c.data_vencimento) : null,
            href: `/certidoes?empresa=${c.empresa_id}` })
        }
        for (const a of alvPriori || []) {
          docs.push({ key: `priori-alv-${a.id}`, tipo: 'alvara', empresaNome: nomeMap[a.empresa_id] || '—',
            empresaId: a.empresa_id, docId: a.id, descricao: `Alvará ${(a as any).tipo || ''}`.trim(),
            dataVencimento: a.data_vencimento, diasRestantes: a.data_vencimento ? daysRemaining(a.data_vencimento) : null,
            href: `/alvaras?empresa=${a.empresa_id}` })
        }
        for (const l of licPriori || []) {
          docs.push({ key: `priori-lic-${l.id}`, tipo: 'licenca', empresaNome: nomeMap[l.empresa_id] || '—',
            empresaId: l.empresa_id, docId: l.id, descricao: 'Licença Sanitária',
            dataVencimento: l.data_vencimento, diasRestantes: l.data_vencimento ? daysRemaining(l.data_vencimento) : null,
            href: `/licencas?empresa=${l.empresa_id}` })
        }
        docs.sort((a, b) => a.empresaNome.localeCompare(b.empresaNome) || a.tipo.localeCompare(b.tipo))
        setPriorityDocs(docs)
      } else {
        setPriorityDocs([])
      }

      setUpdatedAt(new Date())
    } catch (e) {
      console.error('Briefing error:', e)
    }
    setLoading(false)
  }

  const totalCritico  = groups.critico.length
  const totalUrgente  = groups.urgente.length
  const totalAtencao  = groups.atencao.length
  const totalControle = groups.controle.length
  const totalGeral    = totalCritico + totalUrgente + totalAtencao + totalControle
  const tudoEmDia     = !loading && totalGeral === 0

  const filteredGroups = compGroups.filter(g => {
    if (snoozed.has(g.empresaNome)) return false
    if (filterTier !== 'todos' && g.worstTier !== filterTier) return false
    if (searchQ && !g.empresaNome.toLowerCase().includes(searchQ.toLowerCase())) return false
    return true
  })

  function expandAll()  { const m: Record<string, boolean> = {}; compGroups.forEach(g => { m[g.empresaNome] = true  }); setCoExpanded(m) }
  function collapseAll(){ const m: Record<string, boolean> = {}; compGroups.forEach(g => { m[g.empresaNome] = false }); setCoExpanded(m) }

  return (
    <div className="p-4 md:p-6 space-y-4">

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <header className="flex flex-wrap justify-between items-center gap-3 bg-white p-4 md:p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1M4.22 4.22l.707.707m12.02 12.02l.707.707M1 12h2m18 0h2M4.22 19.78l.707-.707M18.95 5.05l.707-.707M12 7a5 5 0 100 10A5 5 0 0012 7z" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Briefing Diário</h1>
            <p className="text-xs text-slate-500 mt-0.5">{diaLabel} · {dateLbl}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {!loading && (
            <>
              {totalCritico > 0  && <span className="flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-lg bg-red-50    text-red-700    border border-red-200   "><span className="w-1.5 h-1.5 rounded-full bg-red-500"    />{totalCritico} críticos</span>}
              {totalUrgente > 0  && <span className="flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-lg bg-orange-50  text-orange-700  border border-orange-200"><span className="w-1.5 h-1.5 rounded-full bg-orange-500"  />{totalUrgente} urgentes</span>}
              {totalAtencao > 0  && <span className="flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-lg bg-amber-50   text-amber-700   border border-amber-200 "><span className="w-1.5 h-1.5 rounded-full bg-amber-400"   />{totalAtencao} atenção</span>}
              {priorityDocs.length > 0 && <span className="flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-lg bg-violet-50  text-violet-700  border border-violet-200"><span className="w-1.5 h-1.5 rounded-full bg-violet-500"  />{priorityDocs.length} revisão</span>}
            </>
          )}
          <button onClick={load} title="Atualizar"
            className="btn-secondary px-3">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </header>

      {/* ── Conteúdo ─────────────────────────────────────────────────────── */}
      <div>
        {loading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-white rounded-xl animate-pulse border border-gray-200" />
            ))}
          </div>
        ) : tudoEmDia ? (
          <div className="text-center py-24 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <p className="text-5xl mb-4">🎉</p>
            <p className="text-lg font-bold text-gray-900">100% sob controle!</p>
            <p className="text-sm text-gray-500 mt-1">Nenhuma pendência encontrada. Continue assim!</p>
          </div>
        ) : (
          <>
            {/* Ação imediata */}
            {groups.critico.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-xl overflow-hidden">
                <div className="flex items-center gap-2.5 px-4 py-3">
                  <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
                  </span>
                  <span className="text-sm font-bold text-red-700 flex-1">Ação imediata necessária</span>
                  <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-red-100 text-red-700 border border-red-200">
                    {groups.critico.length} {groups.critico.length === 1 ? 'documento' : 'documentos'}
                  </span>
                </div>
                <div className="border-t border-red-200">
                  {groups.critico.map(item => (
                    <Link key={item.key} href={item.href}
                      className="flex items-center gap-2.5 px-4 py-2.5 border-b border-red-100 last:border-0 hover:bg-red-100 transition-colors group">
                      <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border bg-red-100 border-red-200 text-red-700 flex-shrink-0 whitespace-nowrap">
                        {item.badge}
                      </span>
                      <span className="text-xs font-semibold text-gray-900 flex-1 min-w-0 truncate">{item.descricao}</span>
                      <span className="text-xs text-gray-500 flex-1 min-w-0 truncate hidden sm:block">{item.empresaNome}</span>
                      <span className="text-[11px] font-bold text-red-700 flex-shrink-0 whitespace-nowrap">{item.detalhe}</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Toolbar */}
            <div className="flex flex-wrap gap-2 items-center bg-white border border-slate-200 rounded-2xl p-3 shadow-sm">
              <div className="relative flex-1 min-w-[160px]">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input type="text" value={searchQ} onChange={e => setSearchQ(e.target.value)}
                  placeholder="Buscar empresa…"
                  className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-50 transition-all placeholder:text-gray-400" />
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {(['todos','critico','urgente','atencao'] as const).map(f => (
                  <button key={f} onClick={() => setFilterTier(f)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all whitespace-nowrap
                      ${filterTier === f ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
                    {f === 'todos' ? 'Todos' : f === 'critico' ? 'Crítico' : f === 'urgente' ? 'Urgente' : 'Atenção'}
                  </button>
                ))}
              </div>
              <div className="flex gap-1.5 ml-auto">
                <button onClick={expandAll}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors whitespace-nowrap">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 8h16M4 16h16"/></svg>
                  Expandir
                </button>
                <button onClick={collapseAll}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors whitespace-nowrap">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7"/></svg>
                  Recolher
                </button>
              </div>
            </div>

            {/* Revisão Mensal */}
            <MensalCard docs={priorityDocs} expanded={mensalOpen} onToggle={() => setMensalOpen(p => !p)} />

            {/* Label */}
            {filteredGroups.length > 0 && (
              <div className="flex items-center justify-between py-2 mb-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Pendências por empresa</span>
                <span className="text-[11px] text-gray-400">Ordenado por urgência</span>
              </div>
            )}

            {/* Company cards */}
            <div className="space-y-2">
              {filteredGroups.map(g => (
                <CompanyCard
                  key={g.empresaNome}
                  group={g}
                  expanded={coExpanded[g.empresaNome] ?? true}
                  onToggle={() => setCoExpanded(p => ({ ...p, [g.empresaNome]: !(p[g.empresaNome] ?? true) }))}
                  onSnooze={() => setSnoozed(p => new Set([...p, g.empresaNome]))}
                  subListExpanded={subExpanded}
                  onToggleSubList={key => setSubExpanded(p => ({ ...p, [key]: !p[key] }))}
                />
              ))}

              {/* Controle */}
              {filterTier === 'todos' && !searchQ && groups.controle.length > 0 && (
                <>
                  {filteredGroups.length > 0 && (
                    <div className="py-2">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Controle de Cadastro</span>
                    </div>
                  )}
                  {groups.controle.map(item => (
                    <ControleCard key={item.key} item={item} subListExpanded={subExpanded}
                      onToggleSubList={key => setSubExpanded(p => ({ ...p, [key]: !p[key] }))} />
                  ))}
                </>
              )}

              {filteredGroups.length === 0 && (filterTier !== 'todos' || searchQ) && (
                <div className="text-center py-10 bg-white rounded-xl border border-gray-200">
                  <p className="text-2xl mb-2">🔍</p>
                  <p className="text-sm font-medium text-gray-500">Nenhuma empresa encontrada</p>
                </div>
              )}
            </div>

            {updatedAt && (
              <p className="text-[11px] text-gray-400 text-center mt-6">
                Atualizado às {updatedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} · {totalGeral} {totalGeral === 1 ? 'pendência' : 'pendências'} em {compGroups.length} {compGroups.length === 1 ? 'empresa' : 'empresas'}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
