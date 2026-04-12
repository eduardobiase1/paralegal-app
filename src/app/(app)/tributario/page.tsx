'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  buscarCnaeDB, calcularAliquotaEfetiva, calcularFatorR, calcularLucroPresumido,
  formatarMoeda, formatarPorcentagem,
  CnaeInfo, Anexo, TABELAS_SIMPLES, CNAES_DB,
} from '@/lib/cnaeTax'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseMoeda(v: string): number {
  return parseFloat(v.replace(/\./g, '').replace(',', '.')) || 0
}

function inputMoeda(v: string): string {
  const n = v.replace(/\D/g, '')
  if (!n) return ''
  const num = parseInt(n, 10) / 100
  return num.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
}

// ─── Badges ───────────────────────────────────────────────────────────────────

function BadgeRisco({ nivel }: { nivel: string }) {
  const cor = nivel === 'Alto' ? 'bg-red-100 text-red-700 border-red-200'
    : nivel === 'Médio' ? 'bg-yellow-100 text-yellow-700 border-yellow-200'
    : 'bg-green-100 text-green-700 border-green-200'
  return <span className={`text-[10px] px-2 py-0.5 rounded border font-bold uppercase tracking-wide ${cor}`}>{nivel}</span>
}

function BadgeAnexo({ anexo }: { anexo: string }) {
  const cor = anexo === 'I'   ? 'bg-blue-100 text-blue-700 border-blue-200'
    : anexo === 'II'  ? 'bg-purple-100 text-purple-700 border-purple-200'
    : anexo === 'III' ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
    : anexo === 'IV'  ? 'bg-orange-100 text-orange-700 border-orange-200'
    : anexo === 'V'   ? 'bg-red-100 text-red-700 border-red-200'
    : 'bg-slate-100 text-slate-600 border-slate-200'
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded border font-bold ${cor}`}>
      {anexo === 'impedido' ? '⛔ Impedido' : `Anexo ${anexo}`}
    </span>
  )
}

function BarraComparacao({ label, valor, total, cor }: { label: string; valor: number; total: number; cor: string }) {
  const pct = total > 0 ? Math.min((valor / total) * 100, 100) : 0
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-slate-600">{label}</span>
        <span className="font-semibold">{formatarMoeda(valor)}</span>
      </div>
      <div className="h-5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${cor}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

// ─── Donut Chart (SVG puro, sem dependências) ─────────────────────────────────

function DonutChart({ segments, total }: {
  segments: { label: string; value: number; color: string }[]
  total: number
}) {
  const filtered = segments.filter(s => s.value > 0)
  if (total === 0 || filtered.length === 0) return (
    <div className="text-center py-6 text-slate-300 text-xs">Busque um CNAE para ver a distribuição</div>
  )

  const R = 38, cx = 50, cy = 50
  let cumPct = 0

  const toRad = (d: number) => (d * Math.PI) / 180
  const arcs = filtered.map(seg => {
    const pct = seg.value / total
    const start = cumPct * 360 - 90
    const end = (cumPct + pct) * 360 - 90
    cumPct += pct
    const x1 = cx + R * Math.cos(toRad(start))
    const y1 = cy + R * Math.sin(toRad(start))
    const x2 = cx + R * Math.cos(toRad(end))
    const y2 = cy + R * Math.sin(toRad(end))
    return { ...seg, path: `M${cx} ${cy} L${x1.toFixed(1)} ${y1.toFixed(1)} A${R} ${R} 0 ${pct > 0.5 ? 1 : 0} 1 ${x2.toFixed(1)} ${y2.toFixed(1)}Z`, pct: Math.round(pct * 100) }
  })

  return (
    <div className="flex flex-col items-center gap-3">
      <svg viewBox="0 0 100 100" className="w-32 h-32">
        {arcs.map((a, i) => <path key={i} d={a.path} fill={a.color} stroke="white" strokeWidth="2" />)}
        <circle cx={cx} cy={cy} r={22} fill="white" />
        <text x={cx} y={cy - 4} textAnchor="middle" fontSize="10" fontWeight="bold" fill="#0f172a">{total}</text>
        <text x={cx} y={cy + 8} textAnchor="middle" fontSize="7" fill="#94a3b8">CNAEs</text>
      </svg>
      <div className="w-full space-y-1.5 text-xs">
        {arcs.map((a, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: a.color }} />
            <span className="text-slate-600 flex-1 min-w-0 truncate">{a.label}</span>
            <span className="font-black text-slate-800">{a.value}</span>
            <span className="text-slate-400">({a.pct}%)</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Card de CNAE (alta densidade) ────────────────────────────────────────────

function CnaeCard({
  cnae, selected, onSelect, onSimular, onFatorR, onLicencas,
}: {
  cnae: CnaeInfo
  selected: boolean
  onSelect: () => void
  onSimular: () => void
  onFatorR: () => void
  onLicencas: () => void
}) {
  const isImpedido = cnae.impedidoSimples
  const hasFatorR = cnae.fatorRAplicavel && !isImpedido

  return (
    <div className={`border-2 rounded-2xl overflow-hidden transition-all duration-150 ${
      selected
        ? 'border-slate-900 shadow-lg bg-white'
        : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-md'
    }`}>
      {/* Header do card */}
      <div
        className="p-4 cursor-pointer"
        onClick={onSelect}
      >
        {/* Linha 1: código + badges */}
        <div className="flex items-start gap-2 flex-wrap mb-2">
          <span className="font-mono text-[11px] font-black bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">
            {cnae.codigo}
          </span>
          {cnae.temFiscal ? (
            isImpedido ? (
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200">⛔ Impedido Simples</span>
            ) : (
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">✅ Simples Nacional</span>
            )
          ) : (
            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-slate-50 text-slate-400 border border-slate-200">❓ Não mapeado</span>
          )}
          {cnae.temFiscal && !isImpedido && <BadgeAnexo anexo={cnae.anexoSimples} />}
          {hasFatorR && (
            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200">📊 Fator R</span>
          )}
          {cnae.conselhoClasse && (
            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">{cnae.conselhoClasse}</span>
          )}
        </div>

        {/* Descrição */}
        <p className="text-sm font-semibold text-slate-800 leading-snug mb-3">{cnae.descricao}</p>

        {/* Linha 3: riscos + licenças */}
        <div className="flex items-center gap-3 flex-wrap text-[10px] text-slate-500">
          <span className="flex items-center gap-1">
            <span>🏥</span>
            <span>Vig.: </span>
            <BadgeRisco nivel={cnae.riscoVigilancia} />
          </span>
          <span className="flex items-center gap-1">
            <span>🚒</span>
            <span>Bomb.: </span>
            <BadgeRisco nivel={cnae.riscoBombeiros} />
          </span>
          <span className="flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-full font-bold text-slate-600">
            📋 {cnae.licencasObrigatorias.length} licença{cnae.licencasObrigatorias.length !== 1 ? 's' : ''}
          </span>
          <span className="capitalize bg-slate-100 px-2 py-0.5 rounded-full font-bold text-slate-600">
            {cnae.tipoAtividade}
          </span>
        </div>
      </div>

      {/* Botões de ação */}
      <div className="border-t border-slate-100 px-4 py-2.5 flex gap-2 bg-slate-50">
        <button
          onClick={onSelect}
          className={`flex-1 text-[10px] font-black uppercase px-2 py-1.5 rounded-lg transition-all ${
            selected ? 'bg-slate-900 text-yellow-400' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
          }`}
        >
          {selected ? '✓ Selecionado' : 'Ver Detalhes'}
        </button>
        <button
          onClick={onSimular}
          className="text-[10px] font-black uppercase px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 transition-all"
        >
          ⚖️ Simular
        </button>
        {hasFatorR && (
          <button
            onClick={onFatorR}
            className="text-[10px] font-black uppercase px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-700 transition-all"
          >
            📊 Fator R
          </button>
        )}
        <button
          onClick={onLicencas}
          className="text-[10px] font-black uppercase px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-green-50 hover:border-green-200 hover:text-green-700 transition-all"
        >
          ✅ Lic.
        </button>
      </div>
    </div>
  )
}

// ─── Página Principal ─────────────────────────────────────────────────────────

type TabKey = 'cnae' | 'simulador' | 'fatorr' | 'licencas' | 'tags'

export default function TributarioPage() {
  const [tab, setTab] = useState<TabKey>('cnae')
  const [cnaeAtual, setCnaeAtual] = useState<CnaeInfo | null>(null)

  const TABS: { key: TabKey; label: string; icon: string }[] = [
    { key: 'cnae',      label: 'Consulta CNAE',        icon: '🔍' },
    { key: 'simulador', label: 'Comparador de Regimes', icon: '⚖️' },
    { key: 'fatorr',    label: 'Simulador Fator R',     icon: '📊' },
    { key: 'licencas',  label: 'Checklist de Licenças', icon: '✅' },
    { key: 'tags',      label: 'Tags de Segmento',      icon: '🏷️' },
  ]

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans">

      {/* ── Hero Header ───────────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white px-4 md:px-8 pt-8 pb-0">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">🧠</span>
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-yellow-400">Portal de Inteligência Contábil</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-black tracking-tight leading-tight">
                Estrategista Tributário & CNAE
              </h1>
              <p className="text-slate-400 text-sm mt-1.5 max-w-xl">
                Análise consultiva de viabilidade, carga tributária, anexo do Simples Nacional e licenciamento por atividade econômica.
              </p>
              <div className="flex items-center gap-1.5 mt-2 text-slate-400 text-xs">
                <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span>Sua ferramenta de inteligência contábil local em <span className="text-yellow-400 font-bold">Osasco/SP</span></span>
              </div>
            </div>

            {/* Estatísticas */}
            <div className="flex gap-4 flex-shrink-0">
              {[
                { val: '1.300+', label: 'CNAEs' },
                { val: '5', label: 'Anexos Simples' },
                { val: '3', label: 'Regimes' },
              ].map(s => (
                <div key={s.label} className="text-center">
                  <p className="text-xl font-black text-yellow-400">{s.val}</p>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">{s.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-0 overflow-x-auto">
            {TABS.map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex items-center gap-1.5 px-4 py-3 text-xs font-black uppercase tracking-wide whitespace-nowrap border-b-2 transition-all ${
                  tab === t.key
                    ? 'border-yellow-400 text-yellow-400'
                    : 'border-transparent text-slate-500 hover:text-slate-300'
                }`}
              >
                <span>{t.icon}</span> {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Conteúdo das Tabs ──────────────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-4 md:px-8 py-6">
        {tab === 'cnae'      && <TabConsultaCnae cnaeAtual={cnaeAtual} setCnaeAtual={setCnaeAtual} setTab={setTab} />}
        {tab === 'simulador' && <TabSimulador cnaeAtual={cnaeAtual} />}
        {tab === 'fatorr'    && <TabFatorR cnaeAtual={cnaeAtual} />}
        {tab === 'licencas'  && <TabLicencas cnaeAtual={cnaeAtual} />}
        {tab === 'tags'      && <TabTagsSegmento setCnaeAtual={setCnaeAtual} setTab={setTab} />}
      </div>
    </div>
  )
}

