'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useOrg } from '@/lib/org-context'
import Link from 'next/link'
import toast from 'react-hot-toast'

// ── Labels (mesmos do módulo societário) ─────────────────────────────────────
const TIPO_LABELS: Record<string, string> = {
  abertura:              'Abertura',
  alteracao_contratual:  'Alteração Contratual',
  encerramento:          'Encerramento',
  transferencia_entrada: 'Transferência (Entrada)',
  transferencia_saida:   'Transferência (Saída)',
}

const TIPO_COLORS: Record<string, string> = {
  abertura:              'bg-emerald-100 text-emerald-700',
  alteracao_contratual:  'bg-blue-100 text-blue-700',
  encerramento:          'bg-red-100 text-red-700',
  transferencia_entrada: 'bg-purple-100 text-purple-700',
  transferencia_saida:   'bg-orange-100 text-orange-700',
}

const DIAS_PT  = ['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado']
const MESES_PT = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro']

// ── Próxima etapa (igual ao módulo) ──────────────────────────────────────────
function proximaEtapa(checklist: any[]): string | null {
  const next = checklist?.find(i => i.status !== 'Concluido')
  if (!next) return null
  const t = next.etapa as string
  return t.length > 60 ? t.substring(0, 60) + '…' : t
}

function diasDesde(dateStr: string): number {
  return Math.max(0, Math.round((Date.now() - new Date(dateStr).getTime()) / 86_400_000))
}

function urgBorderClass(dias: number, prio: boolean) {
  if (prio)      return 'border-l-orange-500'
  if (dias > 30) return 'border-l-red-500'
  if (dias > 15) return 'border-l-orange-400'
  if (dias >= 7) return 'border-l-amber-400'
  return          'border-l-emerald-400'
}

