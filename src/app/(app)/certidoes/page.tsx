'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useOrg } from '@/lib/org-context'

export default function CertidoesPage() {
  const { orgName } = useOrg()
  const [supabase] = useState(createClient())
  const [data, setData] = useState<any[]>([])

  useEffect(() => {
    async function init() {
      // RLS isolates data by org automatically — no manual filter needed
      const { data: res } = await supabase
        .from('certidoes')
        .select('*, empresas(razao_social)')
        .order('data_vencimento', { ascending: true })
      setData(res || [])
    }
    init()
  }, [supabase])

  return (
    <div className="p-6 text-left font-sans">
      <h1 className="text-2xl font-bold">Certidões Negativas</h1>
      <p className="text-[10px] font-black uppercase text-blue-600 mb-6 tracking-widest italic">{orgName}</p>
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b text-[10px] font-black uppercase text-slate-500">
            <tr><th className="px-6 py-4">Empresa</th><th className="px-6 py-4">Órgão</th><th className="px-6 py-4">Vencimento</th></tr>
          </thead>
          <tbody>
            {data.map(i => (
              <tr key={i.id} className="border-b last:border-0">
                <td className="px-6 py-4 text-sm font-bold">{i.empresas?.razao_social}</td>
                <td className="px-6 py-4 text-xs uppercase">{i.tipo}</td>
                <td className="px-6 py-4 text-sm font-mono">{new Date(i.data_vencimento).toLocaleDateString('pt-BR')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}