'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  buscarCnaeDB, calcularAliquotaEfetiva, calcularFatorR, calcularLucroPresumido,
  formatarMoeda, formatarPorcentagem,
  CnaeInfo, Anexo, TABELAS_SIMPLES,
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

// ─── Subcomponents ────────────────────────────────────────────────────────────

function BadgeRisco({ nivel }: { nivel: string }) {
  const cor = nivel === 'Alto' ? 'bg-red-100 text-red-700 border-red-200'
    : nivel === 'Médio' ? 'bg-yellow-100 text-yellow-700 border-yellow-200'
    : 'bg-green-100 text-green-700 border-green-200'
  return <span className={`text-xs px-2 py-0.5 rounded border font-medium ${cor}`}>{nivel}</span>
}

function BadgeAnexo({ anexo }: { anexo: string }) {
  const cor = anexo === 'I' ? 'bg-blue-100 text-blue-700'
    : anexo === 'II' ? 'bg-purple-100 text-purple-700'
    : anexo === 'III' ? 'bg-green-100 text-green-700'
    : anexo === 'IV' ? 'bg-orange-100 text-orange-700'
    : anexo === 'V' ? 'bg-red-100 text-red-700'
    : 'bg-gray-100 text-gray-600'
  return <span className={`text-xs px-2 py-0.5 rounded font-semibold ${cor}`}>
    {anexo === 'impedido' ? '⛔ Impedido' : `Anexo ${anexo}`}
  </span>
}

// ─── Bar visual ───────────────────────────────────────────────────────────────

function BarraComparacao({ label, valor, total, cor }: { label: string; valor: number; total: number; cor: string }) {
  const pct = total > 0 ? Math.min((valor / total) * 100, 100) : 0
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-gray-600">{label}</span>
        <span className="font-semibold">{formatarMoeda(valor)}</span>
      </div>
      <div className="h-5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${cor}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

// ─── Página Principal ─────────────────────────────────────────────────────────

type TabKey = 'cnae' | 'simulador' | 'fatorr' | 'licencas'

export default function TributarioPage() {
  const [tab, setTab] = useState<TabKey>('cnae')

  // ── Estado global: CNAE selecionado ────────────────────────────────────────
  const [cnaeAtual, setCnaeAtual] = useState<CnaeInfo | null>(null)

  const TABS: { key: TabKey; label: string; icon: string }[] = [
    { key: 'cnae',      label: 'Consulta CNAE',         icon: '🔍' },
    { key: 'simulador', label: 'Comparador de Regimes',  icon: '⚖️' },
    { key: 'fatorr',    label: 'Simulador Fator R',      icon: '📊' },
    { key: 'licencas',  label: 'Checklist de Licenças',  icon: '✅' },
  ]

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <span>🧠</span> Estrategista Tributário e de CNAE
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Análise consultiva de viabilidade, carga tributária e licenciamento por atividade
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b mb-6 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
              tab === t.key
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'}`}>
            <span>{t.icon}</span> {t.label}
          </button>
        ))}
      </div>

      {/* ════════════════ TAB 1 — CONSULTA CNAE ════════════════════════════════ */}
      {tab === 'cnae' && (
        <TabConsultaCnae cnaeAtual={cnaeAtual} setCnaeAtual={setCnaeAtual} setTab={setTab} />
      )}

      {/* ════════════════ TAB 2 — COMPARADOR DE REGIMES ════════════════════════ */}
      {tab === 'simulador' && (
        <TabSimulador cnaeAtual={cnaeAtual} />
      )}

      {/* ════════════════ TAB 3 — FATOR R ══════════════════════════════════════ */}
      {tab === 'fatorr' && (
        <TabFatorR cnaeAtual={cnaeAtual} />
      )}

      {/* ════════════════ TAB 4 — CHECKLIST DE LICENÇAS ════════════════════════ */}
      {tab === 'licencas' && (
        <TabLicencas cnaeAtual={cnaeAtual} />
      )}
    </div>
  )
}

