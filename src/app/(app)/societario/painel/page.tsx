'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import toast from 'react-hot-toast'

// ── Helpers ───────────────────────────────────────────────────────────────────
const DIAS_PT  = ['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado']
const MESES_PT = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro']

const TIPO_LABELS: Record<string, string> = {
  abertura:              'Abertura de Empresa',
  alteracao_contratual:  'Alteração Contratual',
  encerramento:          'Encerramento',
  transferencia_entrada: 'Transferência Entrada',
  transferencia_saida:   'Transferência Saída',
}

function daysSinceMs(ms: number) {
  return Math.max(0, Math.round((Date.now() - ms) / 86_400_000))
}

function statusLabel(s: string) {
  if (!s) return '—'
  if (s === 'em_andamento' || s === 'Andamento')   return 'Em andamento'
  if (s === 'aguardando_cliente')                   return 'Aguard. cliente'
  if (s === 'aguardando_orgao')                     return 'Aguard. órgão'
  if (s === 'concluido' || s === 'Finalizado')      return 'Concluído'
  if (s === 'cancelado')                            return 'Cancelado'
  return s
}
function statusColor(s: string) {
  if (s === 'em_andamento' || s === 'Andamento')  return 'bg-blue-100 text-blue-700'
  if (s === 'aguardando_cliente')                  return 'bg-amber-100 text-amber-700'
  if (s === 'aguardando_orgao')                    return 'bg-orange-100 text-orange-700'
  if (s === 'concluido' || s === 'Finalizado')     return 'bg-emerald-100 text-emerald-700'
  return 'bg-gray-100 text-gray-600'
}

const STATUS_CHANGE_OPTS = [
  { value: 'em_andamento',       label: 'Em andamento'      },
  { value: 'aguardando_cliente', label: 'Aguardando cliente' },
  { value: 'aguardando_orgao',   label: 'Aguardando órgão'  },
  { value: 'concluido',          label: 'Concluído'          },
]

const SNOOZE_OPTS = [
  { days: 1,  label: 'Amanhã'  },
  { days: 3,  label: '3 dias'  },
  { days: 7,  label: '7 dias'  },
  { days: 14, label: '14 dias' },
]

// Urgência pelo nº de dias parado
function urgBorder(dias: number, prio: boolean) {
  if (prio)      return 'border-l-orange-500'
  if (dias > 30) return 'border-l-red-500'
  if (dias > 15) return 'border-l-orange-400'
  if (dias >= 7) return 'border-l-amber-400'
  return          'border-l-emerald-400'
}
function diasPill(dias: number) {
  if (dias > 30) return 'bg-red-100 text-red-700'
  if (dias > 15) return 'bg-orange-100 text-orange-700'
  if (dias >= 7) return 'bg-amber-100 text-amber-700'
  return          'bg-emerald-100 text-emerald-700'
}

// ── LocalStorage: snooze + prioridade ────────────────────────────────────────
function getSnooze(id: string): Date | null {
  try {
    const v = localStorage.getItem(`psnooze_${id}`)
    if (!v) return null
    const d = new Date(v)
    return d > new Date() ? d : null
  } catch { return null }
}
function saveSnooze(id: string, days: number) {
  const d = new Date(); d.setDate(d.getDate() + days)
  localStorage.setItem(`psnooze_${id}`, d.toISOString())
}
function clearSnooze(id: string) { localStorage.removeItem(`psnooze_${id}`) }

