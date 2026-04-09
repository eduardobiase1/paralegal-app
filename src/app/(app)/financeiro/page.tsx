'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

// --- ÍCONES ---
const IconPlus = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
const IconTrash = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>

export default function FinanceiroPage() {
  const [supabase] = useState(createClient())
  const [lancamentos, setLancamentos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [processos, setProcessos] = useState<any[]>([])
  const [userOrg, setUserOrg] = useState<string | null>(null)

  // Cálculos do Dashboard
  const totalHonorarios = lancamentos.filter(i => i.tipo_custo === 'Honorário').reduce((acc, curr) => acc + curr.valor, 0)
  const totalReembolsos = lancamentos.filter(i => i.tipo_custo !== 'Honorário').reduce((acc, curr) => acc + curr.valor, 0)
  const totalPendente = lancamentos.filter(i => i.status === 'Pendente').reduce((acc, curr) => acc + curr.valor, 0)

  const [formData, setFormData] = useState({ 
    processo_id: '', tipo_custo: 'Honorário', valor: '', 
    data_vencimento: new Date().toISOString().split('T')[0],
    data_conclusao_prevista: '', status: 'Pendente' 
  })

  useEffect(() => {
    async function getInitialData() {
      // 1. Pega a org do usuário logado
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: perfil } = await supabase
          .from('perfis')
          .select('organizacao')
          .eq('id', user.id)
          .single()
        
        if (perfil) {
          setUserOrg(perfil.organizacao)
          fetchFinanceiro()
          fetchProcessos(perfil.organizacao)
        }
      }
    }
    getInitialData()
  }, [])

  async function fetchProcessos(org: string) {
    const { data } = await supabase.from('processos_societarios')
      .select('id, tipo, empresas(razao_social)')
      .eq('organizacao', org)
    setProcessos(data || [])
  }

  async function fetchFinanceiro() {
    setLoading(true)
    const { data, error } = await supabase.from('financeiro_pro')
      .select(`*, processos_societarios (tipo, empresas (razao_social))`)
      .order('data_vencimento', { ascending: false })
    
    // Se o RLS estiver ativo no Supabase, o data virá filtrado automaticamente
    if (!error) setLancamentos(data || [])
    setLoading(false)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!userOrg) return toast.error("Organização não identificada")

    const payload = { 
      ...formData, 
      valor: parseFloat(formData.valor), 
      data_conclusao_prevista: formData.data_conclusao_prevista || null,
      organizacao: userOrg // Carimba com a org do usuário logado
    }

    const { error } = await supabase.from('financeiro_pro').insert([payload])
    if (!error) { 
      setIsModalOpen(false); 
      fetchFinanceiro(); 
      toast.success("Lançamento Registrado!"); 
    }
  }

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen font-sans">
      <header className="flex justify-between items-center bg-white p-6 rounded-xl border border-slate-200 shadow-sm text-left">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Financeiro <span className="text-blue-600">PRO</span></h1>
          <p className="text-slate-500 text-sm italic">Ambiente Seguro: <span className="font-bold text-slate-800 uppercase">{userOrg || 'Carregando...'}</span></p>
        </div>
        <button onClick={() => setIsModalOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-bold text-sm shadow-sm transition-all">+ Novo Lançamento</button>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm text-left">
          <p className="text-slate-500 text-[11px] font-bold uppercase tracking-wider mb-2">Honorários</p>
          <h2 className="text-2xl font-bold text-emerald-600 font-mono">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalHonorarios)}</h2>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm text-left">
          <p className="text-slate-500 text-[11px] font-bold uppercase tracking-wider mb-2">Reembolsos</p>
          <h2 className="text-2xl font-bold text-orange-600 font-mono">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalReembolsos)}</h2>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm text-left">
          <p className="text-slate-500 text-[11px] font-bold uppercase tracking-wider mb-2">Total Pendente</p>
          <h2 className="text-2xl font-bold text-slate-900 font-mono">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalPendente)}</h2>
        </div>
      </section>

      <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden text-left">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-200 text-left">
            <tr className="text-slate-600 text-[11px] font-bold uppercase tracking-wider">
              <th className="px-6 py-4">Processo</th>
              <th className="px-6 py-4">Categoria</th>
              <th className="px-6 py-4">Valor</th>
              <th className="px-6 py-4 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {lancamentos.map((item) => (
              <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4">
                   <p className="text-sm font-semibold text-slate-800 text-left">{item.processos_societarios?.empresas?.razao_social}</p>
                   <p className="text-[10px] text-slate-400 uppercase text-left">{item.processos_societarios?.tipo}</p>
                </td>
                <td className="px-6 py-4"><span className="text-[10px] bg-slate-100 px-2 py-1 rounded-md text-slate-600 font-bold border border-slate-200">{item.tipo_custo}</span></td>
                <td className="px-6 py-4 font-mono font-bold text-slate-900 text-left">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.valor)}</td>
                <td className="px-6 py-4 text-center">
                  <span className={`text-[10px] font-bold px-3 py-1 rounded-full border ${item.status === 'Pago' ? 'text-emerald-700 border-emerald-200 bg-emerald-50' : 'text-orange-700 border-orange-200 bg-orange-50'}`}>{item.status.toUpperCase()}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {lancamentos.length === 0 && !loading && (
          <div className="p-20 text-center text-slate-400 italic">Nenhum lançamento encontrado para sua organização.</div>
        )}
      </section>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-6 text-left">
           <div className="bg-white w-full max-w-lg rounded-2xl p-8 shadow-2xl border border-slate-200 text-left">
             <h2 className="text-xl font-bold text-slate-900 mb-6">Novo Lançamento - {userOrg}</h2>
             <form onSubmit={handleSave} className="space-y-5 text-left">
                <div className="text-left space-y-1">
                  <label className="text-[11px] font-bold text-slate-500 uppercase ml-1">Processo</label>
                  <select required className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm" onChange={(e) => setFormData({...formData, processo_id: e.target.value})}>
                    <option value="">Selecione...</option>
                    {processos.map(p => <option key={p.id} value={p.id}>{p.empresas?.razao_social} ({p.tipo})</option>)}
                  </select>
                </div>
                {/* ... demais campos (valor, tipo, data prevista) seguem o mesmo padrão ... */}
                <button type="submit" className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold uppercase shadow-md hover:bg-blue-700 transition-all">Efetivar Lançamento</button>
             </form>
           </div>
        </div>
      )}
    </div>
  )
}
