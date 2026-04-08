'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { FinanceiroPro } from '@/types'
import toast from 'react-hot-toast'

export default function FinanceiroPage() {
  const [supabase] = useState(createClient())
  const [lancamentos, setLancamentos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchFinanceiro()
  }, [])

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

  return (
    <div className="p-6 space-y-6 bg-[#1a1f2e] min-h-screen text-white font-sans">
      <header className="flex justify-between items-center border-b border-gray-800 pb-6">
        <div>
          <h1 className="text-2xl font-bold uppercase tracking-wider text-emerald-50">Financeiro PRO</h1>
          <p className="text-gray-400 text-sm">Controle de Honorários e Taxas de Processos</p>
        </div>
        <button className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-lg font-bold transition-all shadow-lg active:scale-95 flex items-center gap-2">
          <span>+</span> NOVO LANÇAMENTO
        </button>
      </header>

      {/* Cards de Resumo Visual */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-[#242b3d] p-6 rounded-2xl border border-gray-700/50 shadow-sm">
          <p className="text-gray-400 text-xs font-bold uppercase tracking-widest">A Receber (Mês)</p>
          <p className="text-3xl font-black text-emerald-400 mt-2">R$ 0,00</p>
        </div>
        <div className="bg-[#242b3d] p-6 rounded-2xl border border-gray-700/50 shadow-sm">
          <p className="text-gray-400 text-xs font-bold uppercase tracking-widest">Taxas a Reembolsar</p>
          <p className="text-3xl font-black text-orange-400 mt-2">R$ 0,00</p>
        </div>
        <div className="bg-[#242b3d] p-6 rounded-2xl border border-gray-700/50 shadow-sm">
          <p className="text-gray-400 text-xs font-bold uppercase tracking-widest">Honorários Pagos</p>
          <p className="text-3xl font-black text-blue-400 mt-2">R$ 0,00</p>
        </div>
      </div>

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
                    <span className="text-emerald-50">{item.processos_societarios?.empresas?.razao_social || 'Empresa não vinculada'}</span>
                    <span className="text-[10px] text-gray-500 uppercase mt-1">
                      {item.processos_societarios?.tipo === 'abertura' ? 'ABERTURA' : 'ALTERAÇÃO'}
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
                <td colSpan={5} className="p-24 text-center">
                  <div className="flex flex-col items-center justify-center space-y-3 text-gray-500 italic">
                    <p>Nenhum registro financeiro encontrado no banco de dados.</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}