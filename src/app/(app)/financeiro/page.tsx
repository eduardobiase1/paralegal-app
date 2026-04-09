'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

// --- ÍCONES PREMIUM SVG ---
const IconPlus = () => <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
const IconFilter = () => <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>
const IconTrash = () => <svg className="w-4 h-4 text-red-400/50 hover:text-red-400 transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
const IconSearch = () => <svg className="w-4 h-4 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>

export default function FinanceiroPage() {
  const [supabase] = useState(createClient())
  const [lancamentos, setLancamentos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [processos, setProcessos] = useState<any[]>([])

  // Lógica de Dashboards
  const totalHonorarios = lancamentos.filter(i => i.tipo_custo === 'Honorário').reduce((acc, curr) => acc + curr.valor, 0)
  const totalTaxas = lancamentos.filter(i => i.tipo_custo.includes('Taxa')).reduce((acc, curr) => acc + curr.valor, 0)
  const totalPendente = lancamentos.filter(i => i.status === 'Pendente').reduce((acc, curr) => acc + curr.valor, 0)

  const [formData, setFormData] = useState({ processo_id: '', tipo_custo: 'Honorário', valor: '', data_vencimento: new Date().toISOString().split('T')[0], status: 'Pendente' })

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

  async function updateStatus(id: string, newStatus: string) {
    const { error } = await supabase.from('financeiro_pro').update({ status: newStatus }).eq('id', id)
    if (!error) { toast.success(`Status Atualizado`); fetchFinanceiro(); }
  }

  async function handleDelete(id: string) {
    if (!confirm("Confirmar exclusão?")) return
    const { error } = await supabase.from('financeiro_pro').delete().eq('id', id)
    if (!error) fetchFinanceiro()
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    const { error } = await supabase.from('financeiro_pro').insert([{ ...formData, valor: parseFloat(formData.valor) }])
    if (!error) { setIsModalOpen(false); fetchFinanceiro(); toast.success("Lançamento Registrado!"); }
  }

  return (
    <div className="p-8 space-y-10 bg-[#080808] min-h-screen text-slate-200 font-sans selection:bg-emerald-500/30">
      
      {/* HEADER ELEGANTE */}
      <header className="flex justify-between items-end">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="w-2 h-8 bg-emerald-500 rounded-full animate-pulse"></span>
            <h1 className="text-3xl font-light tracking-tighter text-white">Gestão <span className="font-black italic text-emerald-500">Financeira</span></h1>
          </div>
          <p className="text-slate-500 text-xs font-medium tracking-widest uppercase ml-4">Monitoramento de Fluxo e Auditoria Paralegal</p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="relative group">
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none"><IconSearch /></div>
            <input type="text" placeholder="Buscar lançamento..." className="bg-[#111] border border-white/5 rounded-full py-2 pl-10 pr-4 text-xs focus:outline-none focus:border-emerald-500/50 w-64 transition-all" />
          </div>
          <button onClick={() => setIsModalOpen(true)} className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-full font-bold text-xs flex items-center gap-2 transition-all shadow-[0_0_20px_rgba(16,185,129,0.2)] active:scale-95">
            <IconPlus /> NOVO REGISTRO
          </button>
        </div>
      </header>

      {/* DASHBOARD CARDS (GLASSMORPHISM) */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: 'Faturamento Honorários', val: totalHonorarios, color: 'text-emerald-400', glow: 'shadow-emerald-500/5' },
          { label: 'Reembolsos de Taxas', val: totalTaxas, color: 'text-amber-400', glow: 'shadow-amber-500/5' },
          { label: 'Previsão de Recebimento', val: totalPendente, color: 'text-rose-400', glow: 'shadow-rose-500/5' }
        ].map((card, idx) => (
          <div key={idx} className={`bg-[#111] border border-white/[0.03] p-8 rounded-[2rem] ${card.glow} shadow-2xl transition-transform hover:-translate-y-1`}>
            <div className="flex justify-between items-start mb-4">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">{card.label}</span>
              <div className="p-2 bg-white/5 rounded-xl"><IconFilter /></div>
            </div>
            <h2 className={`text-4xl font-light tracking-tighter ${card.color} font-mono`}>
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(card.val)}
            </h2>
          </div>
        ))}
      </section>

      {/* TABELA ULTRA-CLEAN */}
      <section className="bg-[#111] rounded-[2.5rem] border border-white/[0.03] overflow-hidden shadow-2xl">
        <table className="w-full text-left">
          <thead className="bg-white/[0.02] border-b border-white/[0.05]">
            <tr className="text-slate-500 text-[10px] font-black uppercase tracking-[0.15em]">
              <th className="px-8 py-6">Entidade / Processo</th>
              <th className="px-8 py-6">Categoria</th>
              <th className="px-8 py-6">Montante</th>
              <th className="px-8 py-6 text-center">Status Auditoria</th>
              <th className="px-8 py-6 text-right">Controle</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.03]">
            {lancamentos.map((item) => (
              <tr key={item.id} className="group hover:bg-white/[0.01] transition-colors">
                <td className="px-8 py-6">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-slate-100 group-hover:text-emerald-400 transition-colors">{item.processos_societarios?.empresas?.razao_social}</p>
                    <p className="text-[9px] text-slate-600 font-bold tracking-wider uppercase italic">{item.processos_societarios?.tipo}</p>
                  </div>
                </td>
                <td className="px-8 py-6">
                  <span className="text-[10px] bg-white/5 border border-white/5 px-3 py-1 rounded-full text-slate-400 font-bold uppercase">{item.tipo_custo}</span>
                </td>
                <td className="px-8 py-6">
                  <span className="text-lg font-light tracking-tighter text-emerald-500 font-mono">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.valor)}
                  </span>
                </td>
                <td className="px-8 py-6 text-center">
                  <select 
                    value={item.status}
                    onChange={(e) => updateStatus(item.id, e.target.value)}
                    className={`text-[10px] font-black uppercase tracking-widest bg-transparent border-none focus:ring-0 cursor-pointer transition-all ${
                      item.status === 'Conciliado' ? 'text-cyan-400' : item.status === 'Pago' ? 'text-emerald-400' : 'text-amber-500'
                    }`}
                  >
                    <option value="Pendente">● Pendente</option>
                    <option value="Pago">● Pago</option>
                    <option value="Conciliado">● Conciliado</option>
                  </select>
                </td>
                <td className="px-8 py-6 text-right">
                  <button onClick={() => handleDelete(item.id)} className="p-3 bg-white/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500/10">
                    <IconTrash />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* MODAL DESIGNER */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-xl flex items-center justify-center z-50 p-6 animate-in fade-in duration-300">
          <div className="bg-[#111] border border-white/10 w-full max-w-xl rounded-[3rem] p-12 shadow-[0_0_100px_rgba(0,0,0,0.5)]">
            <div className="flex justify-between items-center mb-10">
              <h2 className="text-3xl font-light tracking-tighter text-white">Registrar <span className="font-black text-emerald-500">Transação</span></h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-500 hover:text-white transition-colors">Fechar</button>
            </div>
            
            <form onSubmit={handleSave} className="space-y-8 text-left">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4">Vincular Processo Operacional</label>
                <select required className="w-full bg-white/5 border border-white/5 rounded-2xl p-4 text-sm text-slate-100 focus:border-emerald-500/50 outline-none transition-all" onChange={(e) => setFormData({...formData, processo_id: e.target.value})}>
                  <option value="">Selecione o cliente...</option>
                  {processos.map(p => <option key={p.id} value={p.id}>{p.empresas?.razao_social} ({p.tipo})</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4">Tipo</label>
                  <select className="w-full bg-white/5 border border-white/5 rounded-2xl p-4 text-sm text-slate-100 outline-none focus:border-emerald-500/50 transition-all" onChange={(e) => setFormData({...formData, tipo_custo: e.target.value})}>
                    <option value="Honorário">Honorário</option>
                    <option value="Taxa JUCESP">Taxa JUCESP</option>
                    <option value="Taxa Prefeitura">Taxa Prefeitura</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4">Valor Nomimal</label>
                  <input type="number" step="0.01" required placeholder="0,00" className="w-full bg-white/5 border border-white/5 rounded-2xl p-4 text-sm text-emerald-400 font-bold outline-none focus:border-emerald-500 transition-all placeholder:text-slate-800" onChange={(e) => setFormData({...formData, valor: e.target.value})} />
                </div>
              </div>

              <div className="flex gap-4 pt-6">
                <button type="submit" className="flex-1 bg-emerald-600 hover:bg-emerald-500 py-5 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-2xl shadow-emerald-500/20 transition-all">Efetivar Lançamento</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}