function getPrio(id: string): boolean {
  try { return localStorage.getItem(`pprio_${id}`) === '1' } catch { return false }
}
function setPrio(id: string, val: boolean) {
  localStorage.setItem(`pprio_${id}`, val ? '1' : '0')
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function PainelProcessosPage() {
  const [supabase]      = useState(createClient)
  const [rawData,       setRawData]       = useState<any[]>([])
  const [loading,       setLoading]       = useState(true)
  const [updatedAt,     setUpdatedAt]     = useState<Date | null>(null)
  const [prioMap,       setPrioMap]       = useState<Record<string, boolean>>({})
  const [snoozeMap,     setSnoozeMap]     = useState<Record<string, Date | null>>({})
  const [openSnooze,    setOpenSnooze]    = useState<string | null>(null)
  const [openStatus,    setOpenStatus]    = useState<string | null>(null)
  const [showSnoozed,   setShowSnoozed]   = useState(false)

  const hoje     = new Date()
  const diaLabel = DIAS_PT[hoje.getDay()]
  const dateTxt  = `${hoje.getDate()} de ${MESES_PT[hoje.getMonth()]} de ${hoje.getFullYear()}`

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('processos_societarios')
      .select(`
        id, titulo, tipo, status, updated_at, empresa_id, checklist,
        empresa:empresas(razao_social),
        etapas:processo_etapas(id, updated_at)
      `)
      .order('updated_at', { ascending: true })

    const active = (data || []).filter((p: any) =>
      !['Finalizado', 'concluido', 'cancelado'].includes(p.status)
    )

    // Lê localStorage
    const pm: Record<string, boolean>    = {}
    const sm: Record<string, Date | null> = {}
    for (const p of active) {
      pm[p.id] = getPrio(p.id)
      sm[p.id] = getSnooze(p.id)
    }
    setPrioMap(pm)
    setSnoozeMap(sm)
    setRawData(active)
    setUpdatedAt(new Date())
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  // Fecha dropdowns ao clicar fora
  useEffect(() => {
    const h = () => { setOpenSnooze(null); setOpenStatus(null) }
    document.addEventListener('click', h)
    return () => document.removeEventListener('click', h)
  }, [])

  // ── Ações ─────────────────────────────────────────────────────────────────
  async function handleStatusChange(id: string, status: string) {
    const { error } = await supabase.from('processos_societarios').update({ status }).eq('id', id)
    if (!error) {
      setRawData(prev => prev.map(p => p.id === id ? { ...p, status } : p))
      toast.success('Status atualizado')
    }
    setOpenStatus(null)
  }

  function handleSnooze(id: string, days: number) {
    saveSnooze(id, days)
    const d = new Date(); d.setDate(d.getDate() + days)
    setSnoozeMap(prev => ({ ...prev, [id]: d }))
    setOpenSnooze(null)
    toast.success(`Processo adiado por ${days === 1 ? 'amanhã' : `${days} dias`}`)
  }

  function handleClearSnooze(id: string) {
    clearSnooze(id)
    setSnoozeMap(prev => ({ ...prev, [id]: null }))
  }

  function handleTogglePrio(id: string) {
    const next = !prioMap[id]
    setPrio(id, next)
    setPrioMap(prev => ({ ...prev, [id]: next }))
  }

  // ── Derivar lista processada ──────────────────────────────────────────────
  const now = new Date()

  const processos = rawData.map(p => {
    const etapas   = (p.etapas || []) as Array<{ id: string; updated_at: string }>
    const lastMs   = etapas.length
      ? Math.max(new Date(p.updated_at).getTime(), ...etapas.map(e => new Date(e.updated_at).getTime()))
      : new Date(p.updated_at).getTime()
    const diasParado = daysSinceMs(lastMs)
    const ultimaMov  = new Date(lastMs).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })

    const checklist: any[] = p.checklist || []
    const nextItem   = checklist.find(c => c.status !== 'Concluido' && c.status !== 'concluido')
    const nextStep   = nextItem
      ? (nextItem.etapa || nextItem.nome || nextItem.titulo || nextItem.tarefa || nextItem.descricao || 'Próxima etapa')
      : null
    const done  = checklist.filter(c => c.status === 'Concluido' || c.status === 'concluido').length
    const total = checklist.length

    return {
      ...p,
      diasParado,
      ultimaMov,
      nextStep,
      done,
      total,
      prioridade:  prioMap[p.id] || false,
      snoozeUntil: snoozeMap[p.id] || null,
    }
  })

  const snoozed = processos.filter(p => p.snoozeUntil && p.snoozeUntil > now)
  const active  = processos.filter(p => !p.snoozeUntil || p.snoozeUntil <= now)
  const prio    = active.filter(p =>  p.prioridade).sort((a, b) => b.diasParado - a.diasParado)
  const rotina  = active.filter(p => !p.prioridade).sort((a, b) => b.diasParado - a.diasParado)

  // ── Card ─────────────────────────────────────────────────────────────────
  function ProcessCard({ p }: { p: ReturnType<typeof processos[0] extends infer T ? () => T : never> & any }) {
    const border = urgBorder(p.diasParado, p.prioridade)
    const pct    = p.total > 0 ? Math.round((p.done / p.total) * 100) : 0

    return (
      <div className={`bg-white rounded-2xl border border-gray-100 border-l-[5px] ${border} shadow-sm hover:shadow-md transition-all`}>
        <div className="px-5 pt-4 pb-3 space-y-3">

          {/* Linha 1 — empresa + botão prioridade */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="font-bold text-gray-900 text-[15px] leading-snug truncate">
                {p.empresa?.razao_social || '—'}
              </p>
              <p className="text-[11px] text-gray-400 mt-0.5">
                <span className="font-semibold text-gray-600">
                  {TIPO_LABELS[p.tipo] || p.tipo}
                </span>
                {p.titulo && <span> · {p.titulo}</span>}
              </p>
            </div>
            <button
              onClick={() => handleTogglePrio(p.id)}
              title={p.prioridade ? 'Remover prioridade' : 'Marcar como prioritário'}
              className={`flex-shrink-0 text-[10px] font-bold px-2.5 py-1 rounded-full transition-all whitespace-nowrap ${
                p.prioridade
                  ? 'bg-orange-100 text-orange-700 ring-1 ring-orange-300 hover:bg-orange-200'
                  : 'bg-gray-100 text-gray-400 hover:bg-orange-50 hover:text-orange-500 hover:ring-1 hover:ring-orange-200'
              }`}
            >
              {p.prioridade ? '🔥 Prioritário' : '☆ Rotina'}
            </button>
          </div>

          {/* Linha 2 — status + urgência + última mov */}
          <div className="flex flex-wrap items-center gap-2" onClick={e => e.stopPropagation()}>
            {/* Status (clicável) */}
            <div className="relative">
              <button
                onClick={() => setOpenStatus(prev => prev === p.id ? null : p.id)}
                className={`flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide transition-all ${statusColor(p.status)} hover:opacity-80`}
              >
                {statusLabel(p.status)}
                <svg className="w-2.5 h-2.5 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {openStatus === p.id && (
                <div className="absolute left-0 top-full mt-1.5 z-30 bg-white rounded-xl shadow-xl border border-gray-200 py-1.5 min-w-[180px]">
                  {STATUS_CHANGE_OPTS.map(o => (
                    <button key={o.value} onClick={() => handleStatusChange(p.id, o.value)}
                      className={`w-full text-left px-3.5 py-2 text-xs font-medium transition-colors hover:bg-gray-50 ${
                        p.status === o.value ? 'text-blue-700 font-bold' : 'text-gray-700'
                      }`}>
                      {o.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Dias parado */}
            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${diasPill(p.diasParado)}`}>
              {p.diasParado === 0 ? 'movido hoje' : `${p.diasParado}d parado`}
            </span>

            {/* Última movimentação */}
            <span className="text-[10px] text-gray-400 flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              última mov. {p.ultimaMov}
            </span>
          </div>

          {/* Próxima etapa */}
          {p.nextStep ? (
            <div className="flex items-start gap-2 bg-indigo-50 rounded-xl px-3.5 py-2.5">
              <svg className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
              <div>
                <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-0.5">Próxima etapa</p>
                <p className="text-xs font-semibold text-indigo-900 leading-snug">{p.nextStep}</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 bg-emerald-50 rounded-xl px-3.5 py-2.5">
              <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <p className="text-xs font-semibold text-emerald-700">Todas etapas concluídas</p>
            </div>
          )}

          {/* Barra de progresso */}
          {p.total > 0 && (
            <div className="flex items-center gap-2.5">
              <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${pct === 100 ? 'bg-emerald-400' : 'bg-indigo-400'}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-[10px] font-bold text-gray-400 whitespace-nowrap flex-shrink-0">
                {p.done}/{p.total} etapas · {pct}%
              </span>
            </div>
          )}
        </div>

        {/* Rodapé com ações */}
        <div className="px-5 py-2.5 border-t border-gray-50 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
            {/* Snooze */}
            <div className="relative">
              <button
                onClick={() => setOpenSnooze(prev => prev === p.id ? null : p.id)}
                className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-500 hover:text-gray-800 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg transition-all"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
                Adiar
              </button>
              {openSnooze === p.id && (
                <div className="absolute left-0 bottom-full mb-1.5 z-30 bg-white rounded-xl shadow-xl border border-gray-200 py-1.5 min-w-[140px]">
                  <p className="px-3.5 py-1 text-[9px] font-black uppercase tracking-widest text-gray-400">Adiar por</p>
                  {SNOOZE_OPTS.map(o => (
                    <button key={o.days} onClick={() => handleSnooze(p.id, o.days)}
                      className="w-full text-left px-3.5 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                      {o.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <Link href={`/societario/${p.id}`}
            className="flex items-center gap-1.5 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 transition-colors">
            Abrir processo
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </div>
    )
  }

  // ── Seção ─────────────────────────────────────────────────────────────────
  function Section({
    label, sublabel, dotColor, headerBg, headerBorder, badgeCls, count, children,
  }: {
    label: string; sublabel: string; dotColor: string; headerBg: string; headerBorder: string
    badgeCls: string; count: number; children: React.ReactNode
  }) {
    return (
      <div>
        <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border mb-3 ${headerBg} ${headerBorder}`}>
          <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${dotColor}`} />
          <span className="text-sm font-bold text-gray-900">{label}</span>
          <span className="text-xs text-gray-400 hidden sm:inline">— {sublabel}</span>
          <span className={`ml-auto text-xs font-bold px-2 py-0.5 rounded-full ${badgeCls}`}>{count}</span>
        </div>
        {children}
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 max-w-3xl mx-auto font-sans">

      {/* Cabeçalho */}
      <div className="mb-8">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-2xl shadow-sm border border-indigo-100">
              ⚖️
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Painel de Processos</h1>
              <p className="text-sm text-gray-500">{diaLabel} · {dateTxt}</p>
            </div>
          </div>
          <button onClick={load}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-700 transition-colors font-medium mt-1 flex-shrink-0">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Atualizar
          </button>
        </div>

        {/* Scorecard */}
        {!loading && (
          <div className="mt-5 flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-1.5 px-3.5 py-2 bg-orange-50 rounded-full ring-1 ring-orange-200">
              <span className="w-2 h-2 rounded-full bg-orange-500" />
              <span className="text-xs font-bold text-orange-700">
                {prio.length} prioritário{prio.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-50 rounded-full ring-1 ring-slate-200">
              <span className="w-2 h-2 rounded-full bg-slate-400" />
              <span className="text-xs font-bold text-slate-600">
                {rotina.length} em rotina
              </span>
            </div>
            {snoozed.length > 0 && (
              <button
                onClick={() => setShowSnoozed(s => !s)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-gray-50 rounded-full ring-1 ring-gray-200 hover:bg-gray-100 transition-all"
              >
                <span className="w-2 h-2 rounded-full bg-gray-400" />
                <span className="text-xs font-bold text-gray-500">
                  {snoozed.length} adiado{snoozed.length !== 1 ? 's' : ''} {showSnoozed ? '▲' : '▼'}
                </span>
              </button>
            )}
            {updatedAt && (
              <span className="text-[10px] text-gray-400 ml-auto">
                atualizado às {updatedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Conteúdo */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-44 bg-gray-50 rounded-2xl animate-pulse border border-gray-100" />
          ))}
        </div>
      ) : active.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-gray-100 shadow-sm">
          <p className="text-5xl mb-4">🎉</p>
          <p className="text-lg font-bold text-gray-900">Nenhum processo ativo!</p>
          <p className="text-sm text-gray-500 mt-1">Tudo concluído ou adiado. Bom trabalho!</p>
          <Link href="/societario" className="inline-block mt-5 text-xs font-bold text-indigo-600 hover:underline">
            Ver todos os processos →
          </Link>
        </div>
      ) : (
        <div className="space-y-7">

          {/* Prioritários */}
          <Section
            label="Prioritários"
            sublabel="precisam da sua atenção hoje"
            dotColor="bg-orange-500"
            headerBg="bg-orange-50"
            headerBorder="border-orange-200"
            badgeCls="bg-orange-100 text-orange-700 ring-1 ring-orange-200"
            count={prio.length}
          >
            {prio.length === 0 ? (
              <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-gray-50 border border-gray-100 border-dashed">
                <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <p className="text-sm text-gray-400">
                  Nenhum processo marcado como prioritário.
                  <span className="ml-1 text-gray-500 font-medium">Clique em ☆ Rotina nos cards abaixo para elevar.</span>
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {prio.map(p => <ProcessCard key={p.id} p={p} />)}
              </div>
            )}
          </Section>

          {/* Rotina */}
          <Section
            label="Em Rotina"
            sublabel="ordenados por urgência — mais parado primeiro"
            dotColor="bg-slate-400"
            headerBg="bg-slate-50"
            headerBorder="border-slate-200"
            badgeCls="bg-slate-100 text-slate-600 ring-1 ring-slate-200"
            count={rotina.length}
          >
            {rotina.length === 0 ? (
              <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-gray-50 border border-gray-100 border-dashed">
                <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <p className="text-sm text-gray-400">Sem processos em rotina.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {rotina.map(p => <ProcessCard key={p.id} p={p} />)}
              </div>
            )}
          </Section>

          {/* Adiados */}
          {showSnoozed && snoozed.length > 0 && (
            <Section
              label="Adiados"
              sublabel="voltam automaticamente na data programada"
              dotColor="bg-gray-400"
              headerBg="bg-gray-50"
              headerBorder="border-gray-200"
              badgeCls="bg-gray-100 text-gray-500 ring-1 ring-gray-200"
              count={snoozed.length}
            >
              <div className="space-y-2">
                {snoozed.map(p => {
                  const sn = snoozeMap[p.id]
                  const daysLeft = sn ? Math.ceil((sn.getTime() - now.getTime()) / 86_400_000) : 0
                  return (
                    <div key={p.id} className="bg-white rounded-xl border border-gray-100 border-l-[4px] border-l-gray-300 shadow-sm">
                      <div className="px-4 py-3 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-gray-500 truncate">{p.empresa?.razao_social || '—'}</p>
                          <p className="text-xs text-gray-400">
                            {TIPO_LABELS[p.tipo] || p.tipo}
                            <span className="mx-1.5 text-gray-300">·</span>
                            volta em {daysLeft === 1 ? 'amanhã' : `${daysLeft} dias`}
                            {sn && (
                              <span className="ml-1 font-mono">({sn.toLocaleDateString('pt-BR')})</span>
                            )}
                          </p>
                        </div>
                        <button
                          onClick={() => handleClearSnooze(p.id)}
                          className="flex-shrink-0 text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors whitespace-nowrap"
                        >
                          Retomar agora
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </Section>
          )}
        </div>
      )}

      {/* Rodapé */}
      {!loading && (
        <div className="mt-8 pt-4 border-t border-gray-100 flex items-center justify-between">
          <p className="text-[10px] text-gray-400">
            Prioridades e snooze ficam salvos neste navegador.
          </p>
          <Link href="/societario" className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors">
            Ver lista completa →
          </Link>
        </div>
      )}
    </div>
  )
}
