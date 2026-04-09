'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useOrg } from '@/lib/org-context'
import toast from 'react-hot-toast'

type TabType = 'dashboard' | 'honorarios' | 'cobrancas'

const FORMA_LABELS: Record<string, string> = {
  pix: 'PIX',
  boleto: 'Boleto',
  transferencia: 'Transferência',
  dinheiro: 'Dinheiro',
  cartao: 'Cartão',
}

const STATUS_COLORS: Record<string, string> = {
  pendente: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  pago: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  atrasado: 'bg-red-50 text-red-700 border-red-200',
  cancelado: 'bg-slate-100 text-slate-500 border-slate-200',
}

const STATUS_LABELS: Record<string, string> = {
  pendente: 'Em Aberto',
  pago: 'Pago',
  atrasado: 'Atrasado',
  cancelado: 'Cancelado',
}

export default function FinanceiroPage() {
  const { orgId, orgName } = useOrg()
  const [supabase] = useState(createClient())
  const [tab, setTab] = useState<TabType>('dashboard')
  const [honorarios, setHonorarios] = useState<any[]>([])
  const [cobrancas, setCobrancas] = useState<any[]>([])
  const [empresas, setEmpresas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modalHon, setModalHon] = useState(false)
  const [modalCob, setModalCob] = useState(false)
  const [editingHonId, setEditingHonId] = useState<string | null>(null)
  const [editingCobId, setEditingCobId] = useState<string | null>(null)

  const [formHon, setFormHon] = useState({
    cliente_nome: '',
    cliente_cnpj: '',
    descricao: '',
    valor: '',
    tipo: 'mensal',
    data_vencimento: '',
    status: 'pendente',
    empresa_id: '',
  })

  const [formCob, setFormCob] = useState({
    honorario_id: '',
    cliente_nome: '',
    descricao: '',
    valor: '',
    data_vencimento: '',
    forma_pagamento: 'pix',
    observacoes: '',
    empresa_id: '',
  })

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [honRes, cobRes, empRes] = await Promise.all([
      supabase.from('honorarios').select('*, empresas(razao_social)').eq('org_id', orgId).eq('ativo', true).order('data_vencimento', { ascending: true }),
      supabase.from('cobrancas').select('*, honorarios(descricao), empresas(razao_social)').eq('org_id', orgId).order('data_vencimento', { ascending: false }),
      supabase.from('empresas').select('id, razao_social').order('razao_social'),
    ])
    setHonorarios(honRes.data || [])
    setCobrancas(cobRes.data || [])
    setEmpresas(empRes.data || [])
    setLoading(false)
  }, [supabase, orgId])

  useEffect(() => {
    if (orgId) fetchData()
  }, [orgId, fetchData])

  // ── Abrir modal honorário ────────────────────────────────────────────────

  function openNewHon() {
    setEditingHonId(null)
    setFormHon({ cliente_nome: '', cliente_cnpj: '', descricao: '', valor: '', tipo: 'mensal', data_vencimento: '', status: 'pendente', empresa_id: '' })
    setModalHon(true)
  }

  function openEditHon(h: any) {
    setEditingHonId(h.id)
    setFormHon({
      cliente_nome: h.cliente_nome || '',
      cliente_cnpj: h.cliente_cnpj || '',
      descricao: h.descricao || '',
      valor: String(h.valor || ''),
      tipo: h.tipo || 'mensal',
      data_vencimento: h.data_vencimento || '',
      status: h.status || 'pendente',
      empresa_id: h.empresa_id || '',
    })
    setModalHon(true)
  }

  // ── Salvar honorário ─────────────────────────────────────────────────────

  async function handleSaveHon(e: React.FormEvent) {
    e.preventDefault()
    const payload: any = {
      org_id: orgId,
      ativo: true,
      cliente_nome: formHon.cliente_nome.trim(),
      cliente_cnpj: formHon.cliente_cnpj.trim() || null,
      descricao: formHon.descricao.trim() || null,
      valor: parseFloat(formHon.valor),
      tipo: formHon.tipo,
      data_vencimento: formHon.data_vencimento || null,
      status: formHon.status,
      empresa_id: formHon.empresa_id || null,
    }

    const { error } = editingHonId
      ? await supabase.from('honorarios').update(payload).eq('id', editingHonId)
      : await supabase.from('honorarios').insert([payload])

    if (!error) {
      toast.success(editingHonId ? 'Honorário atualizado!' : 'Honorário cadastrado!')
      setModalHon(false)
      setEditingHonId(null)
      setFormHon({ cliente_nome: '', cliente_cnpj: '', descricao: '', valor: '', tipo: 'mensal', data_vencimento: '', status: 'pendente', empresa_id: '' })
      fetchData()
    } else {
      toast.error(`Erro: ${error.message}`)
    }
  }

  // ── Excluir honorário ────────────────────────────────────────────────────

  async function handleDeleteHon(id: string) {
    if (!confirm('Excluir este honorário?')) return
    await supabase.from('honorarios').update({ ativo: false }).eq('id', id)
    setHonorarios(prev => prev.filter(h => h.id !== id))
    toast.success('Honorário excluído.')
  }

  // ── Marcar honorário como pago ────────────────────────────────────────────

  async function marcarPagoHon(id: string) {
    const { error } = await supabase.from('honorarios').update({ status: 'pago' }).eq('id', id)
    if (!error) {
      toast.success('Honorário marcado como pago!')
      fetchData()
    }
  }

  // ── Abrir modal cobrança ─────────────────────────────────────────────────

  function openNewCob() {
    setEditingCobId(null)
    setFormCob({ honorario_id: '', cliente_nome: '', descricao: '', valor: '', data_vencimento: '', forma_pagamento: 'pix', observacoes: '', empresa_id: '' })
    setModalCob(true)
  }

  function openEditCob(c: any) {
    setEditingCobId(c.id)
    setFormCob({
      honorario_id: c.honorario_id || '',
      cliente_nome: c.cliente_nome || '',
      descricao: c.descricao || '',
      valor: String(c.valor || ''),
      data_vencimento: c.data_vencimento || '',
      forma_pagamento: c.forma_pagamento || 'pix',
      observacoes: c.observacoes || '',
      empresa_id: c.empresa_id || '',
    })
    setModalCob(true)
  }

  // ── Salvar cobrança ───────────────────────────────────────────────────────

  async function handleSaveCob(e: React.FormEvent) {
    e.preventDefault()
    const payload: any = {
      org_id: orgId,
      cliente_nome: formCob.cliente_nome.trim(),
      descricao: formCob.descricao.trim(),
      valor: parseFloat(formCob.valor),
      data_vencimento: formCob.data_vencimento,
      forma_pagamento: formCob.forma_pagamento,
      observacoes: formCob.observacoes.trim() || null,
      honorario_id: formCob.honorario_id || null,
      empresa_id: formCob.empresa_id || null,
    }
    if (!editingCobId) payload.status = 'pendente'

    const { error } = editingCobId
      ? await supabase.from('cobrancas').update(payload).eq('id', editingCobId)
      : await supabase.from('cobrancas').insert([payload])

    if (!error) {
      toast.success(editingCobId ? 'Cobrança atualizada!' : 'Cobrança registrada!')
      setModalCob(false)
      setEditingCobId(null)
      setFormCob({ honorario_id: '', cliente_nome: '', descricao: '', valor: '', data_vencimento: '', forma_pagamento: 'pix', observacoes: '', empresa_id: '' })
      fetchData()
    } else {
      toast.error(`Erro: ${error.message}`)
    }
  }

  // ── Excluir cobrança ─────────────────────────────────────────────────────

  async function handleDeleteCob(id: string) {
    if (!confirm('Excluir esta cobrança?')) return
    await supabase.from('cobrancas').delete().eq('id', id)
    setCobrancas(prev => prev.filter(c => c.id !== id))
    toast.success('Cobrança excluída.')
  }

  // ── Marcar cobrança como paga ─────────────────────────────────────────────

  async function marcarPago(id: string) {
    const hoje = new Date().toISOString().split('T')[0]
    const { error } = await supabase.from('cobrancas').update({ status: 'pago', data_pagamento: hoje }).eq('id', id)
    if (!error) {
      toast.success('Marcado como pago!')
      fetchData()
    }
  }

  // ── Estatísticas ─────────────────────────────────────────────────────────
  // Honorários + cobranças consolidados na visão geral

  const honPendente = honorarios.filter(h => h.status === 'pendente' || !h.status).reduce((s, h) => s + (h.valor || 0), 0)
  const honPago = honorarios.filter(h => h.status === 'pago').reduce((s, h) => s + (h.valor || 0), 0)
  const honAtrasado = honorarios.filter(h => h.status === 'atrasado').reduce((s, h) => s + (h.valor || 0), 0)
  const cobPendente = cobrancas.filter(c => c.status === 'pendente').reduce((s, c) => s + (c.valor || 0), 0)
  const cobPago = cobrancas.filter(c => c.status === 'pago').reduce((s, c) => s + (c.valor || 0), 0)
  const cobAtrasado = cobrancas.filter(c => c.status === 'atrasado').reduce((s, c) => s + (c.valor || 0), 0)

  const totalPendente = honPendente + cobPendente
  const totalPago = honPago + cobPago
  const totalAtrasado = honAtrasado + cobAtrasado
  const receitaMensal = honorarios.filter(h => h.tipo === 'mensal').reduce((s, h) => s + (h.valor || 0), 0)

  function fmt(n: number) {
    return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  }

  function fmtDate(d: string | null) {
    if (!d) return '—'
    return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR')
  }

  return (
    <div className="p-8 space-y-6 bg-slate-50 min-h-screen font-sans">
      {/* Header */}
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Financeiro</h1>
          <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] mt-1">
            Escritório: <span className="text-blue-600">{orgName}</span>
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={openNewHon} className="bg-blue-600 text-white px-4 py-2 rounded-xl font-bold text-sm hover:bg-blue-700 transition-all shadow-sm">
            + Honorário
          </button>
          <button onClick={openNewCob} className="bg-slate-900 text-white px-4 py-2 rounded-xl font-bold text-sm hover:bg-slate-800 transition-all shadow-sm">
            + Cobrança
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {(['dashboard', 'honorarios', 'cobrancas'] as TabType[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-2 rounded-xl font-bold text-sm transition-all ${tab === t ? 'bg-slate-900 text-white' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'}`}
          >
            {t === 'dashboard' ? 'Visão Geral' : t === 'honorarios' ? 'Honorários' : 'Cobranças'}
          </button>
        ))}
      </div>

      {/* ── Dashboard ── */}
      {tab === 'dashboard' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Receita Mensal', value: fmt(receitaMensal), color: 'text-blue-700', bg: 'bg-blue-50 border-blue-100' },
              { label: 'A Receber', value: fmt(totalPendente), color: 'text-yellow-700', bg: 'bg-yellow-50 border-yellow-100' },
              { label: 'Recebido', value: fmt(totalPago), color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-100' },
              { label: 'Em Atraso', value: fmt(totalAtrasado), color: 'text-red-700', bg: 'bg-red-50 border-red-100' },
            ].map(card => (
              <div key={card.label} className={`${card.bg} border p-6 rounded-2xl`}>
                <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest">{card.label}</p>
                <p className={`text-2xl font-black mt-2 font-mono ${card.color}`}>{card.value}</p>
              </div>
            ))}
          </div>

          {/* Honorários em aberto */}
          {honorarios.filter(h => h.status === 'pendente' || !h.status).length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100">
                <h2 className="font-bold text-slate-800">Honorários em Aberto</h2>
              </div>
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-500 tracking-widest">
                  <tr>
                    <th className="px-6 py-3">Cliente</th>
                    <th className="px-6 py-3">Descrição</th>
                    <th className="px-6 py-3">Vencimento</th>
                    <th className="px-6 py-3">Valor</th>
                    <th className="px-6 py-3">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {honorarios.filter(h => h.status === 'pendente' || !h.status).map(h => (
                    <tr key={h.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 text-sm font-bold text-slate-800">{h.cliente_nome}</td>
                      <td className="px-6 py-4 text-xs text-slate-500">{h.descricao || '—'}</td>
                      <td className="px-6 py-4 text-sm font-mono">{fmtDate(h.data_vencimento)}</td>
                      <td className="px-6 py-4 text-sm font-black font-mono">{fmt(h.valor)}</td>
                      <td className="px-6 py-4">
                        <button onClick={() => marcarPagoHon(h.id)} className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-black px-3 py-1 rounded-full hover:bg-emerald-100 transition-all">
                          Marcar Pago
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Cobranças pendentes */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100">
              <h2 className="font-bold text-slate-800">Cobranças Pendentes</h2>
            </div>
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-500 tracking-widest">
                <tr>
                  <th className="px-6 py-3">Cliente</th>
                  <th className="px-6 py-3">Descrição</th>
                  <th className="px-6 py-3">Vencimento</th>
                  <th className="px-6 py-3">Valor</th>
                  <th className="px-6 py-3">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cobrancas.filter(c => c.status === 'pendente').map(c => (
                  <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 text-sm font-bold text-slate-800">{c.cliente_nome}</td>
                    <td className="px-6 py-4 text-xs text-slate-500">{c.descricao}</td>
                    <td className="px-6 py-4 text-sm font-mono">{fmtDate(c.data_vencimento)}</td>
                    <td className="px-6 py-4 text-sm font-black font-mono">{fmt(c.valor)}</td>
                    <td className="px-6 py-4">
                      <button onClick={() => marcarPago(c.id)} className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-black px-3 py-1 rounded-full hover:bg-emerald-100 transition-all">
                        Marcar Pago
                      </button>
                    </td>
                  </tr>
                ))}
                {cobrancas.filter(c => c.status === 'pendente').length === 0 && (
                  <tr><td colSpan={5} className="px-6 py-10 text-center text-slate-400 italic text-sm">Nenhuma cobrança pendente.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Honorários ── */}
      {tab === 'honorarios' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-500 tracking-widest">
              <tr>
                <th className="px-6 py-4">Cliente</th>
                <th className="px-6 py-4">Descrição</th>
                <th className="px-6 py-4">Tipo</th>
                <th className="px-6 py-4">Vencimento</th>
                <th className="px-6 py-4">Valor</th>
                <th className="px-6 py-4 text-center">Status</th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {honorarios.map(h => (
                <tr key={h.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4">
                    <p className="text-sm font-bold text-slate-800">{h.cliente_nome}</p>
                    {h.empresas && <p className="text-[10px] text-slate-400">{h.empresas.razao_social}</p>}
                  </td>
                  <td className="px-6 py-4 text-xs text-slate-500">{h.descricao || '—'}</td>
                  <td className="px-6 py-4 text-[10px] font-black uppercase text-slate-600">{h.tipo}</td>
                  <td className="px-6 py-4 text-sm font-mono text-slate-700">{fmtDate(h.data_vencimento)}</td>
                  <td className="px-6 py-4 text-sm font-black font-mono text-slate-900">{fmt(h.valor)}</td>
                  <td className="px-6 py-4 text-center">
                    <span className={`text-[10px] font-black px-3 py-1 rounded-full border ${STATUS_COLORS[h.status ?? 'pendente'] ?? 'bg-slate-100 text-slate-500'}`}>
                      {STATUS_LABELS[h.status ?? 'pendente'] ?? h.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      {(h.status === 'pendente' || !h.status) && (
                        <button onClick={() => marcarPagoHon(h.id)} className="text-[10px] text-emerald-600 font-bold hover:underline">Pago ✓</button>
                      )}
                      <button onClick={() => openEditHon(h)} className="text-[10px] text-blue-500 hover:text-blue-700 font-bold transition-colors">Editar</button>
                      <button onClick={() => handleDeleteHon(h.id)} className="text-[10px] text-red-300 hover:text-red-500 font-bold transition-colors">Excluir</button>
                    </div>
                  </td>
                </tr>
              ))}
              {honorarios.length === 0 && !loading && (
                <tr><td colSpan={7} className="px-6 py-16 text-center text-slate-400 italic">Nenhum honorário cadastrado.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Cobranças ── */}
      {tab === 'cobrancas' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-500 tracking-widest">
              <tr>
                <th className="px-6 py-4">Cliente</th>
                <th className="px-6 py-4">Descrição</th>
                <th className="px-6 py-4">Vencimento</th>
                <th className="px-6 py-4">Valor</th>
                <th className="px-6 py-4">Pagamento</th>
                <th className="px-6 py-4 text-center">Status</th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {cobrancas.map(c => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 text-sm font-bold text-slate-800">{c.cliente_nome}</td>
                  <td className="px-6 py-4 text-xs text-slate-500">{c.descricao}</td>
                  <td className="px-6 py-4 text-sm font-mono">{fmtDate(c.data_vencimento)}</td>
                  <td className="px-6 py-4 text-sm font-black font-mono">{fmt(c.valor)}</td>
                  <td className="px-6 py-4 text-xs text-slate-500">{FORMA_LABELS[c.forma_pagamento] || '—'}</td>
                  <td className="px-6 py-4 text-center">
                    <span className={`text-[10px] font-black px-3 py-1 rounded-full border ${STATUS_COLORS[c.status] ?? 'bg-slate-100 text-slate-500'}`}>
                      {STATUS_LABELS[c.status] ?? c.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      {c.status === 'pendente' && (
                        <button onClick={() => marcarPago(c.id)} className="text-[10px] text-emerald-600 font-bold hover:underline">Pago ✓</button>
                      )}
                      <button onClick={() => openEditCob(c)} className="text-[10px] text-blue-500 hover:text-blue-700 font-bold transition-colors">Editar</button>
                      <button onClick={() => handleDeleteCob(c.id)} className="text-[10px] text-red-300 hover:text-red-500 font-bold transition-colors">Excluir</button>
                    </div>
                  </td>
                </tr>
              ))}
              {cobrancas.length === 0 && !loading && (
                <tr><td colSpan={7} className="px-6 py-16 text-center text-slate-400 italic">Nenhuma cobrança registrada.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Modal Honorário ──────────────────────────────────────────────────── */}
      {modalHon && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-6">
          <div className="bg-white w-full max-w-lg rounded-3xl p-8 border border-slate-200 shadow-2xl">
            <h2 className="text-xl font-bold mb-6 text-slate-900">{editingHonId ? 'Editar Honorário' : 'Cadastrar Honorário'}</h2>
            <form onSubmit={handleSaveHon} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase">Nome do Cliente *</label>
                  <input required value={formHon.cliente_nome} onChange={e => setFormHon({ ...formHon, cliente_nome: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm mt-1 outline-none focus:ring-2 focus:ring-blue-500/20" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase">Empresa (opcional)</label>
                  <select value={formHon.empresa_id} onChange={e => setFormHon({ ...formHon, empresa_id: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm mt-1 outline-none">
                    <option value="">— Nenhuma —</option>
                    {empresas.map(e => <option key={e.id} value={e.id}>{e.razao_social}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase">CNPJ</label>
                  <input value={formHon.cliente_cnpj} onChange={e => setFormHon({ ...formHon, cliente_cnpj: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm mt-1 outline-none" placeholder="00.000.000/0001-00" />
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase">Descrição do Serviço</label>
                  <input value={formHon.descricao} onChange={e => setFormHon({ ...formHon, descricao: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm mt-1 outline-none" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase">Valor (R$) *</label>
                  <input required type="number" step="0.01" min="0" value={formHon.valor} onChange={e => setFormHon({ ...formHon, valor: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm mt-1 outline-none" placeholder="0,00" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase">Tipo</label>
                  <select value={formHon.tipo} onChange={e => setFormHon({ ...formHon, tipo: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm mt-1 outline-none">
                    <option value="mensal">Mensal</option>
                    <option value="trimestral">Trimestral</option>
                    <option value="semestral">Semestral</option>
                    <option value="anual">Anual</option>
                    <option value="avulso">Avulso</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase">Data de Vencimento</label>
                  <input type="date" value={formHon.data_vencimento} onChange={e => setFormHon({ ...formHon, data_vencimento: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm mt-1 outline-none" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase">Status *</label>
                  <select required value={formHon.status} onChange={e => setFormHon({ ...formHon, status: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm mt-1 outline-none">
                    <option value="pendente">Em Aberto</option>
                    <option value="pago">Pago</option>
                    <option value="atrasado">Atrasado</option>
                    <option value="cancelado">Cancelado</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setModalHon(false); setEditingHonId(null) }} className="flex-1 bg-slate-100 text-slate-600 py-3 rounded-xl font-bold text-sm">Cancelar</button>
                <button type="submit" className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-bold text-sm hover:bg-blue-700 transition-all">{editingHonId ? 'Atualizar' : 'Salvar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal Cobrança ──────────────────────────────────────────────────── */}
      {modalCob && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-6">
          <div className="bg-white w-full max-w-lg rounded-3xl p-8 border border-slate-200 shadow-2xl">
            <h2 className="text-xl font-bold mb-6 text-slate-900">{editingCobId ? 'Editar Cobrança' : 'Registrar Cobrança'}</h2>
            <form onSubmit={handleSaveCob} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase">Nome do Cliente *</label>
                  <input required value={formCob.cliente_nome} onChange={e => setFormCob({ ...formCob, cliente_nome: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm mt-1 outline-none" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase">Honorário vinculado</label>
                  <select value={formCob.honorario_id} onChange={e => {
                    const hon = honorarios.find(h => h.id === e.target.value)
                    setFormCob({ ...formCob, honorario_id: e.target.value, valor: hon ? String(hon.valor) : formCob.valor, cliente_nome: hon ? hon.cliente_nome : formCob.cliente_nome })
                  }} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm mt-1 outline-none">
                    <option value="">— Nenhum —</option>
                    {honorarios.map(h => <option key={h.id} value={h.id}>{h.cliente_nome} — {fmt(h.valor)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase">Data de Vencimento *</label>
                  <input required type="date" value={formCob.data_vencimento} onChange={e => setFormCob({ ...formCob, data_vencimento: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm mt-1 outline-none" />
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase">Descrição *</label>
                  <input required value={formCob.descricao} onChange={e => setFormCob({ ...formCob, descricao: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm mt-1 outline-none" placeholder="Ex: Mensalidade Março/2025" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase">Valor (R$) *</label>
                  <input required type="number" step="0.01" min="0" value={formCob.valor} onChange={e => setFormCob({ ...formCob, valor: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm mt-1 outline-none" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase">Forma de Pagamento</label>
                  <select value={formCob.forma_pagamento} onChange={e => setFormCob({ ...formCob, forma_pagamento: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm mt-1 outline-none">
                    {Object.entries(FORMA_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase">Observações</label>
                  <input value={formCob.observacoes} onChange={e => setFormCob({ ...formCob, observacoes: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm mt-1 outline-none" />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setModalCob(false); setEditingCobId(null) }} className="flex-1 bg-slate-100 text-slate-600 py-3 rounded-xl font-bold text-sm">Cancelar</button>
                <button type="submit" className="flex-1 bg-slate-900 text-white py-3 rounded-xl font-bold text-sm hover:bg-slate-800 transition-all">{editingCobId ? 'Atualizar' : 'Salvar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
