'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { FinanceiroPro } from '@/types'
import toast from 'react-hot-toast'

// --- ÍCONES SVG ---
const IconPlus = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
const IconDollar = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
const IconTrash = () => <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>

export default function FinanceiroPage() {
  const [supabase] = useState(createClient())
  const [lancamentos, setLancamentos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [processos, setProcessos] = useState<any[]>([])

  // Totais Reais
  const totalReceita = lancamentos.reduce((acc, curr) => acc + (curr.tipo_custo === 'Honorário' ? curr.valor : 0), 0)
  const totalTaxas = lancamentos.reduce((acc, curr) => acc + (curr.tipo_custo.includes('Taxa') ? curr.valor : 0), 0)
  const totalPendente = lancamentos.reduce((acc, curr) => acc + (curr.status === 'Pendente' ? curr.valor : 0), 0)

  const [formData, setFormData] = useState({
    processo_id: '',
    tipo_custo: 'Honorário',
    valor: '',
    data_vencimento: new Date().toISOString().split('T')[0],
    status: 'Pendente'
  })

  useEffect(() => {
    fetchFinanceiro()
    fetchProcessos()
  }, [])

  async function fetchProcessos() {
    const { data } = await supabase.from('processos_societarios').select('id, tipo, empresas(razao_social)')
    setProcessos(data || [])
  }

  async function fetchFinanceiro() {
    setLoading(true)
    const { data, error } = await supabase
      .from('financeiro_pro')
      .select(`*, processos_societarios (tipo, empresas (razao_social))`)
      .order('data_vencimento', { ascending: false })
    if (!error) setLancamentos(data || [])
    setLoading(false)
  }

  // MUDAR STATUS AO CLICAR
  async function toggleStatus(id: string, currentStatus: string) {
    const nextStatus = currentStatus === 'Pendente' ? 'Pago' : 'Pendente'
    const { error } = await supabase.from('financeiro_pro').update({ status: nextStatus }).eq('id', id)
    if (!error) fetchFinanceiro()
    else toast.error("Erro ao atualizar status")
  }

  // EXCLUIR LANÇAMENTO
  async function handleDelete(id: string) {
    if (!confirm("Deseja excluir este lançamento?")) return
    const { error } = await supabase.from('financeiro_pro').delete().eq('id', id)
    if (!error) {
      toast.success("Excluído!")
      fetchFinanceiro()
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    const { error } = await supabase.from('financeiro_pro').insert([{
      ...formData,
      valor: parseFloat(formData.valor)
    }])
    if (!error) {
      toast.success('Salvo!')
      setIsModalOpen(false)
      fetchFinanceiro()
    }
  }

  return (
    <div className="p-6 space-y-8 bg-[#0d0d0d] min-h-screen text-white font-sans">
      <header className="flex justify-between items-center border-b border-white/[0.06] pb-6">
        <div>
          <h1 className="text-2xl font-bold uppercase tracking-wider text-emerald-50 italic">Financeiro <span className="text-emerald-500">PRO</span></h1>
          <p className="text-gray-500 text-sm">Gestão Estratégica de Custos</p>
        </div>
        <button onClick={() => setIsModalOpen(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-xl font-bold transition-all flex items-center gap-2">
          <IconPlus /> NOVO LANÇAMENTO
        </button>
      </header>

      {/* DASHBOARD COM NÚMEROS REAIS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-[#141414] p-6 rounded-2xl border border-white/[0.05] shadow-xl">
          <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest mb-1">Total Honorários</p>
          <h2 className="text-3xl font-black text-emerald-400 font-mono">
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalReceita)}
          </h2>
        </div>
        <div className="bg-[#141414] p-6 rounded-2xl border border-white/[0.05] shadow-xl">
          <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest mb-1">Taxas Acumuladas</p>
          <h2 className="text-3xl font-black text-amber-500 font-mono">
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalTaxas)}
          </h2>
        </div>
        <div className="bg-[#141414] p-6 rounded-2xl border border-white/[0.05] shadow-xl">
          <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest mb-1">Pendente de Recebimento</p>
          <h2 className="text-3xl font-black text-red-500 font-mono">
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalPendente)}
          </h2>
        </div>
      </div>

      {/* TABELA COM EDIÇÃO */}
      <div className="bg-[#141414] rounded-2xl border border-white/[0.05] overflow-hidden shadow-2xl">
        <table className="w-full text-left text-sm">
          <thead className="bg-[#1a1a1a] text-gray-500 text-[10px] font-black uppercase tracking-widest">
            <tr>
              <th className="p-5">Empresa / Processo</th>
              <th className="p-5">Tipo</th>
              <th className="p-5">Valor</th>
              <th className="p-5">Vencimento</th>
              <th className="p-5 text-center">Status (Clique p/ mudar)</th>
              <th className="p-5 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {lancamentos.map((item) => (
              <tr key={item.id} className="hover:bg-white/[0.02] transition-colors">
                <td className="p-5 font-bold">
                  <p className="text-gray-200">{item.processos_societarios?.empresas?.razao_social}</p>
                  <p className="text-[9px] text-gray-600 uppercase font-black">{item.processos_societarios?.tipo}</p>
                </td>
                <td className="p-5 text-gray-400 text-xs font-medium uppercase">{item.tipo_custo}</td>
                <td className="p-5 font-black text-emerald-400 text-base">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.valor)}
                </td>
                <td className="p-5 text-gray-500 text-xs">
                  {new Date(item.data_vencimento).toLocaleDateString('pt-BR')}
                </td>
                <td className="p-5 text-center">
                  <button 
                    onClick={() => toggleStatus(item.id, item.status)}
                    className={`px-3 py-1 rounded-md text-[9px] font-black uppercase tracking-widest border transition-all active:scale-90 ${
                    item.status === 'Pago' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 
                    'bg-amber-500/10 text-amber-500 border-amber-500/20'
                  }`}>
                    {item.status}
                  </button>
                </td>
                <td className="p-5 text-right">
                    <button onClick={() => handleDelete(item.id)} className="p-2 hover:bg-red-500/10 rounded-lg transition-all"><IconTrash /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* MODAL MANTIDO */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-[#141414] border border-white/[0.1] w-full max-w-md rounded-3xl p-8 shadow-2xl">
            <h2 className="text-2xl font-black mb-6 text-emerald-400 italic uppercase">Novo Lançamento</h2>
            <form onSubmit={handleSave} className="space-y-5">
              <div>
                <label className="block text-[10px] font-black text-gray-500 uppercase mb-2">Processo</label>
                <select required className="w-full bg-[#0d0d0d] border border-white/[0.1] rounded-xl p-3 text-sm" onChange={(e) => setFormData({...formData, processo_id: e.target.value})}>
                  <option value="">Selecione...</option>
                  {processos.map(p => <option key={p.id} value={p.id}>{p.empresas?.razao_social} ({p.tipo})</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-gray-500 uppercase mb-2">Tipo</label>
                  <select className="w-full bg-[#0d0d0d] border border-white/[0.1] rounded-xl p-3 text-sm text-gray-300" onChange={(e) => setFormData({...formData, tipo_custo: e.target.value})}>
                    <option value="Honorário">Honorário</option>
                    <option value="Taxa JUCESP">Taxa JUCESP</option>
                    <option value="Taxa Prefeitura">Taxa Prefeitura</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray-500 uppercase mb-2">Valor (R$)</label>
                  <input type="number" step="0.01" required className="w-full bg-[#0d0d0d] border border-white/[0.1] rounded-xl p-3 text-sm text-emerald-400 font-bold" onChange={(e) => setFormData({...formData, valor: e.target.value})} />
                </div>
              </div>
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 text-gray-500 font-bold text-xs uppercase">Cancelar</button>
                <button type="submit" className="flex-1 bg-emerald-600 py-4 rounded-xl font-black text-xs uppercase shadow-lg shadow-emerald-900/20">Salvar Registro</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}