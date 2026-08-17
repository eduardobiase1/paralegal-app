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
  abertura:              { bg: '#ECFDF5', color: '#065F46' },
  alteracao_contratual:  { bg: '#EFF6FF', color: '#1E40AF' },
  encerramento:          { bg: '#FEF2F2', color: '#991B1B' },
  transferencia_entrada: { bg: '#F5F3FF', color: '#5B21B6' },
  transferencia_saida:   { bg: '#FFF7ED', color: '#C2410C' },
}

const DIAS_PT  = ['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado']
const MESES_PT = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro']

const SNOOZE_OPTS = [
  { days: 1,  label: 'Amanhã'  },
  { days: 3,  label: '3 dias'  },
  { days: 7,  label: '7 dias'  },
  { days: 14, label: '14 dias' },
]

// ── Urgência: borda esquerda fina + badge sutil ─────────────────────────────
// ≤7d  → cinza neutro
// 8–30d → âmbar
// >30d  → vermelho
// Prio  → laranja brand
function urgConfig(dias: number, prio: boolean) {
  if (prio) return {
    borderLeft: '4px solid #F97316',
    tag: { bg: '#FFF7ED', color: '#C2410C', border: '#FED7AA' },
    alertIcon: false,
  }
  if (dias > 30) return {
    borderLeft: '4px solid #EF4444',
    tag: { bg: '#FEF2F2', color: '#B91C1C', border: '#FECACA' },
    alertIcon: true,
  }
  if (dias >= 8) return {
    borderLeft: '4px solid #F59E0B',
    tag: { bg: '#FFFBEB', color: '#92400E', border: '#FDE68A' },
    alertIcon: false,
  }
  return {
    borderLeft: '4px solid #E2E8F0',
    tag: { bg: '#F8FAFC', color: '#64748B', border: '#E2E8F0' },
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

  const [openStatus,   setOpenStatus]   = useState<string | null>(null)
  const [snoozeModal,  setSnoozeModal]  = useState<{ id: string; nome: string } | null>(null)
  const [showSnoozed,  setShowSnoozed]  = useState(false)

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
    const h = () => setOpenStatus(null)
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
    setSnoozeModal(null)
    toast.success(`Processo adiado por ${days === 1 ? '1 dia' : `${days} dias`}`)
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
    const nome     = (p.empresas as any)?.razao_social || p.cliente_nome || '—'
    const docsPend = docs.filter(d => !d.recebido).length
    const docsReceb = docs.length - docsPend
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
    const tipo     = TIPO_STYLE[p.tipo] || { bg: '#F8FAFC', color: '#64748B' }
    const notesCt  = notaCount[p.id] || 0
    const notesOpen = expandNotes[p.id]

    return (
      <div style={{
        display: 'flex', flexDirection: 'column',
        background: '#FFFFFF',
        border: '1px solid #E2E8F0',
        borderLeft: urg.borderLeft,
        borderRadius: '12px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        transition: 'box-shadow 0.2s ease, transform 0.2s ease',
        overflow: 'hidden',
        height: '100%',
      }}
        onMouseEnter={e => {
          e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)'
          e.currentTarget.style.transform = 'translateY(-2px)'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)'
          e.currentTarget.style.transform = 'translateY(0)'
        }}
      >

        {/* ── BODY ─────────────────────────────────────────────────────── */}
        <div style={{ padding: '16px 18px 0', flex: 1, display: 'flex', flexDirection: 'column', gap: '11px' }}>

          {/* Empresa + botão prio */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{
                fontSize: '15px', fontWeight: 700, color: '#0F172A',
                letterSpacing: '-0.015em', lineHeight: 1.2, marginBottom: '6px',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {p.nome}
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', alignItems: 'center' }}>
                <span style={{
                  fontSize: '9px', fontWeight: 700, padding: '3px 8px',
                  borderRadius: '100px', background: tipo.bg, color: tipo.color,
                  textTransform: 'uppercase', letterSpacing: '0.07em',
                }}>
                  {TIPO_LABELS[p.tipo] ?? p.tipo}
                </span>
                {p.titulo && (
                  <span style={{
                    fontSize: '10px', fontWeight: 500, color: '#94A3B8',
                    background: '#F8FAFC', border: '1px solid #E2E8F0',
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
                flexShrink: 0, fontSize: '10px', fontWeight: 600,
                padding: '4px 10px', borderRadius: '100px', cursor: 'pointer',
                border: p.prioridade ? '1px solid #FED7AA' : '1px solid #E2E8F0',
                background: p.prioridade ? '#FFF7ED' : 'transparent',
                color: p.prioridade ? '#C2410C' : '#94A3B8',
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
                  background: '#EFF6FF', color: '#1D4ED8',
                  border: '1px solid #BFDBFE', cursor: 'pointer',
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
                  background: '#FFFFFF', borderRadius: '12px',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.1), 0 0 0 1px rgba(0,0,0,0.06)',
                  padding: '6px', minWidth: '175px',
                }}>
                  <p style={{ fontSize: '9px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#94A3B8', padding: '4px 10px 6px', margin: 0 }}>
                    Alterar status
                  </p>
                  <button
                    onClick={() => handleFinalizar(p.id)}
                    style={{
                      width: '100%', textAlign: 'left', padding: '8px 10px',
                      fontSize: '12px', fontWeight: 600, color: '#065F46',
                      background: 'transparent', border: 'none', borderRadius: '8px',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = '#ECFDF5'}
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

            <span style={{ fontSize: '10px', color: '#94A3B8', fontWeight: 500 }}>
              {p.ultimaMov}
            </span>
          </div>

          {/* Próxima etapa */}
          {p.nextStep ? (
            <div style={{
              background: '#F8FAFC', borderRadius: '8px',
              padding: '10px 12px', borderLeft: '2px solid #CBD5E1',
            }}>
              <p style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#94A3B8', marginBottom: '4px' }}>
                Próxima etapa
              </p>
              <p style={{ fontSize: '12px', fontWeight: 500, color: '#475569', lineHeight: 1.45 }}>
                {p.nextStep}
              </p>
            </div>
          ) : (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '7px',
              background: '#F0FDF4', borderRadius: '8px',
              padding: '10px 12px', border: '1px solid #BBF7D0',
            }}>
              <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="#16A34A" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <p style={{ fontSize: '12px', fontWeight: 600, color: '#15803D' }}>Todas as etapas concluídas</p>
            </div>
          )}

          {/* Progress bar */}
          {p.total > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ flex: 1, height: '4px', background: '#F1F5F9', borderRadius: '100px', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', width: `${p.pct}%`, borderRadius: '100px',
                  background: p.pct === 100 ? '#22C55E' : '#3B82F6',
                  transition: 'width 0.6s ease',
                }} />
              </div>
              <span style={{ fontSize: '10px', fontWeight: 600, color: '#94A3B8', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                {p.done}/{p.total}
              </span>
            </div>
          )}

          <div style={{ flex: 1 }} />
        </div>

        {/* ── BARRA DE AÇÕES ────────────────────────────────────────────── */}
        <div style={{
          borderTop: '1px solid #F1F5F9',
          padding: '9px 12px',
          display: 'flex', alignItems: 'center', gap: '2px',
          background: '#FAFAFA',
          marginTop: '12px',
        }}>

          {/* Adiar */}
          <button
            onClick={() => setSnoozeModal({ id: p.id, nome: p.nome })}
            style={lightBtnStyle(false)} title="Adiar processo"
            onMouseEnter={e => lightBtnHover(e, true)}
            onMouseLeave={e => lightBtnHover(e, false)}>
            <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
            Adiar
          </button>

          <LightSep />

          {/* Notas */}
          <button onClick={() => toggleNotes(p.id)}
            style={lightBtnStyle(notesOpen)}
            onMouseEnter={e => { if (!notesOpen) lightBtnHover(e, true) }}
            onMouseLeave={e => { if (!notesOpen) lightBtnHover(e, false) }}>
            <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Notas
            {notesCt > 0 && (
              <span style={{
                fontSize: '9px', fontWeight: 700, padding: '1px 5px', borderRadius: '100px',
                background: notesOpen ? '#DBEAFE' : '#F1F5F9',
                color: notesOpen ? '#1D4ED8' : '#64748B', lineHeight: 1.4,
              }}>
                {notesCt}
              </span>
            )}
          </button>

          {/* Docs */}
          <Link href={`/societario?processo=${p.id}`}
            onClick={e => e.stopPropagation()} title="Documentos"
            style={{ ...lightBtnStyle(false) as React.CSSProperties, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' } as React.CSSProperties}
            onMouseEnter={(e: React.MouseEvent<HTMLAnchorElement>) => lightBtnHover(e as unknown as React.MouseEvent<HTMLButtonElement>, true)}
            onMouseLeave={(e: React.MouseEvent<HTMLAnchorElement>) => lightBtnHover(e as unknown as React.MouseEvent<HTMLButtonElement>, false)}>
            <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            Docs
            {p.docsTotal > 0 && (
              <span style={{
                fontSize: '9px', fontWeight: 700, padding: '1px 5px', borderRadius: '100px',
                background: p.docsPend > 0 ? '#FEF9C3' : '#DCFCE7',
                color: p.docsPend > 0 ? '#854D0E' : '#15803D', lineHeight: 1.4,
              }}>
                {p.docsReceb}/{p.docsTotal}
              </span>
            )}
          </Link>

          {/* Empresa */}
          {p.empresa_id && (
            <Link href={`/empresas/${p.empresa_id}`}
              onClick={e => e.stopPropagation()} title="Empresa"
              style={{ ...lightBtnStyle(false) as React.CSSProperties, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' } as React.CSSProperties}
              onMouseEnter={(e: React.MouseEvent<HTMLAnchorElement>) => lightBtnHover(e as unknown as React.MouseEvent<HTMLButtonElement>, true)}
              onMouseLeave={(e: React.MouseEvent<HTMLAnchorElement>) => lightBtnHover(e as unknown as React.MouseEvent<HTMLButtonElement>, false)}>
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
          <div style={{ borderTop: '1px solid #F1F5F9', background: '#F8FAFC', padding: '14px 18px' }}>
            <p style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#94A3B8', marginBottom: '10px' }}>
              Notas Rápidas
            </p>

            {notasCache[p.id] === null ? (
              <p style={{ fontSize: '12px', color: '#94A3B8', fontStyle: 'italic', marginBottom: '10px' }}>Carregando...</p>
            ) : notasCache[p.id] !== undefined && (notasCache[p.id] as any[]).length === 0 ? (
              <p style={{ fontSize: '12px', color: '#94A3B8', fontStyle: 'italic', marginBottom: '10px' }}>Sem notas ainda.</p>
            ) : notasCache[p.id] !== undefined ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '10px' }}>
                {(notasCache[p.id] as any[]).slice(0, 3).map((nota: any) => (
                  <div key={nota.id} style={{ background: '#FFFFFF', borderRadius: '8px', padding: '8px 11px', border: '1px solid #E2E8F0' }}>
                    <p style={{ fontSize: '12px', color: '#334155', lineHeight: 1.5 }}>{nota.texto}</p>
                    <p style={{ fontSize: '10px', color: '#94A3B8', marginTop: '4px', fontFamily: 'monospace' }}>
                      {new Date(nota.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                ))}
                {(notasCache[p.id] as any[]).length > 3 && (
                  <Link href={`/societario?processo=${p.id}`} style={{ fontSize: '11px', color: '#2563EB', fontWeight: 600, textDecoration: 'none' }}>
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
                  border: '1px solid #E2E8F0', borderRadius: '8px',
                  padding: '8px 10px', outline: 'none', color: '#334155',
                  background: '#FFFFFF', transition: 'border-color 0.15s',
                }}
                onFocus={e => e.target.style.borderColor = '#93C5FD'}
                onBlur={e => e.target.style.borderColor = '#E2E8F0'}
              />
              <button
                onClick={() => saveNota(p.id)}
                disabled={savingNota[p.id] || !(notaInput[p.id] || '').trim()}
                style={{
                  padding: '0 13px', background: '#2563EB', color: 'white',
                  border: 'none', borderRadius: '8px', fontSize: '11px', fontWeight: 700,
                  cursor: 'pointer', flexShrink: 0,
                  opacity: (savingNota[p.id] || !(notaInput[p.id] || '').trim()) ? 0.4 : 1,
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

  // ── Seção ─────────────────────────────────────────────────────────────────
  function Secao({ label, sublabel, dot, count, children }: {
    label: string; sublabel: string; dot: string; count: number; children: React.ReactNode
  }) {
    return (
      <section>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          padding: '24px 0 14px',
          borderTop: '1px solid #E2E8F0',
        }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: dot, flexShrink: 0 }} />
          <span style={{ fontSize: '11px', fontWeight: 800, color: '#0F172A', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {label}
          </span>
          <span style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 400 }}>
            {sublabel}
          </span>
          <span style={{ marginLeft: 'auto', fontSize: '10px', fontWeight: 700, padding: '2px 9px', borderRadius: '100px', background: '#F1F5F9', color: '#64748B' }}>
            {count}
          </span>
        </div>
        {children}
      </section>
    )
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFC' }}>

      {/* ══ HEADER ═════════════════════════════════════════════════════════ */}
      <div style={{
        background: '#FFFFFF',
        borderBottom: '1px solid #E2E8F0',
        padding: '24px 32px',
      }}>
        <div style={{ maxWidth: '1440px', margin: '0 auto' }}>

          {/* Eyebrow */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <span style={{ fontSize: '9px', fontWeight: 900, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#EA580C' }}>
              PARALEGAL PRO
            </span>
            <span style={{ color: '#E2E8F0' }}>·</span>
            <span style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#94A3B8' }}>
              MÓDULO SOCIETÁRIO
            </span>
          </div>

          {/* Título + botão atualizar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
            <div>
              <h1 style={{ fontSize: '26px', fontWeight: 800, letterSpacing: '-0.025em', color: '#0F172A', lineHeight: 1.1, margin: 0 }}>
                Painel de Processos
              </h1>
              <p style={{ fontSize: '13px', color: '#94A3B8', fontWeight: 500, marginTop: '5px' }}>
                {diaLabel} · {dateTxt}
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0, marginTop: '4px' }}>
              {/* Scorecards inline no header */}
              {!loading && (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <ScoreChip label="Em andamento" value={ativos.length + snoozed.length} variant="neutral" />
                  <ScoreChip label="Prioritários" value={priori.length} variant={priori.length > 0 ? 'warn' : 'neutral'} />
                  <ScoreChip label="Acima de 30d" value={criticalCount} variant={criticalCount > 0 ? 'danger' : 'neutral'} />
                </div>
              )}

              <button onClick={load} style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                fontSize: '11px', fontWeight: 600, color: '#64748B',
                background: '#F8FAFC', border: '1px solid #E2E8F0',
                borderRadius: '8px', padding: '7px 13px', cursor: 'pointer',
                transition: 'all 0.15s',
              }}
                onMouseEnter={e => { e.currentTarget.style.background = '#F1F5F9'; e.currentTarget.style.color = '#334155' }}
                onMouseLeave={e => { e.currentTarget.style.background = '#F8FAFC'; e.currentTarget.style.color = '#64748B' }}
              >
                <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Atualizar
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ══ CONTEÚDO ════════════════════════════════════════════════════════ */}
      <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '0 32px 64px' }}>

        {loading ? (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
            gap: '14px', paddingTop: '28px',
          }}>
            {[...Array(6)].map((_, i) => (
              <div key={i} style={{
                height: '220px', background: '#FFFFFF',
                borderRadius: '12px', border: '1px solid #E2E8F0',
                animation: 'pulse 1.5s ease-in-out infinite',
              }} />
            ))}
          </div>
        ) : ativos.length === 0 && snoozed.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 24px' }}>
            <p style={{ fontSize: '48px', marginBottom: '16px' }}>🎉</p>
            <p style={{ fontSize: '18px', fontWeight: 700, color: '#0F172A' }}>Nenhum processo em andamento!</p>
            <Link href="/societario" style={{ display: 'inline-block', marginTop: '20px', fontSize: '12px', fontWeight: 700, color: '#2563EB', textDecoration: 'none' }}>
              Ver módulo societário →
            </Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>

            <Secao label="Prioritários" sublabel="precisam da sua atenção hoje" dot="#F97316" count={priori.length}>
              {priori.length === 0 ? (
                <EmptyState>Nenhum prioritário — use <strong>☆</strong> nos cards abaixo para elevar.</EmptyState>
              ) : (
                <CardGrid>
                  {priori.map(p => <ProcessoCard key={p.id} p={p} />)}
                </CardGrid>
              )}
            </Secao>

            <Secao label="Em Rotina" sublabel="mais parado primeiro" dot="#CBD5E1" count={rotina.length}>
              {rotina.length === 0 ? (
                <EmptyState>Sem processos em rotina.</EmptyState>
              ) : (
                <CardGrid>
                  {rotina.map(p => <ProcessoCard key={p.id} p={p} />)}
                </CardGrid>
              )}
            </Secao>

            {snoozed.length > 0 && (
              <section>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '24px 0 14px', borderTop: '1px solid #E2E8F0',
                }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#CBD5E1', flexShrink: 0 }} />
                  <button onClick={() => setShowSnoozed(s => !s)}
                    style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'none', border: 'none', cursor: 'pointer', padding: 0, flex: 1 }}>
                    <span style={{ fontSize: '11px', fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Adiados</span>
                    <span style={{ fontSize: '11px', color: '#CBD5E1' }}>voltam automaticamente</span>
                    <span style={{ marginLeft: 'auto', fontSize: '10px', fontWeight: 700, padding: '2px 9px', borderRadius: '100px', background: '#F1F5F9', color: '#94A3B8' }}>
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
                          background: '#FFFFFF', borderRadius: '10px',
                          border: '1px solid #E2E8F0',
                          padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
                        }}>
                          <div style={{ minWidth: 0 }}>
                            <p style={{ fontSize: '13px', fontWeight: 600, color: '#94A3B8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {p.nome}
                            </p>
                            <p style={{ fontSize: '11px', color: '#CBD5E1', marginTop: '2px' }}>
                              {TIPO_LABELS[p.tipo] ?? p.tipo} · {daysLeft === 1 ? 'volta amanhã' : `${daysLeft} dias`}
                            </p>
                          </div>
                          <button onClick={() => handleClearSnooze(p.id)}
                            style={{ flexShrink: 0, fontSize: '11px', fontWeight: 700, color: '#2563EB', background: 'transparent', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }}>
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
          <div style={{ marginTop: '48px', paddingTop: '16px', borderTop: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <p style={{ fontSize: '10px', color: '#CBD5E1' }}>
              Prioridades e snooze salvos neste navegador · Somente processos em andamento
              {updatedAt && <span style={{ marginLeft: '8px' }}>· atualizado às {updatedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>}
            </p>
            <Link href="/societario" style={{ fontSize: '11px', fontWeight: 600, color: '#94A3B8', textDecoration: 'none' }}>
              Ver módulo completo →
            </Link>
          </div>
        )}
      </div>

      {/* ══ MODAL ADIAR ════════════════════════════════════════════════════ */}
      {snoozeModal && (
        <div
          onClick={() => setSnoozeModal(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 100,
            background: 'rgba(15,23,42,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '24px',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#FFFFFF', borderRadius: '16px',
              boxShadow: '0 20px 60px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.06)',
              padding: '28px', width: '100%', maxWidth: '360px',
            }}
          >
            <div style={{ marginBottom: '20px' }}>
              <p style={{ fontSize: '9px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.14em', color: '#94A3B8', marginBottom: '6px' }}>
                Adiar processo
              </p>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0F172A', lineHeight: 1.3 }}>
                Por quanto tempo deseja adiar?
              </h3>
              <p style={{ fontSize: '12px', color: '#64748B', marginTop: '5px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {snoozeModal.nome}
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {SNOOZE_OPTS.map(o => (
                <button
                  key={o.days}
                  onClick={() => handleSnooze(snoozeModal.id, o.days)}
                  style={{
                    width: '100%', padding: '12px 16px',
                    borderRadius: '10px', border: '1px solid #E2E8F0',
                    background: '#F8FAFC', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    fontSize: '13px', fontWeight: 600, color: '#1E293B',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = '#EFF6FF'
                    e.currentTarget.style.borderColor = '#BFDBFE'
                    e.currentTarget.style.color = '#1D4ED8'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = '#F8FAFC'
                    e.currentTarget.style.borderColor = '#E2E8F0'
                    e.currentTarget.style.color = '#1E293B'
                  }}
                >
                  <span>{o.label}</span>
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              ))}
            </div>

            <button
              onClick={() => setSnoozeModal(null)}
              style={{
                marginTop: '16px', width: '100%', padding: '10px',
                borderRadius: '10px', border: 'none',
                background: 'transparent', cursor: 'pointer',
                fontSize: '12px', fontWeight: 600, color: '#94A3B8',
                transition: 'color 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.color = '#475569'}
              onMouseLeave={e => e.currentTarget.style.color = '#94A3B8'}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      <style>{`@keyframes pulse { 0%, 100% { opacity: 0.6; } 50% { opacity: 0.3; } }`}</style>
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
      padding: '14px 18px', borderRadius: '10px',
      background: '#FFFFFF', border: '1px dashed #E2E8F0',
      color: '#94A3B8', fontSize: '13px', marginBottom: '8px',
    }}>
      {children}
    </div>
  )
}

function ScoreChip({ label, value, variant }: { label: string; value: number; variant: 'neutral' | 'warn' | 'danger' }) {
  const styles = {
    neutral: { bg: '#F8FAFC', border: '#E2E8F0', label: '#94A3B8',  value: '#0F172A' },
    warn:    { bg: '#FFFBEB', border: '#FDE68A', label: '#92400E',  value: '#B45309' },
    danger:  { bg: '#FEF2F2', border: '#FECACA', label: '#991B1B',  value: '#DC2626' },
  }[variant]

  return (
    <div style={{
      padding: '6px 14px', borderRadius: '8px',
      background: styles.bg, border: `1px solid ${styles.border}`,
      display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '72px',
    }}>
      <span style={{ fontSize: '18px', fontWeight: 800, color: styles.value, lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </span>
      <span style={{ fontSize: '9px', fontWeight: 700, color: styles.label, textTransform: 'uppercase', letterSpacing: '0.07em', marginTop: '2px', whiteSpace: 'nowrap' }}>
        {label}
      </span>
    </div>
  )
}

function LightSep() {
  return <span style={{ width: '1px', height: '14px', background: '#E2E8F0', margin: '0 2px', flexShrink: 0 }} />
}

function lightBtnStyle(active: boolean): React.CSSProperties {
  return {
    display: 'flex', alignItems: 'center', gap: '4px',
    padding: '5px 9px', borderRadius: '7px', cursor: 'pointer',
    fontSize: '11px', fontWeight: 600,
    border: active ? '1px solid #BFDBFE' : '1px solid transparent',
    background: active ? '#EFF6FF' : 'transparent',
    color: active ? '#1D4ED8' : '#64748B',
    transition: 'all 0.15s',
  }
}

function lightBtnHover(e: React.MouseEvent<HTMLButtonElement>, on: boolean) {
  const el = e.currentTarget as HTMLElement
  if (on) { el.style.background = '#F1F5F9'; el.style.color = '#334155'; el.style.borderColor = '#E2E8F0' }
  else    { el.style.background = 'transparent'; el.style.color = '#64748B'; el.style.borderColor = 'transparent' }
}
