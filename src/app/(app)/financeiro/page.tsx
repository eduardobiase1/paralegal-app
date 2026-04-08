'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

// --- ÍCONES SVG ---
const IconPlus = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
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

  // FUNÇÃO PARA ATUALIZAR STATUS VIA SELECT
  async function updateStatus(id: string, newStatus: string) {
    const { error } = await supabase
      .from('financeiro_pro')
      .update({ status: newStatus })
      .eq('id', id)
    
    if (!error) {
        toast.success(`Status atualizado para ${newStatus}`)
        fetchFinanceiro()
    } else {
        toast.error("Erro ao atualizar status")
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
      toast.success("Lançamento salvo!")
    }
  }

  return (
    <div className="p-6 space-y-8 bg-[#0d0d0d] min-h-screen text-white font-sans">
      <header className="flex justify-between items-center border-b border-white/[0.06] pb-6">
        <div>
          <h1 className="text-2xl font-bold uppercase tracking-wider text-emerald-50 italic">Financeiro <span className="text-emerald-500">PRO</span></h1>
          <p className="text-gray-500 text-sm">Gestão de Fluxo e Auditoria</p>
        </div>
        <button onClick={() => setIsModalOpen(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all active:scale-95 shadow-lg shadow-emerald-900/20">
          <IconPlus /> NOVO LANÇAMENTO
        </button>
      </header>

      {/* TABELA COM SELETOR DE STATUS */}
      <div className="bg-[#141414] rounded-2xl border border-white/[0.05] overflow-hidden shadow-2xl">
        <table className="w-full text-left text-sm">
          <thead className="bg-[#1a1a1a] text-gray-500 text-[10px] font-black uppercase tracking-widest">
            <tr>
              <th className="p-5">Empresa / Processo</th>
              <th className="p-5">Valor</th>
              <th className="p-5 text-center">Status</th>
              <th className="p-5 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {lancamentos.map((item) => (
              <tr key={item.id} className="hover:bg-white/[0.02] transition-colors">
                <td className="p-5">
                  <p className="font-bold text-gray-200">{item.processos_societarios?.empresas?.razao_social}</p>
                  <p className="text-[9px] text-gray-600 uppercase font-black tracking-tighter">{item.processos_societarios?.tipo}</p>
                </td>
                <td className="p-5 font-black text-emerald-400 text-base font-mono">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.valor)}
                </td>
                <td className="p-5 text-center">
                  {/* SELETOR DE STATUS ESTILO FILTRO */}
                  <select 
                    value={item.status}
                    onChange={(e) => updateStatus(item.id, e.target.value)}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border bg-transparent outline-none cursor-pointer transition-all ${
                        item.status === 'Conciliado' ? 'text-blue-400 border-blue-500/30 bg-blue-500/5' : 
                        item.status === 'Pago' ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/5' : 
                        'text-amber-500 border-amber-500/30 bg-amber-500/5'
                    }`}
                  >
                    <option value="Pendente" className="bg-[#1a1a1a] text-amber-500">Pendente</option>
                    <option value="Pago" className="bg-[#1a1a1a] text-emerald-400">Pago</option>
                    <option value="Conciliado" className="bg-[#1a1a1a] text-blue-400">Conciliado</option>
                  </select>
                </td>
                <td className="p-5 text-right">
                    <button onClick={() => handleDelete(item.id)} className="p-2 hover:bg-red-500/10 rounded-lg transition-all group">
                        <IconTrash />
                    </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* MODAL DE CADASTRO */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-[#141414] border border-white/[0.1] w-full max-w-md rounded-3xl p-8 shadow-2xl">
            <h2 className="text-2xl font-black mb-6 text-emerald-400 italic uppercase">Novo Lançamento</h2>
            <form onSubmit={handleSave} className="space-y-5">
              <div>
                <label className="block text-[10px] font-black text-gray-500 uppercase mb-2">Processo</label>
                <select required className="w-full bg-[#0d0d0d] border border-white/[0.1] rounded-xl p-3 text-sm text-white outline-none focus:border-emerald-500/50" onChange={(e) => setFormData({...formData, processo_id: e.target.value})}>
                  <option value="">Selecione...</option>
                  {processos.map(p => <option key={p.id} value={p.id}>{p.empresas?.razao_social} ({p.tipo})</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-gray-500 uppercase mb-2">Tipo</label>
                  <select className="w-full bg-[#0d0d0d] border border-white/[0.1] rounded-xl p-3 text-sm text-white outline-none" onChange={(e) => setFormData({...formData, tipo_custo: e.target.value})}>
                    <option value="Honorário">Honorário</option>
                    <option value="Taxa JUCESP">Taxa JUCESP</option>
                    <option value="Taxa Prefeitura">Taxa Prefeitura</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray-500 uppercase mb-2">Valor (R$)</label>
                  <input type="number" step="0.01" required className="w-full bg-[#0d0d0d] border border-white/[0.1] rounded-xl p-3 text-sm text-emerald-400 font-bold outline-none" onChange={(e) => setFormData({...formData, valor: e.target.value})} />
                </div>
              </div>
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 text-gray-500 font-bold text-xs uppercase tracking-widest hover:text-white transition-colors">Cancelar</button>
                <button type="submit" className="flex-1 bg-emerald-600 py-4 rounded-xl font-black text-xs uppercase shadow-lg shadow-emerald-900/20 hover:bg-emerald-500 transition-all">Salvar Registro</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}