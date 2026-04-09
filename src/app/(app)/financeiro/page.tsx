'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

// --- ÍCONES ---
const IconPlus = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
const IconTrash = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
const IconEdit = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>

export default function FinanceiroPage() {
  const [supabase] = useState(createClient())
  const [lancamentos, setLancamentos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [processos, setProcessos] = useState<any[]>([])
  const [editingId, setEditingId] = useState<string | null>(null) // Controla se estamos editando

  const totalHonorarios = lancamentos.filter(i => i.tipo_custo === 'Honorário').reduce((acc, curr) => acc + curr.valor, 0)
  const totalReembolsos = lancamentos.filter(i => i.tipo_custo !== 'Honorário').reduce((acc, curr) => acc + curr.valor, 0)
  const totalPendente = lancamentos.filter(i => i.status === 'Pendente').reduce((acc, curr) => acc + curr.valor, 0)

  const [formData, setFormData] = useState({ 
    processo_id: '', tipo_custo: 'Honorário', valor: '', 
    data_vencimento: new Date().toISOString().split('T')[0],
    data_conclusao_prevista: '', status: 'Pendente' 
  })

  useEffect(() => { fetchFinanceiro(); fetchProcessos(); }, [])

  async function fetchProcessos() {
    const { data } = await supabase.from('processos_societarios').select('id, tipo, empresas(razao_social)')
    setProcessos(data || [])
  }

  async function fetchFinanceiro() {
    setLoading(true)
    const { data, error } = await supabase.from('financeiro_pro').select(`*, processos_societarios (tipo, empresas (razao_social))`).order('data_vencimento', { ascending: false })
    if (!error) setLancamentos(data || [])
    setLoading(false)
  }

  // --- FUNÇÃO PARA CARREGAR DADOS NO MODAL PARA EDITAR ---
  function handleEdit(item: any) {
    setEditingId(item.id)
    setFormData({
      processo_id: item.processo_id,
      tipo_custo: item.tipo_custo,
      valor: item.valor.toString(),
      data_vencimento: item.data_vencimento,
      data_conclusao_prevista: item.data_conclusao_prevista || '',
      status: item.status
    })
    setIsModalOpen(true)
  }

  // --- FUNÇÃO PARA MUDAR STATUS DIRETO NA TABELA ---
  async function updateStatus(id: string, newStatus: string) {
    const { error } = await supabase.from('financeiro_pro').update({ status: newStatus }).eq('id', id)
    if (!error) {
      toast.success("Status atualizado")
      fetchFinanceiro()
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Excluir este lançamento?")) return
    const { error } = await supabase.from('financeiro_pro').delete().eq('id', id)
    if (!error) fetchFinanceiro()
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    const payload = { ...formData, valor: parseFloat(formData.valor), data_conclusao_prevista: formData.data_conclusao_prevista || null }
    
    let error;
    if (editingId) {
      // Atualizar existente
      const { error: err } = await supabase.from('financeiro_pro').update(payload).eq('id', editingId)
      error = err
    } else {
      // Inserir novo
      const { error: err } = await supabase.from('financeiro_pro').insert([payload])
      error = err
    }

    if (!error) { 
      setIsModalOpen(false)
      setEditingId(null)
      fetchFinanceiro()
      toast.success(editingId ? "Atualizado com sucesso!" : "Lançamento Registrado!")
    } else {
      toast.error("Erro ao processar operação")
    }
  }

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen font-sans">
      <header className="flex justify-between items-center bg-white p-6 rounded-xl border border-slate-200 shadow-sm text-left">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Módulo Financeiro</h1>
          <p className="text-slate-500 text-sm">{lancamentos.length} registro(s) encontrados</p>
        </div>
        <button onClick={() => { setEditingId(null); setFormData({ ...formData, valor: '', data_conclusao_prevista: '' }); setIsModalOpen(true); }} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-bold text-sm shadow-sm transition-all">+ Novo Lançamento</button>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-slate-500 text-[11px] font-bold uppercase tracking-wider mb-2">Honorários a Receber</p>
          <h2 className="text-2xl font-bold text-emerald-600 font-mono">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalHonorarios)}</h2>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-slate-500 text-[11px] font-bold uppercase tracking-wider mb-2">Taxas a Reembolsar</p>
          <h2 className="text-2xl font-bold text-orange-600 font-mono">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalReembolsos)}</h2>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-slate-500 text-[11px] font-bold uppercase tracking-wider mb-2">Total Pendente (Geral)</p>
          <h2 className="text-2xl font-bold text-slate-900 font-mono">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalPendente)}</h2>
        </div>
      </section>

      <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden text-left">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr className="text-slate-600 text-[11px] font-bold uppercase tracking-wider">
              <th className="px-6 py-4">Empresa / Processo</th>
              <th className="px-6 py-4">Categoria</th>
              <th className="px-6 py-4">Prev. Término</th>
              <th className="px-6 py-4">Valor</th>
              <th className="px-6 py-4 text-center">Status</th>
              <th className="px-6 py-4 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {lancamentos.map((item) => (
              <tr key={item.id} className="hover:bg-slate-50 transition-colors group">
                <td className="px-6 py-4">
                   <p className="text-sm font-semibold text-slate-800">{item.processos_societarios?.empresas?.razao_social}</p>
                   <p className="text-[10px] text-slate-400 uppercase font-medium">{item.processos_societarios?.tipo}</p>
                </td>
                <td className="px-6 py-4">
                  <span className="text-[10px] bg-slate-100 px-2 py-1 rounded-md text-slate-600 font-bold border border-slate-200">{item.tipo_custo}</span>
                </td>
                <td className="px-6 py-4">
                  <span className="text-xs font-semibold text-blue-600">{item.data_conclusao_prevista ? new Date(item.data_conclusao_prevista).toLocaleDateString('pt-BR') : '--'}</span>
                </td>
                <td className="px-6 py-4 font-mono font-bold text-slate-900">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.valor)}
                </td>
                <td className="px-6 py-4 text-center">
                  <select 
                    value={item.status}
                    onChange={(e) => updateStatus(item.id, e.target.value)}
                    className={`text-[10px] font-bold px-2 py-1 rounded-lg border bg-transparent cursor-pointer outline-none transition-all ${
                        item.status === 'Pago' ? 'text-emerald-700 border-emerald-200' : 'text-orange-700 border-orange-200'
                    }`}
                  >
                    <option value="Pendente">PENDENTE</option>
                    <option value="Pago">PAGO</option>
                    <option value="Conciliado">CONCILIADO</option>
                  </select>
                </td>
                <td className="px-6 py-4 text-right space-x-2">
                  <button onClick={() => handleEdit(item)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all" title="Editar"><IconEdit /></button>
                  <button onClick={() => handleDelete(item.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all" title="Excluir"><IconTrash /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-6 text-left">
          <div className="bg-white w-full max-w-lg rounded-2xl p-8 shadow-2xl border border-slate-200 text-left">
            <h2 className="text-xl font-bold text-slate-900 mb-6">{editingId ? 'Editar Lançamento' : 'Novo Lançamento Financeiro'}</h2>
            <form onSubmit={handleSave} className="space-y-5">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500 uppercase ml-1">Cliente / Processo</label>
                <select required value={formData.processo_id} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm" onChange={(e) => setFormData({...formData, processo_id: e.target.value})}>
                  <option value="">Selecione...</option>
                  {processos.map(p => <option key={p.id} value={p.id}>{p.empresas?.razao_social} ({p.tipo})</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-500 uppercase ml-1">Tipo</label>
                  <select value={formData.tipo_custo} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm" onChange={(e) => setFormData({...formData, tipo_custo: e.target.value})}>
                    <option value="Honorário">Honorário</option>
                    <option value="Taxa JUCESP">Taxa JUCESP</option>
                    <option value="Taxa Prefeitura">Taxa Prefeitura</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-500 uppercase ml-1">Valor (R$)</label>
                  <input type="number" step="0.01" required value={formData.valor} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm font-bold" onChange={(e) => setFormData({...formData, valor: e.target.value})} />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-blue-600 uppercase ml-1">Previsão Término Processo</label>
                <input type="date" value={formData.data_conclusao_prevista} className="w-full bg-slate-50 border border-blue-100 rounded-lg p-3 text-sm" onChange={(e) => setFormData({...formData, data_conclusao_prevista: e.target.value})} />
              </div>
              <div className="flex gap-3 pt-4 text-left">
                <button type="button" onClick={() => { setIsModalOpen(false); setEditingId(null); }} className="flex-1 text-slate-400 font-bold text-xs uppercase">Cancelar</button>
                <button type="submit" className="flex-[2] bg-blue-600 text-white py-3 rounded-lg font-bold text-xs uppercase shadow-md transition-all">{editingId ? 'Salvar Alterações' : 'Efetivar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
