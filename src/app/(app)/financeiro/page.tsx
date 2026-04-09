'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

// ÍCONES
const IconPlus = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
const IconCheck = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>

export default function FinanceiroPage() {
  const [supabase] = useState(createClient())
  const [lancamentos, setLancamentos] = useState<any[]>([])
  const [processos, setProcessos] = useState<any[]>([])
  const [userOrg, setUserOrg] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const [formData, setFormData] = useState({ 
    processo_id: '', 
    tipo_custo: 'Honorário', 
    valor: '', 
    status: 'Pendente' 
  })

  useEffect(() => {
    async function initFinanceiro() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        // 1. Identifica a organização do perfil logado
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
    initFinanceiro()
  }, [])

  async function fetchData(org: string) {
    setLoading(true)
    // 2. Busca lançamentos e processos filtrando pela organização
    const [finRes, procRes] = await Promise.all([
      supabase
        .from('financeiro_pro')
        .select(`*, processos_societarios(tipo, empresas(razao_social))`)
        .eq('organizacao', org)
        .order('created_at', { ascending: false }),
      supabase
        .from('processos_societarios')
        .select('id, tipo, empresas(razao_social)')
        .eq('organizacao', org)
    ])

    setLancamentos(finRes.data || [])
    setProcessos(procRes.data || [])
    setLoading(false)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!userOrg) return

    // 3. Insere o novo lançamento com o carimbo organizacional
    const payload = { 
      ...formData, 
      valor: parseFloat(formData.valor), 
      organizacao: userOrg 
    }

    const { error } = await supabase.from('financeiro_pro').insert([payload])

    if (!error) {
      toast.success("Lançamento financeiro registrado!")
      setIsModalOpen(false)
      setFormData({ processo_id: '', tipo_custo: 'Honorário', valor: '', status: 'Pendente' })
      fetchData(userOrg)
    } else {
      toast.error("Erro ao salvar lançamento.")
    }
  }

  // Cálculos de resumo rápidos
  const totalPendente = lancamentos
    .filter(i => i.status === 'Pendente')
    .reduce((acc, curr) => acc + curr.valor, 0)

  return (
    <div className="p-8 space-y-8 bg-slate-50 min-h-screen font-sans text-left">
      <header className="flex justify-between items-center bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="text-left">
          <h1 className="text-2xl font-bold text-slate-900">Financeiro PRO</h1>
          <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] mt-1">
            Escritório: <span className="text-blue-600">{userOrg}</span>
          </p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 transition-all shadow-lg shadow-slate-200"
        >
          <IconPlus /> Novo Lançamento
        </button>
      </header>

      {/* Card de Alerta Financeiro */}
      <div className="bg-orange-50 border border-orange-100 p-6 rounded-2xl flex justify-between items-center">
        <div>
          <p className="text-orange-600 text-[10px] font-black uppercase tracking-widest">Total Pendente ({userOrg})</p>
          <h2 className="text-3xl font-black text-orange-700 mt-1 font-mono">
            R$ {totalPendente.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </h2>
        </div>
        <div className="bg-orange-200/30 p-3 rounded-full text-orange-600 italic text-xs font-bold">
          Aguardando Pagamento
        </div>
      </div>

      {/* Tabela de Lançamentos */}
      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden text-left">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr className="text-slate-500 text-[10px] font-black uppercase tracking-widest text-left">
              <th className="px-6 py-4">Empresa / Processo</th>
              <th className="px-6 py-4">Tipo</th>
              <th className="px-6 py-4">Valor</th>
              <th className="px-6 py-4 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {lancamentos.map(item => (
              <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4 text-left">
                  <p className="text-sm font-bold text-slate-800">{item.processos_societarios?.empresas?.razao_social}</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">{item.processos_societarios?.tipo}</p>
                </td>
                <td className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase">{item.tipo_custo}</td>
                <td className="px-6 py-4 text-sm font-black text-slate-900 font-mono">R$ {item.valor.toFixed(2)}</td>
                <td className="px-6 py-4 text-center">
                  <span className={`text-[10px] font-black px-3 py-1 rounded-full border ${
                    item.status === 'Pago' 
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                    : 'bg-orange-50 text-orange-700 border-orange-200'
                  }`}>
                    {item.status.toUpperCase()}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {lancamentos.length === 0 && !loading && (
          <div className="p-20 text-center text-slate-400 italic">Nenhum lançamento financeiro para {userOrg}.</div>
        )}
      </section>

      {/* MODAL DE CADASTRO */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-6">
          <div className="bg-white w-full max-w-lg rounded-3xl p-8 border border-slate-200 shadow-2xl text-left">
            <h2 className="text-xl font-bold mb-6 text-slate-900">Novo Lançamento Financeiro</h2>
            <form onSubmit={handleSave} className="space-y-4 text-left">
              <div className="text-left">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Vincular a Processo Ativo</label>
                <select 
                  required 
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500/10 outline-none mt-1" 
                  onChange={e => setFormData({...formData, processo_id: e.target.value})}
                >
                  <option value="">Selecione um processo...</option>
                  {processos.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.empresas?.razao_social} ({p.tipo})
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4 text-left">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Tipo de Gasto</label>
                  <select 
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm mt-1" 
                    onChange={e => setFormData({...formData, tipo_custo: e.target.value})}
                  >
                    <option value="Honorário">Honorário</option>
                    <option value="Taxa JUCESP">Taxa JUCESP</option>
                    <option value="Certidão">Certidão</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Valor (R$)</label>
                  <input 
                    type="number" step="0.01" required 
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold text-slate-900 mt-1" 
                    placeholder="0,00"
                    onChange={e => setFormData({...formData, valor: e.target.value})} 
                  />
                </div>
              </div>
              <button 
                type="submit" 
                className="w-full bg-blue-600 text-white py-4 rounded-xl font-black uppercase text-xs mt-6 tracking-[0.2em] shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all"
              >
                Efetivar Lançamento
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}