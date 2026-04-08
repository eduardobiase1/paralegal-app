'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { FinanceiroPro } from '@/types'
import toast from 'react-hot-toast'

// --- ÍCONES SVG PARA EVITAR ERROS DE BIBLIOTECA ---
const IconPlus = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
const IconDollar = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
const IconClock = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
const IconSend = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>

export default function FinanceiroPage() {
  const [supabase] = useState(createClient())
  const [lancamentos, setLancamentos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [processos, setProcessos] = useState<any[]>([])

  const [formData, setFormData] = useState({
    processo_id: '',
    tipo_custo: 'Honorário',
    valor: '',
    data_vencimento: new Date().toISOString().split('T')[0],
    status: 'Pendente',
    descricao: ''
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
    const { data, error } = await supabase
      .from('financeiro_pro')
      .select(`*, processos_societarios (tipo, empresas (razao_social))`)
      .order('data_vencimento', { ascending: false })

    if (error) toast.error('Erro ao carregar dados')
    else setLancamentos(data || [])
    setLoading(false)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    const { error } = await supabase.from('financeiro_pro').insert([{
      ...formData,
      valor: parseFloat(formData.valor)
    }])

    if (error) toast.error('Erro ao salvar')
    else {
      toast.success('Salvo com sucesso!')
      setIsModalOpen(false)
      fetchFinanceiro()
    }
  }

  return (
    <div className="p-6 space-y-8 bg-[#0d0d0d] min-h-screen text-white font-sans">
      {/* HEADER ESTRATÉGICO */}
      <header className="flex justify-between items-center border-b border-white/[0.06] pb-6">
        <div>
          <h1 className="text-2xl font-bold uppercase tracking-wider text-emerald-50 italic">Financeiro <span className="text-emerald-500">PRO</span></h1>
          <p className="text-gray-500 text-sm">Gestão de Fluxo de Caixa e Reembolsos</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-xl font-bold transition-all shadow-lg flex items-center gap-2"
          >
            <IconPlus /> NOVO LANÇAMENTO
          </button>
        </div>
      </header>

      {/* DASHBOARD DE KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-[#141414] p-6 rounded-2xl border border-white/[0.05] shadow-xl">
          <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest mb-1">Receita Prevista (Mês)</p>
          <div className="flex items-baseline gap-2">
            <h2 className="text-3xl font-black text-emerald-400 font-mono">R$ 45.800</h2>
            <span className="text-xs text-emerald-600">+12%</span>
          </div>
        </div>
        <div className="bg-[#141414] p-6 rounded-2xl border border-white/[0.05] shadow-xl">
          <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest mb-1">Taxas a Reembolsar</p>
          <h2 className="text-3xl font-black text-amber-500 font-mono">R$ 3.250</h2>
        </div>
        <div className="bg-[#141414] p-6 rounded-2xl border border-white/[0.05] shadow-xl">
          <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest mb-1">Inadimplência</p>
          <h2 className="text-3xl font-black text-red-500 font-mono">R$ 1.100</h2>
        </div>
      </div>

      {/* TABELA PROFISSIONAL */}
      <div className="bg-[#141414] rounded-2xl border border-white/[0.05] overflow-hidden shadow-2xl">
        <table className="w-full text-left text-sm">
          <thead className="bg-[#1a1a1a] text-gray-500 text-[10px] font-black uppercase tracking-widest">
            <tr>
              <th className="p-5">Empresa / Processo</th>
              <th className="p-5">Tipo de Custo</th>
              <th className="p-5">Valor</th>
              <th className="p-5">Vencimento</th>
              <th className="p-5 text-center">Status</th>
              <th className="p-5 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {lancamentos.map((item) => (
              <tr key={item.id} className="hover:bg-white/[0.02] transition-colors group">
                <td className="p-5">
                  <p className="font-bold text-gray-200">{item.processos_societarios?.empresas?.razao_social || 'N/A'}</p>
                  <p className="text-[10px] text-gray-600 uppercase font-bold">{item.processos_societarios?.tipo}</p>
                </td>
                <td className="p-5">
                  <span className="flex items-center gap-2 text-gray-400 font-medium text-xs">
                    <IconDollar /> {item.tipo_custo}
                  </span>
                </td>
                <td className="p-5 font-black text-emerald-400 text-base">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.valor)}
                </td>
                <td className="p-5 text-gray-500 text-xs">
                  <div className="flex items-center gap-2"><IconClock /> {new Date(item.data_vencimento).toLocaleDateString('pt-BR')}</div>
                </td>
                <td className="p-5 text-center">
                  <span className={`px-3 py-1 rounded-md text-[9px] font-black uppercase tracking-widest border ${
                    item.status === 'Pago' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 
                    item.status === 'Pendente' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 
                    'bg-red-500/10 text-red-500 border-red-500/20'
                  }`}>
                    {item.status}
                  </span>
                </td>
                <td className="p-5 text-right">
                    <button className="p-2 text-gray-600 hover:text-white transition-colors"><IconSend /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* MODAL DE CADASTRO */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-[#141414] border border-white/[0.1] w-full max-w-md rounded-3xl p-8 shadow-2xl shadow-black">
            <h2 className="text-2xl font-black mb-6 text-emerald-400 italic">NOVO LANÇAMENTO</h2>
            <form onSubmit={handleSave} className="space-y-5">
              <div>
                <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Vincular Processo</label>
                <select 
                  required
                  className="w-full bg-[#0d0d0d] border border-white/[0.1] rounded-xl p-3 text-sm text-gray-300 focus:border-emerald-500 outline-none appearance-none"
                  onChange={(e) => setFormData({...formData, processo_id: e.target.value})}
                >
                  <option value="">Selecione um processo...</option>
                  {processos.map(p => (
                    <option key={p.id} value={p.id}>{p.empresas?.razao_social} ({p.tipo})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Tipo</label>
                  <select 
                    className="w-full bg-[#0d0d0d] border border-white/[0.1] rounded-xl p-3 text-sm text-gray-300 outline-none"
                    value={formData.tipo_custo}
                    onChange={(e) => setFormData({...formData, tipo_custo: e.target.value})}
                  >
                    <option value="Honorário">Honorário</option>
                    <option value="Taxa JUCESP">Taxa JUCESP</option>
                    <option value="Taxa Prefeitura">Taxa Prefeitura</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Valor (R$)</label>
                  <input 
                    type="number" step="0.01" required
                    className="w-full bg-[#0d0d0d] border border-white/[0.1] rounded-xl p-3 text-sm text-emerald-400 font-bold outline-none"
                    onChange={(e) => setFormData({...formData, valor: e.target.value})}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Vencimento</label>
                <input 
                  type="date" required
                  className="w-full bg-[#0d0d0d] border border-white/[0.1] rounded-xl p-3 text-sm text-gray-300 outline-none"
                  value={formData.data_vencimento}
                  onChange={(e) => setFormData({...formData, data_vencimento: e.target.value})}
                />
              </div>

              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 text-gray-500 font-bold text-xs uppercase tracking-widest hover:text-white transition-colors">Cancelar</button>
                <button type="submit" className="flex-1 bg-emerald-600 hover:bg-emerald-500 py-4 rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-emerald-900/20 transition-all">Salvar Registro</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}