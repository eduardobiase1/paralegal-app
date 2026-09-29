'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useOrg } from '@/lib/org-context'
import toast from 'react-hot-toast'

type MainTab = 'dashboard' | 'receber' | 'pagar' | 'extrato' | 'config'
type ConfigTab = 'clientes' | 'fornecedores' | 'categorias' | 'centros' | 'contas'

const FORMA_LABELS: Record<string, string> = {
  boleto: 'Boleto', pix: 'PIX', nf: 'NF', transferencia: 'Transferência',
  dinheiro: 'Dinheiro', debito_automatico: 'Débito Auto', outro: 'Outro',
}
const STATUS_R: Record<string, { label: string; cls: string }> = {
  aguardando: { label: 'A Receber',  cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  pago:       { label: 'Recebido',   cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  vencido:    { label: 'Vencido',    cls: 'bg-red-50 text-red-700 border-red-200' },
  cancelado:  { label: 'Cancelado',  cls: 'bg-slate-100 text-slate-500 border-slate-200' },
}
const STATUS_P: Record<string, { label: string; cls: string }> = {
  a_pagar:   { label: 'A Pagar',  cls: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  pago:      { label: 'Pago',     cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  vencido:   { label: 'Vencido',  cls: 'bg-red-50 text-red-700 border-red-200' },
  cancelado: { label: 'Cancelado', cls: 'bg-slate-100 text-slate-500 border-slate-200' },
}

function fmt(n: number) { return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }
function fmtDate(d: string | null) { if (!d) return '—'; return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') }
function today() { return new Date().toISOString().split('T')[0] }

const emptyReceber = {
  cliente_id: '', descricao: '', valor: '', data_vencimento: '',
  forma_pagamento: 'pix', numero_nf: '', parcela_numero: '1',
  parcela_total: '1', observacoes: '', categoria_id: '',
}
const emptyPagar = {
  fornecedor_id: '', categoria_id: '', centro_custo_id: '', descricao: '',
  valor: '', data_vencimento: '', forma_pagamento: 'transferencia',
  recorrente: false, observacoes: '',
}

export default function FinanceiroBMPage() {
  const { orgId, orgName } = useOrg()
  const [supabase] = useState(createClient())
  const [tab, setTab] = useState<MainTab>('dashboard')
  const [configTab, setConfigTab] = useState<ConfigTab>('clientes')

  // data
  const [receber, setReceber] = useState<any[]>([])
  const [pagar, setPagar] = useState<any[]>([])
  const [extrato, setExtrato] = useState<any[]>([])
  const [clientes, setClientes] = useState<any[]>([])
  const [fornecedores, setFornecedores] = useState<any[]>([])
  const [categorias, setCategorias] = useState<any[]>([])
  const [centros, setCentros] = useState<any[]>([])
  const [contas, setContas] = useState<any[]>([])
  const [contaSelecionada, setContaSelecionada] = useState('')

  // filters
  const [filterR, setFilterR] = useState('todos')
  const [filterP, setFilterP] = useState('todos')

  // modals
  const [modalR, setModalR] = useState(false)
  const [modalP, setModalP] = useState(false)
  const [modalExtrato, setModalExtrato] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formR, setFormR] = useState({ ...emptyReceber })
  const [formP, setFormP] = useState({ ...emptyPagar })
  const [formExtrato, setFormExtrato] = useState({
    descricao: '', valor: '', tipo: 'credito', data: today(), observacoes: '',
  })

  // config modals
  const [modalConfig, setModalConfig] = useState(false)
  const [configForm, setConfigForm] = useState<Record<string, string>>({})
  const [editingConfigId, setEditingConfigId] = useState<string | null>(null)

  const [loading, setLoading] = useState(true)

  // ── Fetch ────────────────────────────────────────────────────────────────────

  const fetchAll = useCallback(async () => {
    if (!orgId) return
    setLoading(true)
    const [rRes, pRes, clRes, foRes, caRes, ceRes, coRes] = await Promise.all([
      supabase.from('bm_contas_receber').select('*, cliente:bm_clientes(nome), categoria:bm_categorias(nome)').eq('org_id', orgId).order('data_vencimento'),
      supabase.from('bm_contas_pagar').select('*, fornecedor:bm_fornecedores(nome), categoria:bm_categorias(nome), centro:bm_centros_custo(nome)').eq('org_id', orgId).order('data_vencimento'),
      supabase.from('bm_clientes').select('*').eq('org_id', orgId).eq('ativo', true).order('nome'),
      supabase.from('bm_fornecedores').select('*').eq('org_id', orgId).eq('ativo', true).order('nome'),
      supabase.from('bm_categorias').select('*').eq('org_id', orgId).order('nome'),
      supabase.from('bm_centros_custo').select('*').eq('org_id', orgId).order('nome'),
      supabase.from('bm_contas_bancarias').select('*').eq('org_id', orgId).eq('ativa', true).order('nome'),
    ])
    setReceber(rRes.data || [])
    setPagar(pRes.data || [])
    setClientes(clRes.data || [])
    setFornecedores(foRes.data || [])
    setCategorias(caRes.data || [])
    setCentros(ceRes.data || [])
    setContas(coRes.data || [])
    if (!contaSelecionada && coRes.data?.length) setContaSelecionada(coRes.data[0].id)
    setLoading(false)
  }, [supabase, orgId])

  const fetchExtrato = useCallback(async (contaId: string) => {
    if (!contaId) return
    const { data } = await supabase.from('bm_extrato').select('*').eq('conta_bancaria_id', contaId).order('data').order('created_at')
    setExtrato(data || [])
  }, [supabase])

  useEffect(() => { if (orgId) fetchAll() }, [orgId, fetchAll])
  useEffect(() => { if (contaSelecionada) fetchExtrato(contaSelecionada) }, [contaSelecionada, fetchExtrato])

  // ── Contas a Receber ─────────────────────────────────────────────────────────

  function openNewR() {
    setEditingId(null)
    setFormR({ ...emptyReceber })
    setModalR(true)
  }
  function openEditR(r: any) {
    setEditingId(r.id)
    setFormR({
      cliente_id: r.cliente_id || '', descricao: r.descricao || '',
      valor: String(r.valor || ''), data_vencimento: r.data_vencimento || '',
      forma_pagamento: r.forma_pagamento || 'pix', numero_nf: r.numero_nf || '',
      parcela_numero: String(r.parcela_numero || 1), parcela_total: String(r.parcela_total || 1),
      observacoes: r.observacoes || '', categoria_id: r.categoria_id || '',
    })
    setModalR(true)
  }
  async function handleSaveR(e: React.FormEvent) {
    e.preventDefault()
    const payload: any = {
      org_id: orgId,
      cliente_id: formR.cliente_id || null,
      descricao: formR.descricao.trim(),
      valor: parseFloat(formR.valor),
      data_vencimento: formR.data_vencimento,
      forma_pagamento: formR.forma_pagamento,
      numero_nf: formR.numero_nf.trim() || null,
      parcela_numero: parseInt(formR.parcela_numero) || 1,
      parcela_total: parseInt(formR.parcela_total) || 1,
      observacoes: formR.observacoes.trim() || null,
      categoria_id: formR.categoria_id || null,
    }
    if (!editingId) payload.status = 'aguardando'
    const { error } = editingId
      ? await supabase.from('bm_contas_receber').update(payload).eq('id', editingId)
      : await supabase.from('bm_contas_receber').insert([payload])
    if (!error) { toast.success(editingId ? 'Atualizado!' : 'Lançamento criado!'); setModalR(false); fetchAll() }
    else toast.error(error.message)
  }
  async function marcarReceberPago(r: any) {
    const dataHoje = today()
    const { error } = await supabase.from('bm_contas_receber').update({ status: 'pago', data_pagamento: dataHoje, valor_pago: r.valor }).eq('id', r.id)
    if (!error) {
      if (contaSelecionada) {
        await supabase.from('bm_extrato').insert([{
          org_id: orgId, conta_bancaria_id: contaSelecionada,
          data: dataHoje, descricao: r.descricao, tipo: 'credito',
          valor: r.valor, forma_pagamento: r.forma_pagamento,
          origem: 'contas_receber', origem_id: r.id,
        }])
      }
      toast.success('Recebimento registrado!')
      fetchAll()
      if (contaSelecionada) fetchExtrato(contaSelecionada)
    }
  }
  async function deleteR(id: string) {
    if (!confirm('Excluir lançamento?')) return
    await supabase.from('bm_contas_receber').delete().eq('id', id)
    setReceber(p => p.filter(r => r.id !== id))
    toast.success('Excluído.')
  }

  // ── Contas a Pagar ───────────────────────────────────────────────────────────

  function openNewP() {
    setEditingId(null)
    setFormP({ ...emptyPagar })
    setModalP(true)
  }
  function openEditP(p: any) {
    setEditingId(p.id)
    setFormP({
      fornecedor_id: p.fornecedor_id || '', categoria_id: p.categoria_id || '',
      centro_custo_id: p.centro_custo_id || '', descricao: p.descricao || '',
      valor: String(p.valor || ''), data_vencimento: p.data_vencimento || '',
      forma_pagamento: p.forma_pagamento || 'transferencia',
      recorrente: p.recorrente || false, observacoes: p.observacoes || '',
    })
    setModalP(true)
  }
  async function handleSaveP(e: React.FormEvent) {
    e.preventDefault()
    const payload: any = {
      org_id: orgId,
      fornecedor_id: formP.fornecedor_id || null,
      categoria_id: formP.categoria_id || null,
      centro_custo_id: formP.centro_custo_id || null,
      descricao: formP.descricao.trim(),
      valor: parseFloat(formP.valor),
      data_vencimento: formP.data_vencimento,
      forma_pagamento: formP.forma_pagamento,
      recorrente: formP.recorrente,
      observacoes: formP.observacoes.trim() || null,
    }
    if (!editingId) payload.status = 'a_pagar'
    const { error } = editingId
      ? await supabase.from('bm_contas_pagar').update(payload).eq('id', editingId)
      : await supabase.from('bm_contas_pagar').insert([payload])
    if (!error) { toast.success(editingId ? 'Atualizado!' : 'Lançamento criado!'); setModalP(false); fetchAll() }
    else toast.error(error.message)
  }
  async function marcarPagarPago(p: any) {
    const dataHoje = today()
    const { error } = await supabase.from('bm_contas_pagar').update({ status: 'pago', data_pagamento: dataHoje, valor_pago: p.valor }).eq('id', p.id)
    if (!error) {
      if (contaSelecionada) {
        await supabase.from('bm_extrato').insert([{
          org_id: orgId, conta_bancaria_id: contaSelecionada,
          data: dataHoje, descricao: p.descricao, tipo: 'debito',
          valor: p.valor, forma_pagamento: p.forma_pagamento,
          origem: 'contas_pagar', origem_id: p.id,
        }])
      }
      if (p.recorrente) {
        const proxMes = new Date(p.data_vencimento + 'T00:00:00')
        proxMes.setMonth(proxMes.getMonth() + 1)
        const novaData = proxMes.toISOString().split('T')[0]
        const confirma = confirm(`Conta recorrente. Criar lançamento para ${fmtDate(novaData)}?`)
        if (confirma) {
          await supabase.from('bm_contas_pagar').insert([{
            org_id: orgId, fornecedor_id: p.fornecedor_id, categoria_id: p.categoria_id,
            centro_custo_id: p.centro_custo_id, descricao: p.descricao, valor: p.valor,
            data_vencimento: novaData, forma_pagamento: p.forma_pagamento,
            recorrente: true, status: 'a_pagar',
          }])
        }
      }
      toast.success('Pagamento registrado!')
      fetchAll()
      if (contaSelecionada) fetchExtrato(contaSelecionada)
    }
  }
  async function deleteP(id: string) {
    if (!confirm('Excluir lançamento?')) return
    await supabase.from('bm_contas_pagar').delete().eq('id', id)
    setPagar(p => p.filter(x => x.id !== id))
    toast.success('Excluído.')
  }

  // ── Extrato manual ────────────────────────────────────────────────────────────

  async function handleSaveExtrato(e: React.FormEvent) {
    e.preventDefault()
    if (!contaSelecionada) return toast.error('Selecione uma conta bancária.')
    const { error } = await supabase.from('bm_extrato').insert([{
      org_id: orgId, conta_bancaria_id: contaSelecionada,
      data: formExtrato.data, descricao: formExtrato.descricao.trim(),
      tipo: formExtrato.tipo, valor: parseFloat(formExtrato.valor),
      observacoes: formExtrato.observacoes.trim() || null, origem: 'manual',
    }])
    if (!error) {
      toast.success('Lançamento adicionado!')
      setModalExtrato(false)
      setFormExtrato({ descricao: '', valor: '', tipo: 'credito', data: today(), observacoes: '' })
      fetchExtrato(contaSelecionada)
    } else toast.error(error.message)
  }

  // ── Config CRUD ───────────────────────────────────────────────────────────────

  const configMeta: Record<ConfigTab, { table: string; fields: { key: string; label: string; type?: string; options?: string[] }[] }> = {
    clientes: {
      table: 'bm_clientes',
      fields: [
        { key: 'nome', label: 'Nome *' },
        { key: 'cnpj', label: 'CNPJ' },
        { key: 'email', label: 'E-mail' },
        { key: 'telefone', label: 'Telefone' },
        { key: 'forma_pagamento', label: 'Forma de Pgto preferida', options: Object.keys(FORMA_LABELS) },
      ],
    },
    fornecedores: {
      table: 'bm_fornecedores',
      fields: [
        { key: 'nome', label: 'Nome *' },
        { key: 'cnpj', label: 'CNPJ' },
        { key: 'email', label: 'E-mail' },
        { key: 'telefone', label: 'Telefone' },
      ],
    },
    categorias: {
      table: 'bm_categorias',
      fields: [
        { key: 'nome', label: 'Nome *' },
        { key: 'tipo', label: 'Tipo *', options: ['receita', 'despesa'] },
      ],
    },
    centros: {
      table: 'bm_centros_custo',
      fields: [
        { key: 'nome', label: 'Nome *' },
        { key: 'descricao', label: 'Descrição' },
      ],
    },
    contas: {
      table: 'bm_contas_bancarias',
      fields: [
        { key: 'nome', label: 'Nome *' },
        { key: 'banco', label: 'Banco' },
        { key: 'tipo', label: 'Tipo', options: ['corrente', 'poupanca', 'caixa', 'outro'] },
        { key: 'saldo_inicial', label: 'Saldo Inicial (R$)', type: 'number' },
      ],
    },
  }
  const configData: Record<ConfigTab, any[]> = { clientes, fornecedores, categorias, centros, contas }

  function openNewConfig() {
    setEditingConfigId(null)
    const blank: Record<string, string> = {}
    configMeta[configTab].fields.forEach(f => { blank[f.key] = '' })
    setConfigForm(blank)
    setModalConfig(true)
  }
  function openEditConfig(row: any) {
    setEditingConfigId(row.id)
    const f: Record<string, string> = {}
    configMeta[configTab].fields.forEach(field => { f[field.key] = row[field.key] !== null && row[field.key] !== undefined ? String(row[field.key]) : '' })
    setConfigForm(f)
    setModalConfig(true)
  }
  async function handleSaveConfig(e: React.FormEvent) {
    e.preventDefault()
    const { table } = configMeta[configTab]
    const payload: any = { org_id: orgId }
    configMeta[configTab].fields.forEach(f => {
      if (f.type === 'number') payload[f.key] = parseFloat(configForm[f.key]) || 0
      else payload[f.key] = configForm[f.key] || null
    })
    const { error } = editingConfigId
      ? await supabase.from(table).update(payload).eq('id', editingConfigId)
      : await supabase.from(table).insert([payload])
    if (!error) { toast.success('Salvo!'); setModalConfig(false); fetchAll() }
    else toast.error(error.message)
  }
  async function deleteConfig(id: string) {
    if (!confirm('Excluir?')) return
    const { table } = configMeta[configTab]
    await supabase.from(table).delete().eq('id', id)
    fetchAll()
    toast.success('Excluído.')
  }

  // ── Cálculos dashboard ───────────────────────────────────────────────────────

  const hoje = today()
  const aReceber = receber.filter(r => r.status === 'aguardando').reduce((s, r) => s + (r.valor || 0), 0)
  const aPagar = pagar.filter(p => p.status === 'a_pagar').reduce((s, p) => s + (p.valor || 0), 0)
  const vencidoR = receber.filter(r => r.status === 'aguardando' && r.data_vencimento < hoje).reduce((s, r) => s + (r.valor || 0), 0)
  const vencidoP = pagar.filter(p => p.status === 'a_pagar' && p.data_vencimento < hoje).reduce((s, p) => s + (p.valor || 0), 0)
  const pagoMes = receber.filter(r => r.status === 'pago' && r.data_pagamento?.startsWith(hoje.slice(0, 7))).reduce((s, r) => s + (r.valor_pago || r.valor || 0), 0)
  const proximos7 = pagar.filter(p => p.status === 'a_pagar' && p.data_vencimento >= hoje && p.data_vencimento <= new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0])

  // Extrato com saldo corrente
  const contaObj = contas.find(c => c.id === contaSelecionada)
  const saldoInicial = contaObj?.saldo_inicial || 0
  let saldoCorrente = saldoInicial
  const extratoComSaldo = extrato.map(e => {
    if (e.tipo === 'credito') saldoCorrente += e.valor
    else saldoCorrente -= e.valor
    return { ...e, saldo: saldoCorrente }
  })

  // ── Render ────────────────────────────────────────────────────────────────────

  const TABS: { id: MainTab; label: string }[] = [
    { id: 'dashboard', label: 'Visão Geral' },
    { id: 'receber', label: 'A Receber' },
    { id: 'pagar', label: 'A Pagar' },
    { id: 'extrato', label: 'Extrato' },
    { id: 'config', label: 'Configurações' },
  ]

  return (
    <div className="p-4 md:p-8 space-y-4 md:space-y-6 bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="bg-white p-5 md:p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap justify-between items-center gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">FINANCEIRO</p>
          <h1 className="text-2xl font-black text-slate-900 mt-0.5">B&M Soluções</h1>
          <p className="text-xs text-slate-400 mt-0.5">Organização: <span className="font-bold text-slate-600">{orgName}</span></p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {tab === 'receber' && <button onClick={openNewR} className="bg-blue-600 text-white px-4 py-2 rounded-xl font-bold text-sm hover:bg-blue-700 transition-all">+ A Receber</button>}
          {tab === 'pagar' && <button onClick={openNewP} className="bg-rose-600 text-white px-4 py-2 rounded-xl font-bold text-sm hover:bg-rose-700 transition-all">+ A Pagar</button>}
          {tab === 'extrato' && <button onClick={() => setModalExtrato(true)} className="bg-slate-800 text-white px-4 py-2 rounded-xl font-bold text-sm hover:bg-slate-700 transition-all">+ Lançamento Manual</button>}
          {tab === 'config' && <button onClick={openNewConfig} className="bg-slate-800 text-white px-4 py-2 rounded-xl font-bold text-sm hover:bg-slate-700 transition-all">+ Novo</button>}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-5 py-2 rounded-xl font-bold text-sm transition-all ${tab === t.id ? 'bg-slate-900 text-white' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── DASHBOARD ── */}
      {tab === 'dashboard' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'A Receber',      value: fmt(aReceber),  color: 'text-blue-700',    bg: 'bg-blue-50 border-blue-100' },
              { label: 'A Pagar',        value: fmt(aPagar),    color: 'text-rose-700',    bg: 'bg-rose-50 border-rose-100' },
              { label: 'Em Atraso (rec)', value: fmt(vencidoR), color: 'text-red-700',     bg: 'bg-red-50 border-red-100' },
              { label: 'Recebido no Mês', value: fmt(pagoMes),  color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-100' },
            ].map(c => (
              <div key={c.label} className={`${c.bg} border p-5 rounded-2xl`}>
                <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest">{c.label}</p>
                <p className={`text-xl font-black mt-2 font-mono ${c.color}`}>{c.value}</p>
              </div>
            ))}
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            {/* Inadimplentes */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <h2 className="font-bold text-slate-800 text-sm">Recebíveis Vencidos</h2>
                <span className="text-[10px] font-black text-red-500 bg-red-50 border border-red-100 px-2 py-0.5 rounded-full">{fmt(vencidoR)}</span>
              </div>
              <div className="divide-y divide-slate-50">
                {receber.filter(r => r.status === 'aguardando' && r.data_vencimento < hoje).slice(0, 8).map(r => (
                  <div key={r.id} className="px-5 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-slate-800">{r.cliente?.nome || r.descricao}</p>
                      <p className="text-[10px] text-slate-400">Venceu {fmtDate(r.data_vencimento)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black font-mono text-red-600">{fmt(r.valor)}</p>
                      <button onClick={() => marcarReceberPago(r)} className="text-[10px] font-black text-emerald-600 hover:underline">Recebido ✓</button>
                    </div>
                  </div>
                ))}
                {receber.filter(r => r.status === 'aguardando' && r.data_vencimento < hoje).length === 0 && (
                  <p className="px-5 py-6 text-sm text-slate-400 italic text-center">Nenhum recebível vencido.</p>
                )}
              </div>
            </div>

            {/* Próximos vencimentos */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <h2 className="font-bold text-slate-800 text-sm">Vencimentos Próximos (7 dias)</h2>
                <span className="text-[10px] font-black text-yellow-600 bg-yellow-50 border border-yellow-100 px-2 py-0.5 rounded-full">{proximos7.length} contas</span>
              </div>
              <div className="divide-y divide-slate-50">
                {proximos7.slice(0, 8).map(p => (
                  <div key={p.id} className="px-5 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-slate-800">{p.fornecedor?.nome || p.descricao}</p>
                      <p className="text-[10px] text-slate-400">{p.categoria?.nome || '—'} · {fmtDate(p.data_vencimento)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black font-mono text-rose-600">{fmt(p.valor)}</p>
                      <button onClick={() => marcarPagarPago(p)} className="text-[10px] font-black text-emerald-600 hover:underline">Pago ✓</button>
                    </div>
                  </div>
                ))}
                {proximos7.length === 0 && (
                  <p className="px-5 py-6 text-sm text-slate-400 italic text-center">Sem vencimentos nos próximos 7 dias.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── CONTAS A RECEBER ── */}
      {tab === 'receber' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
          <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center gap-2">
            <p className="text-sm font-bold text-slate-700 mr-2">Filtrar:</p>
            {['todos', 'aguardando', 'vencido', 'pago', 'cancelado'].map(f => (
              <button key={f} onClick={() => setFilterR(f)}
                className={`px-3 py-1 rounded-full text-[11px] font-black border transition-all ${filterR === f ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}>
                {f === 'todos' ? 'Todos' : STATUS_R[f]?.label || f}
              </button>
            ))}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[700px]">
              <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400 tracking-widest">
                <tr>
                  <th className="px-5 py-3">Cliente</th>
                  <th className="px-5 py-3">Descrição</th>
                  <th className="px-5 py-3">NF / Parcela</th>
                  <th className="px-5 py-3">Vencimento</th>
                  <th className="px-5 py-3">Valor</th>
                  <th className="px-5 py-3">Forma</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {receber
                  .filter(r => filterR === 'todos' || r.status === filterR)
                  .map(r => {
                    const isVencido = r.status === 'aguardando' && r.data_vencimento < hoje
                    return (
                      <tr key={r.id} className={`hover:bg-slate-50 transition-colors ${isVencido ? 'bg-red-50/30' : ''}`}>
                        <td className="px-5 py-4 text-sm font-bold text-slate-800">{r.cliente?.nome || '—'}</td>
                        <td className="px-5 py-4 text-xs text-slate-500">{r.descricao}</td>
                        <td className="px-5 py-4 text-xs text-slate-500">{r.numero_nf || '—'}{r.parcela_total > 1 ? ` · ${r.parcela_numero}/${r.parcela_total}` : ''}</td>
                        <td className={`px-5 py-4 text-sm font-mono ${isVencido ? 'text-red-600 font-bold' : 'text-slate-700'}`}>{fmtDate(r.data_vencimento)}</td>
                        <td className="px-5 py-4 text-sm font-black font-mono text-slate-900">{fmt(r.valor)}</td>
                        <td className="px-5 py-4 text-xs text-slate-500">{FORMA_LABELS[r.forma_pagamento] || r.forma_pagamento}</td>
                        <td className="px-5 py-4">
                          <span className={`text-[10px] font-black px-2.5 py-1 rounded-full border ${STATUS_R[r.status]?.cls || 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                            {isVencido ? 'Vencido' : STATUS_R[r.status]?.label || r.status}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            {r.status === 'aguardando' && <button onClick={() => marcarReceberPago(r)} className="text-[10px] text-emerald-600 font-black hover:underline whitespace-nowrap">Recebido ✓</button>}
                            <button onClick={() => openEditR(r)} className="text-[10px] text-blue-500 hover:text-blue-700 font-bold">Editar</button>
                            <button onClick={() => deleteR(r.id)} className="text-[10px] text-red-300 hover:text-red-500 font-bold">Excluir</button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                {receber.filter(r => filterR === 'todos' || r.status === filterR).length === 0 && !loading && (
                  <tr><td colSpan={8} className="px-5 py-12 text-center text-slate-400 italic text-sm">Nenhum lançamento encontrado.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── CONTAS A PAGAR ── */}
      {tab === 'pagar' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
          <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center gap-2">
            <p className="text-sm font-bold text-slate-700 mr-2">Filtrar:</p>
            {['todos', 'a_pagar', 'vencido', 'pago', 'cancelado'].map(f => (
              <button key={f} onClick={() => setFilterP(f)}
                className={`px-3 py-1 rounded-full text-[11px] font-black border transition-all ${filterP === f ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}>
                {f === 'todos' ? 'Todos' : STATUS_P[f]?.label || f}
              </button>
            ))}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[800px]">
              <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400 tracking-widest">
                <tr>
                  <th className="px-5 py-3">Fornecedor</th>
                  <th className="px-5 py-3">Descrição</th>
                  <th className="px-5 py-3">Categoria</th>
                  <th className="px-5 py-3">Centro</th>
                  <th className="px-5 py-3">Vencimento</th>
                  <th className="px-5 py-3">Valor</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pagar
                  .filter(p => filterP === 'todos' || p.status === filterP)
                  .map(p => {
                    const isVencido = p.status === 'a_pagar' && p.data_vencimento < hoje
                    return (
                      <tr key={p.id} className={`hover:bg-slate-50 transition-colors ${isVencido ? 'bg-red-50/30' : ''}`}>
                        <td className="px-5 py-4 text-sm font-bold text-slate-800">{p.fornecedor?.nome || '—'}</td>
                        <td className="px-5 py-4 text-xs text-slate-500">
                          {p.descricao}
                          {p.recorrente && <span className="ml-1.5 text-[9px] font-black text-violet-500 bg-violet-50 border border-violet-100 px-1.5 py-0.5 rounded-full">↻ Recorrente</span>}
                        </td>
                        <td className="px-5 py-4 text-xs text-slate-500">{p.categoria?.nome || '—'}</td>
                        <td className="px-5 py-4 text-xs text-slate-500">{p.centro?.nome || '—'}</td>
                        <td className={`px-5 py-4 text-sm font-mono ${isVencido ? 'text-red-600 font-bold' : 'text-slate-700'}`}>{fmtDate(p.data_vencimento)}</td>
                        <td className="px-5 py-4 text-sm font-black font-mono text-slate-900">{fmt(p.valor)}</td>
                        <td className="px-5 py-4">
                          <span className={`text-[10px] font-black px-2.5 py-1 rounded-full border ${STATUS_P[p.status]?.cls || 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                            {isVencido ? 'Vencido' : STATUS_P[p.status]?.label || p.status}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            {p.status === 'a_pagar' && <button onClick={() => marcarPagarPago(p)} className="text-[10px] text-emerald-600 font-black hover:underline whitespace-nowrap">Pago ✓</button>}
                            <button onClick={() => openEditP(p)} className="text-[10px] text-blue-500 hover:text-blue-700 font-bold">Editar</button>
                            <button onClick={() => deleteP(p.id)} className="text-[10px] text-red-300 hover:text-red-500 font-bold">Excluir</button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                {pagar.filter(p => filterP === 'todos' || p.status === filterP).length === 0 && !loading && (
                  <tr><td colSpan={8} className="px-5 py-12 text-center text-slate-400 italic text-sm">Nenhum lançamento encontrado.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── EXTRATO ── */}
      {tab === 'extrato' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <select value={contaSelecionada} onChange={e => setContaSelecionada(e.target.value)}
              className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500/20">
              {contas.map(c => <option key={c.id} value={c.id}>{c.nome} {c.banco ? `· ${c.banco}` : ''}</option>)}
            </select>
            {contaObj && (
              <span className="text-sm text-slate-500">Saldo inicial: <span className="font-black font-mono text-slate-800">{fmt(contaObj.saldo_inicial || 0)}</span></span>
            )}
          </div>

          {contas.length === 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400 italic">
              Cadastre uma conta bancária em Configurações para visualizar o extrato.
            </div>
          )}

          {contaSelecionada && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <h2 className="font-bold text-slate-800 text-sm">Extrato Bancário</h2>
                {extratoComSaldo.length > 0 && (
                  <span className={`text-sm font-black font-mono ${extratoComSaldo[extratoComSaldo.length - 1]?.saldo >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    Saldo: {fmt(extratoComSaldo[extratoComSaldo.length - 1]?.saldo || saldoInicial)}
                  </span>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left min-w-[600px]">
                  <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400 tracking-widest">
                    <tr>
                      <th className="px-5 py-3">Data</th>
                      <th className="px-5 py-3">Descrição</th>
                      <th className="px-5 py-3">Forma</th>
                      <th className="px-5 py-3 text-right">Débito</th>
                      <th className="px-5 py-3 text-right">Crédito</th>
                      <th className="px-5 py-3 text-right">Saldo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <tr className="bg-slate-50">
                      <td className="px-5 py-3 text-xs text-slate-500 font-mono">—</td>
                      <td className="px-5 py-3 text-xs text-slate-500 italic">Saldo inicial</td>
                      <td className="px-5 py-3"></td>
                      <td className="px-5 py-3"></td>
                      <td className="px-5 py-3"></td>
                      <td className="px-5 py-3 text-right text-sm font-black font-mono text-slate-700">{fmt(saldoInicial)}</td>
                    </tr>
                    {extratoComSaldo.map(e => (
                      <tr key={e.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-5 py-3 text-xs font-mono text-slate-600">{fmtDate(e.data)}</td>
                        <td className="px-5 py-3">
                          <p className="text-sm text-slate-800">{e.descricao}</p>
                          {e.observacoes && <p className="text-[10px] text-slate-400">{e.observacoes}</p>}
                        </td>
                        <td className="px-5 py-3 text-xs text-slate-500">{FORMA_LABELS[e.forma_pagamento] || e.origem === 'manual' ? 'Manual' : '—'}</td>
                        <td className="px-5 py-3 text-right text-sm font-mono font-black text-red-600">{e.tipo === 'debito' ? fmt(e.valor) : ''}</td>
                        <td className="px-5 py-3 text-right text-sm font-mono font-black text-emerald-600">{e.tipo === 'credito' ? fmt(e.valor) : ''}</td>
                        <td className={`px-5 py-3 text-right text-sm font-black font-mono ${e.saldo >= 0 ? 'text-slate-800' : 'text-red-600'}`}>{fmt(e.saldo)}</td>
                      </tr>
                    ))}
                    {extratoComSaldo.length === 0 && (
                      <tr><td colSpan={6} className="px-5 py-12 text-center text-slate-400 italic text-sm">Nenhuma movimentação nesta conta.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── CONFIGURAÇÕES ── */}
      {tab === 'config' && (
        <div className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            {(['clientes', 'fornecedores', 'categorias', 'centros', 'contas'] as ConfigTab[]).map(ct => (
              <button key={ct} onClick={() => setConfigTab(ct)}
                className={`px-4 py-2 rounded-xl font-bold text-sm transition-all border ${configTab === ct ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}>
                {ct === 'clientes' ? 'Clientes' : ct === 'fornecedores' ? 'Fornecedores' : ct === 'categorias' ? 'Categorias' : ct === 'centros' ? 'Centros de Custo' : 'Contas Bancárias'}
              </button>
            ))}
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400 tracking-widest">
                <tr>
                  {configMeta[configTab].fields.map(f => (
                    <th key={f.key} className="px-5 py-3">{f.label.replace(' *', '')}</th>
                  ))}
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {configData[configTab].map(row => (
                  <tr key={row.id} className="hover:bg-slate-50">
                    {configMeta[configTab].fields.map(f => (
                      <td key={f.key} className="px-5 py-3 text-sm text-slate-700">
                        {f.options ? (f.options.includes(row[f.key]) ? row[f.key] : row[f.key]) : (row[f.key] ?? '—')}
                      </td>
                    ))}
                    <td className="px-5 py-3">
                      <div className="flex gap-2">
                        <button onClick={() => openEditConfig(row)} className="text-[10px] text-blue-500 hover:text-blue-700 font-bold">Editar</button>
                        <button onClick={() => deleteConfig(row.id)} className="text-[10px] text-red-300 hover:text-red-500 font-bold">Excluir</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {configData[configTab].length === 0 && !loading && (
                  <tr><td colSpan={configMeta[configTab].fields.length + 1} className="px-5 py-12 text-center text-slate-400 italic text-sm">Nenhum registro. Clique em "+ Novo" para adicionar.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── MODAL CONTAS A RECEBER ── */}
      {modalR && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-lg rounded-3xl p-6 md:p-8 border border-slate-200 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-6 text-slate-900">{editingId ? 'Editar Recebível' : 'Novo Lançamento a Receber'}</h2>
            <form onSubmit={handleSaveR} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase">Cliente</label>
                  <select value={formR.cliente_id} onChange={e => setFormR({ ...formR, cliente_id: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm mt-1 outline-none">
                    <option value="">— Nenhum —</option>
                    {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase">Descrição *</label>
                  <input required value={formR.descricao} onChange={e => setFormR({ ...formR, descricao: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm mt-1 outline-none" placeholder="Ex: Consultoria Outubro/2026" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase">Valor (R$) *</label>
                  <input required type="number" step="0.01" min="0" value={formR.valor} onChange={e => setFormR({ ...formR, valor: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm mt-1 outline-none" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase">Vencimento *</label>
                  <input required type="date" value={formR.data_vencimento} onChange={e => setFormR({ ...formR, data_vencimento: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm mt-1 outline-none" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase">Forma de Pgto</label>
                  <select value={formR.forma_pagamento} onChange={e => setFormR({ ...formR, forma_pagamento: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm mt-1 outline-none">
                    {Object.entries(FORMA_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase">Nº NF</label>
                  <input value={formR.numero_nf} onChange={e => setFormR({ ...formR, numero_nf: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm mt-1 outline-none" placeholder="opcional" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase">Parcela</label>
                  <input type="number" min="1" value={formR.parcela_numero} onChange={e => setFormR({ ...formR, parcela_numero: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm mt-1 outline-none" placeholder="1" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase">Total parcelas</label>
                  <input type="number" min="1" value={formR.parcela_total} onChange={e => setFormR({ ...formR, parcela_total: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm mt-1 outline-none" placeholder="1" />
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase">Observações</label>
                  <input value={formR.observacoes} onChange={e => setFormR({ ...formR, observacoes: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm mt-1 outline-none" />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setModalR(false)} className="flex-1 bg-slate-100 text-slate-600 py-3 rounded-xl font-bold text-sm">Cancelar</button>
                <button type="submit" className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-bold text-sm hover:bg-blue-700 transition-all">{editingId ? 'Atualizar' : 'Salvar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL CONTAS A PAGAR ── */}
      {modalP && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-lg rounded-3xl p-6 md:p-8 border border-slate-200 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-6 text-slate-900">{editingId ? 'Editar Conta a Pagar' : 'Nova Conta a Pagar'}</h2>
            <form onSubmit={handleSaveP} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase">Descrição *</label>
                  <input required value={formP.descricao} onChange={e => setFormP({ ...formP, descricao: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm mt-1 outline-none" placeholder="Ex: Aluguel Outubro" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase">Fornecedor</label>
                  <select value={formP.fornecedor_id} onChange={e => setFormP({ ...formP, fornecedor_id: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm mt-1 outline-none">
                    <option value="">— Nenhum —</option>
                    {fornecedores.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase">Categoria</label>
                  <select value={formP.categoria_id} onChange={e => setFormP({ ...formP, categoria_id: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm mt-1 outline-none">
                    <option value="">— Nenhuma —</option>
                    {categorias.filter(c => c.tipo === 'despesa').map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase">Centro de Custo</label>
                  <select value={formP.centro_custo_id} onChange={e => setFormP({ ...formP, centro_custo_id: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm mt-1 outline-none">
                    <option value="">— Nenhum —</option>
                    {centros.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase">Valor (R$) *</label>
                  <input required type="number" step="0.01" min="0" value={formP.valor} onChange={e => setFormP({ ...formP, valor: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm mt-1 outline-none" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase">Vencimento *</label>
                  <input required type="date" value={formP.data_vencimento} onChange={e => setFormP({ ...formP, data_vencimento: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm mt-1 outline-none" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase">Forma de Pgto</label>
                  <select value={formP.forma_pagamento} onChange={e => setFormP({ ...formP, forma_pagamento: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm mt-1 outline-none">
                    {Object.entries(FORMA_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div className="col-span-2 flex items-center gap-3 bg-violet-50 border border-violet-100 rounded-xl p-3">
                  <input type="checkbox" id="recorrente" checked={formP.recorrente} onChange={e => setFormP({ ...formP, recorrente: e.target.checked })}
                    className="w-4 h-4 accent-violet-600" />
                  <label htmlFor="recorrente" className="text-sm font-bold text-violet-700 cursor-pointer">
                    Conta recorrente (mensal) — pergunta ao pagar se deseja criar o próximo mês
                  </label>
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase">Observações</label>
                  <input value={formP.observacoes} onChange={e => setFormP({ ...formP, observacoes: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm mt-1 outline-none" />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setModalP(false)} className="flex-1 bg-slate-100 text-slate-600 py-3 rounded-xl font-bold text-sm">Cancelar</button>
                <button type="submit" className="flex-1 bg-rose-600 text-white py-3 rounded-xl font-bold text-sm hover:bg-rose-700 transition-all">{editingId ? 'Atualizar' : 'Salvar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL EXTRATO MANUAL ── */}
      {modalExtrato && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 md:p-8 border border-slate-200 shadow-2xl">
            <h2 className="text-xl font-bold mb-6 text-slate-900">Lançamento Manual no Extrato</h2>
            <form onSubmit={handleSaveExtrato} className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase">Tipo *</label>
                <div className="flex gap-3 mt-2">
                  {[{ v: 'credito', l: 'Crédito (entrada)', cls: 'border-emerald-400 bg-emerald-50 text-emerald-700' }, { v: 'debito', l: 'Débito (saída)', cls: 'border-red-400 bg-red-50 text-red-700' }].map(t => (
                    <button key={t.v} type="button" onClick={() => setFormExtrato({ ...formExtrato, tipo: t.v })}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-bold border-2 transition-all ${formExtrato.tipo === t.v ? t.cls : 'border-slate-200 bg-white text-slate-500'}`}>
                      {t.l}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase">Descrição *</label>
                <input required value={formExtrato.descricao} onChange={e => setFormExtrato({ ...formExtrato, descricao: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm mt-1 outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase">Valor (R$) *</label>
                  <input required type="number" step="0.01" min="0" value={formExtrato.valor} onChange={e => setFormExtrato({ ...formExtrato, valor: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm mt-1 outline-none" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase">Data *</label>
                  <input required type="date" value={formExtrato.data} onChange={e => setFormExtrato({ ...formExtrato, data: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm mt-1 outline-none" />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase">Observações</label>
                <input value={formExtrato.observacoes} onChange={e => setFormExtrato({ ...formExtrato, observacoes: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm mt-1 outline-none" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setModalExtrato(false)} className="flex-1 bg-slate-100 text-slate-600 py-3 rounded-xl font-bold text-sm">Cancelar</button>
                <button type="submit" className="flex-1 bg-slate-800 text-white py-3 rounded-xl font-bold text-sm hover:bg-slate-700 transition-all">Adicionar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL CONFIG ── */}
      {modalConfig && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 md:p-8 border border-slate-200 shadow-2xl">
            <h2 className="text-xl font-bold mb-6 text-slate-900">{editingConfigId ? 'Editar' : 'Novo'} registro</h2>
            <form onSubmit={handleSaveConfig} className="space-y-4">
              {configMeta[configTab].fields.map(f => (
                <div key={f.key}>
                  <label className="text-[10px] font-black text-slate-400 uppercase">{f.label}</label>
                  {f.options ? (
                    <select value={configForm[f.key] || ''} onChange={e => setConfigForm({ ...configForm, [f.key]: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm mt-1 outline-none">
                      <option value="">— Selecione —</option>
                      {f.options.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : (
                    <input
                      type={f.type || 'text'}
                      value={configForm[f.key] || ''}
                      onChange={e => setConfigForm({ ...configForm, [f.key]: e.target.value })}
                      required={f.label.includes('*')}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm mt-1 outline-none"
                    />
                  )}
                </div>
              ))}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setModalConfig(false)} className="flex-1 bg-slate-100 text-slate-600 py-3 rounded-xl font-bold text-sm">Cancelar</button>
                <button type="submit" className="flex-1 bg-slate-800 text-white py-3 rounded-xl font-bold text-sm hover:bg-slate-700 transition-all">{editingConfigId ? 'Atualizar' : 'Salvar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
