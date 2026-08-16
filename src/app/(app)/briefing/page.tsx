'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

// ── Helpers ──────────────────────────────────────────────────────────────────

const DIAS_PT  = ['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado']
const MESES_PT = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro']

function daysRemaining(dateStr: string): number {
  const d = new Date(dateStr); d.setHours(0,0,0,0)
  const n = new Date();        n.setHours(0,0,0,0)
  return Math.round((d.getTime() - n.getTime()) / 86_400_000)
}

function daysSince(dateStr: string): number {
  const d = new Date(dateStr)
  return Math.round((Date.now() - d.getTime()) / 86_400_000)
}

function vencLabel(dias: number, tipo: 'f' | 'm' = 'm') {
  const venc = tipo === 'f' ? 'vencida' : 'vencido'
  if (dias < 0)  return `${venc} há ${Math.abs(dias)} ${Math.abs(dias) === 1 ? 'dia' : 'dias'}`
  if (dias === 0) return 'vence hoje'
  return `vence em ${dias} ${dias === 1 ? 'dia' : 'dias'}`
}

// ── Types ────────────────────────────────────────────────────────────────────

type Urgency = 'red' | 'yellow' | 'green'

interface BriefingItem {
  key: string
  urgency: Urgency
  label: string
  empresaNome: string
  descricao: string
  detalhe: string
  href: string
  score: number
}

// ── Component ────────────────────────────────────────────────────────────────

