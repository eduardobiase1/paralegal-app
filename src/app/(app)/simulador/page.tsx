'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Taxa {
  id: string
  nome: string
  tipo: string
  servico: string
  uf: string
  cidade: string
  valor: number
  observacoes: string
  ativo: boolean
}

const TIPOS_TAXA = ['DARF', 'DARE', 'Junta Comercial', 'Prefeitura', 'Cartório', 'Outro']

const SERVICOS = [
  { value: 'constituicao',          label: 'Constituição de Empresa' },
  { value: 'alteracao',             label: 'Alteração Contratual' },
  { value: 'encerramento',          label: 'Encerramento / Distrato' },
  { value: 'transferencia',         label: 'Transferência de Titularidade' },
  { value: 'transformacao',         label: 'Transformação de Tipo Societário' },
  { value: 'regularizacao',         label: 'Regularização / Desenquadramento' },
]

const UFS = ['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT',
             'PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO']

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatBRL(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function parseBRL(s: string) {
  return parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function SimuladorPage() {
  const [supabase] = useState(createClient)
  const [tab, setTab] = useState<'simular' | 'taxas'>('simular')
  const [taxas, setTaxas] = useState<Taxa[]>([])
  const [loading, setLoading] = useState(true)

  // Formulário nova taxa
  const [novaForm, setNovaForm] = useState({
    nome: '', tipo: 'DARF', servico: 'constituicao',
    uf: 'SP', cidade: '', valor: '', observacoes: '',
  })
  const [saving, setSaving] = useState(false)

  // Filtros simulação
  const [simServico, setSimServico] = useState('constituicao')
  const [simUF, setSimUF] = useState('SP')
  const [simCidade, setSimCidade] = useState('')

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('taxas')
      .select('*')
      .eq('ativo', true)
      .order('tipo')
      .order('nome')
    setTaxas((data ?? []) as Taxa[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function saveTaxa() {
    if (!novaForm.nome || !novaForm.valor) {
      toast.error('Preencha nome e valor')
      return
    }
    setSaving(true)
    const { error } = await supabase.from('taxas').insert({
      nome:        novaForm.nome,
      tipo:        novaForm.tipo,
      servico:     novaForm.servico,
      uf:          novaForm.uf,
      cidade:      novaForm.cidade,
      valor:       parseBRL(novaForm.valor),
      observacoes: novaForm.observacoes,
      ativo:       true,
    })
    setSaving(false)
    if (error) { toast.error('Erro ao salvar: ' + error.message); return }
    toast.success('Taxa cadastrada!')
    setNovaForm({ nome: '', tipo: 'DARF', servico: 'constituicao', uf: 'SP', cidade: '', valor: '', observacoes: '' })
    load()
  }

  async function deleteTaxa(id: string) {
    await supabase.from('taxas').update({ ativo: false }).eq('id', id)
    toast.success('Taxa removida')
    load()
  }

  // Filtra taxas para simulação
  const taxasSimuladas = taxas.filter(t =>
    t.servico === simServico &&
    t.uf === simUF &&
    (!t.cidade || !simCidade || t.cidade.toLowerCase() === simCidade.toLowerCase())
  )

  const totalSimulado = taxasSimuladas.reduce((s, t) => s + Number(t.valor), 0)

  // Agrupa por tipo para exibição
  const porTipo = taxasSimuladas.reduce<Record<string, Taxa[]>>((acc, t) => {
    if (!acc[t.tipo]) acc[t.tipo] = []
    acc[t.tipo].push(t)
    return acc
  }, {})

  function gerarResumoTexto() {
    const servLabel = SERVICOS.find(s => s.value === simServico)?.label ?? simServico
    const linhas = [
      `SIMULAÇÃO DE CUSTOS — ${servLabel}`,
      `Localidade: ${simUF}${simCidade ? ' / ' + simCidade : ''}`,
      `Data: ${new Date().toLocaleDateString('pt-BR')}`,
      '',
    ]
    for (const [tipo, itens] of Object.entries(porTipo)) {
      linhas.push(`── ${tipo} ──`)
      for (const t of itens) {
        linhas.push(`  ${t.nome}: ${formatBRL(Number(t.valor))}`)
        if (t.observacoes) linhas.push(`    Obs: ${t.observacoes}`)
      }
      linhas.push('')
    }
    linhas.push(`TOTAL ESTIMADO: ${formatBRL(totalSimulado)}`)
    linhas.push('')
    linhas.push('* Valores aproximados sujeitos a atualização. Consulte o escritório para confirmação.')
    return linhas.join('\n')
  }

  function copiarResumo() {
    navigator.clipboard.writeText(gerarResumoTexto())
    toast.success('Resumo copiado!')
  }

  function abrirWhatsApp() {
    const text = encodeURIComponent(gerarResumoTexto())
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank')
  }

  const TABS = [
    { key: 'simular', label: 'Simular Custos' },
    { key: 'taxas',   label: 'Gerenciar Taxas' },
  ]

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Simulador de Taxas</h1>
        <p className="text-sm text-gray-500 mt-1">Calcule os custos estimados por serviço e localidade</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b mb-6">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key as any)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-600 hover:text-gray-900'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Simular ── */}
      {tab === 'simular' && (
        <div className="space-y-5">
          {/* Filtros */}
          <div className="card">
            <div className="card-header"><h2 className="font-semibold text-gray-900">Parâmetros da Simulação</h2></div>
            <div className="card-body">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="label">Tipo de Serviço</label>
                  <select className="input" value={simServico} onChange={e => setSimServico(e.target.value)}>
                    {SERVICOS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Estado (UF)</label>
                  <select className="input" value={simUF} onChange={e => setSimUF(e.target.value)}>
                    {UFS.map(uf => <option key={uf} value={uf}>{uf}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Cidade <span className="text-gray-400 text-xs">(opcional)</span></label>
                  <input className="input" placeholder="Ex: São Paulo"
                    value={simCidade} onChange={e => setSimCidade(e.target.value)} />
                </div>
              </div>
            </div>
          </div>

          {/* Resultado */}
          {loading ? (
            <div className="card p-12 text-center text-gray-400">Carregando taxas...</div>
          ) : taxasSimuladas.length === 0 ? (
            <div className="card p-12 text-center text-gray-500">
              <svg className="w-10 h-10 mx-auto text-gray-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              <p className="font-medium">Nenhuma taxa cadastrada</p>
              <p className="text-sm mt-1">Acesse "Gerenciar Taxas" para cadastrar os valores deste serviço/localidade.</p>
            </div>
          ) : (
            <>
              {/* Breakdown por tipo */}
              <div className="space-y-4">
                {Object.entries(porTipo).map(([tipo, itens]) => (
                  <div key={tipo} className="card">
                    <div className="card-header flex items-center justify-between">
                      <h3 className="font-semibold text-gray-900">{tipo}</h3>
                      <span className="text-sm font-semibold text-gray-700">
                        {formatBRL(itens.reduce((s, t) => s + Number(t.valor), 0))}
                      </span>
                    </div>
                    <div className="divide-y">
                      {itens.map(t => (
                        <div key={t.id} className="px-6 py-3 flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-gray-900">{t.nome}</p>
                            {t.observacoes && <p className="text-xs text-gray-500 mt-0.5">{t.observacoes}</p>}
                          </div>
                          <span className="text-sm font-medium text-gray-700 ml-4 flex-shrink-0">{formatBRL(Number(t.valor))}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Total */}
              <div className="card bg-primary-50 border-primary-200">
                <div className="card-body flex items-center justify-between">
                  <div>
                    <p className="text-sm text-primary-700 font-medium">Total Estimado</p>
                    <p className="text-xs text-primary-600 mt-0.5">
                      {SERVICOS.find(s => s.value === simServico)?.label} — {simUF}{simCidade ? ' / ' + simCidade : ''}
                    </p>
                  </div>
                  <p className="text-2xl font-bold text-primary-700">{formatBRL(totalSimulado)}</p>
                </div>
              </div>

              {/* Ações */}
              <div className="flex gap-3">
                <button onClick={copiarResumo} className="btn-secondary flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Copiar Resumo
                </button>
                <button onClick={abrirWhatsApp}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                    <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.555 4.117 1.528 5.845L0 24l6.335-1.505A11.95 11.95 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.943 0-3.772-.524-5.337-1.438l-.383-.228-3.962.941.976-3.858-.25-.397A9.96 9.96 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
                  </svg>
                  Enviar por WhatsApp
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Gerenciar Taxas ── */}
      {tab === 'taxas' && (
        <div className="space-y-5">
          {/* Formulário */}
          <div className="card">
            <div className="card-header">
              <h2 className="font-semibold text-gray-900">Cadastrar Nova Taxa</h2>
            </div>
            <div className="card-body space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label">Nome da Taxa *</label>
                  <input className="input" placeholder="Ex: Taxa de Registro JUCESP"
                    value={novaForm.nome} onChange={e => setNovaForm(p => ({ ...p, nome: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Tipo</label>
                  <select className="input" value={novaForm.tipo}
                    onChange={e => setNovaForm(p => ({ ...p, tipo: e.target.value }))}>
                    {TIPOS_TAXA.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Serviço</label>
                  <select className="input" value={novaForm.servico}
                    onChange={e => setNovaForm(p => ({ ...p, servico: e.target.value }))}>
                    {SERVICOS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Valor (R$) *</label>
                  <input className="input" placeholder="Ex: 150,00"
                    value={novaForm.valor} onChange={e => setNovaForm(p => ({ ...p, valor: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Estado (UF)</label>
                  <select className="input" value={novaForm.uf}
                    onChange={e => setNovaForm(p => ({ ...p, uf: e.target.value }))}>
                    {UFS.map(uf => <option key={uf} value={uf}>{uf}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Cidade <span className="text-gray-400 text-xs">(deixe vazio p/ valer para todo o estado)</span></label>
                  <input className="input" placeholder="Ex: São Paulo"
                    value={novaForm.cidade} onChange={e => setNovaForm(p => ({ ...p, cidade: e.target.value }))} />
                </div>
                <div className="md:col-span-2">
                  <label className="label">Observações</label>
                  <input className="input" placeholder="Ex: Sujeito a atualização anual pelo IPCA"
                    value={novaForm.observacoes} onChange={e => setNovaForm(p => ({ ...p, observacoes: e.target.value }))} />
                </div>
              </div>
              <div className="flex justify-end">
                <button className="btn-primary" onClick={saveTaxa} disabled={saving}>
                  {saving ? 'Salvando...' : 'Cadastrar Taxa'}
                </button>
              </div>
            </div>
          </div>

          {/* Lista */}
          {loading ? (
            <div className="card p-8 text-center text-gray-400">Carregando...</div>
          ) : taxas.length === 0 ? (
            <div className="card p-8 text-center text-gray-500">Nenhuma taxa cadastrada ainda</div>
          ) : (
            <div className="card">
              <div className="card-header">
                <h2 className="font-semibold text-gray-900">Taxas Cadastradas ({taxas.length})</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-gray-600">Nome</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600">Tipo</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600">Serviço</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600">Localidade</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-600">Valor</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-600">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {taxas.map(t => (
                      <tr key={t.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-900">
                          {t.nome}
                          {t.observacoes && <p className="text-xs text-gray-400 font-normal">{t.observacoes}</p>}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">{t.tipo}</span>
                        </td>
                        <td className="px-4 py-3 text-gray-600 text-xs">
                          {SERVICOS.find(s => s.value === t.servico)?.label ?? t.servico}
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {t.uf}{t.cidade ? ` / ${t.cidade}` : ' (todo estado)'}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-gray-900">
                          {formatBRL(Number(t.valor))}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => deleteTaxa(t.id)}
                            className="text-xs text-red-500 hover:text-red-700">Remover</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
