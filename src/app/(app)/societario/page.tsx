'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

export default function SocietarioPage() {
  const [supabase] = useState(createClient())
  const [processos, setProcessos] = useState<any[]>([])
  const [userOrg, setUserOrg] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase.from('profiles').select('organizacao').eq('id', user.id).single()
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
    // FILTRO VITAL: Só traz processos da organização do usuário
    const { data } = await supabase
      .from('processos_societarios')
      .select('*, empresas(razao_social)')
      .eq('organizacao', org)
      .order('created_at', { ascending: false })
    
    setProcessos(data || [])
    setLoading(false)
  }

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen font-sans text-left">
      <header className="flex justify-between items-center bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Processos Societários</h1>
          <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mt-1">Gestão Restrita: {userOrg}</p>
        </div>
      </header>

      <section className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm text-left">
        <table className="w-full text-left font-sans">
          <thead className="bg-slate-50 border-b">
            <tr className="text-slate-500 text-[10px] font-black uppercase tracking-widest">
              <th className="px-6 py-4 text-left">Empresa</th>
              <th className="px-6 py-4 text-left">Tipo</th>
              <th className="px-6 py-4 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {processos.map(proc => (
              <tr key={proc.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4 text-sm font-bold text-slate-800 text-left">{proc.empresas?.razao_social}</td>
                <td className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase text-left">{proc.tipo}</td>
                <td className="px-6 py-4 text-center">
                  <span className="bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-black px-2 py-1 rounded-full uppercase italic">Em Andamento</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {processos.length === 0 && !loading && <div className="p-20 text-center text-slate-400">Nenhum processo para {userOrg}.</div>}
      </section>
    </div>
  )
}