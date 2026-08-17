'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useOrg } from '@/lib/org-context'
import Link from 'next/link'
import toast from 'react-hot-toast'

// ── Labels ─────────────────────────────────────────────────────────────────────
const TIPO_LABELS: Record<string, string> = {
  abertura:              'Abertura',
  alteracao_contratual:  'Alteração Contratual',
  encerramento:          'Encerramento',
  transferencia_entrada: 'Transferência (Entrada)',
  transferencia_saida:   'Transferência (Saída)',
}

const TIPO_STYLE: Record<string, { bg: string; color: string }> = {
  abertura:              { bg: 'rgba(16,185,129,0.15)', color: '#6EE7B7' },
  alteracao_contratual:  { bg: 'rgba(59,130,246,0.15)',  color: '#93C5FD' },
  encerramento:          { bg: 'rgba(239,68,68,0.15)',   color: '#FCA5A5' },
  transferencia_entrada: { bg: 'rgba(139,92,246,0.15)',  color: '#C4B5FD' },
  transferencia_saida:   { bg: 'rgba(245,158,11,0.15)',  color: '#FCD34D' },
}

const DIAS_PT  = ['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado']
const MESES_PT = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro']

const SNOOZE_OPTS = [
  { days: 1,  label: 'Amanhã'  },
  { days: 3,  label: '3 dias'  },
  { days: 7,  label: '7 dias'  },
  { days: 14, label: '14 dias' },
]

