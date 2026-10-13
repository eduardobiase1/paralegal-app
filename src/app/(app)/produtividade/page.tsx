'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useOrg } from '@/lib/org-context'
import toast from 'react-hot-toast'
import { diaLocal } from '@/lib/atividade'

// ── Tipos ─────────────────────────────────────────────────────────────────────
type Bloco = {
  id: string; user_id: string; usuario: string | null; dia: string
  inicio: string; fim: string; segundos: number; tipo: 'sistema' | 'portal'
  modulo: string; empresa_id: string | null; empresa_nome: string | null
  descricao: string | null; resultado: string | null; estimado: boolean
}
type Evento = {
  id: string; user_id: string; usuario: string | null; dia: string; criado_em: string
  acao: string; modulo: string; empresa_nome: string | null; descricao: string
}
type Manual = {
  id: string; userId?: string; usuario?: string
  data: string; tipo: string; empresa: string; descricao: string; duracao: number; criadoEm: string
}
type Periodo = 'hoje' | 'semana' | 'mes'

const TIPOS_MANUAL = ['Reunião', 'Telefone / WhatsApp', 'Protocolo presencial', 'Cartório / Junta', 'Email / Comunicado', 'Outro']

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDur(seg: number) {
  const min = Math.round(seg / 60)
  if (min < 1) return '<1min'
  if (min < 60) return `${min}min`
  const h = Math.floor(min / 60), m = min % 60
  return m ? `${h}h ${m}min` : `${h}h`
}
function fmtHora(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}
function fmtDia(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' })
}
function intervalo(p: Periodo): [string, string] {
  const hoje = new Date()
  if (p === 'hoje') return [diaLocal(hoje), diaLocal(hoje)]
  if (p === 'semana') {
    const seg = new Date(hoje); const dow = hoje.getDay()
    seg.setDate(hoje.getDate() - (dow === 0 ? 6 : dow - 1))
    return [diaLocal(seg), diaLocal(hoje)]
  }
  return [diaLocal(new Date(hoje.getFullYear(), hoje.getMonth(), 1)), diaLocal(hoje)]
}
function tabelaAusente(error: { code?: string } | null) {
  return !!error && (error.code === '42P01' || error.code === 'PGRST205')
}
function manualFromRow(r: any): Manual {
  return {
    id: r.id, userId: r.user_id, usuario: r.usuario || undefined, data: r.data, tipo: r.tipo,
    empresa: r.empresa || '', descricao: r.descricao, duracao: r.duracao, criadoEm: r.criado_em,
  }
}

// Junta blocos seguidos do mesmo contexto (mesma pessoa, módulo e empresa, com menos de 2 min de intervalo)
function juntarBlocos(blocos: Bloco[]): Bloco[] {
  const ord = [...blocos].sort((a, b) => a.inicio.localeCompare(b.inicio))
  const out: Bloco[] = []
  for (const b of ord) {
    const ant = [...out].reverse().find(x => x.user_id === b.user_id)
    const mesmoCtx = ant && ant.tipo === 'sistema' && b.tipo === 'sistema'
      && ant.modulo === b.modulo && ant.empresa_id === b.empresa_id
      && new Date(b.inicio).getTime() - new Date(ant.fim).getTime() < 120_000
    if (mesmoCtx && ant === out[out.length - 1]) {
      ant.fim = b.fim; ant.segundos += b.segundos
    } else {
      out.push({ ...b })
    }
  }
  return out
}

function somaPor<T>(itens: T[], chave: (i: T) => string | null, valor: (i: T) => number) {
  const m: Record<string, number> = {}
  for (const i of itens) { const k = chave(i); if (k) m[k] = (m[k] || 0) + valor(i) }
  return Object.entries(m).sort((a, b) => b[1] - a[1])
}

