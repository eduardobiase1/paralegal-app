'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

export default function FinanceiroPage() {
  const [supabase] = useState(createClient())
  const [lancamentos, setLancamentos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [processos, setProcessos] = useState<any[]>([])

  // Totais Reais baseados no tipo correto
  const totalHonorarios = lancamentos
    .filter(i => i.tipo_custo === 'Honorário')
    .reduce((acc, curr) => acc + curr.valor, 0)

  const totalReembolsos = lancamentos
    .filter(i => i.tipo_custo !== 'Honorário')
    .reduce((acc, curr) => acc + curr.valor, 0)

  const totalPendente = lancamentos
    .filter(i => i.status === 'Pendente')
    .reduce((acc, curr) => acc + curr.valor, 0)

  const [formData, setFormData] = useState({ 
    processo_id: '', 
    tipo_custo: 'Honorário', 
    valor: '', 
    data_vencimento: new Date().toISOString().split('T')[0],
    data_conclusao_prevista: '',
    status: 'Pendente' 
  })

  useEffect(() => { fetchFinanceiro(); fetchProcessos(); }, [])

  async function fetchProcessos() {
    const { data } = await supabase.from('processos_societarios').select('id, tipo, empresas(razao_social)')
    setProcessos(data || [])
  }

  async function fetchFinanceiro() {
    setLoading(true)
    const { data, error } = await supabase.from('financeiro_pro')
      .select(`*, processos_societarios (tipo, empresas (razao_social))`)
      .order('data_vencimento', { ascending: false })
    if (!error) setLancamentos(data || [])
    setLoading(false)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    const { error } = await supabase.from('financeiro_pro').insert([{ 
      ...formData, 
      valor: parseFloat(formData.valor) 
    }])
    if (!error) { 
      setIsModalOpen(false); 
      fetchFinanceiro(); 
      toast.success("Lançamento Registrado!"); 
    } else {
      toast.error("Erro ao salvar lançamento");
    }
  }

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen font-sans">
      
      {/* HEADER PADRÃO SISTEMA */}
      <header className="flex justify-between items-center bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Módulo Financeiro</h1>
          <p className="text-slate-500 text-sm">{lancamentos.length} registro(s) financeiro(s)</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)} 
          className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-bold text-sm flex items-center gap-2 transition-all shadow-sm"
        >
          <span className="text-lg">+</span> Novo Lançamento
        </button>
      </header>

      {/* DASHBOARD EM CARDS BRANCOS */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-slate-500 text-[11px] font-bold uppercase tracking-wider mb-2 text-left">Honorários a Receber</p>
          <h2 className="text-2xl font-bold text-emerald-600 text-left">
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalHonorarios)}
          </h2>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-slate-500 text-[11px] font-bold uppercase tracking-wider mb-2 text-left">Taxas/Custos a Reembolsar</p>
          <h2 className="text-2xl font-bold text-orange-600 text-left">
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalReembolsos)}
          </h2>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-slate-500 text-[11px] font-bold uppercase tracking-wider mb-2 text-left">Total Pendente (Geral)</p>
          <h2 className="text-2xl font-bold text-slate-900 text-left">
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalPendente)}
          </h2>
        </div>
      </section>

      {/* TABELA PADRÃO SISTEMA */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden text-left">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr className="text-slate-600 text-[11px] font-bold uppercase tracking-wider">
              <th className="px-6 py-4 text-left">Empresa / Processo</th>
              <th className="px-6 py-4 text-left">Categoria</th>
              <th className="px-6 py-4 text-left">Previsão Término</th>
              <th className="px-6 py-4 text-left">Valor</th>
              <th className="px-6 py-4 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {lancamentos.map((item) => (
              <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                <td className="px-6 py-4">
                   <p className="text-sm font-semibold text-slate-800">{item.processos_societarios?.empresas?.razao_social}</p>
                   <p className="text-[10px] text-slate-400 uppercase font-medium">{item.processos_societarios?.tipo}</p>
                </td>
                <td className="px-6 py-4">
                  <span className="text-[10px] bg-slate-100 px-2 py-1 rounded-md text-slate-600 font-bold border border-slate-200">
                    {item.tipo_custo}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className="text-xs font-semibold text-blue-600">
                    {item.data_conclusao_prevista ? new Date(item.data_conclusao_prevista).toLocaleDateString('pt-BR') : '--'}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className="text-sm font-bold text-slate-900">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.valor)}
                  </span>
                </td>
                <td className="px-6 py-4 text-center">
                  <span className={`text-[10px] font-bold px-3 py-1 rounded-full border ${
                    item.status === 'Pago' ? 'text-emerald-700 border-emerald-200 bg-emerald-50' : 'text-orange-700 border-orange-200 bg-orange-50'
                  }`}>
                    {item.status.toUpperCase()}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {lancamentos.length === 0 && (
          <div className="p-20 text-center text-slate-400 italic">Nenhum registro encontrado.</div>
        )}
      </section>

      {/* MODAL PADRÃO SISTEMA */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-6 text-left">
          <div className="bg-white w-full max-w-lg rounded-2xl p-8 shadow-2xl border border-slate-200 animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-start mb-6">
               <h2 className="text-xl font-bold text-slate-900 text-left">Novo Lançamento Financeiro</h2>
               <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 text-xl font-light">×</button>
            </div>
            
            <form onSubmit={handleSave} className="space-y-5">
              <div className="space-y-1 text-left">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Vincular Processo Operacional</label>
                <select required className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500/20 outline-none" onChange={(e) => setFormData({...formData, processo_id: e.target.value})}>
                  <option value="">Selecione o cliente...</option>
                  {processos.map(p => <option key={p.id} value={p.id}>{p.empresas?.razao_social} ({p.tipo})</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4 text-left">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Tipo de Verba</label>
                  <select className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm outline-none" onChange={(e) => setFormData({...formData, tipo_custo: e.target.value})}>
                    <option value="Honorário">Honorário</option>
                    <option value="Taxa JUCESP">Taxa JUCESP</option>
                    <option value="Taxa Prefeitura">Taxa Prefeitura</option>
                    <option value="Certidões">Certidões</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Valor Nominal (R$)</label>
                  <input type="number" step="0.01" required placeholder="0,00" className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-blue-500/20" onChange={(e) => setFormData({...formData, valor: e.target.value})} />
                </div>
              </div>

              <div className="space-y-1 text-left">
                <label className="text-[11px] font-bold text-blue-600 uppercase tracking-wider ml-1">Previsão para Término do Processo</label>
                <input 
                  type="date" 
                  className="w-full bg-slate-50 border border-blue-100 rounded-lg p-3 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-blue-500/10" 
                  onChange={(e) => setFormData({...formData, data_conclusao_prevista: e.target.value})} 
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 text-slate-400 font-bold text-xs uppercase tracking-widest hover:bg-slate-50 py-3 rounded-lg transition-all">Cancelar</button>
                <button type="submit" className="flex-[2] bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-bold text-xs uppercase tracking-widest transition-all shadow-md shadow-blue-500/20">Efetivar Lançamento</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}