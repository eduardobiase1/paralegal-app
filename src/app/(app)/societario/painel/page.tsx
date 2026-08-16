'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useOrg } from '@/lib/org-context'
import Link from 'next/link'
import toast from 'react-hot-toast'

// ── Labels ────────────────────────────────────────────────────────────────────
const TIPO_LABELS: Record<string, string> = {
  abertura:              'Abertura',
  alteracao_contratual:  'Alteração Contratual',
  encerramento:          'Encerramento',
  transferencia_entrada: 'Transferência (Entrada)',
  transferencia_saida:   'Transferência (Saída)',
}

const TIPO_STYLE: Record<string, { bg: string; color: string }> = {
  abertura:              { bg: '#ECFDF5', color: '#065F46' },
  alteracao_contratual:  { bg: '#EFF6FF', color: '#1D4ED8' },
  encerramento:          { bg: '#FEF2F2', color: '#991B1B' },
  transferencia_entrada: { bg: '#F5F3FF', color: '#5B21B6' },
  transferencia_saida:   { bg: '#FFF7ED', color: '#C2410C' },
}

const DIAS_PT  = ['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado']
const MESES_PT = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro']

const SNOOZE_OPTS = [
  { days: 1, label: 'Amanhã' },
  { days: 3, label: '3 dias' },
  { days: 7, label: '7 dias' },
  { days: 14, label: '14 dias' },
]

// ── Urgência ──────────────────────────────────────────────────────────────────
function urgencia(dias: number, prio: boolean) {
  if (prio)      return { bar: '#EA580C', wash: 'rgba(234,88,12,0.05)',  pill: { bg: '#FFF7ED', color: '#9A3412', border: '#FED7AA' }, grad: '#EA580C' }
  if (dias > 30) return { bar: '#DC2626', wash: 'rgba(220,38,38,0.05)',  pill: { bg: '#FEF2F2', color: '#991B1B', border: '#FECACA' }, grad: '#DC2626' }
  if (dias > 15) return { bar: '#F97316', wash: 'rgba(249,115,22,0.05)', pill: { bg: '#FFF7ED', color: '#9A3412', border: '#FED7AA' }, grad: '#F97316' }
  if (dias >= 7) return { bar: '#D97706', wash: 'rgba(217,119,6,0.05)',  pill: { bg: '#FEFCE8', color: '#854D0E', border: '#FDE68A' }, grad: '#D97706' }
  return               { bar: '#059669', wash: 'rgba(5,150,105,0.04)',   pill: { bg: '#ECFDF5', color: '#065F46', border: '#A7F3D0' }, grad: '#059669' }
}

// ── Próxima etapa ─────────────────────────────────────────────────────────────
function proximaEtapa(checklist: any[]): string | null {
  const next = checklist?.find(i => i.status !== 'Concluido')
  if (!next) return null
  const t = next.etapa as string
  return t.length > 72 ? t.substring(0, 72) + '…' : t
}

function diasDesde(dateStr: string): number {
  return Math.max(0, Math.round((Date.now() - new Date(dateStr).getTime()) / 86_400_000))
}

// ── LocalStorage ──────────────────────────────────────────────────────────────
function getPrio(id: string): boolean {
  try { return localStorage.getItem(`pprio_${id}`) === '1' } catch { return false }
}
function togglePrioLS(id: string): boolean {
  const next = !getPrio(id)
  localStorage.setItem(`pprio_${id}`, next ? '1' : '0')
  return next
}
function getSnooze(id: string): Date | null {
  try {
    const v = localStorage.getItem(`psnooze_${id}`)
    if (!v) return null
    const d = new Date(v)
    return d > new Date() ? d : null
  } catch { return null }
}
function saveSnoozeLS(id: string, days: number) {
  const d = new Date(); d.setDate(d.getDate() + days)
  localStorage.setItem(`psnooze_${id}`, d.toISOString())
}
function clearSnoozeLS(id: string) { localStorage.removeItem(`psnooze_${id}`) }