// ── Página ────────────────────────────────────────────────────────────────────
export default function ProdutividadePage() {
  const { orgId, isAdmin } = useOrg()
  const [supabase] = useState(createClient)

  const [me, setMe] = useState<{ id: string; nome: string } | null>(null)
  const [periodo, setPeriodo] = useState<Periodo>('hoje')
  const [pessoa, setPessoa] = useState<string>(isAdmin ? 'todos' : 'eu') // 'eu' | 'todos' | user_id
  const [loading, setLoading] = useState(true)
  const [semTabelas, setSemTabelas] = useState(false)

  const [blocos, setBlocos] = useState<Bloco[]>([])
  const [eventos, setEventos] = useState<Evento[]>([])
  const [manuais, setManuais] = useState<Manual[]>([])
  const [limiteFeed, setLimiteFeed] = useState(80)

  // Registro manual (fora do sistema)
  const [empresas, setEmpresas] = useState<Array<{ id: string; razao_social: string }>>([])
  const [showForm, setShowForm] = useState(false)
  const [fData, setFData] = useState(diaLocal())
  const [fTipo, setFTipo] = useState(TIPOS_MANUAL[0])
  const [fEmpresa, setFEmpresa] = useState('')
  const [fDesc, setFDesc] = useState('')
  const [fDur, setFDur] = useState(30)

  const load = useCallback(async () => {
    if (!orgId) return
    setLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    const eu = session?.user ? { id: session.user.id, nome: (session.user.email || '').split('@')[0] } : null
    setMe(eu)

    const [ini, fim] = intervalo(periodo)
    const [bRes, eRes, mRes] = await Promise.all([
      supabase.from('atividade_blocos').select('*').eq('org_id', orgId).gte('dia', ini).lte('dia', fim).order('inicio', { ascending: false }),
      supabase.from('atividade_eventos').select('*').eq('org_id', orgId).gte('dia', ini).lte('dia', fim).order('criado_em', { ascending: false }),
      supabase.from('produtividade_entradas').select('*').eq('org_id', orgId).gte('data', ini).lte('data', fim).order('criado_em', { ascending: false }),
    ])

    if (tabelaAusente(bRes.error) || tabelaAusente(eRes.error) || tabelaAusente(mRes.error)) {
      setSemTabelas(true); setBlocos([]); setEventos([]); setManuais([]); setLoading(false)
      return
    }
    setSemTabelas(false)

    // Envia para o banco o que estava salvo só neste navegador (versão antiga da tela) — uma única vez
    let manuaisRows = mRes.data || []
    try {
      const raw = localStorage.getItem('produtividade_entradas')
      const locais = raw ? JSON.parse(raw) as any[] : []
      if (eu && locais.length > 0) {
        const { data: inseridos, error } = await supabase.from('produtividade_entradas').insert(locais.map(e => ({
          org_id: orgId, usuario: eu.nome, data: e.data, tipo: e.tipo, empresa: e.empresa || null,
          descricao: e.descricao, duracao: e.duracao, criado_em: e.criadoEm,
        }))).select()
        if (!error) {
          localStorage.removeItem('produtividade_entradas')
          manuaisRows = [...(inseridos || []).filter((r: any) => r.data >= ini && r.data <= fim), ...manuaisRows]
        }
      }
    } catch {}

    setBlocos((bRes.data || []) as Bloco[])
    setEventos((eRes.data || []) as Evento[])
    setManuais(manuaisRows.map(manualFromRow))
    setLoading(false)
  }, [supabase, orgId, periodo])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!orgId) return
    supabase.from('empresas').select('id, razao_social').eq('org_id', orgId).order('razao_social')
      .then(({ data }) => setEmpresas(data || []))
  }, [supabase, orgId])

  // ── Filtro por pessoa ───────────────────────────────────────────────────────
  const alvoId = pessoa === 'todos' ? null : pessoa === 'eu' ? me?.id ?? null : pessoa
  const doAlvo = <T extends { user_id?: string; userId?: string }>(l: T[]) =>
    alvoId ? l.filter(i => (i.user_id ?? i.userId) === alvoId) : l

  const pessoas = useMemo(() => {
    const m = new Map<string, string>()
    for (const b of blocos) m.set(b.user_id, b.usuario || 'sem nome')
    for (const e of eventos) m.set(e.user_id, e.usuario || 'sem nome')
    return Array.from(m.entries()).sort((a, b) => a[1].localeCompare(b[1]))
  }, [blocos, eventos])

  const blocosF  = useMemo(() => juntarBlocos(doAlvo(blocos)), [blocos, alvoId])
  const eventosF = useMemo(() => doAlvo(eventos), [eventos, alvoId])
  const manuaisF = useMemo(() => doAlvo(manuais), [manuais, alvoId])

  // ── Métricas ────────────────────────────────────────────────────────────────
  const segSistema = blocosF.filter(b => b.tipo === 'sistema').reduce((s, b) => s + b.segundos, 0)
  const segPortal  = blocosF.filter(b => b.tipo === 'portal').reduce((s, b) => s + b.segundos, 0)
  const segManual  = manuaisF.reduce((s, m) => s + m.duracao * 60, 0)
  const empresasAtendidas = new Set([
    ...blocosF.map(b => b.empresa_nome), ...eventosF.map(e => e.empresa_nome),
  ].filter(Boolean)).size

  const porModulo  = somaPor(blocosF, b => b.tipo === 'portal' ? 'Portais externos' : b.modulo, b => b.segundos)
  const porEmpresa = somaPor(blocosF, b => b.empresa_nome, b => b.segundos).slice(0, 8)
  const porAcao    = somaPor(eventosF, e => e.acao, () => 1)

  const porPessoa = pessoas.map(([id, nome]) => {
    const bs = blocos.filter(b => b.user_id === id)
    return {
      id, nome,
      sistema: bs.filter(b => b.tipo === 'sistema').reduce((s, b) => s + b.segundos, 0),
      portal:  bs.filter(b => b.tipo === 'portal').reduce((s, b) => s + b.segundos, 0),
      acoes:   eventos.filter(e => e.user_id === id).length,
    }
  }).sort((a, b) => (b.sistema + b.portal) - (a.sistema + a.portal))

  // ── Linha do tempo: blocos e ações intercalados, do mais recente ao mais antigo ──
  const feed = useMemo(() => {
    const itens = [
      ...blocosF.map(b => ({ k: 'b' as const, t: b.inicio, dia: b.dia, b })),
      ...eventosF.map(e => ({ k: 'e' as const, t: e.criado_em, dia: e.dia, e })),
    ].sort((a, b) => b.t.localeCompare(a.t))
    return itens
  }, [blocosF, eventosF])

  // ── Registro manual ─────────────────────────────────────────────────────────
  async function addManual() {
    if (!fDesc.trim()) return
    const { data, error } = await supabase.from('produtividade_entradas').insert([{
      org_id: orgId, usuario: me?.nome, data: fData, tipo: fTipo,
      empresa: fEmpresa || null, descricao: fDesc.trim(), duracao: fDur,
    }]).select().single()
    if (error || !data) { toast.error('Erro ao salvar atividade: ' + (error?.message || '')); return }
    setManuais(prev => [manualFromRow(data), ...prev])
    setFDesc(''); setFEmpresa(''); setFDur(30); setShowForm(false)
  }

  async function removeManual(id: string) {
    const { error } = await supabase.from('produtividade_entradas').delete().eq('id', id)
    if (error) { toast.error('Erro ao remover: ' + error.message); return }
    setManuais(prev => prev.filter(m => m.id !== id))
  }

  const mostraNome = !alvoId
  const maxModulo  = porModulo[0]?.[1] || 1
  const maxEmpresa = porEmpresa[0]?.[1] || 1

  return (
    <div className="px-4 md:px-6 py-8 max-w-6xl mx-auto space-y-6">

      {/* ── Cabeçalho ─────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Produtividade</h1>
          <p className="text-sm text-slate-500 mt-0.5">Tempo e ações registrados automaticamente enquanto o sistema é usado</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
            {([['hoje', 'Hoje'], ['semana', 'Semana'], ['mes', 'Mês']] as const).map(([id, label]) => (
              <button key={id} onClick={() => { setPeriodo(id); setLimiteFeed(80) }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${periodo === id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                {label}
              </button>
            ))}
          </div>
          {isAdmin && (
            <select value={pessoa} onChange={e => setPessoa(e.target.value)}
              className="border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 bg-white outline-none focus:border-blue-300">
              <option value="todos">Toda a equipe</option>
              <option value="eu">Só eu</option>
              {pessoas.filter(([id]) => id !== me?.id).map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}
            </select>
          )}
          <button onClick={load} title="Atualizar"
            className="text-xs font-semibold text-slate-500 hover:text-slate-700 border border-slate-200 rounded-xl px-3 py-2 hover:bg-slate-50 transition-all bg-white">
            ↻ Atualizar
          </button>
        </div>
      </div>

      {semTabelas && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-amber-900">
          <p className="font-bold">O registro automático ainda não está ativo.</p>
          <p className="mt-1">Rode o arquivo <code className="font-mono text-xs bg-amber-100 px-1 py-0.5 rounded">supabase/migration_v13_produtividade_automatica.sql</code> no SQL Editor do Supabase. Depois disso, o tempo e as ações passam a ser gravados sozinhos.</p>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-white rounded-2xl animate-pulse border border-slate-200" />)}
        </div>
      ) : !semTabelas && (
        <>
          {/* ── Resumo ──────────────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {[
              { label: 'Tempo no sistema',    val: fmtDur(segSistema), sub: 'com a aba ativa' },
              { label: 'Em portais externos', val: fmtDur(segPortal),  sub: 'abertos pelo sistema' },
              { label: 'Fora do sistema',     val: fmtDur(segManual),  sub: 'registro manual' },
              { label: 'Ações registradas',   val: String(eventosF.length), sub: porAcao[0] ? `${porAcao[0][1]}× ${porAcao[0][0].toLowerCase()}` : 'nenhuma ainda' },
              { label: 'Empresas atendidas',  val: String(empresasAtendidas), sub: 'com tempo ou ação' },
            ].map(c => (
              <div key={c.label} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{c.label}</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{c.val}</p>
                <p className="text-xs text-slate-400 mt-0.5 truncate">{c.sub}</p>
              </div>
            ))}
          </div>

          {/* ── Por pessoa (gestor, equipe inteira) ─────────────────────────── */}
          {isAdmin && pessoa === 'todos' && porPessoa.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <p className="px-5 py-3 text-sm font-bold text-slate-900 border-b border-slate-100">Por pessoa</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[480px]">
                  <thead>
                    <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400 bg-slate-50">
                      <th className="px-5 py-2">Pessoa</th>
                      <th className="px-5 py-2">No sistema</th>
                      <th className="px-5 py-2">Em portais</th>
                      <th className="px-5 py-2">Ações</th>
                      <th className="px-5 py-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {porPessoa.map(p => (
                      <tr key={p.id} className="hover:bg-slate-50">
                        <td className="px-5 py-2.5 font-semibold text-slate-800">{p.nome}</td>
                        <td className="px-5 py-2.5 text-slate-600">{fmtDur(p.sistema)}</td>
                        <td className="px-5 py-2.5 text-slate-600">{fmtDur(p.portal)}</td>
                        <td className="px-5 py-2.5 text-slate-600">{p.acoes}</td>
                        <td className="px-5 py-2.5 text-right">
                          <button onClick={() => setPessoa(p.id === me?.id ? 'eu' : p.id)}
                            className="text-xs font-semibold text-blue-600 hover:underline">Ver detalhe →</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Onde o tempo foi ────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Barras titulo="Tempo por módulo" vazio="Nenhum tempo registrado no período."
              itens={porModulo.map(([nome, seg]) => ({ nome, valor: fmtDur(seg), pct: seg / maxModulo, destaque: nome === 'Portais externos' }))} />
            <Barras titulo="Tempo por empresa" vazio="Nenhum tempo ligado a uma empresa no período."
              itens={porEmpresa.map(([nome, seg]) => ({ nome, valor: fmtDur(seg), pct: seg / maxEmpresa, destaque: false }))} />
          </div>

          {/* ── Linha do tempo ──────────────────────────────────────────────── */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <p className="px-5 py-3 text-sm font-bold text-slate-900 border-b border-slate-100">Linha do tempo</p>
            {feed.length === 0 ? (
              <p className="py-12 text-center text-sm text-slate-400">
                Nada registrado ainda neste período. O tempo começa a aparecer após cerca de um minuto de uso.
              </p>
            ) : (
              <div>
                {feed.slice(0, limiteFeed).map((item, idx) => {
                  const novoDia = periodo !== 'hoje' && (idx === 0 || feed[idx - 1].dia !== item.dia)
                  return (
                    <div key={item.k + (item.k === 'b' ? item.b.id : item.e.id)}>
                      {novoDia && (
                        <p className="px-5 py-2 bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500 border-y border-slate-100 capitalize">
                          {fmtDia(item.dia)}
                        </p>
                      )}
                      {item.k === 'b' ? (
                        <div className="flex items-start gap-3 px-5 py-3 border-b border-slate-50">
                          <span className="text-xs font-mono text-slate-500 w-[92px] flex-shrink-0 pt-0.5">
                            {fmtHora(item.b.inicio)}–{fmtHora(item.b.fim)}
                          </span>
                          <span className={`w-1 self-stretch rounded-full flex-shrink-0 ${item.b.tipo === 'portal' ? 'bg-amber-400' : 'bg-slate-800'}`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-800">
                              {item.b.tipo === 'portal' ? `Portal externo · ${item.b.descricao || 'link'}` : item.b.modulo}
                              {item.b.empresa_nome && <span className="font-normal text-slate-500"> · {item.b.empresa_nome}</span>}
                            </p>
                            {item.b.tipo === 'portal' && (
                              <p className="text-xs text-slate-500 mt-0.5">
                                {item.b.resultado ? `Resultado: ${item.b.resultado}` : 'Sem conclusão registrada ao voltar'}
                                {item.b.estimado && ' · tempo estimado'}
                              </p>
                            )}
                            {mostraNome && <p className="text-xs text-slate-400 mt-0.5">{item.b.usuario}</p>}
                          </div>
                          <span className="text-xs font-semibold text-slate-700 flex-shrink-0 pt-0.5">{fmtDur(item.b.segundos)}</span>
                        </div>
                      ) : (
                        <div className="flex items-start gap-3 px-5 py-2 border-b border-slate-50 bg-emerald-50/30">
                          <span className="text-xs font-mono text-slate-500 w-[92px] flex-shrink-0 pt-0.5">{fmtHora(item.e.criado_em)}</span>
                          <span className="w-1 self-stretch flex-shrink-0 flex items-center justify-center">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-slate-700">
                              <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded mr-2">{item.e.acao}</span>
                              {item.e.descricao}
                              {item.e.empresa_nome && <span className="text-slate-500"> · {item.e.empresa_nome}</span>}
                            </p>
                            {mostraNome && <p className="text-xs text-slate-400 mt-0.5">{item.e.usuario}</p>}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
                {feed.length > limiteFeed && (
                  <button onClick={() => setLimiteFeed(l => l + 80)}
                    className="w-full py-3 text-xs font-semibold text-blue-600 hover:bg-slate-50 transition-colors">
                    Mostrar mais ({feed.length - limiteFeed} restantes)
                  </button>
                )}
              </div>
            )}
          </div>

          {/* ── Fora do sistema (manual) ────────────────────────────────────── */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="text-sm font-bold text-slate-900">Fora do sistema</p>
                <p className="text-xs text-slate-400">Reuniões, telefonemas e idas a órgãos — o que o sistema não enxerga</p>
              </div>
              <button onClick={() => setShowForm(v => !v)}
                className="px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-slate-900 hover:bg-slate-700 transition-all">
                + Registrar
              </button>
            </div>

            {showForm && (
              <div className="p-5 border-b border-slate-100 bg-slate-50/60">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Campo label="Data">
                    <input type="date" value={fData} onChange={e => setFData(e.target.value)} className={inputCls} />
                  </Campo>
                  <Campo label="Tipo">
                    <select value={fTipo} onChange={e => setFTipo(e.target.value)} className={inputCls + ' bg-white'}>
                      {TIPOS_MANUAL.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </Campo>
                  <Campo label="Empresa (opcional)">
                    <input list="emp-list" value={fEmpresa} onChange={e => setFEmpresa(e.target.value)}
                      placeholder="Selecione ou digite..." className={inputCls} />
                    <datalist id="emp-list">
                      {empresas.map(e => <option key={e.id} value={e.razao_social} />)}
                    </datalist>
                  </Campo>
                  <Campo label={`Duração · ${fmtDur(fDur * 60)}`}>
                    <input type="range" min={5} max={480} step={5} value={fDur} onChange={e => setFDur(+e.target.value)}
                      className="w-full accent-slate-800 mt-2" />
                  </Campo>
                  <div className="sm:col-span-2">
                    <Campo label="Descrição">
                      <textarea value={fDesc} onChange={e => setFDesc(e.target.value)} placeholder="O que foi feito?"
                        rows={2} className={inputCls + ' resize-none'} />
                    </Campo>
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <button onClick={addManual}
                    className="px-4 py-2 rounded-xl text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-all">Salvar</button>
                  <button onClick={() => setShowForm(false)}
                    className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-500 bg-slate-100 hover:bg-slate-200 transition-colors">Cancelar</button>
                </div>
              </div>
            )}

            {manuaisF.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">Nenhum registro manual no período.</p>
            ) : (
              <div className="divide-y divide-slate-50">
                {manuaisF.map(m => (
                  <div key={m.id} className="flex items-start gap-3 px-5 py-3 group">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-700">
                        <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded mr-2">{m.tipo}</span>
                        {m.descricao}
                        {m.empresa && <span className="text-slate-500"> · {m.empresa}</span>}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {new Date(m.data + 'T00:00:00').toLocaleDateString('pt-BR')} · {fmtDur(m.duracao * 60)}
                        {mostraNome && m.usuario && ` · ${m.usuario}`}
                      </p>
                    </div>
                    {m.userId === me?.id && (
                      <button onClick={() => removeManual(m.id)} title="Remover"
                        className="opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity text-slate-300 hover:text-red-500 text-xs px-1.5 py-0.5 rounded flex-shrink-0">
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <p className="text-xs text-slate-400 text-right">
            {isAdmin ? 'Você vê os registros de toda a equipe.' : 'Você vê apenas os seus registros; o gestor vê os de toda a equipe.'}
            {' '}O tempo só conta com a aba ativa e com uso de mouse ou teclado.
          </p>
        </>
      )}
    </div>
  )
}

// ── Componentes auxiliares ────────────────────────────────────────────────────
const inputCls = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-300 transition-colors'

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 block mb-1">{label}</label>
      {children}
    </div>
  )
}

function Barras({ titulo, vazio, itens }: {
  titulo: string; vazio: string
  itens: Array<{ nome: string; valor: string; pct: number; destaque: boolean }>
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
      <p className="text-sm font-bold text-slate-900 mb-3">{titulo}</p>
      {itens.length === 0 ? (
        <p className="text-sm text-slate-400">{vazio}</p>
      ) : (
        <div className="space-y-2.5">
          {itens.map(i => (
            <div key={i.nome}>
              <div className="flex items-center justify-between gap-3 mb-1">
                <span className="text-xs font-semibold text-slate-700 truncate">{i.nome}</span>
                <span className="text-xs text-slate-500 flex-shrink-0">{i.valor}</span>
              </div>
              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${i.destaque ? 'bg-amber-400' : 'bg-slate-800'}`}
                  style={{ width: `${Math.max(2, Math.round(i.pct * 100))}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
