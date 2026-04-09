'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

// ÍCONES
const IconTrash = () => <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>

export default function FinanceiroPage() {
  const [supabase] = useState(createClient())
  const [lancamentos, setLancamentos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [processos, setProcessos] = useState<any[]>([])
  const [userOrg, setUserOrg] = useState<string | null>(null)

  const [formData, setFormData] = useState({ 
    processo_id: '', tipo_custo: 'Honorário', valor: '', 
    data_conclusao_prevista: '', status: 'Pendente' 
  })

  // Cálculos dinâmicos baseados no que está na tela
  const totalHonorarios = lancamentos.filter(i => i.tipo_custo === 'Honorário').reduce((acc, curr) => acc + curr.valor, 0)
  const totalReembolsos = lancamentos.filter(i => i.tipo_custo !== 'Honorário').reduce((acc, curr) => acc + curr.valor, 0)
  const totalPendente = lancamentos.filter(i => i.status === 'Pendente').reduce((acc, curr) => acc + curr.valor, 0)

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        // BUSCA NA TABELA PROFILES (conforme sua imagem)
        const { data: profile } = await supabase
          .from('profiles')
          .select('organizacao')
          .eq('id', user.id)
          .single()

        if (profile?.organizacao) {
          setUserOrg(profile.organizacao)
          fetchData(profile.organizacao)
        }
      }
    }
    init()
  }, [])

  async function fetchData(org: string) {
    setLoading(true)
    const [procRes, finRes] = await Promise.all([
      supabase.from('processos_societarios').select('id, tipo, empresas(razao_social)').eq('organizacao', org),
      supabase.from('financeiro_pro').select(`*, processos_societarios(tipo, empresas(razao_social))`).eq('organizacao', org).order('created_at', { ascending: false })
    ])
    setProcessos(procRes.data || [])
    setLancamentos(finRes.data || [])
    setLoading(false)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!userOrg) return toast.error("Organização não identificada")

    const payload = { 
      ...formData, 
      valor: parseFloat(formData.valor), 
      organizacao: userOrg, // Carimbo de quem está logado
      data_conclusao_prevista: formData.data_conclusao_prevista || null 
    }

    const { error } = await supabase.from('financeiro_pro').insert([payload])
    if (!error) {
      setIsModalOpen(false)
      fetchData(userOrg)
      setFormData({ processo_id: '', tipo_custo: 'Honorário', valor: '', data_conclusao_prevista: '', status: 'Pendente' })
      toast.success("Lançamento efetivado!")
    } else {
      toast.error("Erro ao salvar")
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Excluir este lançamento?")) return
    const { error } = await supabase.from('financeiro_pro').delete().eq('id', id)
    if (!error && userOrg) fetchData(userOrg)
  }

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen font-sans text-left">
      <header className="flex justify-between items-center bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div className="text-left">
          <h1 className="text-2xl font-bold text-slate-900">Financeiro <span className="text-blue-600 italic">PRO</span></h1>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">Ambiente Seguro: <span className="text-slate-800">{userOrg || 'Identificando...'}</span></p>
        </div>
        <button onClick={() => setIsModalOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-bold text-sm shadow-sm transition-all">+ Novo Lançamento</button>
      </header>

      {/* CARDS */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-1">Honorários ({userOrg})</p>
          <h2 className="text-2xl font-black text-emerald-600 font-mono">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalHonorarios)}</h2>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-1">Reembolsos ({userOrg})</p>
          <h2 className="text-2xl font-bold text-orange-600 font-mono">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalReembolsos)}</h2>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-1">Total em Aberto</p>
          <h2 className="text-2xl font-bold text-slate-900 font-mono">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalPendente)}</h2>
        </div>
      </section>

      {/* TABELA */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden text-left">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr className="text-slate-600 text-[11px] font-black uppercase tracking-wider">
              <th className="px-6 py-4">Empresa / Serviço</th>
              <th className="px-6 py-4">Categoria</th>
              <th className="px-6 py-4">Valor</th>
              <th className="px-6 py-4 text-center">Status</th>
              <th className="px-6 py-4 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {lancamentos.map((item) => (
              <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4">
                  <p className="text-sm font-bold text-slate-800">{item.processos_societarios?.empresas?.razao_social}</p>
                  <p className="text-[10px] text-slate-400 font-black uppercase italic">{item.processos_societarios?.tipo}</p>
                </td>
                <td className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase">{item.tipo_custo}</td>
                <td className="px-6 py-4 font-bold text-slate-900 font-mono">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.valor)}</td>
                <td className="px-6 py-4 text-center">
                  <span className={`text-[10px] font-black px-3 py-1 rounded-full border ${item.status === 'Pago' ? 'text-emerald-700 border-emerald-200 bg-emerald-50' : 'text-orange-700 border-orange-200 bg-orange-50'}`}>
                    {item.status.toUpperCase()}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <button onClick={() => handleDelete(item.id)} className="p-2 hover:bg-red-50 text-slate-300 hover:text-red-600 rounded-lg transition-all"><IconTrash /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {lancamentos.length === 0 && !loading && <div className="p-20 text-center text-slate-400 italic">Nenhum dado financeiro vinculado a {userOrg}.</div>}
      </section>

      {/* MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-6 text-left">
          <div className="bg-white w-full max-w-lg rounded-2xl p-8 shadow-2xl border border-slate-200 text-left">
            <h2 className="text-xl font-bold text-slate-900 mb-6 italic">Novo Lançamento - {userOrg}</h2>
            <form onSubmit={handleSave} className="space-y-4 text-left">
              <div className="space-y-1">
                <label className="text-[11px] font-black text-slate-500 uppercase ml-1">Vincular Processo</label>
                <select required className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500/10 outline-none" onChange={e => setFormData({...formData, processo_id: e.target.value})}>
                  <option value="">Selecione...</option>
                  {processos.map(p => <option key={p.id} value={p.id}>{p.empresas?.razao_social} ({p.tipo})</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-black text-slate-500 uppercase ml-1">Verba</label>
                  <select className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm outline-none" onChange={e => setFormData({...formData, tipo_custo: e.target.value})}>
                    <option value="Honorário">Honorário</option>
                    <option value="Taxa JUCESP">Taxa JUCESP</option>
                    <option value="Taxa Prefeitura">Taxa Prefeitura</option>
                  </select>
                </div>
                <div className="space-y-1 text-left">
                  <label className="text-[11px] font-black text-slate-500 uppercase ml-1">Valor</label>
                  <input type="number" step="0.01" required className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm font-bold text-emerald-600" placeholder="0,00" onChange={e => setFormData({...formData, valor: e.target.value})} />
                </div>
              </div>
              <div className="space-y-1 text-left">
                <label className="text-[11px] font-black text-blue-600 uppercase ml-1 tracking-tighter">Previsão Conclusão Processo</label>
                <input type="date" className="w-full bg-slate-50 border border-blue-100 rounded-lg p-3 text-sm" onChange={e => setFormData({...formData, data_conclusao_prevista: e.target.value})} />
              </div>
              <button type="submit" className="w-full bg-blue-600 text-white py-3 rounded-lg font-black text-xs uppercase shadow-md hover:bg-blue-700 transition-all tracking-[0.2em] mt-4">Efetivar Registro</button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}