// ── Componente principal ──────────────────────────────────────────────────────
export default function PainelProcessosPage() {
  const { orgId } = useOrg()
  const [supabase] = useState(createClient)

  const [processos,   setProcessos]   = useState<any[]>([])
  const [loading,     setLoading]     = useState(true)
  const [updatedAt,   setUpdatedAt]   = useState<Date | null>(null)
  const [prioMap,     setPrioMap]     = useState<Record<string, boolean>>({})
  const [snoozeMap,   setSnoozeMap]   = useState<Record<string, Date | null>>({})
  const [openStatus,  setOpenStatus]  = useState<string | null>(null)
  const [openSnooze,  setOpenSnooze]  = useState<string | null>(null)
  const [showSnoozed, setShowSnoozed] = useState(false)

  const hoje     = new Date()
  const diaLabel = DIAS_PT[hoje.getDay()]
  const dateTxt  = `${hoje.getDate()} de ${MESES_PT[hoje.getMonth()]} de ${hoje.getFullYear()}`

  const load = useCallback(async () => {
    if (!orgId) return
    setLoading(true)
    const { data } = await supabase
      .from('processos_societarios')
      .select('id, titulo, tipo, status, updated_at, created_at, empresa_id, checklist, cliente_nome, empresas(razao_social)')
      .eq('org_id', orgId)
      .eq('status', 'Andamento')
      .order('updated_at', { ascending: true })

    const lista = data || []
    const pm: Record<string, boolean>     = {}
    const sm: Record<string, Date | null> = {}
    for (const p of lista) { pm[p.id] = getPrio(p.id); sm[p.id] = getSnooze(p.id) }
    setPrioMap(pm); setSnoozeMap(sm); setProcessos(lista)
    setUpdatedAt(new Date()); setLoading(false)
  }, [supabase, orgId])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const h = () => { setOpenStatus(null); setOpenSnooze(null) }
    document.addEventListener('click', h)
    return () => document.removeEventListener('click', h)
  }, [])

  // ── Ações ─────────────────────────────────────────────────────────────────

  async function handleFinalizar(id: string) {
    const { error } = await supabase.from('processos_societarios').update({ status: 'Finalizado' }).eq('id', id)
    if (!error) { setProcessos(prev => prev.filter(p => p.id !== id)); toast.success('Processo finalizado!') }
    setOpenStatus(null)
  }

  function handleSnooze(id: string, days: number) {
    saveSnoozeLS(id, days)
    const d = new Date(); d.setDate(d.getDate() + days)
    setSnoozeMap(prev => ({ ...prev, [id]: d }))
    setOpenSnooze(null)
    toast.success(`Adiado por ${days === 1 ? 'amanhã' : `${days} dias`}`)
  }

  function handleClearSnooze(id: string) {
    clearSnoozeLS(id)
    setSnoozeMap(prev => ({ ...prev, [id]: null }))
  }

  function handleTogglePrio(id: string) {
    const next = togglePrioLS(id)
    setPrioMap(prev => ({ ...prev, [id]: next }))
  }

  // ── Dados derivados ───────────────────────────────────────────────────────
  const agora = new Date()

  const processosDados = processos.map(p => {
    const checklist: any[] = p.checklist || []
    const done  = checklist.filter(i => i.status === 'Concluido').length
    const total = checklist.length
    const pct   = total > 0 ? Math.round((done / total) * 100) : 0
    const next  = proximaEtapa(checklist)
    const dias  = diasDesde(p.updated_at || p.created_at)
    const ultimaMov = new Date(p.updated_at || p.created_at)
      .toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
    const nome = (p.empresas as any)?.razao_social || p.cliente_nome || '—'
    return { ...p, nome, diasParado: dias, ultimaMov, nextStep: next, done, total, pct, prioridade: prioMap[p.id] || false, snoozeUntil: snoozeMap[p.id] || null }
  })

  const snoozed = processosDados.filter(p => p.snoozeUntil && p.snoozeUntil > agora)
  const ativos  = processosDados.filter(p => !p.snoozeUntil || p.snoozeUntil <= agora)
  const priori  = ativos.filter(p =>  p.prioridade).sort((a, b) => b.diasParado - a.diasParado)
  const rotina  = ativos.filter(p => !p.prioridade).sort((a, b) => b.diasParado - a.diasParado)
  const critical = ativos.filter(p => p.diasParado > 30 && !p.prioridade).length

  // ── Card ─────────────────────────────────────────────────────────────────
  function ProcessoCard({ p }: { p: typeof processosDados[0] }) {
    const urg  = urgencia(p.diasParado, p.prioridade)
    const tipo = TIPO_STYLE[p.tipo] || { bg: '#F8FAFC', color: '#475569' }

    return (
      <div
        style={{
          background: `linear-gradient(to right, ${urg.wash} 0%, white 240px), white`,
          borderLeft: `4px solid ${urg.bar}`,
          borderRadius: '0 14px 14px 0',
          boxShadow: '0 1px 4px rgba(13,17,23,0.06), 0 4px 16px rgba(13,17,23,0.04)',
          transition: 'box-shadow 0.2s ease, transform 0.2s ease',
          cursor: 'default',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.boxShadow = '0 4px 20px rgba(13,17,23,0.1), 0 8px 32px rgba(13,17,23,0.06)'
          e.currentTarget.style.transform = 'translateY(-2px)'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.boxShadow = '0 1px 4px rgba(13,17,23,0.06), 0 4px 16px rgba(13,17,23,0.04)'
          e.currentTarget.style.transform = 'translateY(0)'
        }}
      >
        {/* Card body */}
        <div style={{ padding: '18px 20px 14px' }}>

          {/* Empresa + prioridade */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '10px' }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <p style={{ fontSize: '17px', fontWeight: 800, color: '#0D1117', letterSpacing: '-0.025em', lineHeight: 1.15, marginBottom: '7px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {p.nome}
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
                <span style={{ fontSize: '9px', fontWeight: 800, padding: '3px 8px', borderRadius: '100px', background: tipo.bg, color: tipo.color, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  {TIPO_LABELS[p.tipo] ?? p.tipo}
                </span>
                {p.titulo && (
                  <span style={{ fontSize: '11px', fontWeight: 600, color: '#B45309', background: '#FFFBEB', border: '1px solid #FDE68A', padding: '2px 9px', borderRadius: '100px', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.titulo}
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={() => handleTogglePrio(p.id)}
              style={{
                flexShrink: 0, fontSize: '10px', fontWeight: 700,
                padding: '5px 11px', borderRadius: '100px', cursor: 'pointer',
                border: p.prioridade ? '1px solid #FDBA74' : '1px solid #E2E8F0',
                background: p.prioridade ? '#FFF7ED' : 'transparent',
                color: p.prioridade ? '#EA580C' : '#94A3B8',
                transition: 'all 0.15s ease', whiteSpace: 'nowrap',
              }}
            >
              {p.prioridade ? '🔥 Prioritário' : '☆ Rotina'}
            </button>
          </div>

          {/* Metadata row */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px', alignItems: 'center', marginBottom: '13px' }} onClick={e => e.stopPropagation()}>

            {/* Status dropdown */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setOpenStatus(prev => prev === p.id ? null : p.id)}
                style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', fontWeight: 700, padding: '4px 10px', borderRadius: '100px', background: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.06em' }}
              >
                Em Andamento
                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
              </button>
              {openStatus === p.id && (
                <div style={{ position: 'absolute', left: 0, top: 'calc(100% + 6px)', zIndex: 40, background: 'white', borderRadius: '12px', boxShadow: '0 8px 30px rgba(0,0,0,0.14)', border: '1px solid #E2E8F0', padding: '6px', minWidth: '175px' }}>
                  <p style={{ fontSize: '9px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#94A3B8', padding: '4px 10px 6px', margin: 0 }}>Alterar status</p>
                  <button
                    onClick={() => handleFinalizar(p.id)}
                    style={{ width: '100%', textAlign: 'left', padding: '8px 10px', fontSize: '12px', fontWeight: 600, color: '#065F46', background: 'transparent', border: 'none', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#ECFDF5'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#059669', flexShrink: 0 }} />
                    Marcar como Finalizado
                  </button>
                </div>
              )}
            </div>

            {/* Dias parado */}
            <span style={{ fontSize: '10px', fontWeight: 700, padding: '4px 10px', borderRadius: '100px', background: urg.pill.bg, color: urg.pill.color, border: `1px solid ${urg.pill.border}` }}>
              {p.diasParado === 0 ? 'movido hoje' : `${p.diasParado}d parado`}
            </span>

            {/* Última movimentação */}
            <span style={{ fontSize: '10px', color: '#94A3B8', fontWeight: 500 }}>
              última mov. {p.ultimaMov}
            </span>
          </div>

          {/* Próxima etapa */}
          {p.nextStep ? (
            <div style={{ display: 'flex', gap: '10px', background: '#F8FAFC', borderRadius: '10px', padding: '11px 14px', marginBottom: '13px', borderLeft: '3px solid #CBD5E1' }}>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: '9px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#94A3B8', marginBottom: '4px' }}>Próxima etapa</p>
                <p style={{ fontSize: '12px', fontWeight: 600, color: '#334155', lineHeight: 1.45 }}>{p.nextStep}</p>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#ECFDF5', borderRadius: '10px', padding: '11px 14px', marginBottom: '13px' }}>
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#059669" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
              <p style={{ fontSize: '12px', fontWeight: 600, color: '#065F46' }}>Todas as etapas concluídas</p>
            </div>
          )}

          {/* Progress bar */}
          {p.total > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ flex: 1, height: '5px', background: '#F1F5F9', borderRadius: '100px', overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${p.pct}%`,
                  borderRadius: '100px',
                  background: p.pct === 100 ? '#059669' : `linear-gradient(to right, ${urg.bar}AA, ${urg.bar})`,
                  transition: 'width 0.6s ease',
                }} />
              </div>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#94A3B8', whiteSpace: 'nowrap', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                {p.done}/{p.total} · {p.pct}%
              </span>
            </div>
          )}
        </div>

        {/* Rodapé */}
        <div style={{ borderTop: '1px solid #F1F5F9', padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>

          {/* Snooze */}
          <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setOpenSnooze(prev => prev === p.id ? null : p.id)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 600, color: '#94A3B8', background: '#F8FAFC', border: '1px solid #E2E8F0', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.background = '#F1F5F9'; e.currentTarget.style.color = '#475569' }}
              onMouseLeave={e => { e.currentTarget.style.background = '#F8FAFC'; e.currentTarget.style.color = '#94A3B8' }}
            >
              <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
              Adiar
            </button>
            {openSnooze === p.id && (
              <div style={{ position: 'absolute', left: 0, bottom: 'calc(100% + 6px)', zIndex: 40, background: 'white', borderRadius: '12px', boxShadow: '0 8px 30px rgba(0,0,0,0.14)', border: '1px solid #E2E8F0', padding: '6px', minWidth: '145px' }}>
                <p style={{ fontSize: '9px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#94A3B8', padding: '4px 10px 6px', margin: 0 }}>Adiar por</p>
                {SNOOZE_OPTS.map(o => (
                  <button key={o.days} onClick={() => handleSnooze(p.id, o.days)}
                    style={{ width: '100%', textAlign: 'left', padding: '7px 10px', fontSize: '12px', fontWeight: 500, color: '#334155', background: 'transparent', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <Link href={`/societario?processo=${p.id}`}
            style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: 700, color: '#D97706', textDecoration: 'none' }}
          >
            Abrir no módulo
            <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
          </Link>
        </div>
      </div>
    )
  }

  // ── Seção ─────────────────────────────────────────────────────────────────
  function Secao({ label, sublabel, dot, count, children }: {
    label: string; sublabel: string; dot: string; count: number; children: React.ReactNode
  }) {
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px', paddingBottom: '10px', borderBottom: '1px solid #E4E8F0' }}>
          <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: dot, flexShrink: 0 }} />
          <span style={{ fontSize: '13px', fontWeight: 800, color: '#0D1117', letterSpacing: '-0.01em' }}>{label}</span>
          <span style={{ fontSize: '12px', color: '#94A3B8', fontWeight: 400 }}>— {sublabel}</span>
          <span style={{ marginLeft: 'auto', fontSize: '11px', fontWeight: 700, padding: '2px 9px', borderRadius: '100px', background: '#F1F5F9', color: '#64748B' }}>{count}</span>
        </div>
        {children}
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: '#F0F3F9' }}>

      {/* ═══ DARK HEADER ═══════════════════════════════════════════════════ */}
      <div style={{ background: 'linear-gradient(140deg, #0D1117 0%, #111827 55%, #0F1923 100%)', paddingBottom: '56px' }}>
        <div style={{ maxWidth: '780px', margin: '0 auto', padding: '28px 24px 0' }}>

          {/* Brand crumb */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '22px' }}>
            <span style={{ fontSize: '9px', fontWeight: 900, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#F5C842' }}>PARALEGAL PRO</span>
            <span style={{ color: '#2A3248' }}>·</span>
            <span style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#3D4A60' }}>MÓDULO SOCIETÁRIO</span>
          </div>

          {/* Title + refresh */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', marginBottom: '26px' }}>
            <div>
              <h1 style={{ fontSize: '32px', fontWeight: 900, letterSpacing: '-0.035em', color: '#FFFFFF', lineHeight: 1.0, margin: 0 }}>
                Painel de Processos
              </h1>
              <p style={{ fontSize: '13px', color: '#4A5A7A', fontWeight: 500, marginTop: '7px' }}>
                {diaLabel} · {dateTxt}
              </p>
            </div>
            <button onClick={load} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 600, color: '#4A5A7A', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '8px 14px', cursor: 'pointer', marginTop: '4px', flexShrink: 0, transition: 'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.09)'; e.currentTarget.style.color = '#8A9ABE' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#4A5A7A' }}
            >
              <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              Atualizar
            </button>
          </div>

          {/* Scorecard */}
          {!loading && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
              {/* Total em andamento */}
              <div style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', padding: '14px 16px' }}>
                <p style={{ fontSize: '9px', fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#4A5A7A', marginBottom: '6px' }}>Em andamento</p>
                <p style={{ fontSize: '30px', fontWeight: 900, letterSpacing: '-0.04em', color: '#FFFFFF', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                  {ativos.length + snoozed.length}
                </p>
              </div>
              {/* Prioritários */}
              <div style={{ background: priori.length > 0 ? 'rgba(245,200,66,0.08)' : 'rgba(255,255,255,0.06)', border: priori.length > 0 ? '1px solid rgba(245,200,66,0.22)' : '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', padding: '14px 16px' }}>
                <p style={{ fontSize: '9px', fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: priori.length > 0 ? '#F5C842' : '#4A5A7A', marginBottom: '6px' }}>🔥 Prioritários</p>
                <p style={{ fontSize: '30px', fontWeight: 900, letterSpacing: '-0.04em', color: priori.length > 0 ? '#F5C842' : '#FFFFFF', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                  {priori.length}
                </p>
              </div>
              {/* Críticos +30d */}
              <div style={{ background: critical > 0 ? 'rgba(220,38,38,0.08)' : 'rgba(255,255,255,0.06)', border: critical > 0 ? '1px solid rgba(220,38,38,0.25)' : '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', padding: '14px 16px' }}>
                <p style={{ fontSize: '9px', fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: critical > 0 ? '#F87171' : '#4A5A7A', marginBottom: '6px' }}>⚠ Acima de 30d</p>
                <p style={{ fontSize: '30px', fontWeight: 900, letterSpacing: '-0.04em', color: critical > 0 ? '#F87171' : '#FFFFFF', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                  {critical}
                </p>
              </div>
            </div>
          )}

          {loading && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
              {[...Array(3)].map((_, i) => (
                <div key={i} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '14px', height: '72px' }} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ═══ CONTEÚDO (sobrepõe o header) ══════════════════════════════════ */}
      <div style={{ maxWidth: '780px', margin: '-32px auto 0', padding: '0 24px 56px', position: 'relative', zIndex: 1 }}>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[...Array(4)].map((_, i) => (
              <div key={i} style={{ height: '180px', background: 'white', borderRadius: '0 14px 14px 0', borderLeft: '4px solid #E2E8F0', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', animation: 'pulse 1.5s ease-in-out infinite', opacity: 0.7 }} />
            ))}
          </div>
        ) : ativos.length === 0 && snoozed.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '64px 24px', background: 'white', borderRadius: '14px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <p style={{ fontSize: '48px', marginBottom: '16px' }}>🎉</p>
            <p style={{ fontSize: '18px', fontWeight: 800, color: '#0D1117', letterSpacing: '-0.02em' }}>Nenhum processo em andamento!</p>
            <p style={{ fontSize: '13px', color: '#94A3B8', marginTop: '6px' }}>Tudo finalizado ou adiado.</p>
            <Link href="/societario" style={{ display: 'inline-block', marginTop: '20px', fontSize: '12px', fontWeight: 700, color: '#D97706', textDecoration: 'none' }}>
              Ver módulo societário →
            </Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>

            {/* PRIORITÁRIOS */}
            <Secao label="Prioritários" sublabel="precisam da sua atenção hoje" dot="#EA580C" count={priori.length}>
              {priori.length === 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 16px', background: 'white', borderRadius: '10px', border: '1px dashed #E2E8F0' }}>
                  <span style={{ fontSize: '16px' }}>☆</span>
                  <p style={{ fontSize: '13px', color: '#94A3B8' }}>
                    Nenhum prioritário.
                    <span style={{ marginLeft: '4px', color: '#64748B', fontWeight: 600 }}>Use ☆ Rotina nos cards para elevar.</span>
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {priori.map(p => <ProcessoCard key={p.id} p={p} />)}
                </div>
              )}
            </Secao>

            {/* EM ROTINA */}
            <Secao label="Em Rotina" sublabel="mais parado primeiro" dot="#94A3B8" count={rotina.length}>
              {rotina.length === 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '14px 16px', background: 'white', borderRadius: '10px', border: '1px dashed #E2E8F0' }}>
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#059669" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                  <p style={{ fontSize: '13px', color: '#94A3B8' }}>Sem processos em rotina.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {rotina.map(p => <ProcessoCard key={p.id} p={p} />)}
                </div>
              )}
            </Secao>

            {/* ADIADOS */}
            {snoozed.length > 0 && (
              <div>
                <button onClick={() => setShowSnoozed(s => !s)} style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', background: 'none', border: 'none', cursor: 'pointer', marginBottom: showSnoozed ? '12px' : '0', paddingBottom: showSnoozed ? '10px' : '0', borderBottom: showSnoozed ? '1px solid #E4E8F0' : 'none' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#CBD5E1', flexShrink: 0 }} />
                  <span style={{ fontSize: '13px', fontWeight: 800, color: '#64748B', letterSpacing: '-0.01em' }}>Adiados</span>
                  <span style={{ fontSize: '12px', color: '#94A3B8', fontWeight: 400 }}>— voltam automaticamente</span>
                  <span style={{ marginLeft: 'auto', fontSize: '11px', fontWeight: 700, padding: '2px 9px', borderRadius: '100px', background: '#F1F5F9', color: '#64748B' }}>
                    {snoozed.length} {showSnoozed ? '▲' : '▼'}
                  </span>
                </button>
                {showSnoozed && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {snoozed.map(p => {
                      const sn = snoozeMap[p.id]
                      const daysLeft = sn ? Math.ceil((sn.getTime() - agora.getTime()) / 86_400_000) : 0
                      return (
                        <div key={p.id} style={{ background: 'white', borderRadius: '0 10px 10px 0', borderLeft: '3px solid #CBD5E1', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                          <div style={{ minWidth: 0 }}>
                            <p style={{ fontSize: '13px', fontWeight: 700, color: '#64748B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.nome}</p>
                            <p style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px' }}>
                              {TIPO_LABELS[p.tipo] ?? p.tipo}
                              <span style={{ margin: '0 6px', color: '#CBD5E1' }}>·</span>
                              volta {daysLeft === 1 ? 'amanhã' : `em ${daysLeft} dias`}
                              {sn && <span style={{ marginLeft: '4px', fontFamily: 'monospace' }}>({sn.toLocaleDateString('pt-BR')})</span>}
                            </p>
                          </div>
                          <button onClick={() => handleClearSnooze(p.id)} style={{ flexShrink: 0, fontSize: '11px', fontWeight: 700, color: '#D97706', background: 'transparent', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                            Retomar →
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Rodapé */}
        {!loading && (
          <div style={{ marginTop: '32px', paddingTop: '16px', borderTop: '1px solid #E4E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <p style={{ fontSize: '10px', color: '#94A3B8' }}>
              Prioridades e snooze salvos neste navegador · Processos em andamento
              {updatedAt && <span style={{ marginLeft: '8px' }}>· atualizado às {updatedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>}
            </p>
            <Link href="/societario" style={{ fontSize: '11px', fontWeight: 700, color: '#D97706', textDecoration: 'none' }}>
              Ver módulo completo →
            </Link>
          </div>
        )}
      </div>

      <style>{`@keyframes pulse { 0%, 100% { opacity: 0.7; } 50% { opacity: 0.4; } }`}</style>
    </div>
  )
}
