'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

// --- ÍCONES SVG ---
const IconPlus = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
const IconCheckDouble = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
const IconTrash = () => <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>

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

  // NOVA FUNÇÃO: CICLO DE 3 STATUS (Pendente -> Pago -> Conciliado)
  async function cycleStatus(id: string, currentStatus: string) {
    let nextStatus = 'Pendente'
    if (currentStatus === 'Pendente') nextStatus = 'Pago'
    else if (currentStatus === 'Pago') nextStatus = 'Conciliado'
    else if (currentStatus === 'Conciliado') nextStatus = 'Pendente'

    const { error } = await supabase.from('financeiro_pro').update({ status: nextStatus }).eq('id', id)
    if (!error) {
        toast.success(`Status alterado para ${nextStatus}`)
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
    const { error } = await supabase.from('financeiro_pro').insert([{ ...formData, valor: parseFloat(formData.valor) }])
    if (!error) {
      setIsModalOpen(false)
      fetchFinanceiro()
    }
  }

  return (
    <div className="p-6 space-y-8 bg-[#0d0d0d] min-h-screen text-white font-sans">
      <header className="flex justify-between items-center border-b border-white/[0.06] pb-6">
        <div>
          <h1 className="text-2xl font-bold uppercase tracking-wider text-emerald-50 italic">Financeiro <span className="text-emerald-500">PRO</span></h1>
          <p className="text-gray-500 text-sm">Controle de Fluxo e Auditoria</p>
        </div>
        <button onClick={() => setIsModalOpen(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2">
          <IconPlus /> NOVO LANÇAMENTO
        </button>
      </header>

      {/* TABELA COM 3 STATUS */}
      <div className="bg-[#141414] rounded-2xl border border-white/[0.05] overflow-hidden shadow-2xl">
        <table className="w-full text-left text-sm">
          <thead className="bg-[#1a1a1a] text-gray-500 text-[10px] font-black uppercase tracking-widest">
            <tr>
              <th className="p-5">Empresa / Processo</th>
              <th className="p-5">Valor</th>
              <th className="p-5 text-center">Status (Ciclo de 3 níveis)</th>
              <th className="p-5 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {lancamentos.map((item) => (
              <tr key={item.id} className="hover:bg-white/[0.02]">
                <td className="p-5">
                  <p className="font-bold text-gray-200">{item.processos_societarios?.empresas?.razao_social}</p>
                  <p className="text-[9px] text-gray-600 uppercase font-black">{item.processos_societarios?.tipo}</p>
                </td>
                <td className="p-5 font-black text-emerald-400 text-base">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.valor)}
                </td>
                <td className="p-5 text-center">
                  <button 
                    onClick={() => cycleStatus(item.id, item.status)}
                    className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all flex items-center gap-2 mx-auto ${
                    item.status === 'Conciliado' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 
                    item.status === 'Pago' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 
                    'bg-amber-500/10 text-amber-500 border-amber-500/20'
                  }`}>
                    {item.status === 'Conciliado' && <IconCheckDouble />}
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
                <select required className="w-full bg-[#0d0d0d] border border-white/[0.1] rounded-xl p-3 text-sm text-white" onChange={(e) => setFormData({...formData, processo_id: e.target.value})}>
                  <option value="">Selecione...</option>
                  {processos.map(p => <option key={p.id} value={p.id}>{p.empresas?.razao_social} ({p.tipo})</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-gray-500 uppercase mb-2">Tipo</label>
                  <select className="w-full bg-[#0d0d0d] border border-white/[0.1] rounded-xl p-3 text-sm text-white" onChange={(e) => setFormData({...formData, tipo_custo: e.target.value})}>
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