'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { FinanceiroPro } from '@/types'
import toast from 'react-hot-toast'

export default function FinanceiroPage() {
  const [supabase] = useState(createClient())
  const [lancamentos, setLancamentos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [processos, setProcessos] = useState<any[]>([])

  // Estado do formulário para capturar o que você digita
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

  // Busca os processos existentes para você selecionar no formulário
  async function fetchProcessos() {
    const { data } = await supabase
      .from('processos_societarios')
      .select('id, tipo, empresas(razao_social)')
    setProcessos(data || [])
  }

  // Busca os lançamentos financeiros do banco
  async function fetchFinanceiro() {
    const { data, error } = await supabase
      .from('financeiro_pro')
      .select(`
        *,
        processos_societarios (
          tipo,
          empresas (razao_social)
        )
      `)
      .order('data_vencimento', { ascending: false })

    if (error) {
      toast.error('Erro ao carregar financeiro')
    } else {
      setLancamentos(data || [])
    }
    setLoading(false)
  }

  // Função que salva no banco de dados quando você clica em SALVAR
  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    
    // Converte o valor para número antes de enviar
    const dadosParaEnviar = {
      ...formData,
      valor: parseFloat(formData.valor)
    }

    const { error } = await supabase
      .from('financeiro_pro')
      .insert([dadosParaEnviar])

    if (error) {
      toast.error('Erro ao salvar lançamento')
      console.error(error)
    } else {
      toast.success('Lançamento realizado com sucesso!')
      setIsModalOpen(false) // Fecha a janelinha
      fetchFinanceiro() // Atualiza a tabela na hora
    }
  }

  return (
    <div className="p-6 space-y-6 bg-[#1a1f2e] min-h-screen text-white font-sans">
      <header className="flex justify-between items-center border-b border-gray-800 pb-6">
        <div>
          <h1 className="text-2xl font-bold uppercase tracking-wider text-emerald-50">Financeiro PRO</h1>
          <p className="text-gray-400 text-sm">Controle de Honorários e Taxas de Processos</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-lg font-bold transition-all shadow-lg active:scale-95 flex items-center gap-2"
        >
          <span>+</span> NOVO LANÇAMENTO
        </button>
      </header>

      {/* Tabela de Lançamentos */}
      <div className="bg-[#242b3d] rounded-2xl border border-gray-700 overflow-hidden shadow-2xl">
        <table className="w-full text-left text-sm border-collapse">
          <thead className="bg-[#2d354a] text-gray-400 text-[10px] font-black uppercase tracking-widest">
            <tr>
              <th className="p-5 border-b border-gray-700">Empresa / Processo</th>
              <th className="p-5 border-b border-gray-700">Tipo de Custo</th>
              <th className="p-5 border-b border-gray-700">Valor</th>
              <th className="p-5 border-b border-gray-700">Vencimento</th>
              <th className="p-5 border-b border-gray-700 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700/50">
            {lancamentos.map((item) => (
              <tr key={item.id} className="hover:bg-[#2d354a]/50 transition-colors group">
                <td className="p-5 font-bold">
                  <div className="flex flex-col">
                    <span className="text-emerald-50">{item.processos_societarios?.empresas?.razao_social || 'N/A'}</span>
                    <span className="text-[10px] text-gray-500 uppercase mt-1">
                      {item.processos_societarios?.tipo}
                    </span>
                  </div>
                </td>
                <td className="p-5 text-gray-300 font-medium">{item.tipo_custo}</td>
                <td className="p-5 text-emerald-400 font-black text-base">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.valor)}
                </td>
                <td className="p-5 text-gray-400">
                  {new Date(item.data_vencimento).toLocaleDateString('pt-BR')}
                </td>
                <td className="p-5 text-center">
                  <span className={`px-3 py-1.5 rounded-md text-[9px] font-black uppercase tracking-tighter border ${
                    item.status === 'Pago' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 
                    item.status === 'Pendente' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' : 
                    'bg-blue-500/10 text-blue-400 border-blue-500/20'
                  }`}>
                    {item.status}
                  </span>
                </td>
              </tr>
            ))}
            {lancamentos.length === 0 && !loading && (
              <tr>
                <td colSpan={5} className="p-20 text-center text-gray-500 italic">
                  Nenhum registro encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* JANELA FLUTUANTE (MODAL) DE CADASTRO */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#242b3d] border border-gray-700 w-full max-w-md rounded-2xl p-6 shadow-2xl animate-in fade-in zoom-in duration-200">
            <h2 className="text-xl font-bold mb-6 text-emerald-400">Novo Lançamento</h2>
            
            <form onSubmit={handleSave} className="space-y-4 text-left">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Vincular Processo</label>
                <select 
                  required
                  className="w-full bg-[#1a1f2e] border border-gray-700 rounded-lg p-3 text-sm focus:border-emerald-500 outline-none transition-colors"
                  onChange={(e) => setFormData({...formData, processo_id: e.target.value})}
                >
                  <option value="">Selecione um processo...</option>
                  {processos.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.empresas?.razao_social} ({p.tipo})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Tipo</label>
                  <select 
                    className="w-full bg-[#1a1f2e] border border-gray-700 rounded-lg p-3 text-sm outline-none"
                    value={formData.tipo_custo}
                    onChange={(e) => setFormData({...formData, tipo_custo: e.target.value})}
                  >
                    <option value="Honorário">Honorário</option>
                    <option value="Taxa JUCESP">Taxa JUCESP</option>
                    <option value="Taxa Prefeitura">Taxa Prefeitura</option>
                    <option value="Certidões">Certidões</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Valor (R$)</label>
                  <input 
                    type="number" step="0.01" required placeholder="0,00"
                    className="w-full bg-[#1a1f2e] border border-gray-700 rounded-lg p-3 text-sm outline-none"
                    onChange={(e) => setFormData({...formData, valor: e.target.value})}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Vencimento</label>
                <input 
                  type="date" required
                  className="w-full bg-[#1a1f2e] border border-gray-700 rounded-lg p-3 text-sm outline-none"
                  value={formData.data_vencimento}
                  onChange={(e) => setFormData({...formData, data_vencimento: e.target.value})}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 bg-gray-800 hover:bg-gray-700 py-3 rounded-lg font-bold text-xs transition-colors"
                >
                  CANCELAR
                </button>
                <button 
                  type="submit"
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 py-3 rounded-lg font-bold text-xs transition-colors shadow-lg shadow-emerald-900/20"
                >
                  SALVAR
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}