export default function BriefingPage() {
  const [items,       setItems]       = useState<BriefingItem[]>([])
  const [loading,     setLoading]     = useState(true)
  const [totalIssues, setTotalIssues] = useState(0)
  const [supabase]                    = useState(createClient)

  const hoje    = new Date()
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
        { data: empComCertDig },
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
        supabase.from('certificados_digitais').select('empresa_id').not('empresa_id', 'is', null),
      ])

      const allItems: BriefingItem[] = []

      // ── SLOT 1 & 2 — Processos parados 🔴 >15 dias ───────────────────────
      const processosRed: BriefingItem[] = []
      for (const p of processos || []) {
        // Use last etapa update OR processo.updated_at, whichever is more recent
        const etapas = (p as any).etapas || []
        const lastActivity = etapas.length
          ? Math.max(new Date(p.updated_at).getTime(), ...etapas.map((e: any) => new Date(e.updated_at).getTime()))
          : new Date(p.updated_at).getTime()
        const dias = Math.round((Date.now() - lastActivity) / 86_400_000)
        if (dias > 15) {
          processosRed.push({
            key: `proc-red-${p.id}`,
            urgency: 'red',
            label: 'Processo Parado',
            empresaNome: (p as any).empresa?.razao_social || '—',
            descricao: (p as any).titulo || (p as any).tipo || 'Processo societário',
            detalhe: `parado há ${dias} dias`,
            href: '/societario',
            score: dias * 6,
          })
        }
      }
      processosRed.sort((a, b) => b.score - a.score)
      allItems.push(...processosRed.slice(0, 2))

      // ── SLOT 3 & 4 — Vencimentos críticos 🔴 ────────────────────────────
      const vencCrit: BriefingItem[] = []
      for (const c of certidoes || []) {
        const dias = daysRemaining(c.data_vencimento)
        if (dias <= 5) vencCrit.push({
          key: `cert-crit-${c.id}`, urgency: 'red', label: 'Certidão',
          empresaNome: (c as any).empresa?.razao_social || '—',
          descricao: c.tipo || 'Certidão Negativa',
          detalhe: vencLabel(dias, 'f'), href: '/certidoes',
          score: dias < 0 ? 100 + Math.abs(dias) * 2 : 100 - dias * 10,
        })
      }
      for (const a of alvaras || []) {
        const dias = daysRemaining(a.data_vencimento)
        if (dias <= 5) vencCrit.push({
          key: `alv-crit-${a.id}`, urgency: 'red', label: 'Alvará',
          empresaNome: (a as any).empresa?.razao_social || '—',
          descricao: `Alvará ${a.tipo || ''}`.trim(),
          detalhe: vencLabel(dias), href: '/alvaras',
          score: dias < 0 ? 95 + Math.abs(dias) * 2 : 95 - dias * 10,
        })
      }
      for (const l of licencas || []) {
        const dias = daysRemaining(l.data_vencimento)
        if (dias <= 5) vencCrit.push({
          key: `lic-crit-${l.id}`, urgency: 'red', label: 'Licença Sanitária',
          empresaNome: (l as any).empresa?.razao_social || '—',
          descricao: 'Licença Sanitária',
          detalhe: vencLabel(dias, 'f'), href: '/licencas',
          score: dias < 0 ? 90 + Math.abs(dias) * 2 : 90 - dias * 10,
        })
      }
      for (const cd of certificados || []) {
        const dias = daysRemaining(cd.data_vencimento)
        if (dias <= 7) vencCrit.push({
          key: `certdig-crit-${cd.id}`, urgency: 'red', label: 'Certificado Digital',
          empresaNome: (cd as any).empresa?.razao_social || '—',
          descricao: [`${(cd as any).tipo || ''}`, `${(cd as any).uso || ''}`].filter(Boolean).join(' ') || 'Certificado Digital',
          detalhe: vencLabel(dias), href: '/certificados',
          score: dias < 0 ? 88 + Math.abs(dias) * 2 : 88 - dias * 8,
        })
      }
      vencCrit.sort((a, b) => b.score - a.score)
      allItems.push(...vencCrit.slice(0, 2))

      // ── SLOT 5 & 6 — Processos parados 🟡 7-15 dias ─────────────────────
      const processosYel: BriefingItem[] = []
      for (const p of processos || []) {
        const etapas = (p as any).etapas || []
        const lastActivity = etapas.length
          ? Math.max(new Date(p.updated_at).getTime(), ...etapas.map((e: any) => new Date(e.updated_at).getTime()))
          : new Date(p.updated_at).getTime()
        const dias = Math.round((Date.now() - lastActivity) / 86_400_000)
        if (dias >= 7 && dias <= 15) {
          processosYel.push({
            key: `proc-yel-${p.id}`,
            urgency: 'yellow',
            label: 'Processo em Atenção',
            empresaNome: (p as any).empresa?.razao_social || '—',
            descricao: (p as any).titulo || (p as any).tipo || 'Processo societário',
            detalhe: `parado há ${dias} dias`,
            href: '/societario',
            score: dias * 4,
          })
        }
      }
      processosYel.sort((a, b) => b.score - a.score)
      allItems.push(...processosYel.slice(0, 2))

      // ── SLOT 7 & 8 — Vencimentos próximos 🟡 ────────────────────────────
      const vencProx: BriefingItem[] = []
      for (const c of certidoes || []) {
        const dias = daysRemaining(c.data_vencimento)
        if (dias > 5 && dias <= 30) vencProx.push({
          key: `cert-prox-${c.id}`, urgency: 'yellow', label: 'Certidão',
          empresaNome: (c as any).empresa?.razao_social || '—',
          descricao: c.tipo || 'Certidão Negativa',
          detalhe: `vence em ${dias} dias`, href: '/certidoes',
          score: 50 - dias,
        })
      }
      for (const a of alvaras || []) {
        const dias = daysRemaining(a.data_vencimento)
        if (dias > 5 && dias <= 30) vencProx.push({
          key: `alv-prox-${a.id}`, urgency: 'yellow', label: 'Alvará',
          empresaNome: (a as any).empresa?.razao_social || '—',
          descricao: `Alvará ${a.tipo || ''}`.trim(),
          detalhe: `vence em ${dias} dias`, href: '/alvaras',
          score: 48 - dias,
        })
      }
      for (const cd of certificados || []) {
        const dias = daysRemaining(cd.data_vencimento)
        if (dias > 7 && dias <= 30) vencProx.push({
          key: `certdig-prox-${cd.id}`, urgency: 'yellow', label: 'Certificado Digital',
          empresaNome: (cd as any).empresa?.razao_social || '—',
          descricao: [`${(cd as any).tipo || ''}`, `${(cd as any).uso || ''}`].filter(Boolean).join(' ') || 'Certificado Digital',
          detalhe: `vence em ${dias} dias`, href: '/certificados',
          score: 45 - dias,
        })
      }
      vencProx.sort((a, b) => b.score - a.score)
      allItems.push(...vencProx.slice(0, 2))

      // ── SLOT 9 — Empresa incompleta 🟢 ───────────────────────────────────
      const comCertIds    = new Set((empComCert    || []).map((r: any) => r.empresa_id))
      const comAlvaraIds  = new Set((empComAlvara  || []).map((r: any) => r.empresa_id))
      const comCertDigIds = new Set((empComCertDig || []).map((r: any) => r.empresa_id))
      let semCert = 0, semAlvara = 0, semCertDig = 0
      for (const e of empresasAtivas || []) {
        if (!comCertIds.has(e.id))    semCert++
        if (!comAlvaraIds.has(e.id))  semAlvara++
        if (!comCertDigIds.has(e.id)) semCertDig++
      }

      const gaps = [
        { count: semCert,    label: `${semCert} empresas sem certidão cadastrada`,     href: '/certidoes' },
        { count: semAlvara,  label: `${semAlvara} empresas sem alvará cadastrado`,      href: '/alvaras' },
        { count: semCertDig, label: `${semCertDig} empresas sem certificado digital`,   href: '/certificados' },
      ].filter(g => g.count > 0).sort((a, b) => b.count - a.count)

      if (gaps[0]) allItems.push({
        key: 'incompleta',
        urgency: 'green',
        label: 'Cadastro Pendente',
        empresaNome: 'Varredura do sistema',
        descricao: gaps[0].label,
        detalhe: '',
        href: gaps[0].href,
        score: 20,
      })

      // ── SLOT 10 — Meta da semana 🟢 ──────────────────────────────────────
      const metaGap = gaps[1] || gaps[0]
      if (metaGap) allItems.push({
        key: 'meta',
        urgency: 'green',
        label: '⭐ Meta da Semana',
        empresaNome: '',
        descricao: metaGap.label + ' — tente regularizar pelo menos 3 esta semana',
        detalhe: '',
        href: metaGap.href,
        score: 10,
      })

      const total = processosRed.length + vencCrit.length + processosYel.length + vencProx.length
      setTotalIssues(total)
      setItems(allItems.slice(0, 10))
    } catch (e) {
      console.error('Briefing error:', e)
    }
    setLoading(false)
  }

  const C = {
    red:    { border: 'border-l-red-500',     badge: 'bg-red-50 text-red-700 border border-red-100' },
    yellow: { border: 'border-l-amber-400',   badge: 'bg-amber-50 text-amber-700 border border-amber-100' },
    green:  { border: 'border-l-emerald-500', badge: 'bg-emerald-50 text-emerald-700 border border-emerald-100' },
  }

  return (
    <div className="p-6 max-w-2xl">

      {/* ── Header ── */}
      <div className="mb-8">
        <div className="flex items-start gap-3">
          <span className="text-3xl leading-none mt-0.5">☀️</span>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Briefing Diário</h1>
            <p className="text-sm text-gray-500 mt-0.5">{diaLabel}, {dateLabel}</p>
          </div>
        </div>
        {!loading && (
          <div className="mt-4 ml-11 p-3 bg-gray-50 rounded-lg border border-gray-100">
            <p className="text-sm text-gray-600">
              O sistema encontrou <strong className="text-gray-900">{totalIssues}</strong> pendências nos seus módulos.
              Abaixo estão suas <strong className="text-gray-900">{items.length}</strong> prioridades de hoje —
              distribuídas para que nenhum módulo domine o dia.
            </p>
          </div>
        )}
      </div>

      {/* ── Lista ── */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-[72px] bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-5xl mb-4">🎉</p>
          <p className="text-lg font-semibold text-gray-900">Tudo em dia!</p>
          <p className="text-sm text-gray-500 mt-1">Nenhuma pendência crítica encontrada hoje. Bom trabalho!</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {items.map((item, idx) => {
            const c = C[item.urgency]
            return (
              <Link key={item.key} href={item.href}
                className={`flex items-center gap-4 px-4 py-3.5 bg-white rounded-xl border border-gray-100 border-l-4 ${c.border} hover:shadow-md hover:border-gray-200 transition-all group`}>
                {/* Número */}
                <div className="w-6 h-6 flex-shrink-0 bg-gray-100 rounded-full flex items-center justify-center text-[11px] font-bold text-gray-400">
                  {idx + 1}
                </div>
                {/* Conteúdo */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${c.badge}`}>
                      {item.label}
                    </span>
                    {item.detalhe && (
                      <span className="text-xs text-gray-400">{item.detalhe}</span>
                    )}
                  </div>
                  {item.empresaNome && (
                    <p className="text-sm font-semibold text-gray-900 truncate group-hover:text-primary-600 transition-colors">
                      {item.empresaNome}
                    </p>
                  )}
                  <p className="text-xs text-gray-500 truncate">{item.descricao}</p>
                </div>
                {/* Seta */}
                <svg className="w-4 h-4 text-gray-300 group-hover:text-primary-400 flex-shrink-0 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            )
          })}
        </div>
      )}

      {/* ── Atualizar ── */}
      {!loading && (
        <button onClick={load}
          className="mt-6 flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Atualizar briefing
        </button>
      )}
    </div>
  )
}
