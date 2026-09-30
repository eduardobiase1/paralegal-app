'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useOrg } from '@/lib/org-context'
import toast from 'react-hot-toast'

type MainTab = 'dashboard' | 'receber' | 'pagar' | 'extrato' | 'config'
type ConfigTab = 'clientes' | 'fornecedores' | 'categorias' | 'centros' | 'contas'

const FORMA_LABELS: Record<string, string> = {
  boleto: 'Boleto', pix: 'PIX', nf: 'Nota Fiscal',
  transferencia: 'Transferência', dinheiro: 'Dinheiro',
  debito_automatico: 'Débito Automático', outro: 'Outro',
}

const MESES_PT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

const STATUS_R: Record<string, { label: string; dot: string; badge: string }> = {
  aguardando: { label: 'A Receber',  dot: 'bg-blue-500',    badge: 'bg-blue-50 text-blue-700 ring-blue-200' },
  pago:       { label: 'Recebido',   dot: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  vencido:    { label: 'Vencido',    dot: 'bg-red-500',     badge: 'bg-red-50 text-red-700 ring-red-200' },
  cancelado:  { label: 'Cancelado',  dot: 'bg-slate-400',   badge: 'bg-slate-100 text-slate-500 ring-slate-200' },
}
const STATUS_P: Record<string, { label: string; dot: string; badge: string }> = {
  a_pagar:   { label: 'A Pagar',   dot: 'bg-amber-500',   badge: 'bg-amber-50 text-amber-700 ring-amber-200' },
  pago:      { label: 'Pago',      dot: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  vencido:   { label: 'Vencido',   dot: 'bg-red-500',     badge: 'bg-red-50 text-red-700 ring-red-200' },
  cancelado: { label: 'Cancelado', dot: 'bg-slate-400',   badge: 'bg-slate-100 text-slate-500 ring-slate-200' },
}

function fmt(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR')
}
function today() { return new Date().toISOString().split('T')[0] }
function fmtShort(n: number) {
  const abs = Math.abs(n)
  if (abs >= 1000000) return 'R$' + (n / 1000000).toFixed(1) + 'M'
  if (abs >= 1000) return 'R$' + (n / 1000).toFixed(0) + 'k'
  return 'R$' + n.toFixed(0)
}

const emptyR = {
  cliente_id: '', descricao: '', valor: '', data_vencimento: '',
  forma_pagamento: 'pix', numero_nf: '', parcela_numero: '1',
  parcela_total: '1', observacoes: '', categoria_id: '',
}
const emptyP = {
  fornecedor_id: '', categoria_id: '', centro_custo_id: '', descricao: '',
  valor: '', data_vencimento: '', forma_pagamento: 'transferencia',
  recorrente: false, observacoes: '',
}

// ── OFX / CSV parsers ────────────────────────────────────────────────────────
function parseOFX(text: string) {
  const txns: any[] = []
  const regex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi
  let m
  while ((m = regex.exec(text)) !== null) {
    const block = m[1]
    const get = (tag: string) => { const r = new RegExp(`<${tag}>([^<\\n\\r]+)`, 'i'); const v = r.exec(block); return v ? v[1].trim() : '' }
    const dtposted = get('DTPOSTED').slice(0, 8)
    const trnamt = parseFloat(get('TRNAMT').replace(',', '.'))
    const fitid = get('FITID') || String(txns.length)
    const memo = get('MEMO') || get('NAME') || ''
    if (!dtposted || isNaN(trnamt)) continue
    const date = `${dtposted.slice(0, 4)}-${dtposted.slice(4, 6)}-${dtposted.slice(6, 8)}`
    txns.push({ id: fitid, date, descricao: memo, valor: Math.abs(trnamt), tipo: trnamt >= 0 ? 'credito' : 'debito' })
  }
  return txns
}

function parseCSV(text: string) {
  const lines = text.split('\n').filter(l => l.trim())
  const start = lines[0]?.match(/[a-zA-Z]{3,}/) ? 1 : 0
  const txns: any[] = []
  lines.slice(start).forEach((line, i) => {
    const sep = line.includes(';') ? ';' : ','
    const cols = line.split(sep).map(c => c.trim().replace(/^"|"$/g, ''))
    if (cols.length < 3) return
    const raw = cols[0]
    let date = ''
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) { const [d, mo, y] = raw.split('/'); date = `${y}-${mo}-${d}` }
    else if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) { date = raw }
    if (!date) return
    const descricao = cols[1] || ''
    let valor = 0, tipo = 'credito'
    if (cols.length >= 4) {
      const deb = parseFloat(cols[2].replace(/\./g, '').replace(',', '.')) || 0
      const cred = parseFloat(cols[3].replace(/\./g, '').replace(',', '.')) || 0
      if (cred > 0) { valor = cred; tipo = 'credito' } else if (deb > 0) { valor = deb; tipo = 'debito' }
    } else {
      const v = parseFloat(cols[2].replace(/\./g, '').replace(',', '.'))
      if (isNaN(v)) return
      valor = Math.abs(v); tipo = v >= 0 ? 'credito' : 'debito'
    }
    if (valor <= 0) return
    txns.push({ id: `csv-${i}`, date, descricao, valor, tipo })
  })
  return txns
}

function FieldInput({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-500 mb-1.5">{label}</label>
      <input {...props} className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all placeholder:text-slate-300" />
    </div>
  )
}
function FieldSelect({ label, children, ...props }: { label: string } & React.SelectHTMLAttributes<HTMLSelectElement> & { children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-500 mb-1.5">{label}</label>
      <select {...props} className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all">
        {children}
      </select>
    </div>
  )
}

function StatusBadge({ status, map }: { status: string; map: typeof STATUS_R }) {
  const s = map[status]
  if (!s) return <span className="text-xs text-slate-400">{status}</span>
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ring-1 ring-inset ${s.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  )
}

function SummaryCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{label}</p>
      <p className={`text-2xl font-bold mt-2 tabular-nums ${color}`}>{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  )
}

