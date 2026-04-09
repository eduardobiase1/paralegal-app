'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useOrg } from '@/lib/org-context'

export default function LicencasPage() {
  const { orgName } = useOrg()
  const [supabase] = useState(createClient())
  const [dados, setDados] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      // RLS isolates data by org automatically — no manual filter needed
      const { data } = await supabase
        .from('licencas_sanitarias')
        .select('*, empresas(razao_social)')
        .order('data_vencimento', { ascending: true })
      setDados(data || [])
      setLoading(false)
    }
    load()
  }, [supabase])

  if (loading) return <div className="p-10 font-sans text-slate-400">Carregando...</div>

  return (
    <div className="p-8 space-y-6 bg-slate-50 min-h-screen text-left font-sans">
      <header className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">Licenças Sanitárias</h1>
        <p className="text-[10px] font-black uppercase text-blue-600 tracking-widest mt-1">
          Escritório: {orgName}
        </p>
      </header>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr className="text-[10px] font-black text-slate-500 uppercase">
              <th className="px-6 py-4">Empresa</th>
              <th className="px-6 py-4">Tipo</th>
              <th className="px-6 py-4">Vencimento</th>
              <th className="px-6 py-4">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {dados.length > 0 ? dados.map(item => (
              <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4 text-sm font-bold text-slate-800">{item.empresas?.razao_social || '—'}</td>
                <td className="px-6 py-4 text-xs uppercase text-slate-500">{item.tipo || 'Licença Sanitária'}</td>
                <td className="px-6 py-4 text-sm font-mono">
                  {item.data_vencimento ? new Date(item.data_vencimento).toLocaleDateString('pt-BR') : '—'}
                </td>
                <td className="px-6 py-4">
                  <span className={`text-[10px] font-black px-3 py-1 rounded-full border ${
                    item.status === 'ativo' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                    item.status === 'vencido' ? 'bg-red-50 text-red-700 border-red-200' :
                    'bg-yellow-50 text-yellow-700 border-yellow-200'
                  }`}>
                    {(item.status || 'ativo').toUpperCase()}
                  </span>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center text-slate-400 italic">
                  Nenhuma licença sanitária encontrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