// ── Urgência visual progressiva ─────────────────────────────────────────────
// ≤7d  → neutro    8–30d → âmbar    >30d → vermelho crítico    Prio → laranja brand
function urgConfig(dias: number, prio: boolean) {
  if (prio) return {
    borderColor: '#F97316', borderW: '3px',
    glow: 'rgba(249,115,22,0.18)',
    tag: { bg: 'rgba(249,115,22,0.15)', color: '#FB923C', border: 'rgba(249,115,22,0.3)' },
    alertIcon: false,
  }
  if (dias > 30) return {
    borderColor: '#EF4444', borderW: '3px',
    glow: 'rgba(239,68,68,0.18)',
    tag: { bg: 'rgba(239,68,68,0.15)', color: '#FCA5A5', border: 'rgba(239,68,68,0.35)' },
    alertIcon: true,
  }
  if (dias >= 8) return {
    borderColor: '#F59E0B', borderW: '3px',
    glow: 'transparent',
    tag: { bg: 'rgba(245,158,11,0.12)', color: '#FCD34D', border: 'rgba(245,158,11,0.25)' },
    alertIcon: false,
  }
  return {
    borderColor: 'rgba(255,255,255,0.1)', borderW: '1px',
    glow: 'transparent',
    tag: { bg: 'rgba(255,255,255,0.07)', color: '#94A3B8', border: 'rgba(255,255,255,0.12)' },
    alertIcon: false,
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function proximaEtapa(checklist: any[]): string | null {
  const next = checklist?.find(i => i.status !== 'Concluido')
  if (!next) return null
  const t = next.etapa as string
  return t.length > 68 ? t.substring(0, 68) + '…' : t
}

function diasDesde(dateStr: string): number {
  return Math.max(0, Math.round((Date.now() - new Date(dateStr).getTime()) / 86_400_000))
}

// ── LocalStorage ───────────────────────────────────────────────────────────────
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

// ══════════════════════════════════════════════════════════════════════════════
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

  const [expandNotes, setExpandNotes] = useState<Record<string, boolean>>({})
  const [notasCache,  setNotasCache]  = useState<Record<string, any[] | null>>({})
  const [notaInput,   setNotaInput]   = useState<Record<string, string>>({})
  const [savingNota,  setSavingNota]  = useState<Record<string, boolean>>({})
  const [notaCount,   setNotaCount]   = useState<Record<string, number>>({})

  const hoje     = new Date()
  const diaLabel = DIAS_PT[hoje.getDay()]
  const dateTxt  = `${hoje.getDate()} de ${MESES_PT[hoje.getMonth()]} de ${hoje.getFullYear()}`

  const load = useCallback(async () => {
    if (!orgId) return
    setLoading(true)
    const { data } = await supabase
      .from('processos_societarios')
      .select('id, titulo, tipo, status, updated_at, created_at, empresa_id, checklist, docs_solicitados, cliente_nome, empresas(razao_social)')
      .eq('org_id', orgId)
      .eq('status', 'Andamento')
      .order('updated_at', { ascending: true })

    const lista = data || []
    const pm: Record<string, boolean>     = {}
    const sm: Record<string, Date | null> = {}
    for (const p of lista) { pm[p.id] = getPrio(p.id); sm[p.id] = getSnooze(p.id) }
    setPrioMap(pm); setSnoozeMap(sm); setProcessos(lista)
    setUpdatedAt(new Date()); setLoading(false)

    if (lista.length > 0) {
      const { data: noteRows } = await supabase
        .from('processo_notas').select('processo_id')
        .in('processo_id', lista.map(p => p.id))
      const counts: Record<string, number> = {}
      for (const row of noteRows || []) counts[row.processo_id] = (counts[row.processo_id] || 0) + 1
      setNotaCount(counts)
    }
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
    setPrioMap(prev => ({ ...prev, [id]: togglePrioLS(id) }))
  }

  async function toggleNotes(id: string) {
    const opening = !expandNotes[id]
    setExpandNotes(prev => ({ ...prev, [id]: opening }))
    if (opening && notasCache[id] === undefined) {
      setNotasCache(prev => ({ ...prev, [id]: null }))
      const { data } = await supabase
        .from('processo_notas').select('*').eq('processo_id', id)
        .order('created_at', { ascending: false }).limit(5)
      setNotasCache(prev => ({ ...prev, [id]: data || [] }))
    }
  }

  async function saveNota(id: string) {
    const texto = (notaInput[id] || '').trim()
    if (!texto) return
    setSavingNota(prev => ({ ...prev, [id]: true }))
    const { data, error } = await supabase
      .from('processo_notas').insert([{ processo_id: id, org_id: orgId, texto }])
      .select().single()
    if (!error && data) {
      setNotasCache(prev => ({ ...prev, [id]: [data, ...(prev[id] || [])] }))
      setNotaInput(prev => ({ ...prev, [id]: '' }))
      setNotaCount(prev => ({ ...prev, [id]: (prev[id] || 0) + 1 }))
      toast.success('Nota salva!')
    }
    setSavingNota(prev => ({ ...prev, [id]: false }))
  }

  // ── Dados derivados ────────────────────────────────────────────────────────
  const agora = new Date()

  const processosDados = processos.map(p => {
    const checklist: any[] = p.checklist || []
    const docs: any[]      = p.docs_solicitados || []
    const done  = checklist.filter(i => i.status === 'Concluido').length
    const total = checklist.length
    const pct   = total > 0 ? Math.round((done / total) * 100) : 0
    const dias  = diasDesde(p.updated_at || p.created_at)
    const ultimaMov = new Date(p.updated_at || p.created_at)
      .toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
    const nome       = (p.empresas as any)?.razao_social || p.cliente_nome || '—'
    const docsPend   = docs.filter(d => !d.recebido).length
    const docsReceb  = docs.length - docsPend
    return {
      ...p,
      nome, diasParado: dias, ultimaMov,
      nextStep: proximaEtapa(checklist),
      done, total, pct,
      docsTotal: docs.length, docsReceb, docsPend,
      prioridade:  prioMap[p.id] || false,
      snoozeUntil: snoozeMap[p.id] || null,
    }
  })

  const snoozed       = processosDados.filter(p => p.snoozeUntil && p.snoozeUntil > agora)
  const ativos        = processosDados.filter(p => !p.snoozeUntil || p.snoozeUntil <= agora)
  const priori        = ativos.filter(p =>  p.prioridade).sort((a, b) => b.diasParado - a.diasParado)
  const rotina        = ativos.filter(p => !p.prioridade).sort((a, b) => b.diasParado - a.diasParado)
  const criticalCount = ativos.filter(p => !p.prioridade && p.diasParado > 30).length

  // ── Card ──────────────────────────────────────────────────────────────────
  function ProcessoCard({ p }: { p: typeof processosDados[0] }) {
    const urg      = urgConfig(p.diasParado, p.prioridade)
    const tipo     = TIPO_STYLE[p.tipo] || { bg: 'rgba(255,255,255,0.07)', color: '#94A3B8' }
    const notesCt  = notaCount[p.id] || 0
    const notesOpen = expandNotes[p.id]

    return (
      <div style={{
        display: 'flex', flexDirection: 'column',
        background: 'rgba(255,255,255,0.04)',
        backdropFilter: 'blur(12px)',
        border: `${urg.borderW} solid ${urg.borderColor}`,
        borderRadius: '16px',
        boxShadow: urg.glow !== 'transparent'
          ? `0 0 0 1px rgba(255,255,255,0.06), 0 4px 20px ${urg.glow}`
          : '0 0 0 1px rgba(255,255,255,0.06)',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        overflow: 'hidden',
        height: '100%',
      }}
        onMouseEnter={e => {
          e.currentTarget.style.transform = 'translateY(-3px)'
          e.currentTarget.style.boxShadow = urg.glow !== 'transparent'
            ? `0 0 0 1px rgba(255,255,255,0.1), 0 12px 40px ${urg.glow}, 0 4px 12px rgba(0,0,0,0.4)`
            : '0 0 0 1px rgba(255,255,255,0.1), 0 12px 40px rgba(0,0,0,0.35)'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.transform = 'translateY(0)'
          e.currentTarget.style.boxShadow = urg.glow !== 'transparent'
            ? `0 0 0 1px rgba(255,255,255,0.06), 0 4px 20px ${urg.glow}`
            : '0 0 0 1px rgba(255,255,255,0.06)'
        }}
      >

        {/* ── BODY ─────────────────────────────────────────────────────── */}
        <div style={{ padding: '18px 18px 0', flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>

          {/* Empresa + botão prio */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{
                fontSize: '15px', fontWeight: 800, color: '#F1F5F9',
                letterSpacing: '-0.02em', lineHeight: 1.2, marginBottom: '7px',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {p.nome}
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', alignItems: 'center' }}>
                <span style={{
                  fontSize: '9px', fontWeight: 800, padding: '3px 8px',
                  borderRadius: '100px', background: tipo.bg, color: tipo.color,
                  textTransform: 'uppercase', letterSpacing: '0.07em',
                }}>
                  {TIPO_LABELS[p.tipo] ?? p.tipo}
                </span>
                {p.titulo && (
                  <span style={{
                    fontSize: '10px', fontWeight: 600, color: '#94A3B8',
                    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                    padding: '2px 8px', borderRadius: '100px',
                    maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {p.titulo}
                  </span>
                )}
              </div>
            </div>

            <button
              onClick={() => handleTogglePrio(p.id)}
              style={{
                flexShrink: 0, fontSize: '10px', fontWeight: 700,
                padding: '4px 10px', borderRadius: '100px', cursor: 'pointer',
                border: p.prioridade ? '1px solid rgba(249,115,22,0.4)' : '1px solid rgba(255,255,255,0.1)',
                background: p.prioridade ? 'rgba(249,115,22,0.12)' : 'rgba(255,255,255,0.04)',
                color: p.prioridade ? '#FB923C' : '#64748B',
                transition: 'all 0.15s', whiteSpace: 'nowrap',
              }}
            >
              {p.prioridade ? '🔥 Prio' : '☆'}
            </button>
          </div>

          {/* Status + Dias badge */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}
            onClick={e => e.stopPropagation()}>

            {/* Status dropdown */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setOpenStatus(prev => prev === p.id ? null : p.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '4px',
                  fontSize: '10px', fontWeight: 700, padding: '3px 9px', borderRadius: '100px',
                  background: 'rgba(59,130,246,0.12)', color: '#60A5FA',
                  border: '1px solid rgba(59,130,246,0.25)', cursor: 'pointer',
                  textTransform: 'uppercase', letterSpacing: '0.06em',
                }}>
                Em Andamento
                <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {openStatus === p.id && (
                <div style={{
                  position: 'absolute', left: 0, top: 'calc(100% + 6px)', zIndex: 50,
                  background: '#1E2837', borderRadius: '12px',
                  boxShadow: '0 12px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.08)',
                  padding: '6px', minWidth: '175px',
                }}>
                  <p style={{ fontSize: '9px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#475569', padding: '4px 10px 6px', margin: 0 }}>
                    Alterar status
                  </p>
                  <button
                    onClick={() => handleFinalizar(p.id)}
                    style={{
                      width: '100%', textAlign: 'left', padding: '8px 10px',
                      fontSize: '12px', fontWeight: 600, color: '#4ADE80',
                      background: 'transparent', border: 'none', borderRadius: '8px',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(74,222,128,0.08)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22C55E', flexShrink: 0 }} />
                    Marcar como Finalizado
                  </button>
                </div>
              )}
            </div>

            {/* Dias parado */}
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: '4px',
              fontSize: '10px', fontWeight: 700, padding: '3px 9px', borderRadius: '100px',
              background: urg.tag.bg, color: urg.tag.color, border: `1px solid ${urg.tag.border}`,
            }}>
              {urg.alertIcon && (
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              )}
              {p.diasParado === 0 ? 'hoje' : `${p.diasParado}d parado`}
            </span>

            <span style={{ fontSize: '10px', color: '#475569', fontWeight: 500 }}>
              {p.ultimaMov}
            </span>
          </div>

          {/* Próxima etapa */}
          {p.nextStep ? (
            <div style={{
              background: 'rgba(255,255,255,0.04)', borderRadius: '10px',
              padding: '10px 12px', borderLeft: '2px solid rgba(255,255,255,0.12)',
            }}>
              <p style={{ fontSize: '9px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#475569', marginBottom: '4px' }}>
                Próxima etapa
              </p>
              <p style={{ fontSize: '12px', fontWeight: 500, color: '#94A3B8', lineHeight: 1.45 }}>
                {p.nextStep}
              </p>
            </div>
          ) : (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '7px',
              background: 'rgba(34,197,94,0.08)', borderRadius: '10px',
              padding: '10px 12px', border: '1px solid rgba(34,197,94,0.15)',
            }}>
              <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="#4ADE80" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <p style={{ fontSize: '12px', fontWeight: 600, color: '#4ADE80' }}>Todas as etapas concluídas</p>
            </div>
          )}

          {/* Progress bar */}
          {p.total > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ flex: 1, height: '4px', background: 'rgba(255,255,255,0.07)', borderRadius: '100px', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', width: `${p.pct}%`, borderRadius: '100px',
                  background: p.pct === 100 ? '#22C55E' : '#3B82F6',
                  transition: 'width 0.6s ease',
                  boxShadow: p.pct > 0 ? `0 0 6px ${p.pct === 100 ? '#22C55E' : '#3B82F6'}60` : 'none',
                }} />
              </div>
              <span style={{ fontSize: '10px', fontWeight: 700, color: '#475569', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                {p.done}/{p.total}
              </span>
            </div>
          )}

          {/* Spacer to push action bar down */}
          <div style={{ flex: 1 }} />
        </div>

        {/* ── BARRA DE AÇÕES ────────────────────────────────────────────── */}
        <div style={{
          borderTop: '1px solid rgba(255,255,255,0.07)',
          padding: '9px 12px',
          display: 'flex', alignItems: 'center', gap: '2px',
          background: 'rgba(0,0,0,0.15)',
          marginTop: '12px',
        }}>

          {/* Adiar */}
          <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
            <button onClick={() => setOpenSnooze(prev => prev === p.id ? null : p.id)}
              style={darkBtnStyle(false)} title="Adiar"
              onMouseEnter={e => darkBtnHover(e, true)}
              onMouseLeave={e => darkBtnHover(e, false)}>
              <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
              Adiar
            </button>
            {openSnooze === p.id && (
              <div style={{
                position: 'absolute', left: 0, bottom: 'calc(100% + 6px)', zIndex: 50,
                background: '#1E2837', borderRadius: '12px',
                boxShadow: '0 12px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.08)',
                padding: '6px', minWidth: '140px',
              }}>
                <p style={{ fontSize: '9px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#475569', padding: '4px 10px 6px', margin: 0 }}>
                  Adiar por
                </p>
                {SNOOZE_OPTS.map(o => (
                  <button key={o.days} onClick={() => handleSnooze(p.id, o.days)}
                    style={{ width: '100%', textAlign: 'left', padding: '7px 10px', fontSize: '12px', fontWeight: 500, color: '#CBD5E1', background: 'transparent', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >{o.label}</button>
                ))}
              </div>
            )}
          </div>

          <DarkSep />

          {/* Notas */}
          <button onClick={() => toggleNotes(p.id)}
            style={darkBtnStyle(notesOpen)}
            onMouseEnter={e => { if (!notesOpen) darkBtnHover(e, true) }}
            onMouseLeave={e => { if (!notesOpen) darkBtnHover(e, false) }}>
            <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Notas
            {notesCt > 0 && (
              <span style={{
                fontSize: '9px', fontWeight: 800, padding: '1px 5px', borderRadius: '100px',
                background: notesOpen ? 'rgba(59,130,246,0.25)' : 'rgba(255,255,255,0.1)',
                color: notesOpen ? '#60A5FA' : '#64748B', lineHeight: 1.4,
              }}>
                {notesCt}
              </span>
            )}
          </button>

          {/* Docs */}
          <Link href={`/societario?processo=${p.id}`}
            onClick={e => e.stopPropagation()}
            title="Documentos"
            style={{ ...darkBtnStyle(false) as React.CSSProperties, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' } as React.CSSProperties}
            onMouseEnter={(e: React.MouseEvent<HTMLAnchorElement>) => darkBtnHover(e as unknown as React.MouseEvent<HTMLButtonElement>, true)}
            onMouseLeave={(e: React.MouseEvent<HTMLAnchorElement>) => darkBtnHover(e as unknown as React.MouseEvent<HTMLButtonElement>, false)}>
            <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            Docs
            {p.docsTotal > 0 && (
              <span style={{
                fontSize: '9px', fontWeight: 800, padding: '1px 5px', borderRadius: '100px',
                background: p.docsPend > 0 ? 'rgba(245,158,11,0.15)' : 'rgba(34,197,94,0.12)',
                color: p.docsPend > 0 ? '#FCD34D' : '#4ADE80', lineHeight: 1.4,
              }}>
                {p.docsReceb}/{p.docsTotal}
              </span>
            )}
          </Link>

          {/* Empresa */}
          {p.empresa_id && (
            <Link href={`/empresas/${p.empresa_id}`}
              onClick={e => e.stopPropagation()}
              title="Empresa"
              style={{ ...darkBtnStyle(false) as React.CSSProperties, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' } as React.CSSProperties}
              onMouseEnter={(e: React.MouseEvent<HTMLAnchorElement>) => darkBtnHover(e as unknown as React.MouseEvent<HTMLButtonElement>, true)}
              onMouseLeave={(e: React.MouseEvent<HTMLAnchorElement>) => darkBtnHover(e as unknown as React.MouseEvent<HTMLButtonElement>, false)}>
              <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              Empresa
            </Link>
          )}

          <div style={{ flex: 1 }} />

          {/* Abrir — azul primário */}
          <Link href={`/societario?processo=${p.id}`}
            style={{
              display: 'flex', alignItems: 'center', gap: '5px',
              padding: '6px 13px', borderRadius: '8px',
              background: '#2563EB', color: 'white',
              fontSize: '11px', fontWeight: 700, textDecoration: 'none',
              transition: 'background 0.15s', flexShrink: 0,
              boxShadow: '0 2px 8px rgba(37,99,235,0.35)',
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#1D4ED8'}
            onMouseLeave={e => e.currentTarget.style.background = '#2563EB'}
          >
            Abrir
            <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>

        {/* ── PAINEL NOTAS INLINE ───────────────────────────────────────── */}
        {notesOpen && (
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.2)', padding: '14px 18px' }}>
            <p style={{ fontSize: '9px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.14em', color: '#475569', marginBottom: '10px' }}>
              Notas Rápidas
            </p>

            {notasCache[p.id] === null ? (
              <p style={{ fontSize: '12px', color: '#475569', fontStyle: 'italic', marginBottom: '10px' }}>Carregando...</p>
            ) : notasCache[p.id] !== undefined && (notasCache[p.id] as any[]).length === 0 ? (
              <p style={{ fontSize: '12px', color: '#475569', fontStyle: 'italic', marginBottom: '10px' }}>Sem notas ainda.</p>
            ) : notasCache[p.id] !== undefined ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '10px' }}>
                {(notasCache[p.id] as any[]).slice(0, 3).map((nota: any) => (
                  <div key={nota.id} style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '8px 11px', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <p style={{ fontSize: '12px', color: '#CBD5E1', lineHeight: 1.5 }}>{nota.texto}</p>
                    <p style={{ fontSize: '10px', color: '#475569', marginTop: '4px', fontFamily: 'monospace' }}>
                      {new Date(nota.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                ))}
                {(notasCache[p.id] as any[]).length > 3 && (
                  <Link href={`/societario?processo=${p.id}`} style={{ fontSize: '11px', color: '#60A5FA', fontWeight: 600, textDecoration: 'none' }}>
                    Ver todas no módulo →
                  </Link>
                )}
              </div>
            ) : null}

            <div style={{ display: 'flex', gap: '7px' }} onClick={e => e.stopPropagation()}>
              <textarea
                rows={2}
                value={notaInput[p.id] || ''}
                onChange={e => setNotaInput(prev => ({ ...prev, [p.id]: e.target.value }))}
                onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) saveNota(p.id) }}
                placeholder="Nova nota... (Ctrl+Enter)"
                style={{
                  flex: 1, fontSize: '12px', resize: 'none', fontFamily: 'inherit',
                  border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px',
                  padding: '8px 10px', outline: 'none', color: '#CBD5E1',
                  background: 'rgba(255,255,255,0.06)', transition: 'border-color 0.15s',
                }}
                onFocus={e => e.target.style.borderColor = 'rgba(96,165,250,0.5)'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
              />
              <button
                onClick={() => saveNota(p.id)}
                disabled={savingNota[p.id] || !(notaInput[p.id] || '').trim()}
                style={{
                  padding: '0 13px', background: '#2563EB', color: 'white',
                  border: 'none', borderRadius: '8px', fontSize: '11px', fontWeight: 700,
                  cursor: 'pointer', flexShrink: 0,
                  opacity: (savingNota[p.id] || !(notaInput[p.id] || '').trim()) ? 0.35 : 1,
                  transition: 'opacity 0.15s, background 0.15s',
                }}
                onMouseEnter={e => { if (!(savingNota[p.id] || !(notaInput[p.id] || '').trim())) e.currentTarget.style.background = '#1D4ED8' }}
                onMouseLeave={e => e.currentTarget.style.background = '#2563EB'}
              >
                Salvar
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── Seção em grid ─────────────────────────────────────────────────────────
  function Secao({ label, sublabel, dot, count, children }: {
    label: string; sublabel: string; dot: string; count: number; children: React.ReactNode
  }) {
    return (
      <section>
        {/* Header transparente — sem fundo sólido */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          padding: '20px 0 16px',
          borderTop: '1px solid rgba(255,255,255,0.08)',
        }}>
          <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: dot, flexShrink: 0, boxShadow: `0 0 6px ${dot}80` }} />
          <span style={{ fontSize: '12px', fontWeight: 800, color: '#F1F5F9', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {label}
          </span>
          <span style={{ fontSize: '11px', color: '#475569', fontWeight: 500 }}>
            {sublabel}
          </span>
          <span style={{ marginLeft: 'auto', fontSize: '10px', fontWeight: 800, padding: '2px 9px', borderRadius: '100px', background: 'rgba(255,255,255,0.07)', color: '#64748B' }}>
            {count}
          </span>
        </div>
        {children}
      </section>
    )
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: '#0D1117' }}>

      {/* ══ HEADER ═════════════════════════════════════════════════════════ */}
      <div style={{
        background: 'linear-gradient(160deg, #0D1117 0%, #111827 60%, #0F172A 100%)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        padding: '28px 32px 28px',
      }}>
        <div style={{ maxWidth: '1440px', margin: '0 auto' }}>

          {/* Eyebrow */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
            <span style={{ fontSize: '9px', fontWeight: 900, letterSpacing: '0.22em', textTransform: 'uppercase', color: '#F5C842' }}>
              PARALEGAL PRO
            </span>
            <span style={{ color: '#1F2937' }}>·</span>
            <span style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#374151' }}>
              MÓDULO SOCIETÁRIO
            </span>
          </div>

          {/* Título + botão atualizar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', marginBottom: '24px' }}>
            <div>
              <h1 style={{ fontSize: '28px', fontWeight: 900, letterSpacing: '-0.03em', color: '#F1F5F9', lineHeight: 1.0, margin: 0 }}>
                Painel de Processos
              </h1>
              <p style={{ fontSize: '13px', color: '#374151', fontWeight: 500, marginTop: '6px' }}>
                {diaLabel} · {dateTxt}
              </p>
            </div>
            <button onClick={load} style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              fontSize: '11px', fontWeight: 600, color: '#374151',
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: '10px', padding: '8px 14px', cursor: 'pointer', marginTop: '4px',
              flexShrink: 0, transition: 'all 0.15s',
            }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#94A3B8' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = '#374151' }}
            >
              <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Atualizar
            </button>
          </div>

          {/* Scorecards */}
          {!loading ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, auto)', gap: '10px', width: 'fit-content' }}>
              <ScoreCard label="Em andamento" value={ativos.length + snoozed.length}
                color="#F1F5F9" accent={false} />
              <ScoreCard label="🔥 Prioritários" value={priori.length}
                color={priori.length > 0 ? '#F5C842' : '#475569'} accent={priori.length > 0} />
              <ScoreCard label="⚠ Acima de 30d" value={criticalCount}
                color={criticalCount > 0 ? '#F87171' : '#475569'} accent={criticalCount > 0} />
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 120px)', gap: '10px' }}>
              {[...Array(3)].map((_, i) => (
                <div key={i} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', height: '68px' }} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ══ CONTEÚDO ════════════════════════════════════════════════════════ */}
      <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '0 32px 64px' }}>

        {loading ? (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
            gap: '14px',
            paddingTop: '28px',
          }}>
            {[...Array(6)].map((_, i) => (
              <div key={i} style={{
                height: '240px', background: 'rgba(255,255,255,0.03)',
                borderRadius: '16px', border: '1px solid rgba(255,255,255,0.06)',
                animation: 'pulse 1.5s ease-in-out infinite',
              }} />
            ))}
          </div>
        ) : ativos.length === 0 && snoozed.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 24px', color: '#374151' }}>
            <p style={{ fontSize: '48px', marginBottom: '16px' }}>🎉</p>
            <p style={{ fontSize: '18px', fontWeight: 800, color: '#F1F5F9' }}>Nenhum processo em andamento!</p>
            <Link href="/societario" style={{ display: 'inline-block', marginTop: '20px', fontSize: '12px', fontWeight: 700, color: '#60A5FA', textDecoration: 'none' }}>
              Ver módulo societário →
            </Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>

            {/* Seção Prioritários */}
            <Secao label="Prioritários" sublabel="precisam da sua atenção hoje" dot="#F97316" count={priori.length}>
              {priori.length === 0 ? (
                <EmptyState>Nenhum prioritário — use <strong>☆</strong> nos cards abaixo para elevar.</EmptyState>
              ) : (
                <CardGrid>
                  {priori.map(p => <ProcessoCard key={p.id} p={p} />)}
                </CardGrid>
              )}
            </Secao>

            {/* Seção Em Rotina */}
            <Secao label="Em Rotina" sublabel="mais parado primeiro" dot="#64748B" count={rotina.length}>
              {rotina.length === 0 ? (
                <EmptyState>Sem processos em rotina.</EmptyState>
              ) : (
                <CardGrid>
                  {rotina.map(p => <ProcessoCard key={p.id} p={p} />)}
                </CardGrid>
              )}
            </Secao>

            {/* Seção Adiados */}
            {snoozed.length > 0 && (
              <section>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '20px 0 16px',
                  borderTop: '1px solid rgba(255,255,255,0.08)',
                }}>
                  <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#334155', flexShrink: 0 }} />
                  <button onClick={() => setShowSnoozed(s => !s)}
                    style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'none', border: 'none', cursor: 'pointer', padding: 0, flex: 1 }}>
                    <span style={{ fontSize: '12px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Adiados</span>
                    <span style={{ fontSize: '11px', color: '#334155' }}>voltam automaticamente</span>
                    <span style={{ marginLeft: 'auto', fontSize: '10px', fontWeight: 800, padding: '2px 9px', borderRadius: '100px', background: 'rgba(255,255,255,0.05)', color: '#475569' }}>
                      {snoozed.length} {showSnoozed ? '▲' : '▼'}
                    </span>
                  </button>
                </div>
                {showSnoozed && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '8px', paddingBottom: '8px' }}>
                    {snoozed.map(p => {
                      const sn = snoozeMap[p.id]
                      const daysLeft = sn ? Math.ceil((sn.getTime() - agora.getTime()) / 86_400_000) : 0
                      return (
                        <div key={p.id} style={{
                          background: 'rgba(255,255,255,0.03)', borderRadius: '12px',
                          border: '1px solid rgba(255,255,255,0.06)',
                          padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
                        }}>
                          <div style={{ minWidth: 0 }}>
                            <p style={{ fontSize: '13px', fontWeight: 700, color: '#64748B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {p.nome}
                            </p>
                            <p style={{ fontSize: '11px', color: '#334155', marginTop: '3px' }}>
                              {TIPO_LABELS[p.tipo] ?? p.tipo} · {daysLeft === 1 ? 'volta amanhã' : `${daysLeft} dias`}
                            </p>
                          </div>
                          <button onClick={() => handleClearSnooze(p.id)}
                            style={{ flexShrink: 0, fontSize: '11px', fontWeight: 700, color: '#60A5FA', background: 'transparent', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                            Retomar →
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </section>
            )}
          </div>
        )}

        {/* Footer */}
        {!loading && (
          <div style={{ marginTop: '48px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <p style={{ fontSize: '10px', color: '#1F2937' }}>
              Prioridades e snooze salvos neste navegador · Somente processos em andamento
              {updatedAt && <span style={{ marginLeft: '8px' }}>· {updatedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>}
            </p>
            <Link href="/societario" style={{ fontSize: '11px', fontWeight: 700, color: '#374151', textDecoration: 'none' }}>
              Ver módulo completo →
            </Link>
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 0.6; } 50% { opacity: 0.3; } }
      `}</style>
    </div>
  )
}

// ── Atoms ──────────────────────────────────────────────────────────────────────

function CardGrid({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
      gap: '14px',
      alignItems: 'start',
      paddingBottom: '8px',
    }}>
      {children}
    </div>
  )
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      padding: '14px 18px', borderRadius: '12px',
      background: 'rgba(255,255,255,0.02)',
      border: '1px dashed rgba(255,255,255,0.08)',
      color: '#374151', fontSize: '13px', marginBottom: '8px',
    }}>
      {children}
    </div>
  )
}

function ScoreCard({ label, value, color, accent }: { label: string; value: number; color: string; accent: boolean }) {
  return (
    <div style={{
      background: accent ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.03)',
      border: accent ? `1px solid ${color}25` : '1px solid rgba(255,255,255,0.06)',
      borderRadius: '12px', padding: '13px 18px', minWidth: '110px',
    }}>
      <p style={{ fontSize: '9px', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#334155', marginBottom: '6px' }}>
        {label}
      </p>
      <p style={{ fontSize: '28px', fontWeight: 900, letterSpacing: '-0.04em', color, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </p>
    </div>
  )
}

function DarkSep() {
  return <span style={{ width: '1px', height: '14px', background: 'rgba(255,255,255,0.08)', margin: '0 2px', flexShrink: 0 }} />
}

function darkBtnStyle(active: boolean): React.CSSProperties {
  return {
    display: 'flex', alignItems: 'center', gap: '4px',
    padding: '5px 9px', borderRadius: '7px', cursor: 'pointer',
    fontSize: '11px', fontWeight: 600,
    border: active ? '1px solid rgba(96,165,250,0.3)' : '1px solid transparent',
    background: active ? 'rgba(59,130,246,0.12)' : 'transparent',
    color: active ? '#60A5FA' : '#475569',
    transition: 'all 0.15s',
  }
}

function darkBtnHover(e: React.MouseEvent<HTMLButtonElement>, on: boolean) {
  const el = e.currentTarget as HTMLElement
  if (on) { el.style.background = 'rgba(255,255,255,0.07)'; el.style.color = '#94A3B8'; el.style.borderColor = 'rgba(255,255,255,0.1)' }
  else    { el.style.background = 'transparent'; el.style.color = '#475569'; el.style.borderColor = 'transparent' }
}