// ─── Tab 1: Consulta CNAE ─────────────────────────────────────────────────────

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

  // Busca com debounce de 350ms
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!query.trim() || query.trim().length < 2) {
      setResultados([])
      setLoading(false)
      return
    }
    setLoading(true)
    debounceRef.current = setTimeout(async () => {
      const res = await buscarCnaeDB(query, supabase)
      setResultados(res)
      setLoading(false)
    }, 350)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, supabase])

  return (
    <div className="space-y-5">
      <div>
        <label className="label">Buscar CNAE por código ou descrição</label>
        <div className="relative">
          <input
            className="input text-sm pr-8"
            placeholder="Ex: 8211-3/00 ou serviços administrativos ou contabilidade..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            autoFocus
          />
          {loading && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="w-4 h-4 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>
        <p className="text-xs text-gray-400 mt-1">
          Busca em +1.300 CNAEs — por código (ex: 8211) ou palavras da descrição
        </p>
      </div>

      {query.length >= 2 && !loading && resultados.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-6">Nenhum CNAE encontrado para &ldquo;{query}&rdquo;</p>
      )}

      {resultados.length > 0 && (
        <div className="space-y-2">
          {resultados.map(c => (
            <button key={c.codigo}
              onClick={() => { setCnaeAtual(c); setQuery(''); setResultados([]) }}
              className={`w-full text-left p-4 border-2 rounded-xl transition-all hover:shadow-sm ${
                cnaeAtual?.codigo === c.codigo
                  ? 'border-primary-400 bg-primary-50'
                  : 'border-gray-200 hover:border-gray-300 bg-white'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-mono text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">{c.codigo}</span>
                    {c.temFiscal ? (
                      c.impedidoSimples ? (
                        <span className="text-xs font-semibold bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 rounded">⛔ Impedido Simples</span>
                      ) : (
                        <span className="text-xs font-semibold bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded">✅ Simples Nacional</span>
                      )
                    ) : (
                      <span className="text-xs bg-gray-50 text-gray-400 border border-gray-200 px-1.5 py-0.5 rounded">❓ não mapeado</span>
                    )}
                    {c.temFiscal && !c.impedidoSimples && <BadgeAnexo anexo={c.anexoSimples} />}
                    {c.fatorRAplicavel && (
                      <span className="text-xs bg-indigo-50 text-indigo-600 border border-indigo-200 px-1.5 py-0.5 rounded">Fator R</span>
                    )}
                    {c.conselhoClasse && (
                      <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded">{c.conselhoClasse}</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-800 truncate">{c.descricao}</p>
                </div>
                {c.temFiscal && (
                  <div className="flex flex-col gap-1 items-end flex-shrink-0">
                    <BadgeRisco nivel={c.riscoVigilancia} />
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Ficha do CNAE selecionado */}
      {cnaeAtual && !query && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full bg-primary-500" />
            <h2 className="font-semibold text-gray-900 text-sm">CNAE Selecionado</h2>
          </div>

          <div className="card p-5 space-y-4">
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-mono text-xs text-gray-400 mb-1">{cnaeAtual.codigo}</p>
                <p className="font-semibold text-gray-900">{cnaeAtual.descricao}</p>
              </div>
            </div>

            {/* ── BANNER SIMPLES NACIONAL — destaque principal ── */}
            {cnaeAtual.temFiscal ? (
              cnaeAtual.impedidoSimples ? (
                <div className="rounded-xl border-2 border-red-300 bg-red-50 p-4">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">⛔</span>
                    <div>
                      <p className="font-bold text-red-800 text-base">IMPEDIDO AO SIMPLES NACIONAL</p>
                      <p className="text-sm text-red-700 mt-0.5">{cnaeAtual.motivoImpedimento ?? 'Atividade vedada pela LC 123/2006'}</p>
                      <p className="text-xs text-red-600 mt-1">Regimes disponíveis: <strong>Lucro Presumido</strong> ou <strong>Lucro Real</strong></p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border-2 border-green-300 bg-green-50 p-4">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">✅</span>
                    <div className="flex-1">
                      <p className="font-bold text-green-800 text-base">ELEGÍVEL AO SIMPLES NACIONAL</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <BadgeAnexo anexo={cnaeAtual.anexoSimples} />
                        <span className="text-sm text-green-700">
                          {TABELAS_SIMPLES[cnaeAtual.anexoSimples as Anexo]?.nome ?? ''}
                        </span>
                      </div>
                      {cnaeAtual.fatorRAplicavel && (
                        <p className="text-xs text-indigo-700 mt-1">
                          📊 <strong>Fator R aplicável</strong> — folha ≥ 28% do faturamento pode migrar para Anexo III
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )
            ) : (
              <div className="rounded-xl border-2 border-gray-200 bg-gray-50 p-4">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">❓</span>
                  <div>
                    <p className="font-bold text-gray-700 text-base">SIMPLES NACIONAL — NÃO MAPEADO</p>
                    <p className="text-sm text-gray-500 mt-0.5">
                      Este CNAE consta na base do IBGE mas ainda não possui análise tributária cadastrada.
                    </p>
                    <p className="text-xs text-gray-400 mt-1">Consulte seu contador para verificar a elegibilidade.</p>
                  </div>
                </div>
              </div>
            )}

            {/* Observações específicas do CNAE */}
            {cnaeAtual.observacoes && (
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-xl text-sm text-yellow-800">
                <p className="font-semibold">ℹ️ Atenção</p>
                <p className="text-xs mt-0.5">{cnaeAtual.observacoes}</p>
              </div>
            )}

            {/* Grid de info */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-1">Regime Tributário</p>
                <p className="font-semibold">
                  {cnaeAtual.impedidoSimples
                    ? 'Lucro Presumido / Real'
                    : TABELAS_SIMPLES[cnaeAtual.anexoSimples as Anexo]?.nome ?? '—'}
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-1">Tipo de Atividade</p>
                <p className="font-semibold capitalize">{cnaeAtual.tipoAtividade}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-1">Risco Vigilância Sanitária</p>
                <BadgeRisco nivel={cnaeAtual.riscoVigilancia} />
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-1">Risco Bombeiros</p>
                <BadgeRisco nivel={cnaeAtual.riscoBombeiros} />
              </div>
            </div>

            {cnaeAtual.conselhoClasse && (
              <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm">
                <span>🏛️</span>
                <p className="text-amber-800"><strong>Conselho de Classe obrigatório:</strong> {cnaeAtual.conselhoClasse}</p>
              </div>
            )}

            {cnaeAtual.fatorRAplicavel && !cnaeAtual.impedidoSimples && (
              <div className="flex items-center gap-2 p-3 bg-indigo-50 border border-indigo-200 rounded-lg text-sm">
                <span>📊</span>
                <p className="text-indigo-800"><strong>Fator R aplicável:</strong> Se a folha de pagamento ≥ 28% do faturamento, tributa pelo Anexo III (mais vantajoso) em vez do Anexo V.</p>
              </div>
            )}

            {/* Licenças */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Licenças Obrigatórias</p>
              <div className="space-y-1">
                {cnaeAtual.licencasObrigatorias.map((l, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <span className="text-green-500 mt-0.5 flex-shrink-0">✓</span>
                    <span className="text-gray-700">{l}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Atalhos */}
            <div className="flex flex-wrap gap-2 pt-2 border-t">
              {!cnaeAtual.impedidoSimples && (
                <button onClick={() => setTab('simulador')}
                  className="btn-secondary text-xs py-1.5 px-3">
                  ⚖️ Comparar Regimes →
                </button>
              )}
              {cnaeAtual.fatorRAplicavel && (
                <button onClick={() => setTab('fatorr')}
                  className="btn-secondary text-xs py-1.5 px-3">
                  📊 Simular Fator R →
                </button>
              )}
              <button onClick={() => setTab('licencas')}
                className="btn-secondary text-xs py-1.5 px-3">
                ✅ Ver Checklist →
              </button>
            </div>
          </div>
        </div>
      )}
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
    ? (cnaeAtual.fatorRAplicavel
      ? calcularFatorR(folha12, rbt12).anexoAplicavel
      : cnaeAtual.anexoSimples as Anexo)
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
    <div className="space-y-5">
      {cnaeAtual && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-sm flex items-center gap-2">
          <span>🔍</span>
          <span className="text-blue-800">
            Analisando: <strong>{cnaeAtual.descricao}</strong>
            {cnaeAtual.fatorRAplicavel && ' — Fator R aplicável (folha impacta no anexo)'}
          </span>
        </div>
      )}

      <div className="card p-5 space-y-4">
        <h2 className="font-semibold text-gray-900">Dados para Simulação</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Receita Bruta Mensal (R$) *</label>
            <input className="input font-mono" placeholder="Ex: 50.000,00"
              value={receitaStr}
              onChange={e => setReceitaStr(inputMoeda(e.target.value))} />
            {receitaMensal > 0 && (
              <p className="text-xs text-gray-400 mt-1">Anual: {formatarMoeda(rbt12)}</p>
            )}
          </div>
          {(cnaeAtual?.fatorRAplicavel || !cnaeAtual) && (
            <div>
              <label className="label">Folha de Pagamento Mensal (R$)</label>
              <input className="input font-mono" placeholder="Ex: 15.000,00"
                value={folhaStr}
                onChange={e => setFolhaStr(inputMoeda(e.target.value))} />
              <p className="text-xs text-gray-400 mt-1">Inclui salários + encargos</p>
            </div>
          )}
          {tipoAtv === 'servico' && (
            <div>
              <label className="label">Alíquota ISS do Município (%)</label>
              <input className="input" placeholder="2 a 5" value={aliquotaIss}
                onChange={e => setAliquotaIss(e.target.value)} />
            </div>
          )}
        </div>
        <div className="flex justify-end">
          <button className="btn-primary"
            disabled={receitaMensal <= 0}
            onClick={() => setMostrar(true)}>
            Calcular →
          </button>
        </div>
      </div>

      {mostrar && receitaMensal > 0 && (
        <div className="space-y-4">

          {/* Cards de resultado */}
          <div className="grid grid-cols-2 gap-4">
            {/* Simples */}
            <div className={`card p-5 space-y-3 ${maisBarato === 'Simples Nacional' ? 'border-green-300 bg-green-50' : ''}`}>
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900 text-sm">Simples Nacional</h3>
                {maisBarato === 'Simples Nacional' && (
                  <span className="text-xs bg-green-600 text-white px-2 py-0.5 rounded-full font-medium">✓ Mais barato</span>
                )}
              </div>
              <BadgeAnexo anexo={anexo} />
              <div className="text-2xl font-bold text-gray-900">{formatarMoeda(simplMensal)}<span className="text-sm font-normal text-gray-500">/mês</span></div>
              <div className="text-sm text-gray-600 space-y-1">
                <div className="flex justify-between"><span>Alíquota nominal</span><span className="font-medium">{formatarPorcentagem(simples.aliquotaNominal)}</span></div>
                <div className="flex justify-between"><span>Alíquota efetiva</span><span className="font-medium text-green-700">{formatarPorcentagem(simples.aliquotaEfetiva)}</span></div>
                <div className="flex justify-between font-semibold border-t pt-1"><span>Anual</span><span>{formatarMoeda(simples.impostoAnual)}</span></div>
              </div>
            </div>

            {/* Lucro Presumido */}
            <div className={`card p-5 space-y-3 ${maisBarato === 'Lucro Presumido' ? 'border-green-300 bg-green-50' : ''}`}>
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900 text-sm">Lucro Presumido</h3>
                {maisBarato === 'Lucro Presumido' && (
                  <span className="text-xs bg-green-600 text-white px-2 py-0.5 rounded-full font-medium">✓ Mais barato</span>
                )}
              </div>
              <div className="text-2xl font-bold text-gray-900">{formatarMoeda(lp.total)}<span className="text-sm font-normal text-gray-500">/mês</span></div>
              <div className="text-sm text-gray-600 space-y-1">
                <div className="flex justify-between"><span>IRPJ</span><span>{formatarMoeda(lp.irpj)}</span></div>
                <div className="flex justify-between"><span>CSLL</span><span>{formatarMoeda(lp.csll)}</span></div>
                <div className="flex justify-between"><span>PIS</span><span>{formatarMoeda(lp.pis)}</span></div>
                <div className="flex justify-between"><span>COFINS</span><span>{formatarMoeda(lp.cofins)}</span></div>
                {tipoAtv === 'servico' && <div className="flex justify-between"><span>ISS ({aliquotaIss}%)</span><span>{formatarMoeda(lp.iss)}</span></div>}
                <div className="flex justify-between"><span>INSS Patronal</span><span>{formatarMoeda(lp.cpp)}</span></div>
                <div className="flex justify-between font-semibold border-t pt-1"><span>Alíquota efetiva</span><span>{formatarPorcentagem(lp.aliquotaEfetiva)}</span></div>
                <div className="flex justify-between font-semibold"><span>Anual</span><span>{formatarMoeda(lp.total * 12)}</span></div>
              </div>
            </div>
          </div>

          {/* Barras comparativas */}
          <div className="card p-5 space-y-3">
            <h3 className="font-semibold text-gray-900 text-sm">Comparação Visual (mensal)</h3>
            <BarraComparacao label="Simples Nacional" valor={simplMensal} total={maiorTotal} cor="bg-blue-500" />
            <BarraComparacao label="Lucro Presumido" valor={lp.total} total={maiorTotal} cor="bg-orange-500" />
          </div>

          {/* Resultado */}
          <div className={`p-4 rounded-xl border-2 ${economiaSimples > 0 ? 'bg-green-50 border-green-200' : 'bg-orange-50 border-orange-200'}`}>
            <p className="text-sm font-bold text-gray-900">
              💡 Recomendação: <span className={economiaSimples > 0 ? 'text-green-700' : 'text-orange-700'}>{maisBarato}</span>
            </p>
            <p className="text-sm text-gray-700 mt-1">
              Economia estimada de <strong>{formatarMoeda(diferenca)}/mês</strong> ({formatarMoeda(diferenca * 12)}/ano)
            </p>
            <p className="text-xs text-gray-500 mt-2">
              ⚠️ Simulação estimada. O regime ideal depende também de benefícios fiscais estaduais, histórico de despesas dedutíveis e planejamento de pró-labore. Consulte um contador.
            </p>
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
    <div className="space-y-5">
      <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl space-y-2">
        <p className="text-sm font-semibold text-indigo-800">O que é o Fator R?</p>
        <p className="text-sm text-indigo-700">
          O Fator R é a relação entre a <strong>folha de pagamento dos últimos 12 meses</strong> (salários + pró-labore + FGTS)
          e o <strong>faturamento bruto dos últimos 12 meses</strong>.
        </p>
        <p className="text-sm text-indigo-700">
          Se Fator R <strong>≥ 28%</strong> → tributa pelo <strong>Anexo III</strong> (alíquotas menores)<br/>
          Se Fator R <strong>{'< 28%'}</strong> → tributa pelo <strong>Anexo V</strong> (alíquotas maiores)
        </p>
        {cnaeAtual && !aplicavel && (
          <p className="text-xs text-red-600 font-medium">
            ⚠️ O CNAE selecionado ({cnaeAtual.codigo}) não utiliza Fator R — está fixo no {cnaeAtual.anexoSimples === 'impedido' ? 'regime impedido' : `Anexo ${cnaeAtual.anexoSimples}`}.
          </p>
        )}
      </div>

      <div className="card p-5 space-y-4">
        <h2 className="font-semibold text-gray-900">Dados dos últimos 12 meses</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Receita Bruta Mensal Média (R$)</label>
            <input className="input font-mono" placeholder="Ex: 50.000,00"
              value={receitaStr}
              onChange={e => setReceitaStr(inputMoeda(e.target.value))} />
            {receita12 > 0 && <p className="text-xs text-gray-400 mt-1">Total 12 meses: {formatarMoeda(receita12)}</p>}
          </div>
          <div>
            <label className="label">Folha de Pagamento Mensal Média (R$)</label>
            <input className="input font-mono" placeholder="Ex: 15.000,00"
              value={folhaStr}
              onChange={e => setFolhaStr(inputMoeda(e.target.value))} />
            <p className="text-xs text-gray-400 mt-1">Inclui pró-labore, salários e FGTS</p>
            {folha12 > 0 && <p className="text-xs text-gray-400">Total 12 meses: {formatarMoeda(folha12)}</p>}
          </div>
        </div>
        <div className="flex justify-end">
          <button className="btn-primary" disabled={receita12 <= 0}
            onClick={() => setMostrar(true)}>
            Calcular Fator R →
          </button>
        </div>
      </div>

      {resultado && iii && v && (
        <div className="space-y-4">

          {/* Resultado do Fator R */}
          <div className={`card p-5 text-center ${resultado.anexoAplicavel === 'III' ? 'border-green-300 bg-green-50' : 'border-orange-300 bg-orange-50'}`}>
            <p className="text-4xl font-black mb-1 tabular-nums" style={{ color: resultado.anexoAplicavel === 'III' ? '#16a34a' : '#ea580c' }}>
              {formatarPorcentagem(resultado.fatorR)}
            </p>
            <p className="text-sm text-gray-700 font-medium mb-2">Fator R atual</p>
            <div className="inline-flex items-center gap-2">
              <BadgeAnexo anexo={resultado.anexoAplicavel} />
              <span className="text-sm text-gray-700">aplicável neste momento</span>
            </div>

            {/* Barra visual do fator R */}
            <div className="mt-4 mx-auto max-w-sm">
              <div className="relative h-4 bg-gray-200 rounded-full">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${resultado.fatorR >= 28 ? 'bg-green-500' : 'bg-orange-500'}`}
                  style={{ width: `${Math.min(resultado.fatorR, 50) * 2}%` }}
                />
                {/* Linha dos 28% */}
                <div className="absolute top-0 h-full w-0.5 bg-gray-600" style={{ left: '56%' }} />
                <span className="absolute -top-5 text-xs text-gray-600 font-medium" style={{ left: '54%' }}>28%</span>
              </div>
            </div>
          </div>

          {/* Comparação Anexo III vs V */}
          <div className="grid grid-cols-2 gap-4">
            <div className={`card p-4 space-y-2 ${resultado.anexoAplicavel === 'III' ? 'border-green-300' : ''}`}>
              <div className="flex items-center justify-between">
                <BadgeAnexo anexo="III" />
                {resultado.anexoAplicavel === 'III' && <span className="text-xs text-green-600 font-semibold">✓ Atual</span>}
              </div>
              <p className="text-xl font-bold text-gray-900">{formatarMoeda(iii.impostoMensal)}<span className="text-xs font-normal text-gray-500">/mês</span></p>
              <p className="text-xs text-gray-500">Alíq. efetiva: {formatarPorcentagem(iii.aliquotaEfetiva)}</p>
            </div>
            <div className={`card p-4 space-y-2 ${resultado.anexoAplicavel === 'V' ? 'border-orange-300' : ''}`}>
              <div className="flex items-center justify-between">
                <BadgeAnexo anexo="V" />
                {resultado.anexoAplicavel === 'V' && <span className="text-xs text-orange-600 font-semibold">✓ Atual</span>}
              </div>
              <p className="text-xl font-bold text-gray-900">{formatarMoeda(v.impostoMensal)}<span className="text-xs font-normal text-gray-500">/mês</span></p>
              <p className="text-xs text-gray-500">Alíq. efetiva: {formatarPorcentagem(v.aliquotaEfetiva)}</p>
            </div>
          </div>

          {/* Orientação de planejamento */}
          {resultado.anexoAplicavel === 'V' && resultado.economia > 0 && (
            <div className="card p-4 bg-amber-50 border-amber-200 space-y-2">
              <p className="text-sm font-semibold text-amber-800">📌 Planejamento — Como migrar para o Anexo III</p>
              <p className="text-sm text-amber-700">
                Para atingir Fator R de 28%, a folha mensal precisaria ser de pelo menos{' '}
                <strong>{formatarMoeda(resultado.folhaNecessaria / 12)}/mês</strong>{' '}
                (atual: {formatarMoeda(folha12 / 12)}/mês — faltam{' '}
                {formatarMoeda(resultado.folhaNecessaria / 12 - folha12 / 12)}/mês).
              </p>
              <p className="text-sm text-amber-700">
                Economia potencial: <strong>{formatarMoeda(resultado.economia / 12)}/mês</strong> ({formatarMoeda(resultado.economia)}/ano)
              </p>
              <p className="text-xs text-amber-600">
                Estratégia comum: aumentar o pró-labore dos sócios pode elevar o Fator R sem necessariamente aumentar custos líquidos — mas exige análise tributária completa com contador.
              </p>
            </div>
          )}

          {resultado.anexoAplicavel === 'III' && (
            <div className="card p-4 bg-green-50 border-green-200">
              <p className="text-sm font-semibold text-green-800">✅ Você já está no Anexo III</p>
              <p className="text-sm text-green-700 mt-1">
                Economia em relação ao Anexo V: <strong>{formatarMoeda(resultado.economia / 12)}/mês</strong> ({formatarMoeda(resultado.economia)}/ano).<br/>
                Mantenha a folha acima de {formatarPorcentagem(28)} do faturamento para manter esta vantagem.
              </p>
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

  function toggle(item: string) {
    setChecados(prev => { const n = new Set(prev); n.has(item) ? n.delete(item) : n.add(item); return n })
  }

  if (!cnaeAtual) {
    return (
      <div className="card p-12 text-center text-gray-500">
        <p className="text-3xl mb-3">🔍</p>
        <p className="font-medium">Nenhum CNAE selecionado</p>
        <p className="text-sm mt-1">Consulte um CNAE na aba "Consulta CNAE" para ver o checklist de licenças.</p>
      </div>
    )
  }

  const total = cnaeAtual.licencasObrigatorias.length + (cnaeAtual.conselhoClasse ? 1 : 0)
  const concluidos = checados.size
  const pct = total > 0 ? Math.round((concluidos / total) * 100) : 0

  return (
    <div className="space-y-5">
      <div className="card p-4">
        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="font-semibold text-gray-900 text-sm">{cnaeAtual.descricao}</p>
            <p className="text-xs text-gray-400 font-mono">{cnaeAtual.codigo}</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-gray-900">{pct}%</p>
            <p className="text-xs text-gray-400">{concluidos}/{total} itens</p>
          </div>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-green-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Risco */}
      <div className="grid grid-cols-2 gap-3">
        <div className="card p-3 flex items-center gap-3">
          <span className="text-xl">🏥</span>
          <div>
            <p className="text-xs text-gray-500">Vigilância Sanitária</p>
            <BadgeRisco nivel={cnaeAtual.riscoVigilancia} />
          </div>
        </div>
        <div className="card p-3 flex items-center gap-3">
          <span className="text-xl">🚒</span>
          <div>
            <p className="text-xs text-gray-500">Corpo de Bombeiros</p>
            <BadgeRisco nivel={cnaeAtual.riscoBombeiros} />
          </div>
        </div>
      </div>

      {/* Conselho de Classe */}
      {cnaeAtual.conselhoClasse && (
        <div className="card p-4">
          <h3 className="text-sm font-semibold text-amber-800 mb-3 flex items-center gap-2">
            <span>🏛️</span> Conselho de Classe Obrigatório
          </h3>
          <label className={`flex items-center gap-3 p-3 border-2 rounded-xl cursor-pointer transition-all ${
            checados.has('conselho') ? 'border-green-400 bg-green-50' : 'border-gray-200 hover:border-gray-300'}`}
            onClick={() => toggle('conselho')}>
            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
              checados.has('conselho') ? 'bg-green-500 border-green-500' : 'border-gray-300'}`}>
              {checados.has('conselho') && <span className="text-white text-xs">✓</span>}
            </div>
            <div>
              <p className="text-sm font-medium text-gray-800">Registro {cnaeAtual.conselhoClasse}</p>
              <p className="text-xs text-gray-500">Responsável Técnico inscrito e em situação regular</p>
            </div>
          </label>
        </div>
      )}

      {/* Licenças */}
      <div className="card p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Licenças e Documentos</h3>
        <div className="space-y-2">
          {cnaeAtual.licencasObrigatorias.map((item, i) => (
            <label key={i}
              className={`flex items-center gap-3 p-3 border-2 rounded-xl cursor-pointer transition-all ${
                checados.has(item) ? 'border-green-400 bg-green-50' : 'border-gray-200 hover:border-gray-300'}`}
              onClick={() => toggle(item)}>
              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                checados.has(item) ? 'bg-green-500 border-green-500' : 'border-gray-300'}`}>
                {checados.has(item) && <span className="text-white text-xs">✓</span>}
              </div>
              <span className={`text-sm ${checados.has(item) ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                {item}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Observações */}
      {cnaeAtual.observacoes && (
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-xl text-sm text-yellow-800">
          <p className="font-semibold mb-1">⚠️ Observações Importantes</p>
          <p>{cnaeAtual.observacoes}</p>
        </div>
      )}

      {pct === 100 && (
        <div className="p-4 bg-green-50 border border-green-300 rounded-xl text-center">
          <p className="text-2xl mb-1">🎉</p>
          <p className="text-sm font-semibold text-green-800">Checklist concluído!</p>
          <p className="text-xs text-green-600 mt-1">Todos os itens de licenciamento foram marcados.</p>
        </div>
      )}
    </div>
  )
}