function diasPillClass(dias: number) {
  if (dias > 30) return 'bg-red-100 text-red-700'
  if (dias > 15) return 'bg-orange-100 text-orange-700'
  if (dias >= 7) return 'bg-amber-100 text-amber-700'
  return          'bg-emerald-100 text-emerald-700'
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
function clearSnoozeLS(id: string) {
  localStorage.removeItem(`psnooze_${id}`)
}

const SNOOZE_OPTS = [
  { days: 1,  label: 'Amanhã'  },
  { days: 3,  label: '3 dias'  },
  { days: 7,  label: '7 dias'  },
  { days: 14, label: '14 dias' },
]

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
    for (const p of lista) {
      pm[p.id] = getPrio(p.id)
      sm[p.id] = getSnooze(p.id)
    }
    setPrioMap(pm)
    setSnoozeMap(sm)
    setProcessos(lista)
    setUpdatedAt(new Date())
    setLoading(false)
  }, [supabase, orgId])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const h = () => { setOpenStatus(null); setOpenSnooze(null) }
    document.addEventListener('click', h)
    return () => document.removeEventListener('click', h)
  }, [])

  // ── Ações ─────────────────────────────────────────────────────────────────

  async function handleFinalizar(id: string) {
    const { error } = await supabase
      .from('processos_societarios')
      .update({ status: 'Finalizado' })
      .eq('id', id)
    if (!error) {
      setProcessos(prev => prev.filter(p => p.id !== id))
      toast.success('Processo finalizado!')
    }
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

  // ── Derivar dados ─────────────────────────────────────────────────────────

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

    return {
      ...p,
      nome,
      diasParado: dias,
      ultimaMov,
      nextStep: next,
      done,
      total,
      pct,
      prioridade:  prioMap[p.id] || false,
      snoozeUntil: snoozeMap[p.id] || null,
    }
  })

  const snoozed = processosDados.filter(p => p.snoozeUntil && p.snoozeUntil > agora)
  const ativos  = processosDados.filter(p => !p.snoozeUntil || p.snoozeUntil <= agora)
  const priori  = ativos.filter(p =>  p.prioridade).sort((a, b) => b.diasParado - a.diasParado)
  const rotina  = ativos.filter(p => !p.prioridade).sort((a, b) => b.diasParado - a.diasParado)

  // ── Card ─────────────────────────────────────────────────────────────────

  function ProcessoCard({ p }: { p: typeof processosDados[0] }) {
    const border = urgBorderClass(p.diasParado, p.prioridade)

    return (
      <div className={`bg-white rounded-2xl border border-slate-100 border-l-[5px] ${border} shadow-sm hover:shadow-md transition-shadow`}>
        <div className="px-5 pt-4 pb-3 space-y-3">

          {/* Empresa + prioridade */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="font-bold text-slate-900 text-[15px] leading-snug truncate">{p.nome}</p>
              <div className="flex flex-wrap items-center gap-1.5 mt-1">
                <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wide ${TIPO_COLORS[p.tipo] ?? 'bg-slate-100 text-slate-500'}`}>
                  {TIPO_LABELS[p.tipo] ?? p.tipo}
                </span>
                {p.titulo && (
                  <span className="text-[10px] text-yellow-700 font-bold bg-yellow-50 border border-yellow-200 px-2 py-0.5 rounded-full truncate max-w-[200px]">
                    {p.titulo}
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={() => handleTogglePrio(p.id)}
              className={`flex-shrink-0 text-[10px] font-bold px-2.5 py-1 rounded-full transition-all whitespace-nowrap ${
                p.prioridade
                  ? 'bg-orange-100 text-orange-700 ring-1 ring-orange-300'
                  : 'bg-slate-100 text-slate-400 hover:bg-orange-50 hover:text-orange-500'
              }`}
            >
              {p.prioridade ? '🔥 Prioritário' : '☆ Rotina'}
            </button>
          </div>

          {/* Status + dias + última mov */}
          <div className="flex flex-wrap items-center gap-2" onClick={e => e.stopPropagation()}>
            <div className="relative">
              <button
                onClick={() => setOpenStatus(prev => prev === p.id ? null : p.id)}
                className="flex items-center gap-1 text-[10px] font-black px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 hover:opacity-80 uppercase tracking-wide"
              >
                Em Andamento
                <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {openStatus === p.id && (
                <div className="absolute left-0 top-full mt-1.5 z-30 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 min-w-[170px]">
                  <p className="px-3.5 py-1 text-[9px] font-black uppercase tracking-widest text-slate-400">Alterar status</p>
                  <button
                    onClick={() => handleFinalizar(p.id)}
                    className="w-full text-left px-3.5 py-2.5 text-xs font-bold text-emerald-700 hover:bg-emerald-50 flex items-center gap-2"
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
                    Marcar como Finalizado
                  </button>
                </div>
              )}
            </div>

            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${diasPillClass(p.diasParado)}`}>
              {p.diasParado === 0 ? 'movido hoje' : `${p.diasParado}d parado`}
            </span>

            <span className="text-[10px] text-slate-400">
              última mov. {p.ultimaMov}
            </span>
          </div>

          {/* Próxima etapa */}
          {p.nextStep ? (
            <div className="flex items-start gap-2 bg-slate-50 rounded-xl px-3.5 py-2.5">
              <svg className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
              <div>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Próxima etapa</p>
                <p className="text-xs font-semibold text-slate-700 leading-snug">{p.nextStep}</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 bg-emerald-50 rounded-xl px-3.5 py-2.5">
              <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <p className="text-xs font-bold text-emerald-700">Todas as etapas concluídas</p>
            </div>
          )}

          {/* Progresso */}
          {p.total > 0 && (
            <div className="flex items-center gap-2.5">
              <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${p.pct === 100 ? 'bg-emerald-400' : 'bg-yellow-400'}`}
                  style={{ width: `${p.pct}%` }}
                />
              </div>
              <span className="text-[10px] font-bold text-slate-400 whitespace-nowrap flex-shrink-0">
                {p.done}/{p.total} etapas · {p.pct}%
              </span>
            </div>
          )}
        </div>

        {/* Rodapé do card */}
        <div className="px-5 py-2.5 border-t border-slate-50 flex items-center justify-between gap-3">
          <div className="relative" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setOpenSnooze(prev => prev === p.id ? null : p.id)}
              className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition-all"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
              Adiar
            </button>
            {openSnooze === p.id && (
              <div className="absolute left-0 bottom-full mb-1.5 z-30 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 min-w-[140px]">
                <p className="px-3.5 py-1 text-[9px] font-black uppercase tracking-widest text-slate-400">Adiar por</p>
                {SNOOZE_OPTS.map(o => (
                  <button key={o.days} onClick={() => handleSnooze(p.id, o.days)}
                    className="w-full text-left px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors">
                    {o.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <Link
            href={`/societario?processo=${p.id}`}
            className="flex items-center gap-1.5 text-[11px] font-bold text-yellow-600 hover:text-yellow-800 transition-colors"
          >
            Abrir no módulo
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </div>
    )
  }

  // ── Seção ─────────────────────────────────────────────────────────────────

  function Secao({
    label, sublabel, dotColor, bg, border, badgeCls, count, children,
  }: {
    label: string; sublabel: string; dotColor: string; bg: string; border: string
    badgeCls: string; count: number; children: React.ReactNode
  }) {
    return (
      <div>
        <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border mb-3 ${bg} ${border}`}>
          <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${dotColor}`} />
          <span className="text-sm font-bold text-slate-800">{label}</span>
          <span className="text-xs text-slate-400 hidden sm:inline">— {sublabel}</span>
          <span className={`ml-auto text-xs font-bold px-2 py-0.5 rounded-full ${badgeCls}`}>{count}</span>
        </div>
        {children}
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 max-w-3xl mx-auto font-sans bg-[#F8FAFC] min-h-screen">

      {/* Cabeçalho */}
      <div className="mb-8">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-black rounded-2xl flex items-center justify-center shadow-sm">
              <span className="text-yellow-400 font-black text-xl">⚖</span>
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">Painel de Processos</h1>
              <p className="text-sm text-slate-400">{diaLabel} · {dateTxt}</p>
            </div>
          </div>
          <button onClick={load}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-700 transition-colors font-medium mt-1 flex-shrink-0">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Atualizar
          </button>
        </div>

        {!loading && (
          <div className="mt-5 flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-1.5 px-3.5 py-2 bg-orange-50 rounded-full ring-1 ring-orange-200">
              <span className="w-2 h-2 rounded-full bg-orange-500" />
              <span className="text-xs font-bold text-orange-700">
                {priori.length} prioritário{priori.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 rounded-full ring-1 ring-slate-200">
              <span className="w-2 h-2 rounded-full bg-slate-400" />
              <span className="text-xs font-bold text-slate-600">
                {rotina.length} em rotina
              </span>
            </div>
            {snoozed.length > 0 && (
              <button onClick={() => setShowSnoozed(s => !s)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-gray-50 rounded-full ring-1 ring-gray-200 hover:bg-gray-100 transition-all">
                <span className="w-2 h-2 rounded-full bg-gray-400" />
                <span className="text-xs font-bold text-gray-500">
                  {snoozed.length} adiado{snoozed.length !== 1 ? 's' : ''} {showSnoozed ? '▲' : '▼'}
                </span>
              </button>
            )}
            {updatedAt && (
              <span className="text-[10px] text-slate-400 ml-auto">
                atualizado às {updatedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Conteúdo */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-48 bg-white rounded-2xl animate-pulse border border-slate-100" />
          ))}
        </div>
      ) : ativos.length === 0 && snoozed.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-slate-100 shadow-sm">
          <p className="text-5xl mb-4">🎉</p>
          <p className="text-lg font-bold text-slate-900">Nenhum processo em andamento!</p>
          <p className="text-sm text-slate-400 mt-1">Tudo finalizado ou adiado.</p>
          <Link href="/societario" className="inline-block mt-5 text-xs font-bold text-yellow-600 hover:underline">
            Ver módulo societário →
          </Link>
        </div>
      ) : (
        <div className="space-y-7">

          <Secao
            label="Prioritários"
            sublabel="precisam da sua atenção hoje"
            dotColor="bg-orange-500"
            bg="bg-orange-50"
            border="border-orange-200"
            badgeCls="bg-orange-100 text-orange-700 ring-1 ring-orange-200"
            count={priori.length}
          >
            {priori.length === 0 ? (
              <div className="flex items-center gap-2.5 px-4 py-3.5 rounded-xl bg-slate-50 border border-dashed border-slate-200">
                <span className="text-base">☆</span>
                <p className="text-sm text-slate-400">
                  Nenhum processo marcado como prioritário.
                  <span className="ml-1 font-medium text-slate-500">Use o botão ☆ Rotina nos cards abaixo para elevar.</span>
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {priori.map(p => <ProcessoCard key={p.id} p={p} />)}
              </div>
            )}
          </Secao>

          <Secao
            label="Em Rotina"
            sublabel="ordenados pelo mais parado primeiro"
            dotColor="bg-slate-400"
            bg="bg-slate-50"
            border="border-slate-200"
            badgeCls="bg-slate-100 text-slate-600 ring-1 ring-slate-200"
            count={rotina.length}
          >
            {rotina.length === 0 ? (
              <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-slate-50 border border-dashed border-slate-200">
                <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <p className="text-sm text-slate-400">Sem processos em rotina.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {rotina.map(p => <ProcessoCard key={p.id} p={p} />)}
              </div>
            )}
          </Secao>

          {showSnoozed && snoozed.length > 0 && (
            <Secao
              label="Adiados"
              sublabel="voltam automaticamente na data programada"
              dotColor="bg-slate-300"
              bg="bg-slate-50"
              border="border-slate-200"
              badgeCls="bg-slate-100 text-slate-400"
              count={snoozed.length}
            >
              <div className="space-y-2">
                {snoozed.map(p => {
                  const sn = snoozeMap[p.id]
                  const daysLeft = sn ? Math.ceil((sn.getTime() - agora.getTime()) / 86_400_000) : 0
                  return (
                    <div key={p.id} className="bg-white rounded-xl border border-slate-100 border-l-[4px] border-l-slate-300">
                      <div className="px-4 py-3 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-slate-500 truncate">{p.nome}</p>
                          <p className="text-xs text-slate-400">
                            {TIPO_LABELS[p.tipo] ?? p.tipo}
                            <span className="mx-1.5 text-slate-300">·</span>
                            volta {daysLeft === 1 ? 'amanhã' : `em ${daysLeft} dias`}
                            {sn && <span className="ml-1 font-mono">({sn.toLocaleDateString('pt-BR')})</span>}
                          </p>
                        </div>
                        <button onClick={() => handleClearSnooze(p.id)}
                          className="flex-shrink-0 text-xs font-bold text-yellow-600 hover:text-yellow-800 transition-colors whitespace-nowrap">
                          Retomar agora
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </Secao>
          )}
        </div>
      )}

      {!loading && (
        <div className="mt-8 pt-4 border-t border-slate-200 flex items-center justify-between">
          <p className="text-[10px] text-slate-400">
            Prioridades e snooze salvos neste navegador · Exibindo apenas processos em andamento
          </p>
          <Link href="/societario" className="text-xs font-bold text-yellow-600 hover:text-yellow-800 transition-colors">
            Ver módulo completo →
          </Link>
        </div>
      )}
    </div>
  )
}