export default function FinanceiroPage() {
  const { orgId, orgName } = useOrg()
  const [supabase] = useState(createClient())
  const [tab, setTab] = useState<MainTab>('dashboard')
  const [configTab, setConfigTab] = useState<ConfigTab>('clientes')

  const [receber, setReceber] = useState<any[]>([])
  const [pagar, setPagar] = useState<any[]>([])
  const [extrato, setExtrato] = useState<any[]>([])
  const [clientes, setClientes] = useState<any[]>([])
  const [fornecedores, setFornecedores] = useState<any[]>([])
  const [categorias, setCategorias] = useState<any[]>([])
  const [centros, setCentros] = useState<any[]>([])
  const [contas, setContas] = useState<any[]>([])
  const [contaSel, setContaSel] = useState('')
  const [filterR, setFilterR] = useState('todos')
  const [filterP, setFilterP] = useState('todos')
  const [loading, setLoading] = useState(true)

  const [modalR, setModalR] = useState(false)
  const [modalP, setModalP] = useState(false)
  const [modalE, setModalE] = useState(false)
  const [modalCfg, setModalCfg] = useState(false)
  const [modalOFX, setModalOFX] = useState(false)
  const [ofxTxns, setOfxTxns] = useState<any[]>([])
  const [selOFX, setSelOFX] = useState<Set<string>>(new Set())
  const fileRef = useRef<HTMLInputElement>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [formR, setFormR] = useState({ ...emptyR })
  const [formP, setFormP] = useState({ ...emptyP })
  const [formE, setFormE] = useState({ descricao: '', valor: '', tipo: 'credito', data: today(), observacoes: '' })
  const [cfgForm, setCfgForm] = useState<Record<string, string>>({})

  const fetchAll = useCallback(async () => {
    if (!orgId) return
    setLoading(true)
    const [rR, rP, rCl, rFo, rCa, rCe, rCo] = await Promise.all([
      supabase.from('bm_contas_receber').select('*, cliente:bm_clientes(nome), categoria:bm_categorias(nome)').eq('org_id', orgId).order('data_vencimento'),
      supabase.from('bm_contas_pagar').select('*, fornecedor:bm_fornecedores(nome), categoria:bm_categorias(nome), centro:bm_centros_custo(nome)').eq('org_id', orgId).order('data_vencimento'),
      supabase.from('bm_clientes').select('*').eq('org_id', orgId).eq('ativo', true).order('nome'),
      supabase.from('bm_fornecedores').select('*').eq('org_id', orgId).eq('ativo', true).order('nome'),
      supabase.from('bm_categorias').select('*').eq('org_id', orgId).order('nome'),
      supabase.from('bm_centros_custo').select('*').eq('org_id', orgId).order('nome'),
      supabase.from('bm_contas_bancarias').select('*').eq('org_id', orgId).eq('ativa', true).order('nome'),
    ])
    setReceber(rR.data || [])
    setPagar(rP.data || [])
    setClientes(rCl.data || [])
    setFornecedores(rFo.data || [])
    setCategorias(rCa.data || [])
    setCentros(rCe.data || [])
    setContas(rCo.data || [])
    if (!contaSel && rCo.data?.length) setContaSel(rCo.data[0].id)
    setLoading(false)
  }, [supabase, orgId, contaSel])

  const fetchExtrato = useCallback(async (id: string) => {
    if (!id) return
    const { data } = await supabase.from('bm_extrato').select('*').eq('conta_bancaria_id', id).order('data').order('created_at')
    setExtrato(data || [])
  }, [supabase])

  useEffect(() => { if (orgId) fetchAll() }, [orgId, fetchAll])
  useEffect(() => { if (contaSel) fetchExtrato(contaSel) }, [contaSel, fetchExtrato])

  // ── Receber ──────────────────────────────────────────────────────────────────
  async function saveR(e: React.FormEvent) {
    e.preventDefault()
    const p: any = {
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
    if (!editId) p.status = 'aguardando'
    const { error } = editId
      ? await supabase.from('bm_contas_receber').update(p).eq('id', editId)
      : await supabase.from('bm_contas_receber').insert([p])
    if (!error) { toast.success(editId ? 'Atualizado!' : 'Criado!'); setModalR(false); fetchAll() }
    else toast.error(error.message)
  }

  async function receberPago(r: any) {
    const dt = today()
    await supabase.from('bm_contas_receber').update({ status: 'pago', data_pagamento: dt, valor_pago: r.valor }).eq('id', r.id)
    if (contaSel) {
      await supabase.from('bm_extrato').insert([{
        org_id: orgId, conta_bancaria_id: contaSel, data: dt,
        descricao: r.descricao, tipo: 'credito', valor: r.valor,
        forma_pagamento: r.forma_pagamento, origem: 'contas_receber', origem_id: r.id,
      }])
    }
    toast.success('Recebimento registrado!')
    fetchAll()
    if (contaSel) fetchExtrato(contaSel)
  }

  async function estornarR(r: any) {
    if (!confirm('Estornar recebimento? O lançamento no extrato será removido.')) return
    await supabase.from('bm_contas_receber').update({ status: 'aguardando', data_pagamento: null, valor_pago: null }).eq('id', r.id)
    await supabase.from('bm_extrato').delete().eq('origem', 'contas_receber').eq('origem_id', r.id)
    toast.success('Recebimento estornado.')
    fetchAll()
    if (contaSel) fetchExtrato(contaSel)
  }

  async function deleteR(id: string) {
    if (!confirm('Excluir este lançamento? O extrato também será atualizado.')) return
    await supabase.from('bm_extrato').delete().eq('origem', 'contas_receber').eq('origem_id', id)
    await supabase.from('bm_contas_receber').delete().eq('id', id)
    setReceber(p => p.filter(x => x.id !== id))
    if (contaSel) fetchExtrato(contaSel)
    toast.success('Excluído.')
  }

  // ── Pagar ────────────────────────────────────────────────────────────────────
  async function saveP(e: React.FormEvent) {
    e.preventDefault()
    const p: any = {
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
    if (!editId) p.status = 'a_pagar'
    const { error } = editId
      ? await supabase.from('bm_contas_pagar').update(p).eq('id', editId)
      : await supabase.from('bm_contas_pagar').insert([p])
    if (!error) { toast.success(editId ? 'Atualizado!' : 'Criado!'); setModalP(false); fetchAll() }
    else toast.error(error.message)
  }

  async function pagarPago(p: any) {
    const dt = today()
    await supabase.from('bm_contas_pagar').update({ status: 'pago', data_pagamento: dt, valor_pago: p.valor }).eq('id', p.id)
    if (contaSel) {
      await supabase.from('bm_extrato').insert([{
        org_id: orgId, conta_bancaria_id: contaSel, data: dt,
        descricao: p.descricao, tipo: 'debito', valor: p.valor,
        forma_pagamento: p.forma_pagamento, origem: 'contas_pagar', origem_id: p.id,
      }])
    }
    if (p.recorrente) {
      const d = new Date(p.data_vencimento + 'T00:00:00')
      d.setMonth(d.getMonth() + 1)
      const nd = d.toISOString().split('T')[0]
      if (confirm('Conta recorrente — criar próximo vencimento em ' + fmtDate(nd) + '?')) {
        await supabase.from('bm_contas_pagar').insert([{
          org_id: orgId, fornecedor_id: p.fornecedor_id, categoria_id: p.categoria_id,
          centro_custo_id: p.centro_custo_id, descricao: p.descricao, valor: p.valor,
          data_vencimento: nd, forma_pagamento: p.forma_pagamento, recorrente: true, status: 'a_pagar',
        }])
      }
    }
    toast.success('Pagamento registrado!')
    fetchAll()
    if (contaSel) fetchExtrato(contaSel)
  }

  async function estornarP(p: any) {
    if (!confirm('Estornar pagamento? O lançamento no extrato será removido.')) return
    await supabase.from('bm_contas_pagar').update({ status: 'a_pagar', data_pagamento: null, valor_pago: null }).eq('id', p.id)
    await supabase.from('bm_extrato').delete().eq('origem', 'contas_pagar').eq('origem_id', p.id)
    toast.success('Pagamento estornado.')
    fetchAll()
    if (contaSel) fetchExtrato(contaSel)
  }

  async function deleteP(id: string) {
    if (!confirm('Excluir este lançamento? O extrato também será atualizado.')) return
    await supabase.from('bm_extrato').delete().eq('origem', 'contas_pagar').eq('origem_id', id)
    await supabase.from('bm_contas_pagar').delete().eq('id', id)
    setPagar(p => p.filter(x => x.id !== id))
    if (contaSel) fetchExtrato(contaSel)
    toast.success('Excluído.')
  }

  // ── Extrato ──────────────────────────────────────────────────────────────────
  async function saveExtrato(e: React.FormEvent) {
    e.preventDefault()
    if (!contaSel) return toast.error('Selecione uma conta bancária.')
    const { error } = await supabase.from('bm_extrato').insert([{
      org_id: orgId, conta_bancaria_id: contaSel,
      data: formE.data, descricao: formE.descricao.trim(),
      tipo: formE.tipo, valor: parseFloat(formE.valor),
      observacoes: formE.observacoes.trim() || null, origem: 'manual',
    }])
    if (!error) {
      toast.success('Lançamento adicionado!')
      setModalE(false)
      setFormE({ descricao: '', valor: '', tipo: 'credito', data: today(), observacoes: '' })
      fetchExtrato(contaSel)
    } else toast.error(error.message)
  }

  // ── Config ───────────────────────────────────────────────────────────────────
  const cfgMeta: Record<ConfigTab, { table: string; cols: { key: string; label: string; type?: string; opts?: string[] }[] }> = {
    clientes:     { table: 'bm_clientes',         cols: [{ key: 'nome', label: 'Nome' }, { key: 'cnpj', label: 'CNPJ' }, { key: 'email', label: 'E-mail' }, { key: 'telefone', label: 'Telefone' }] },
    fornecedores: { table: 'bm_fornecedores',     cols: [{ key: 'nome', label: 'Nome' }, { key: 'cnpj', label: 'CNPJ' }, { key: 'email', label: 'E-mail' }, { key: 'telefone', label: 'Telefone' }] },
    categorias:   { table: 'bm_categorias',       cols: [{ key: 'nome', label: 'Nome' }, { key: 'tipo', label: 'Tipo', opts: ['receita', 'despesa'] }] },
    centros:      { table: 'bm_centros_custo',    cols: [{ key: 'nome', label: 'Nome' }, { key: 'descricao', label: 'Descrição' }] },
    contas:       { table: 'bm_contas_bancarias', cols: [{ key: 'nome', label: 'Nome' }, { key: 'banco', label: 'Banco' }, { key: 'tipo', label: 'Tipo', opts: ['corrente', 'poupanca', 'caixa', 'outro'] }, { key: 'saldo_inicial', label: 'Saldo Inicial (R$)', type: 'number' }] },
  }
  const cfgData: Record<ConfigTab, any[]> = { clientes, fornecedores, categorias, centros, contas }

  async function saveCfg(e: React.FormEvent) {
    e.preventDefault()
    const { table, cols } = cfgMeta[configTab]
    const p: any = { org_id: orgId }
    cols.forEach(c => { p[c.key] = c.type === 'number' ? parseFloat(cfgForm[c.key]) || 0 : cfgForm[c.key] || null })
    const { error } = editId
      ? await supabase.from(table).update(p).eq('id', editId)
      : await supabase.from(table).insert([p])
    if (!error) { toast.success('Salvo!'); setModalCfg(false); fetchAll() }
    else toast.error(error.message)
  }

  async function deleteCfg(id: string) {
    if (!confirm('Excluir?')) return
    await supabase.from(cfgMeta[configTab].table).delete().eq('id', id)
    fetchAll()
    toast.success('Excluído.')
  }

  // ── Cálculos ─────────────────────────────────────────────────────────────────
  const hj = today()
  const totalAReceber = receber.filter(r => r.status === 'aguardando').reduce((s, r) => s + (r.valor || 0), 0)
  const totalAPagar   = pagar.filter(p => p.status === 'a_pagar').reduce((s, p) => s + (p.valor || 0), 0)
  const totalVencR    = receber.filter(r => r.status === 'aguardando' && r.data_vencimento < hj).reduce((s, r) => s + (r.valor || 0), 0)
  const totalPagoMes  = receber.filter(r => r.status === 'pago' && r.data_pagamento?.startsWith(hj.slice(0, 7))).reduce((s, r) => s + (r.valor_pago || r.valor || 0), 0)
  const prox7 = pagar.filter(p => {
    const d7 = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]
    return p.status === 'a_pagar' && p.data_vencimento >= hj && p.data_vencimento <= d7
  })

  const contaObj = contas.find(c => c.id === contaSel)
  const saldo0 = contaObj?.saldo_inicial || 0
  let balanco = saldo0
  const extratoSaldo = extrato.map(e => {
    balanco += e.tipo === 'credito' ? e.valor : -e.valor
    return { ...e, saldo: balanco }
  })

  // ── Conciliação OFX/CSV ───────────────────────────────────────────────────────
  function isJaLancado(txn: any) {
    return extrato.some(e =>
      e.tipo === txn.tipo &&
      Math.abs(e.valor - txn.valor) < 0.01 &&
      Math.abs(new Date(e.data + 'T00:00:00').getTime() - new Date(txn.date + 'T00:00:00').getTime()) <= 86400000
    )
  }

  function handleFileUpload(file: File) {
    const reader = new FileReader()
    reader.onload = ev => {
      const text = ev.target?.result as string
      const txns = file.name.toLowerCase().endsWith('.ofx') ? parseOFX(text) : parseCSV(text)
      if (!txns.length) return toast.error('Nenhuma transação encontrada no arquivo.')
      setOfxTxns(txns)
      const novas = new Set(txns.filter(t => !isJaLancado(t)).map((t: any) => t.id))
      setSelOFX(novas)
      setModalOFX(true)
    }
    reader.readAsText(file, 'latin1')
  }

  async function importarOFX() {
    const toImport = ofxTxns.filter(t => selOFX.has(t.id))
    if (!toImport.length) return toast.error('Nenhuma transação selecionada.')
    if (!contaSel) return toast.error('Selecione uma conta bancária.')
    const rows = toImport.map(t => ({
      org_id: orgId, conta_bancaria_id: contaSel,
      data: t.date, descricao: t.descricao, tipo: t.tipo, valor: t.valor, origem: 'ofx',
    }))
    const { error } = await supabase.from('bm_extrato').insert(rows)
    if (!error) {
      toast.success(`${toImport.length} lançamento${toImport.length > 1 ? 's' : ''} importado${toImport.length > 1 ? 's' : ''}!`)
      setModalOFX(false)
      fetchExtrato(contaSel)
    } else toast.error(error.message)
  }

  // ── Fluxo de Caixa ───────────────────────────────────────────────────────────
  const meses6 = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 5 + i)
    return d.toISOString().slice(0, 7)
  })
  const fluxoMeses = meses6.map(mes => {
    const m = parseInt(mes.split('-')[1])
    const entradas = receber.filter(r => r.status === 'pago' && r.data_pagamento?.startsWith(mes)).reduce((s, r) => s + (r.valor_pago || r.valor || 0), 0)
    const saidas = pagar.filter(p => p.status === 'pago' && p.data_pagamento?.startsWith(mes)).reduce((s, p) => s + (p.valor_pago || p.valor || 0), 0)
    return { mes, label: MESES_PT[m - 1], entradas, saidas, resultado: entradas - saidas }
  })
  const maxFluxo = Math.max(...fluxoMeses.flatMap(m => [m.entradas, m.saidas]), 100)

  const proj = [30, 60, 90].map(dias => {
    const limite = new Date(Date.now() + dias * 86400000).toISOString().split('T')[0]
    const r = receber.filter(x => x.status === 'aguardando' && x.data_vencimento >= hj && x.data_vencimento <= limite).reduce((s, x) => s + x.valor, 0)
    const p = pagar.filter(x => x.status === 'a_pagar' && x.data_vencimento >= hj && x.data_vencimento <= limite).reduce((s, x) => s + x.valor, 0)
    return { dias, r, p, resultado: r - p }
  })

  const MAIN_TABS: { id: MainTab; label: string }[] = [
    { id: 'dashboard', label: 'Visão Geral' },
    { id: 'receber',   label: 'A Receber' },
    { id: 'pagar',     label: 'A Pagar' },
    { id: 'extrato',   label: 'Extrato' },
    { id: 'config',    label: 'Configurações' },
  ]
  const CFG_TABS: { id: ConfigTab; label: string }[] = [
    { id: 'clientes',     label: 'Clientes' },
    { id: 'fornecedores', label: 'Fornecedores' },
    { id: 'categorias',   label: 'Categorias' },
    { id: 'centros',      label: 'Centros de Custo' },
    { id: 'contas',       label: 'Contas Bancárias' },
  ]

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 px-6 py-5">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Financeiro</p>
            <h1 className="text-xl font-bold text-slate-900 mt-0.5">{orgName}</h1>
          </div>
          <div className="flex gap-2">
            {tab === 'receber' && (
              <button onClick={() => { setEditId(null); setFormR({ ...emptyR }); setModalR(true) }}
                className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors shadow-sm">
                + Novo Recebível
              </button>
            )}
            {tab === 'pagar' && (
              <button onClick={() => { setEditId(null); setFormP({ ...emptyP }); setModalP(true) }}
                className="inline-flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors shadow-sm">
                + Nova Conta a Pagar
              </button>
            )}
            {tab === 'extrato' && (
              <div className="flex gap-2">
                <input ref={fileRef} type="file" accept=".ofx,.csv" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); e.target.value = '' }} />
                <button onClick={() => fileRef.current?.click()}
                  className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors shadow-sm">
                  Importar OFX / CSV
                </button>
                <button onClick={() => setModalE(true)}
                  className="inline-flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors">
                  + Manual
                </button>
              </div>
            )}
            {tab === 'config' && (
              <button onClick={() => {
                setEditId(null)
                const b: Record<string, string> = {}
                cfgMeta[configTab].cols.forEach(c => { b[c.key] = '' })
                setCfgForm(b)
                setModalCfg(true)
              }} className="inline-flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors">
                + Novo
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* Tabs */}
        <div className="flex gap-1 bg-white rounded-2xl border border-slate-100 shadow-sm p-1 w-fit">
          {MAIN_TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all ${tab === t.id ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── VISÃO GERAL ── */}
        {tab === 'dashboard' && (
          <div className="space-y-6">
            {/* Summary cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <SummaryCard label="A Receber"         value={fmt(totalAReceber)} color="text-indigo-600"  sub={`${receber.filter(r => r.status === 'aguardando').length} títulos`} />
              <SummaryCard label="A Pagar"           value={fmt(totalAPagar)}   color="text-rose-600"    sub={`${pagar.filter(p => p.status === 'a_pagar').length} títulos`} />
              <SummaryCard label="Em Atraso"         value={fmt(totalVencR)}    color="text-red-600"     sub="recebíveis vencidos" />
              <SummaryCard label="Recebido no Mês" value={fmt(totalPagoMes)}  color="text-emerald-600" sub={hj.slice(0, 7).split('-').reverse().join('/')} />
            </div>

            {/* Fluxo de Caixa */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-sm font-bold text-slate-800">Fluxo de Caixa</h2>
                  <p className="text-xs text-slate-400 mt-0.5">Últimos 6 meses — entradas vs saídas realizadas</p>
                </div>
                <div className="flex items-center gap-5 text-xs font-semibold text-slate-500">
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block w-2.5 h-2.5 rounded-sm bg-emerald-500 opacity-85" />Entradas
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block w-2.5 h-2.5 rounded-sm bg-rose-400 opacity-75" />Saídas
                  </span>
                </div>
              </div>
              <svg viewBox="0 0 660 195" className="w-full overflow-visible">
                {/* Grid lines */}
                {[1, 0.75, 0.5, 0.25].map((pct, i) => {
                  const y = 15 + (1 - pct) * 140
                  return (
                    <g key={i}>
                      <line x1="50" y1={y} x2="650" y2={y} stroke="#f1f5f9" strokeWidth="1.5" />
                      <text x="44" y={y + 3.5} textAnchor="end" fontSize="9" fill="#cbd5e1">{fmtShort(maxFluxo * pct)}</text>
                    </g>
                  )
                })}
                <line x1="50" y1="155" x2="650" y2="155" stroke="#e2e8f0" strokeWidth="1" />
                {/* Bars */}
                {fluxoMeses.map((m, i) => {
                  const gx = 50 + i * 100 + 11
                  const cx = 50 + i * 100 + 50
                  const hE = maxFluxo > 0 ? (m.entradas / maxFluxo) * 140 : 0
                  const hS = maxFluxo > 0 ? (m.saidas / maxFluxo) * 140 : 0
                  return (
                    <g key={i}>
                      <rect x={gx} y={155 - Math.max(hE, 2)} width="35" height={Math.max(hE, 2)} rx="3" fill="#10b981" opacity="0.85" />
                      <rect x={gx + 43} y={155 - Math.max(hS, 2)} width="35" height={Math.max(hS, 2)} rx="3" fill="#f43f5e" opacity="0.75" />
                      <text x={cx} y="170" textAnchor="middle" fontSize="10" fill="#64748b" fontWeight="600">{m.label}</text>
                      <text x={cx} y="183" textAnchor="middle" fontSize="9" fontWeight="700"
                        fill={m.resultado > 0 ? '#059669' : m.resultado < 0 ? '#e11d48' : '#94a3b8'}>
                        {m.resultado > 0 ? '+' : ''}{m.resultado === 0 ? '—' : fmtShort(m.resultado)}
                      </text>
                    </g>
                  )
                })}
              </svg>
            </div>

            {/* Projeções */}
            <div className="grid grid-cols-3 gap-4">
              {proj.map(p => (
                <div key={p.dias} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">Próximos {p.dias} dias</p>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />A receber
                      </span>
                      <span className="text-xs font-semibold text-emerald-700 tabular-nums">{fmt(p.r)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 flex-shrink-0" />A pagar
                      </span>
                      <span className="text-xs font-semibold text-rose-700 tabular-nums">{fmt(p.p)}</span>
                    </div>
                    <div className="flex items-center justify-between border-t border-slate-100 pt-2 mt-1">
                      <span className="text-xs font-bold text-slate-700">Resultado</span>
                      <span className={`text-sm font-bold tabular-nums ${p.resultado >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                        {p.resultado > 0 ? '+' : ''}{fmt(p.resultado)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Alertas */}
            <div className="grid lg:grid-cols-2 gap-4">
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-50 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-slate-800">Recebíveis Vencidos</h2>
                  {totalVencR > 0 && <span className="text-xs font-bold text-red-600 bg-red-50 px-2.5 py-1 rounded-full">{fmt(totalVencR)}</span>}
                </div>
                <div className="divide-y divide-slate-50">
                  {receber.filter(r => r.status === 'aguardando' && r.data_vencimento < hj).slice(0, 6).map(r => (
                    <div key={r.id} className="px-6 py-3.5 flex items-center justify-between hover:bg-slate-50/60 transition-colors">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{r.cliente?.nome || r.descricao}</p>
                        <p className="text-xs text-slate-400 mt-0.5">Venceu em {fmtDate(r.data_vencimento)}</p>
                      </div>
                      <div className="text-right flex-shrink-0 ml-4">
                        <p className="text-sm font-bold text-red-600 tabular-nums">{fmt(r.valor)}</p>
                        <button onClick={() => receberPago(r)} className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 mt-0.5">Marcar recebido →</button>
                      </div>
                    </div>
                  ))}
                  {receber.filter(r => r.status === 'aguardando' && r.data_vencimento < hj).length === 0 && (
                    <p className="px-6 py-8 text-sm text-slate-400 text-center">Nenhum recebível vencido.</p>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-50 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-slate-800">Próximos Vencimentos</h2>
                  <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full">{prox7.length} {prox7.length === 1 ? 'conta' : 'contas'} em 7 dias</span>
                </div>
                <div className="divide-y divide-slate-50">
                  {prox7.slice(0, 6).map(p => (
                    <div key={p.id} className="px-6 py-3.5 flex items-center justify-between hover:bg-slate-50/60 transition-colors">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{p.fornecedor?.nome || p.descricao}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{p.categoria?.nome || '—'} · {fmtDate(p.data_vencimento)}</p>
                      </div>
                      <div className="text-right flex-shrink-0 ml-4">
                        <p className="text-sm font-bold text-rose-600 tabular-nums">{fmt(p.valor)}</p>
                        <button onClick={() => pagarPago(p)} className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 mt-0.5">Marcar pago →</button>
                      </div>
                    </div>
                  ))}
                  {prox7.length === 0 && (
                    <p className="px-6 py-8 text-sm text-slate-400 text-center">Sem vencimentos nos próximos 7 dias.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── A RECEBER ── */}
        {tab === 'receber' && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-50 flex flex-wrap items-center gap-2">
              {['todos', 'aguardando', 'vencido', 'pago', 'cancelado'].map(f => (
                <button key={f} onClick={() => setFilterR(f)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all border ${filterR === f ? 'bg-slate-900 text-white border-slate-900' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                  {f === 'todos' ? 'Todos' : STATUS_R[f]?.label || f}
                </button>
              ))}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px]">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/40">
                    {['Cliente', 'Descrição', 'NF / Parcela', 'Vencimento', 'Valor', 'Forma', 'Status', ''].map(h => (
                      <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-slate-400">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {receber.filter(r => filterR === 'todos' || r.status === filterR).map(r => {
                    const atrasado = r.status === 'aguardando' && r.data_vencimento < hj
                    return (
                      <tr key={r.id} className={`hover:bg-slate-50/60 transition-colors ${atrasado ? 'bg-red-50/20' : ''}`}>
                        <td className="px-5 py-3.5 text-sm font-semibold text-slate-800">{r.cliente?.nome || '—'}</td>
                        <td className="px-5 py-3.5 text-sm text-slate-500">{r.descricao}</td>
                        <td className="px-5 py-3.5 text-xs text-slate-400">{r.numero_nf || '—'}{r.parcela_total > 1 ? ` · ${r.parcela_numero}/${r.parcela_total}` : ''}</td>
                        <td className={`px-5 py-3.5 text-sm tabular-nums ${atrasado ? 'text-red-600 font-semibold' : 'text-slate-600'}`}>{fmtDate(r.data_vencimento)}</td>
                        <td className="px-5 py-3.5 text-sm font-bold text-slate-900 tabular-nums">{fmt(r.valor)}</td>
                        <td className="px-5 py-3.5 text-xs text-slate-400">{FORMA_LABELS[r.forma_pagamento] || r.forma_pagamento}</td>
                        <td className="px-5 py-3.5"><StatusBadge status={atrasado ? 'vencido' : r.status} map={STATUS_R} /></td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            {r.status === 'aguardando' && <button onClick={() => receberPago(r)} className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 whitespace-nowrap">Recebido ✓</button>}
                            {r.status === 'pago' && <button onClick={() => estornarR(r)} className="text-xs font-semibold text-amber-600 hover:text-amber-700 whitespace-nowrap">Estornar</button>}
                            <button onClick={() => {
                              setEditId(r.id)
                              setFormR({ cliente_id: r.cliente_id || '', descricao: r.descricao || '', valor: String(r.valor || ''), data_vencimento: r.data_vencimento || '', forma_pagamento: r.forma_pagamento || 'pix', numero_nf: r.numero_nf || '', parcela_numero: String(r.parcela_numero || 1), parcela_total: String(r.parcela_total || 1), observacoes: r.observacoes || '', categoria_id: r.categoria_id || '' })
                              setModalR(true)
                            }} className="text-xs font-semibold text-indigo-500 hover:text-indigo-700">Editar</button>
                            <button onClick={() => deleteR(r.id)} className="text-xs font-semibold text-slate-300 hover:text-red-500">Excluir</button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                  {!loading && receber.filter(r => filterR === 'todos' || r.status === filterR).length === 0 && (
                    <tr><td colSpan={8} className="px-5 py-16 text-center text-sm text-slate-400">Nenhum lançamento encontrado.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── A PAGAR ── */}
        {tab === 'pagar' && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-50 flex flex-wrap items-center gap-2">
              {['todos', 'a_pagar', 'vencido', 'pago', 'cancelado'].map(f => (
                <button key={f} onClick={() => setFilterP(f)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all border ${filterP === f ? 'bg-slate-900 text-white border-slate-900' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                  {f === 'todos' ? 'Todos' : STATUS_P[f]?.label || f}
                </button>
              ))}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px]">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/40">
                    {['Fornecedor', 'Descrição', 'Categoria', 'Centro', 'Vencimento', 'Valor', 'Status', ''].map(h => (
                      <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-slate-400">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {pagar.filter(p => filterP === 'todos' || p.status === filterP).map(p => {
                    const atrasado = p.status === 'a_pagar' && p.data_vencimento < hj
                    return (
                      <tr key={p.id} className={`hover:bg-slate-50/60 transition-colors ${atrasado ? 'bg-red-50/20' : ''}`}>
                        <td className="px-5 py-3.5 text-sm font-semibold text-slate-800">{p.fornecedor?.nome || '—'}</td>
                        <td className="px-5 py-3.5 text-sm text-slate-500">
                          {p.descricao}
                          {p.recorrente && <span className="ml-2 text-xs font-semibold text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full">↻ mensal</span>}
                        </td>
                        <td className="px-5 py-3.5 text-xs text-slate-400">{p.categoria?.nome || '—'}</td>
                        <td className="px-5 py-3.5 text-xs text-slate-400">{p.centro?.nome || '—'}</td>
                        <td className={`px-5 py-3.5 text-sm tabular-nums ${atrasado ? 'text-red-600 font-semibold' : 'text-slate-600'}`}>{fmtDate(p.data_vencimento)}</td>
                        <td className="px-5 py-3.5 text-sm font-bold text-slate-900 tabular-nums">{fmt(p.valor)}</td>
                        <td className="px-5 py-3.5"><StatusBadge status={atrasado ? 'vencido' : p.status} map={STATUS_P} /></td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            {p.status === 'a_pagar' && <button onClick={() => pagarPago(p)} className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 whitespace-nowrap">Pago ✓</button>}
                            {p.status === 'pago' && <button onClick={() => estornarP(p)} className="text-xs font-semibold text-amber-600 hover:text-amber-700 whitespace-nowrap">Estornar</button>}
                            <button onClick={() => {
                              setEditId(p.id)
                              setFormP({ fornecedor_id: p.fornecedor_id || '', categoria_id: p.categoria_id || '', centro_custo_id: p.centro_custo_id || '', descricao: p.descricao || '', valor: String(p.valor || ''), data_vencimento: p.data_vencimento || '', forma_pagamento: p.forma_pagamento || 'transferencia', recorrente: p.recorrente || false, observacoes: p.observacoes || '' })
                              setModalP(true)
                            }} className="text-xs font-semibold text-indigo-500 hover:text-indigo-700">Editar</button>
                            <button onClick={() => deleteP(p.id)} className="text-xs font-semibold text-slate-300 hover:text-red-500">Excluir</button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                  {!loading && pagar.filter(p => filterP === 'todos' || p.status === filterP).length === 0 && (
                    <tr><td colSpan={8} className="px-5 py-16 text-center text-sm text-slate-400">Nenhum lançamento encontrado.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── EXTRATO ── */}
        {tab === 'extrato' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-4">
              {contas.length > 0 && (
                <select value={contaSel} onChange={e => setContaSel(e.target.value)}
                  className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/30">
                  {contas.map(c => <option key={c.id} value={c.id}>{c.nome}{c.banco ? ` · ${c.banco}` : ''}</option>)}
                </select>
              )}
              {contaObj && <span className="text-sm text-slate-500">Saldo inicial: <strong className="text-slate-800 tabular-nums">{fmt(contaObj.saldo_inicial || 0)}</strong></span>}
              {extratoSaldo.length > 0 && (
                <span className={`text-sm font-bold tabular-nums ${extratoSaldo[extratoSaldo.length - 1].saldo >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  Saldo atual: {fmt(extratoSaldo[extratoSaldo.length - 1].saldo)}
                </span>
              )}
            </div>

            {contas.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-100 p-16 text-center">
                <p className="text-slate-400 text-sm">Cadastre uma conta bancária em Configurações para usar o extrato.</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[600px]">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/40">
                        <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400">Data</th>
                        <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400">Descrição</th>
                        <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400">Tipo</th>
                        <th className="px-5 py-3 text-right text-xs font-semibold text-slate-400">Débito</th>
                        <th className="px-5 py-3 text-right text-xs font-semibold text-slate-400">Crédito</th>
                        <th className="px-5 py-3 text-right text-xs font-semibold text-slate-400">Saldo</th>
                        <th className="px-5 py-3" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      <tr className="bg-slate-50/40">
                        <td className="px-5 py-3 text-xs text-slate-400">—</td>
                        <td className="px-5 py-3 text-xs text-slate-400 italic">Saldo inicial</td>
                        <td /><td /><td />
                        <td className="px-5 py-3 text-sm font-bold text-slate-700 text-right tabular-nums">{fmt(saldo0)}</td>
                      </tr>
                      {extratoSaldo.map(e => (
                        <tr key={e.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="px-5 py-3.5 text-xs text-slate-500 tabular-nums">{fmtDate(e.data)}</td>
                          <td className="px-5 py-3.5">
                            <p className="text-sm text-slate-800">{e.descricao}</p>
                            {e.observacoes && <p className="text-xs text-slate-400 mt-0.5">{e.observacoes}</p>}
                          </td>
                          <td className="px-5 py-3.5">
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${e.tipo === 'credito' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                              {e.tipo === 'credito' ? 'Entrada' : 'Saída'}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-sm font-semibold text-red-600 text-right tabular-nums">{e.tipo === 'debito' ? fmt(e.valor) : ''}</td>
                          <td className="px-5 py-3.5 text-sm font-semibold text-emerald-600 text-right tabular-nums">{e.tipo === 'credito' ? fmt(e.valor) : ''}</td>
                          <td className={`px-5 py-3.5 text-sm font-bold text-right tabular-nums ${e.saldo >= 0 ? 'text-slate-800' : 'text-red-600'}`}>{fmt(e.saldo)}</td>
                          <td className="px-5 py-3.5">
                            <button onClick={async () => {
                              if (!confirm('Excluir este lançamento do extrato?')) return
                              await supabase.from('bm_extrato').delete().eq('id', e.id)
                              fetchExtrato(contaSel)
                              toast.success('Excluído.')
                            }} className="text-xs font-semibold text-slate-300 hover:text-red-500 transition-colors">Excluir</button>
                          </td>
                        </tr>
                      ))}
                      {extratoSaldo.length === 0 && (
                        <tr><td colSpan={6} className="px-5 py-16 text-center text-sm text-slate-400">Nenhuma movimentação registrada.</td></tr>
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
            <div className="flex gap-1 bg-white rounded-2xl border border-slate-100 shadow-sm p-1 w-fit flex-wrap">
              {CFG_TABS.map(t => (
                <button key={t.id} onClick={() => setConfigTab(t.id)}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${configTab === t.id ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'}`}>
                  {t.label}
                </button>
              ))}
            </div>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/40">
                    {cfgMeta[configTab].cols.map(c => (
                      <th key={c.key} className="px-5 py-3 text-left text-xs font-semibold text-slate-400">{c.label}</th>
                    ))}
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {cfgData[configTab].map(row => (
                    <tr key={row.id} className="hover:bg-slate-50/60 transition-colors">
                      {cfgMeta[configTab].cols.map(c => (
                        <td key={c.key} className="px-5 py-3.5 text-sm text-slate-700">{row[c.key] ?? '—'}</td>
                      ))}
                      <td className="px-5 py-3.5">
                        <div className="flex gap-3">
                          <button onClick={() => {
                            setEditId(row.id)
                            const f: Record<string, string> = {}
                            cfgMeta[configTab].cols.forEach(c => { f[c.key] = row[c.key] !== null && row[c.key] !== undefined ? String(row[c.key]) : '' })
                            setCfgForm(f)
                            setModalCfg(true)
                          }} className="text-xs font-semibold text-indigo-500 hover:text-indigo-700">Editar</button>
                          <button onClick={() => deleteCfg(row.id)} className="text-xs font-semibold text-slate-300 hover:text-red-500">Excluir</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!loading && cfgData[configTab].length === 0 && (
                    <tr><td colSpan={cfgMeta[configTab].cols.length + 1} className="px-5 py-16 text-center text-sm text-slate-400">Nenhum registro cadastrado.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ── MODAL A RECEBER ── */}
      {modalR && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-5 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-900">{editId ? 'Editar Recebível' : 'Novo Recebível'}</h2>
            </div>
            <form onSubmit={saveR} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <FieldSelect label="Cliente" value={formR.cliente_id} onChange={e => setFormR({ ...formR, cliente_id: e.target.value })}>
                    <option value="">— Nenhum —</option>
                    {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </FieldSelect>
                </div>
                <div className="col-span-2">
                  <FieldInput label="Descrição *" required value={formR.descricao} onChange={e => setFormR({ ...formR, descricao: e.target.value })} placeholder="Ex: Consultoria Outubro/2026" />
                </div>
                <FieldInput label="Valor (R$) *" required type="number" step="0.01" min="0" value={formR.valor} onChange={e => setFormR({ ...formR, valor: e.target.value })} />
                <FieldInput label="Vencimento *" required type="date" value={formR.data_vencimento} onChange={e => setFormR({ ...formR, data_vencimento: e.target.value })} />
                <FieldSelect label="Forma de Pagamento" value={formR.forma_pagamento} onChange={e => setFormR({ ...formR, forma_pagamento: e.target.value })}>
                  {Object.entries(FORMA_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </FieldSelect>
                <FieldInput label="Número da NF" value={formR.numero_nf} onChange={e => setFormR({ ...formR, numero_nf: e.target.value })} placeholder="opcional" />
                <FieldInput label="Parcela" type="number" min="1" value={formR.parcela_numero} onChange={e => setFormR({ ...formR, parcela_numero: e.target.value })} />
                <FieldInput label="Total de Parcelas" type="number" min="1" value={formR.parcela_total} onChange={e => setFormR({ ...formR, parcela_total: e.target.value })} />
                <div className="col-span-2">
                  <FieldInput label="Observações" value={formR.observacoes} onChange={e => setFormR({ ...formR, observacoes: e.target.value })} />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setModalR(false)} className="flex-1 bg-slate-100 text-slate-600 py-2.5 rounded-xl font-semibold text-sm hover:bg-slate-200 transition-colors">Cancelar</button>
                <button type="submit" className="flex-1 bg-indigo-600 text-white py-2.5 rounded-xl font-semibold text-sm hover:bg-indigo-700 transition-colors">{editId ? 'Atualizar' : 'Salvar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL A PAGAR ── */}
      {modalP && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-5 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-900">{editId ? 'Editar Conta a Pagar' : 'Nova Conta a Pagar'}</h2>
            </div>
            <form onSubmit={saveP} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <FieldInput label="Descrição *" required value={formP.descricao} onChange={e => setFormP({ ...formP, descricao: e.target.value })} placeholder="Ex: Aluguel Outubro" />
                </div>
                <FieldSelect label="Fornecedor" value={formP.fornecedor_id} onChange={e => setFormP({ ...formP, fornecedor_id: e.target.value })}>
                  <option value="">— Nenhum —</option>
                  {fornecedores.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
                </FieldSelect>
                <FieldSelect label="Categoria" value={formP.categoria_id} onChange={e => setFormP({ ...formP, categoria_id: e.target.value })}>
                  <option value="">— Nenhuma —</option>
                  {categorias.filter(c => c.tipo === 'despesa').map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </FieldSelect>
                <FieldSelect label="Centro de Custo" value={formP.centro_custo_id} onChange={e => setFormP({ ...formP, centro_custo_id: e.target.value })}>
                  <option value="">— Nenhum —</option>
                  {centros.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </FieldSelect>
                <FieldSelect label="Forma de Pagamento" value={formP.forma_pagamento} onChange={e => setFormP({ ...formP, forma_pagamento: e.target.value })}>
                  {Object.entries(FORMA_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </FieldSelect>
                <FieldInput label="Valor (R$) *" required type="number" step="0.01" min="0" value={formP.valor} onChange={e => setFormP({ ...formP, valor: e.target.value })} />
                <FieldInput label="Vencimento *" required type="date" value={formP.data_vencimento} onChange={e => setFormP({ ...formP, data_vencimento: e.target.value })} />
                <div className="col-span-2">
                  <label className="flex items-center gap-3 cursor-pointer p-3.5 rounded-xl border border-violet-100 bg-violet-50/60 hover:bg-violet-50 transition-colors">
                    <input type="checkbox" checked={formP.recorrente} onChange={e => setFormP({ ...formP, recorrente: e.target.checked })} className="w-4 h-4 accent-violet-600 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-violet-700">Conta recorrente mensal</p>
                      <p className="text-xs text-violet-400 mt-0.5">Ao pagar, pergunta se cria o próximo mês automaticamente</p>
                    </div>
                  </label>
                </div>
                <div className="col-span-2">
                  <FieldInput label="Observações" value={formP.observacoes} onChange={e => setFormP({ ...formP, observacoes: e.target.value })} />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setModalP(false)} className="flex-1 bg-slate-100 text-slate-600 py-2.5 rounded-xl font-semibold text-sm hover:bg-slate-200 transition-colors">Cancelar</button>
                <button type="submit" className="flex-1 bg-rose-600 text-white py-2.5 rounded-xl font-semibold text-sm hover:bg-rose-700 transition-colors">{editId ? 'Atualizar' : 'Salvar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL EXTRATO MANUAL ── */}
      {modalE && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl">
            <div className="px-6 py-5 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-900">Lançamento Manual no Extrato</h2>
            </div>
            <form onSubmit={saveExtrato} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-xl">
                {[{ v: 'credito', l: 'Entrada (crédito)' }, { v: 'debito', l: 'Saída (débito)' }].map(t => (
                  <button key={t.v} type="button" onClick={() => setFormE({ ...formE, tipo: t.v })}
                    className={`py-2.5 rounded-lg text-sm font-semibold transition-all ${formE.tipo === t.v ? (t.v === 'credito' ? 'bg-emerald-600 text-white shadow-sm' : 'bg-red-600 text-white shadow-sm') : 'text-slate-500 hover:text-slate-700'}`}>
                    {t.l}
                  </button>
                ))}
              </div>
              <FieldInput label="Descrição *" required value={formE.descricao} onChange={e => setFormE({ ...formE, descricao: e.target.value })} />
              <div className="grid grid-cols-2 gap-4">
                <FieldInput label="Valor (R$) *" required type="number" step="0.01" min="0" value={formE.valor} onChange={e => setFormE({ ...formE, valor: e.target.value })} />
                <FieldInput label="Data *" required type="date" value={formE.data} onChange={e => setFormE({ ...formE, data: e.target.value })} />
              </div>
              <FieldInput label="Observações" value={formE.observacoes} onChange={e => setFormE({ ...formE, observacoes: e.target.value })} />
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setModalE(false)} className="flex-1 bg-slate-100 text-slate-600 py-2.5 rounded-xl font-semibold text-sm hover:bg-slate-200 transition-colors">Cancelar</button>
                <button type="submit" className="flex-1 bg-slate-800 text-white py-2.5 rounded-xl font-semibold text-sm hover:bg-slate-700 transition-colors">Adicionar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL CONFIG ── */}
      {modalCfg && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl">
            <div className="px-6 py-5 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-900">{editId ? 'Editar' : 'Novo'} registro</h2>
            </div>
            <form onSubmit={saveCfg} className="p-6 space-y-4">
              {cfgMeta[configTab].cols.map(c => (
                c.opts ? (
                  <FieldSelect key={c.key} label={c.label} value={cfgForm[c.key] || ''} onChange={e => setCfgForm({ ...cfgForm, [c.key]: e.target.value })}>
                    <option value="">— Selecione —</option>
                    {c.opts.map(o => <option key={o} value={o}>{o}</option>)}
                  </FieldSelect>
                ) : (
                  <FieldInput key={c.key} label={c.label} type={c.type || 'text'} value={cfgForm[c.key] || ''} onChange={e => setCfgForm({ ...cfgForm, [c.key]: e.target.value })} required={c.label === 'Nome'} />
                )
              ))}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setModalCfg(false)} className="flex-1 bg-slate-100 text-slate-600 py-2.5 rounded-xl font-semibold text-sm hover:bg-slate-200 transition-colors">Cancelar</button>
                <button type="submit" className="flex-1 bg-slate-800 text-white py-2.5 rounded-xl font-semibold text-sm hover:bg-slate-700 transition-colors">{editId ? 'Atualizar' : 'Salvar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL CONCILIAÇÃO OFX/CSV ── */}
      {modalOFX && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl flex flex-col max-h-[85vh]">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
              <div>
                <h2 className="text-base font-bold text-slate-900">Conciliação Bancária</h2>
                <p className="text-xs text-slate-400 mt-0.5">{ofxTxns.length} transações encontradas no arquivo</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-full">
                  {ofxTxns.filter(t => isJaLancado(t)).length} já lançadas
                </span>
                <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-full">
                  {ofxTxns.filter(t => !isJaLancado(t)).length} novas
                </span>
              </div>
            </div>
            <div className="px-6 py-3 border-b border-slate-50 flex items-center gap-4 flex-shrink-0">
              <button onClick={() => setSelOFX(new Set(ofxTxns.filter(t => !isJaLancado(t)).map(t => t.id)))}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800">Selecionar todas novas</button>
              <button onClick={() => setSelOFX(new Set())} className="text-xs font-semibold text-slate-400 hover:text-slate-600">Limpar seleção</button>
              <span className="text-xs text-slate-400 ml-auto">{selOFX.size} selecionadas para importar</span>
            </div>
            <div className="overflow-y-auto flex-1">
              <table className="w-full">
                <thead className="sticky top-0 bg-white border-b border-slate-100">
                  <tr>
                    <th className="px-5 py-3 w-8" />
                    <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400">Data</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400">Descrição</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-slate-400">Valor</th>
                    <th className="px-5 py-3 text-center text-xs font-semibold text-slate-400">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {ofxTxns.map(t => {
                    const jaLancado = isJaLancado(t)
                    const checked = selOFX.has(t.id)
                    return (
                      <tr key={t.id} className={`transition-colors ${jaLancado ? 'opacity-40' : checked ? 'bg-indigo-50/40' : 'hover:bg-slate-50/60'}`}>
                        <td className="px-5 py-3">
                          {!jaLancado && (
                            <input type="checkbox" checked={checked} className="w-4 h-4 accent-indigo-600 cursor-pointer"
                              onChange={e => { const s = new Set(selOFX); e.target.checked ? s.add(t.id) : s.delete(t.id); setSelOFX(s) }} />
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-xs text-slate-500 tabular-nums whitespace-nowrap">{fmtDate(t.date)}</td>
                        <td className="px-5 py-3.5 text-sm text-slate-700 max-w-xs truncate">{t.descricao || '—'}</td>
                        <td className={`px-5 py-3.5 text-sm font-bold text-right tabular-nums ${t.tipo === 'credito' ? 'text-emerald-600' : 'text-red-600'}`}>
                          {t.tipo === 'credito' ? '+' : '-'}{fmt(t.valor)}
                        </td>
                        <td className="px-5 py-3.5 text-center">
                          {jaLancado
                            ? <span className="text-xs font-semibold text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full">Já lançado</span>
                            : <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-full">Novo</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex gap-3 flex-shrink-0">
              <button onClick={() => setModalOFX(false)} className="flex-1 bg-slate-100 text-slate-600 py-2.5 rounded-xl font-semibold text-sm hover:bg-slate-200 transition-colors">Cancelar</button>
              <button onClick={importarOFX} disabled={selOFX.size === 0}
                className="flex-1 bg-indigo-600 text-white py-2.5 rounded-xl font-semibold text-sm hover:bg-indigo-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                Importar {selOFX.size > 0 ? `${selOFX.size} lançamento${selOFX.size > 1 ? 's' : ''}` : ''}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