// ─── Tab 1: Consulta CNAE (redesenhada) ──────────────────────────────────────

function TabConsultaCnae({ cnaeAtual, setCnaeAtual, setTab }: {
  cnaeAtual: CnaeInfo | null
  setCnaeAtual: (c: CnaeInfo) => void
  setTab: (t: TabKey) => void
}) {
  const [supabase] = useState(createClient)
  const [query, setQuery] = useState('')
  const [resultados, setResultados] = useState<CnaeInfo[]>([])
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!query.trim() || query.trim().length < 2) { setResultados([]); setLoading(false); return }
    setLoading(true)
    debounceRef.current = setTimeout(async () => {
      const res = await buscarCnaeDB(query, supabase)
      setResultados(res)
      setLoading(false)
    }, 350)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, supabase])

  // Distribuição de regimes nos resultados (para o gráfico)
  const distribuicao = useMemo(() => {
    const base = resultados.length > 0 ? resultados : (cnaeAtual ? [cnaeAtual] : [])
    const counts = { I: 0, II: 0, III: 0, IV: 0, V: 0, impedido: 0, nao_mapeado: 0 }
    base.forEach(c => {
      if (!c.temFiscal) counts.nao_mapeado++
      else if (c.impedidoSimples) counts.impedido++
      else counts[c.anexoSimples as keyof typeof counts] = (counts[c.anexoSimples as keyof typeof counts] as number || 0) + 1
    })
    return [
      { label: 'Anexo I (Comércio)',    value: counts.I,          color: '#3b82f6' },
      { label: 'Anexo II (Indústria)',  value: counts.II,         color: '#8b5cf6' },
      { label: 'Anexo III (Serv. CPP)', value: counts.III,        color: '#10b981' },
      { label: 'Anexo IV (Serv. s/CPP)',value: counts.IV,         color: '#f97316' },
      { label: 'Anexo V (Alta esp.)',   value: counts.V,          color: '#ef4444' },
      { label: 'Impedido Simples',      value: counts.impedido,   color: '#dc2626' },
      { label: 'Não mapeado',           value: counts.nao_mapeado,color: '#94a3b8' },
    ]
  }, [resultados, cnaeAtual])

  const totalDist = useMemo(() => distribuicao.reduce((s, d) => s + d.value, 0), [distribuicao])

  const mostrando = resultados.length > 0 ? resultados : (cnaeAtual && !query ? [] : [])

  return (
    <div className="space-y-5">

      {/* ── Barra de busca central ── */}
      <div className="max-w-2xl mx-auto">
        <div className="relative">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
            {loading ? (
              <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            )}
          </div>
          <input
            className="w-full bg-white border-2 border-slate-200 rounded-2xl py-3.5 pl-11 pr-12 text-sm font-medium outline-none focus:border-slate-900 transition-all shadow-sm placeholder-slate-400"
            placeholder="Buscar CNAE por código (ex: 8211) ou descrição (ex: contabilidade)..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            autoFocus
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 text-xs font-black"
            >✕</button>
          )}
        </div>
        <p className="text-xs text-slate-400 mt-2 text-center">
          Base com +1.300 CNAEs — inclui análise de Simples Nacional, Fator R e licenciamento
        </p>
      </div>

      {/* ── Nenhum resultado ── */}
      {query.length >= 2 && !loading && resultados.length === 0 && (
        <p className="text-sm text-slate-400 text-center py-8">Nenhum CNAE encontrado para &ldquo;{query}&rdquo;</p>
      )}

      {/* ── Layout 2 colunas: resultados + gráfico ── */}
      {(mostrando.length > 0 || cnaeAtual) && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* Coluna esquerda: cards */}
          <div className="lg:col-span-2 space-y-3">
            {mostrando.length > 0 && (
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                {mostrando.length} resultado{mostrando.length !== 1 ? 's' : ''} encontrado{mostrando.length !== 1 ? 's' : ''}
              </p>
            )}

            {mostrando.map(c => (
              <CnaeCard
                key={c.codigo}
                cnae={c}
                selected={cnaeAtual?.codigo === c.codigo}
                onSelect={() => { setCnaeAtual(c); setQuery(''); setResultados([]) }}
                onSimular={() => { setCnaeAtual(c); setQuery(''); setResultados([]); setTab('simulador') }}
                onFatorR={() => { setCnaeAtual(c); setQuery(''); setResultados([]); setTab('fatorr') }}
                onLicencas={() => { setCnaeAtual(c); setQuery(''); setResultados([]); setTab('licencas') }}
              />
            ))}

            {/* Ficha expandida do CNAE selecionado */}
            {cnaeAtual && !query && resultados.length === 0 && (
              <CnaeFichaCompleta cnae={cnaeAtual} setTab={setTab} />
            )}
          </div>

          {/* Coluna direita: gráfico + estatísticas */}
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">
                {resultados.length > 0 ? 'Distribuição dos Resultados' : 'CNAE Selecionado'}
              </p>
              <DonutChart segments={distribuicao} total={totalDist} />
            </div>

            {/* Dicas contextuais */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Referência Rápida</p>
              {[
                { cor: 'bg-emerald-500', label: 'Anexo III', desc: 'Serviços com CPP — alíq. 6% na 1ª faixa' },
                { cor: 'bg-indigo-500',  label: 'Fator R',   desc: 'Folha ≥ 28% fatura → Anexo III vs V' },
                { cor: 'bg-red-500',     label: 'Impedido',  desc: 'Só Lucro Presumido ou Real' },
                { cor: 'bg-amber-500',   label: 'Conselho',  desc: 'RT obrigatório — CRM, CREA, OAB...' },
              ].map(r => (
                <div key={r.label} className="flex items-center gap-2.5 text-xs">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${r.cor}`} />
                  <span className="font-bold text-slate-700 w-16 flex-shrink-0">{r.label}</span>
                  <span className="text-slate-500">{r.desc}</span>
                </div>
              ))}
            </div>

            {/* Dica Osasco */}
            <div className="bg-slate-900 rounded-2xl p-4 text-xs text-slate-400 space-y-1">
              <p className="font-black text-yellow-400 text-[10px] uppercase tracking-widest">📍 Osasco/SP</p>
              <p>ISS municipal: <span className="text-white font-bold">2% a 5%</span> conforme atividade</p>
              <p>Alvará Digital disponível pelo portal <span className="text-white">poupatempo.sp.gov.br</span></p>
            </div>
          </div>
        </div>
      )}

      {/* Estado inicial (sem busca, sem seleção) */}
      {!query && !cnaeAtual && (
        <div className="text-center py-16 text-slate-300">
          <div className="text-5xl mb-4">🔍</div>
          <p className="text-slate-500 font-semibold text-base">Digite um código ou descrição para começar</p>
          <p className="text-slate-400 text-sm mt-2">Ex: <button onClick={() => setQuery('8211')} className="text-blue-500 hover:underline">8211</button> · <button onClick={() => setQuery('comércio')} className="text-blue-500 hover:underline">comércio</button> · <button onClick={() => setQuery('saúde')} className="text-blue-500 hover:underline">saúde</button> · <button onClick={() => setQuery('construção')} className="text-blue-500 hover:underline">construção</button></p>
        </div>
      )}
    </div>
  )
}

// ─── Ficha completa do CNAE selecionado ──────────────────────────────────────

function CnaeFichaCompleta({ cnae, setTab }: { cnae: CnaeInfo; setTab: (t: TabKey) => void }) {
  return (
    <div className="bg-white rounded-2xl border-2 border-slate-900 shadow-lg overflow-hidden">
      <div className="bg-slate-900 text-white px-5 py-3 flex items-center justify-between">
        <span className="text-[10px] font-black uppercase tracking-widest text-yellow-400">CNAE Selecionado</span>
        <span className="font-mono text-xs text-slate-400">{cnae.codigo}</span>
      </div>

      <div className="p-5 space-y-4">
        <p className="font-bold text-slate-900 text-base">{cnae.descricao}</p>

        {/* Banner Simples */}
        {cnae.temFiscal ? (
          cnae.impedidoSimples ? (
            <div className="rounded-xl border-2 border-red-300 bg-red-50 p-4 flex items-start gap-3">
              <span className="text-2xl">⛔</span>
              <div>
                <p className="font-black text-red-800">IMPEDIDO AO SIMPLES NACIONAL</p>
                <p className="text-sm text-red-700 mt-0.5">{cnae.motivoImpedimento ?? 'Atividade vedada pela LC 123/2006'}</p>
                <p className="text-xs text-red-600 mt-1">Regimes: <strong>Lucro Presumido</strong> ou <strong>Lucro Real</strong></p>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border-2 border-emerald-300 bg-emerald-50 p-4 flex items-start gap-3">
              <span className="text-2xl">✅</span>
              <div className="flex-1">
                <p className="font-black text-emerald-800">ELEGÍVEL AO SIMPLES NACIONAL</p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <BadgeAnexo anexo={cnae.anexoSimples} />
                  <span className="text-sm text-emerald-700">{TABELAS_SIMPLES[cnae.anexoSimples as Anexo]?.nome ?? ''}</span>
                </div>
                {cnae.fatorRAplicavel && (
                  <p className="text-xs text-indigo-700 mt-1.5">📊 <strong>Fator R aplicável</strong> — folha ≥ 28% do faturamento pode migrar para Anexo III</p>
                )}
                <p className="text-xs text-emerald-600 mt-2 border-t border-emerald-200 pt-2">⚠️ Análise indicativa — confirme com o contador.</p>
              </div>
            </div>
          )
        ) : (
          <div className="rounded-xl border-2 border-slate-200 bg-slate-50 p-4 flex items-start gap-3">
            <span className="text-2xl">❓</span>
            <div>
              <p className="font-black text-slate-700">SIMPLES NACIONAL — NÃO MAPEADO</p>
              <p className="text-sm text-slate-500 mt-0.5">Consulte seu contador para verificar a elegibilidade.</p>
            </div>
          </div>
        )}

        {/* Grid de detalhes */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          {[
            ['Tipo de Atividade', cnae.tipoAtividade],
            ['Risco Vigilância Sanitária', <BadgeRisco key="v" nivel={cnae.riscoVigilancia} />],
            ['Risco Bombeiros', <BadgeRisco key="b" nivel={cnae.riscoBombeiros} />],
            ['Conselho de Classe', cnae.conselhoClasse || '—'],
          ].map(([label, val]) => (
            <div key={label as string} className="bg-slate-50 rounded-xl p-3">
              <p className="text-[9px] text-slate-400 font-black uppercase tracking-wide mb-1">{label as string}</p>
              <div className="font-semibold capitalize text-slate-800">{val as any}</div>
            </div>
          ))}
        </div>

        {/* Observações */}
        {cnae.observacoes && (
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-xl text-sm text-yellow-800">
            <p className="font-bold">ℹ️ Atenção</p>
            <p className="text-xs mt-0.5">{cnae.observacoes}</p>
          </div>
        )}

        {/* Licenças */}
        <div>
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-wide mb-2">Licenças Obrigatórias</p>
          <div className="space-y-1">
            {cnae.licencasObrigatorias.map((l, i) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                <span className="text-emerald-500 mt-0.5 flex-shrink-0">✓</span>
                <span className="text-slate-700">{l}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Atalhos */}
        <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
          {!cnae.impedidoSimples && (
            <button onClick={() => setTab('simulador')} className="text-xs font-bold bg-slate-100 hover:bg-blue-100 text-slate-700 hover:text-blue-700 px-3 py-1.5 rounded-lg transition-all">⚖️ Comparar Regimes →</button>
          )}
          {cnae.fatorRAplicavel && (
            <button onClick={() => setTab('fatorr')} className="text-xs font-bold bg-slate-100 hover:bg-indigo-100 text-slate-700 hover:text-indigo-700 px-3 py-1.5 rounded-lg transition-all">📊 Simular Fator R →</button>
          )}
          <button onClick={() => setTab('licencas')} className="text-xs font-bold bg-slate-100 hover:bg-emerald-100 text-slate-700 hover:text-emerald-700 px-3 py-1.5 rounded-lg transition-all">✅ Checklist de Licenças →</button>
        </div>
      </div>
    </div>
  )
}

// ─── Tab 2: Comparador de Regimes ─────────────────────────────────────────────

function TabSimulador({ cnaeAtual }: { cnaeAtual: CnaeInfo | null }) {
  const [receitaStr, setReceitaStr] = useState('')
  const [folhaStr, setFolhaStr] = useState('')
  const [aliquotaIss, setAliquotaIss] = useState('3')
  const [mostrar, setMostrar] = useState(false)

  const receitaMensal = parseMoeda(receitaStr)
  const rbt12 = receitaMensal * 12
  const folha12 = parseMoeda(folhaStr) * 12

  const anexo: Anexo = cnaeAtual && !cnaeAtual.impedidoSimples
    ? (cnaeAtual.fatorRAplicavel ? calcularFatorR(folha12, rbt12).anexoAplicavel : cnaeAtual.anexoSimples as Anexo)
    : 'III'

  const simples = calcularAliquotaEfetiva(rbt12, anexo)
  const simplMensal = simples.impostoMensal
  const tipoAtv = cnaeAtual?.tipoAtividade ?? 'servico'
  const lp = calcularLucroPresumido(receitaMensal, tipoAtv, parseFloat(aliquotaIss) || 3)
  const economiaSimples = lp.total - simplMensal
  const maisBarato = economiaSimples > 0 ? 'Simples Nacional' : 'Lucro Presumido'
  const diferenca = Math.abs(economiaSimples)
  const maiorTotal = Math.max(simplMensal, lp.total)

  return (
    <div className="space-y-5 max-w-2xl">
      {cnaeAtual && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-sm flex items-center gap-2">
          <span>🔍</span>
          <span className="text-blue-800">Analisando: <strong>{cnaeAtual.descricao}</strong>{cnaeAtual.fatorRAplicavel && ' — Fator R aplicável'}</span>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
        <h2 className="font-bold text-slate-900">Dados para Simulação</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wide block mb-1">Receita Bruta Mensal *</label>
            <input className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-mono outline-none focus:border-slate-400" placeholder="Ex: 50.000,00" value={receitaStr} onChange={e => setReceitaStr(inputMoeda(e.target.value))} />
            {receitaMensal > 0 && <p className="text-xs text-slate-400 mt-1">Anual: {formatarMoeda(rbt12)}</p>}
          </div>
          {(cnaeAtual?.fatorRAplicavel || !cnaeAtual) && (
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wide block mb-1">Folha de Pagamento Mensal</label>
              <input className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-mono outline-none focus:border-slate-400" placeholder="Ex: 15.000,00" value={folhaStr} onChange={e => setFolhaStr(inputMoeda(e.target.value))} />
            </div>
          )}
          {tipoAtv === 'servico' && (
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wide block mb-1">Alíquota ISS Municipal (%)</label>
              <input className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm outline-none focus:border-slate-400" placeholder="2 a 5" value={aliquotaIss} onChange={e => setAliquotaIss(e.target.value)} />
            </div>
          )}
        </div>
        <div className="flex justify-end">
          <button className="bg-slate-900 text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-slate-700 transition-all disabled:opacity-40" disabled={receitaMensal <= 0} onClick={() => setMostrar(true)}>Calcular →</button>
        </div>
      </div>

      {mostrar && receitaMensal > 0 && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {[
              { title: 'Simples Nacional', value: simplMensal, anual: simples.impostoAnual, badge: <BadgeAnexo anexo={anexo} />, extra: <><div className="flex justify-between text-sm text-slate-600"><span>Alíquota nominal</span><span className="font-medium">{formatarPorcentagem(simples.aliquotaNominal)}</span></div><div className="flex justify-between text-sm text-slate-600"><span>Alíquota efetiva</span><span className="font-medium text-emerald-700">{formatarPorcentagem(simples.aliquotaEfetiva)}</span></div></>, best: maisBarato === 'Simples Nacional' },
            ].map(c => (
              <div key={c.title} className={`bg-white rounded-2xl border-2 p-5 space-y-3 ${c.best ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200'}`}>
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-slate-900 text-sm">{c.title}</h3>
                  {c.best && <span className="text-[10px] bg-emerald-600 text-white px-2 py-0.5 rounded-full font-bold">✓ Mais barato</span>}
                </div>
                {c.badge}
                <div className="text-2xl font-black text-slate-900">{formatarMoeda(c.value)}<span className="text-sm font-normal text-slate-500">/mês</span></div>
                <div className="space-y-1">{c.extra}</div>
                <div className="flex justify-between text-sm font-bold border-t pt-1"><span>Anual</span><span>{formatarMoeda(c.anual)}</span></div>
              </div>
            ))}
            <div className={`bg-white rounded-2xl border-2 p-5 space-y-3 ${maisBarato === 'Lucro Presumido' ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200'}`}>
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-900 text-sm">Lucro Presumido</h3>
                {maisBarato === 'Lucro Presumido' && <span className="text-[10px] bg-emerald-600 text-white px-2 py-0.5 rounded-full font-bold">✓ Mais barato</span>}
              </div>
              <div className="text-2xl font-black text-slate-900">{formatarMoeda(lp.total)}<span className="text-sm font-normal text-slate-500">/mês</span></div>
              <div className="space-y-1 text-sm text-slate-600">
                {[['IRPJ', lp.irpj],['CSLL',lp.csll],['PIS',lp.pis],['COFINS',lp.cofins],tipoAtv==='servico'?[`ISS (${aliquotaIss}%)`,lp.iss]:null,['INSS Patronal',lp.cpp]].filter(Boolean).map(([l,v]:any) => <div key={l} className="flex justify-between"><span>{l}</span><span>{formatarMoeda(v)}</span></div>)}
                <div className="flex justify-between font-bold border-t pt-1"><span>Alíquota efetiva</span><span>{formatarPorcentagem(lp.aliquotaEfetiva)}</span></div>
                <div className="flex justify-between font-bold"><span>Anual</span><span>{formatarMoeda(lp.total*12)}</span></div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
            <h3 className="font-bold text-slate-900 text-sm">Comparação Visual (mensal)</h3>
            <BarraComparacao label="Simples Nacional" valor={simplMensal} total={maiorTotal} cor="bg-blue-500" />
            <BarraComparacao label="Lucro Presumido" valor={lp.total} total={maiorTotal} cor="bg-orange-500" />
          </div>

          <div className={`p-4 rounded-2xl border-2 ${economiaSimples > 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-orange-50 border-orange-200'}`}>
            <p className="text-sm font-black text-slate-900">💡 Recomendação: <span className={economiaSimples > 0 ? 'text-emerald-700' : 'text-orange-700'}>{maisBarato}</span></p>
            <p className="text-sm text-slate-700 mt-1">Economia estimada de <strong>{formatarMoeda(diferenca)}/mês</strong> ({formatarMoeda(diferenca * 12)}/ano)</p>
            <p className="text-xs text-slate-500 mt-2">⚠️ Simulação estimada. Confirme com o contador.</p>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Tab 3: Fator R ───────────────────────────────────────────────────────────

function TabFatorR({ cnaeAtual }: { cnaeAtual: CnaeInfo | null }) {
  const [receitaStr, setReceitaStr] = useState('')
  const [folhaStr, setFolhaStr]     = useState('')
  const [mostrar, setMostrar]       = useState(false)

  const receita12 = parseMoeda(receitaStr) * 12
  const folha12   = parseMoeda(folhaStr) * 12
  const resultado = mostrar && receita12 > 0 ? calcularFatorR(folha12, receita12) : null
  const iii = receita12 > 0 ? calcularAliquotaEfetiva(receita12, 'III') : null
  const v   = receita12 > 0 ? calcularAliquotaEfetiva(receita12, 'V')   : null
  const aplicavel = cnaeAtual?.fatorRAplicavel ?? true

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-2xl space-y-2">
        <p className="text-sm font-bold text-indigo-800">O que é o Fator R?</p>
        <p className="text-sm text-indigo-700">Relação entre <strong>folha de pagamento 12 meses</strong> e <strong>faturamento 12 meses</strong>.</p>
        <p className="text-sm text-indigo-700">Fator R <strong>≥ 28%</strong> → <strong>Anexo III</strong> &nbsp;|&nbsp; Fator R <strong>{'< 28%'}</strong> → <strong>Anexo V</strong></p>
        {cnaeAtual && !aplicavel && (
          <p className="text-xs text-red-600 font-bold">⚠️ {cnaeAtual.codigo} não usa Fator R — fixo no Anexo {cnaeAtual.anexoSimples}.</p>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
        <h2 className="font-bold text-slate-900">Dados dos últimos 12 meses</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wide block mb-1">Receita Bruta Mensal Média</label>
            <input className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-mono outline-none focus:border-slate-400" placeholder="Ex: 50.000,00" value={receitaStr} onChange={e => setReceitaStr(inputMoeda(e.target.value))} />
            {receita12 > 0 && <p className="text-xs text-slate-400 mt-1">Total: {formatarMoeda(receita12)}</p>}
          </div>
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wide block mb-1">Folha de Pagamento Mensal Média</label>
            <input className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-mono outline-none focus:border-slate-400" placeholder="Ex: 15.000,00" value={folhaStr} onChange={e => setFolhaStr(inputMoeda(e.target.value))} />
            <p className="text-xs text-slate-400 mt-1">Inclui pró-labore, salários e FGTS</p>
          </div>
        </div>
        <div className="flex justify-end">
          <button className="bg-slate-900 text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-slate-700 transition-all disabled:opacity-40" disabled={receita12 <= 0} onClick={() => setMostrar(true)}>Calcular Fator R →</button>
        </div>
      </div>

      {resultado && iii && v && (
        <div className="space-y-4">
          <div className={`bg-white rounded-2xl border-2 p-5 text-center ${resultado.anexoAplicavel === 'III' ? 'border-emerald-300 bg-emerald-50' : 'border-orange-300 bg-orange-50'}`}>
            <p className="text-4xl font-black tabular-nums mb-1" style={{ color: resultado.anexoAplicavel === 'III' ? '#16a34a' : '#ea580c' }}>{formatarPorcentagem(resultado.fatorR)}</p>
            <p className="text-sm text-slate-600 font-medium mb-2">Fator R atual</p>
            <div className="inline-flex items-center gap-2"><BadgeAnexo anexo={resultado.anexoAplicavel} /><span className="text-sm text-slate-700">aplicável</span></div>
            <div className="mt-4 mx-auto max-w-sm">
              <div className="relative h-4 bg-slate-200 rounded-full">
                <div className={`h-full rounded-full transition-all duration-700 ${resultado.fatorR >= 28 ? 'bg-emerald-500' : 'bg-orange-500'}`} style={{ width: `${Math.min(resultado.fatorR, 50) * 2}%` }} />
                <div className="absolute top-0 h-full w-0.5 bg-slate-600" style={{ left: '56%' }} />
                <span className="absolute -top-5 text-xs text-slate-600 font-bold" style={{ left: '54%' }}>28%</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {[{ a: 'III' as Anexo, data: iii, current: resultado.anexoAplicavel === 'III' }, { a: 'V' as Anexo, data: v, current: resultado.anexoAplicavel === 'V' }].map(({ a, data, current }) => (
              <div key={a} className={`bg-white rounded-2xl border-2 p-4 space-y-2 ${current ? (a === 'III' ? 'border-emerald-300' : 'border-orange-300') : 'border-slate-200'}`}>
                <div className="flex items-center justify-between"><BadgeAnexo anexo={a} />{current && <span className={`text-xs font-bold ${a === 'III' ? 'text-emerald-600' : 'text-orange-600'}`}>✓ Atual</span>}</div>
                <p className="text-xl font-black text-slate-900">{formatarMoeda(data.impostoMensal)}<span className="text-xs font-normal text-slate-500">/mês</span></p>
                <p className="text-xs text-slate-500">Alíq. efetiva: {formatarPorcentagem(data.aliquotaEfetiva)}</p>
              </div>
            ))}
          </div>

          {resultado.anexoAplicavel === 'V' && resultado.economia > 0 && (
            <div className="bg-white rounded-2xl border border-amber-200 bg-amber-50 p-4 space-y-2">
              <p className="text-sm font-bold text-amber-800">📌 Como migrar para o Anexo III</p>
              <p className="text-sm text-amber-700">Folha mínima necessária: <strong>{formatarMoeda(resultado.folhaNecessaria / 12)}/mês</strong> (faltam {formatarMoeda(resultado.folhaNecessaria / 12 - folha12 / 12)}/mês)</p>
              <p className="text-sm text-amber-700">Economia potencial: <strong>{formatarMoeda(resultado.economia / 12)}/mês</strong> ({formatarMoeda(resultado.economia)}/ano)</p>
            </div>
          )}
          {resultado.anexoAplicavel === 'III' && (
            <div className="bg-white rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-sm font-bold text-emerald-800">✅ Você já está no Anexo III</p>
              <p className="text-sm text-emerald-700 mt-1">Economia vs Anexo V: <strong>{formatarMoeda(resultado.economia / 12)}/mês</strong> · Mantenha folha ≥ 28% do faturamento.</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Tab 4: Checklist de Licenças ─────────────────────────────────────────────

function TabLicencas({ cnaeAtual }: { cnaeAtual: CnaeInfo | null }) {
  const [checados, setChecados] = useState<Set<string>>(new Set())
  const toggle = (item: string) => setChecados(prev => { const n = new Set(prev); n.has(item) ? n.delete(item) : n.add(item); return n })

  if (!cnaeAtual) return (
    <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center">
      <p className="text-4xl mb-3">🔍</p>
      <p className="font-bold text-slate-600">Nenhum CNAE selecionado</p>
      <p className="text-sm text-slate-400 mt-1">Consulte um CNAE na aba "Consulta CNAE" para ver o checklist.</p>
    </div>
  )

  const total = cnaeAtual.licencasObrigatorias.length + (cnaeAtual.conselhoClasse ? 1 : 0)
  const concluidos = checados.size
  const pct = total > 0 ? Math.round((concluidos / total) * 100) : 0

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="bg-white rounded-2xl border border-slate-200 p-4">
        <div className="flex items-center justify-between mb-2">
          <div><p className="font-bold text-slate-900 text-sm">{cnaeAtual.descricao}</p><p className="text-xs text-slate-400 font-mono">{cnaeAtual.codigo}</p></div>
          <div className="text-right"><p className="text-2xl font-black text-slate-900">{pct}%</p><p className="text-xs text-slate-400">{concluidos}/{total} itens</p></div>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {[{ icon: '🏥', label: 'Vigilância Sanitária', risco: cnaeAtual.riscoVigilancia }, { icon: '🚒', label: 'Corpo de Bombeiros', risco: cnaeAtual.riscoBombeiros }].map(r => (
          <div key={r.label} className="bg-white rounded-2xl border border-slate-200 p-3 flex items-center gap-3">
            <span className="text-xl">{r.icon}</span>
            <div><p className="text-xs text-slate-500">{r.label}</p><BadgeRisco nivel={r.risco} /></div>
          </div>
        ))}
      </div>

      {cnaeAtual.conselhoClasse && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <h3 className="text-sm font-bold text-amber-800 mb-3 flex items-center gap-2">🏛️ Conselho de Classe Obrigatório</h3>
          <label className={`flex items-center gap-3 p-3 border-2 rounded-xl cursor-pointer transition-all ${checados.has('conselho') ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 hover:border-slate-300'}`} onClick={() => toggle('conselho')}>
            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${checados.has('conselho') ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300'}`}>{checados.has('conselho') && <span className="text-white text-xs">✓</span>}</div>
            <div><p className="text-sm font-medium text-slate-800">Registro {cnaeAtual.conselhoClasse}</p><p className="text-xs text-slate-500">RT inscrito e em situação regular</p></div>
          </label>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 p-4">
        <h3 className="text-sm font-bold text-slate-900 mb-3">Licenças e Documentos</h3>
        <div className="space-y-2">
          {cnaeAtual.licencasObrigatorias.map((item, i) => (
            <label key={i} className={`flex items-center gap-3 p-3 border-2 rounded-xl cursor-pointer transition-all ${checados.has(item) ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 hover:border-slate-300'}`} onClick={() => toggle(item)}>
              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${checados.has(item) ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300'}`}>{checados.has(item) && <span className="text-white text-xs">✓</span>}</div>
              <span className={`text-sm ${checados.has(item) ? 'line-through text-slate-400' : 'text-slate-800'}`}>{item}</span>
            </label>
          ))}
        </div>
      </div>

      {cnaeAtual.observacoes && (
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-2xl text-sm text-yellow-800">
          <p className="font-bold mb-1">⚠️ Observações</p>
          <p>{cnaeAtual.observacoes}</p>
        </div>
      )}

      {pct === 100 && (
        <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-2xl text-center">
          <p className="text-2xl mb-1">🎉</p>
          <p className="text-sm font-bold text-emerald-800">Checklist concluído!</p>
        </div>
      )}
    </div>
  )
}

// ─── Tab 5: Tags de Segmento ──────────────────────────────────────────────────

function TabTagsSegmento({ setCnaeAtual, setTab }: {
  setCnaeAtual: (c: CnaeInfo) => void
  setTab: (t: TabKey) => void
}) {
  const [filtro, setFiltro] = useState<string | null>(null)

  const SEGMENTOS = [
    { key: 'comercio',    label: '🛒 Comércio',           color: 'bg-blue-100 text-blue-800 border-blue-200',     filtro: (c: CnaeInfo) => c.tipoAtividade === 'comercio' },
    { key: 'industria',   label: '🏭 Indústria',          color: 'bg-purple-100 text-purple-800 border-purple-200', filtro: (c: CnaeInfo) => c.tipoAtividade === 'industria' },
    { key: 'servicos',    label: '💼 Serviços',           color: 'bg-emerald-100 text-emerald-800 border-emerald-200', filtro: (c: CnaeInfo) => c.tipoAtividade === 'servico' },
    { key: 'fatorr',      label: '📊 Com Fator R',        color: 'bg-indigo-100 text-indigo-800 border-indigo-200', filtro: (c: CnaeInfo) => c.fatorRAplicavel === true },
    { key: 'impedido',    label: '⛔ Impedidos Simples',  color: 'bg-red-100 text-red-800 border-red-200',          filtro: (c: CnaeInfo) => c.impedidoSimples === true },
    { key: 'alto_risco',  label: '🏥 Alto Risco Sanitário',color: 'bg-orange-100 text-orange-800 border-orange-200', filtro: (c: CnaeInfo) => c.riscoVigilancia === 'Alto' },
    { key: 'bombeiros',   label: '🚒 Alto Risco Bombeiros',color: 'bg-rose-100 text-rose-800 border-rose-200',       filtro: (c: CnaeInfo) => c.riscoBombeiros === 'Alto' },
    { key: 'conselho',    label: '🏛️ Exige Conselho',    color: 'bg-amber-100 text-amber-800 border-amber-200',    filtro: (c: CnaeInfo) => !!c.conselhoClasse },
    { key: 'anexo_i',     label: 'Anexo I',               color: 'bg-blue-100 text-blue-700 border-blue-200',       filtro: (c: CnaeInfo) => c.anexoSimples === 'I' },
    { key: 'anexo_iii',   label: 'Anexo III',             color: 'bg-emerald-100 text-emerald-700 border-emerald-200', filtro: (c: CnaeInfo) => c.anexoSimples === 'III' },
    { key: 'anexo_iv',    label: 'Anexo IV',              color: 'bg-orange-100 text-orange-700 border-orange-200', filtro: (c: CnaeInfo) => c.anexoSimples === 'IV' },
    { key: 'anexo_v',     label: 'Anexo V',               color: 'bg-red-100 text-red-700 border-red-200',          filtro: (c: CnaeInfo) => c.anexoSimples === 'V' },
  ]

  const mapeados = CNAES_DB.filter(c => c.temFiscal !== false)
  const segComContagem = SEGMENTOS.map(s => ({ ...s, count: mapeados.filter(s.filtro).length }))
  const segAtual = filtro ? SEGMENTOS.find(s => s.key === filtro) : null
  const cnaesFiltrados = segAtual ? mapeados.filter(segAtual.filtro) : []

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-black text-slate-900 mb-1">Tags de Segmento</h2>
        <p className="text-sm text-slate-500">Navegue pelos CNAEs agrupados por característica tributária ou de licenciamento.</p>
      </div>

      {/* Grid de tags */}
      <div className="flex flex-wrap gap-2">
        {segComContagem.map(s => (
          <button
            key={s.key}
            onClick={() => setFiltro(filtro === s.key ? null : s.key)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border-2 text-xs font-black transition-all ${
              filtro === s.key
                ? 'border-slate-900 bg-slate-900 text-white shadow-md scale-105'
                : `${s.color} border hover:scale-105`
            }`}
          >
            {s.label}
            <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[9px] font-black ${filtro === s.key ? 'bg-white/20 text-white' : 'bg-white/60'}`}>
              {s.count}
            </span>
          </button>
        ))}
      </div>

      {/* Lista de CNAEs filtrados */}
      {segAtual && (
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">
            {cnaesFiltrados.length} CNAEs — {segAtual.label}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {cnaesFiltrados.slice(0, 20).map(c => (
              <button
                key={c.codigo}
                onClick={() => { setCnaeAtual(c); setTab('cnae') }}
                className="text-left bg-white border border-slate-200 hover:border-slate-400 rounded-xl p-3 transition-all hover:shadow-md"
              >
                <div className="flex items-start gap-2 mb-1 flex-wrap">
                  <span className="font-mono text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">{c.codigo}</span>
                  {c.temFiscal && !c.impedidoSimples && <BadgeAnexo anexo={c.anexoSimples} />}
                  {c.impedidoSimples && <span className="text-[9px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded border border-red-200 font-bold">⛔ Impedido</span>}
                  {c.fatorRAplicavel && <span className="text-[9px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded border border-indigo-200 font-bold">Fator R</span>}
                </div>
                <p className="text-xs font-semibold text-slate-800 leading-snug">{c.descricao}</p>
              </button>
            ))}
          </div>
          {cnaesFiltrados.length > 20 && (
            <p className="text-xs text-slate-400 text-center mt-3">Mostrando 20 de {cnaesFiltrados.length}. Use a busca na aba "Consulta CNAE" para mais.</p>
          )}
        </div>
      )}

      {!filtro && (
        <div className="text-center py-8 text-slate-300">
          <p className="text-3xl mb-2">🏷️</p>
          <p className="text-slate-500 text-sm">Clique em uma tag para ver os CNAEs do segmento</p>
        </div>
      )}
    </div>
  )
}
