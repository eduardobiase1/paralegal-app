'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useOrg } from '@/lib/org-context'

export default function AlvarasPage() {
  const { orgName } = useOrg()
  const [supabase] = useState(createClient())
  const [dados, setDados] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadInitialData() {
      // RLS isolates data by org automatically — no manual filter needed
      const { data } = await supabase
        .from('alvaras')
        .select('*, empresas(razao_social)')
        .order('data_vencimento', { ascending: true })
      setDados(data || [])
      setLoading(false)
    }
    loadInitialData()
  }, [supabase])

  if (loading) return <div className="p-10 font-sans text-slate-400">Carregando...</div>

  return (
    <div className="p-8 space-y-6 bg-slate-50 min-h-screen text-left font-sans">
      <header className="flex justify-between items-center bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Alvarás de Funcionamento</h1>
          <p className="text-[10px] font-black uppercase text-blue-600 tracking-widest mt-1">
            Escritório: {orgName}
          </p>
        </div>
      </header>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr className="text-[10px] font-black text-slate-500 uppercase">
              <th className="px-6 py-4">Empresa</th>
              <th className="px-6 py-4">Documento</th>
              <th className="px-6 py-4">Vencimento</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {dados.length > 0 ? dados.map((item) => (
              <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4 text-sm font-bold text-slate-800">
                  {item.empresas?.razao_social || 'Empresa não vinculada'}
                </td>
                <td className="px-6 py-4 text-xs font-medium text-slate-500 uppercase">
                  {item.tipo || 'Alvará Geral'}
                </td>
                <td className="px-6 py-4 text-sm font-mono font-bold text-slate-700">
                  {item.data_vencimento ? new Date(item.data_vencimento).toLocaleDateString('pt-BR') : '---'}
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={3} className="px-6 py-12 text-center text-slate-400 italic">
                  Nenhum alvará encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}