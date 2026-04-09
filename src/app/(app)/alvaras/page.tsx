'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

export default function AlvarasPage() {
  const [supabase] = useState(createClient())
  const [dados, setDados] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [userOrg, setUserOrg] = useState<string | null>(null)

  useEffect(() => {
    async function loadInitialData() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data: profile } = await supabase
          .from('profiles')
          .select('organizacao')
          .eq('id', user.id)
          .single()

        if (profile?.organizacao) {
          setUserOrg(profile.organizacao)
          
          const { data, error } = await supabase
            .from('alvaras')
            .select('*, empresas(razao_social)')
            .eq('organizacao', profile.organizacao)

          if (error) throw error
          setDados(data || [])
        }
      } catch (err: any) {
        console.error("Erro técnico:", err.message)
        // Se der erro de coluna, ele avisa mas não trava a tela
        if (err.message.includes("column \"organizacao\" does not exist")) {
          toast.error("Erro: A coluna 'organizacao' falta no banco. Rode o SQL.")
        }
      } finally {
        setLoading(false)
      }
    }
    loadInitialData()
  }, [supabase])

  if (loading) return <div className="p-10 font-sans text-slate-400">Verificando banco de dados...</div>

  return (
    <div className="p-8 space-y-6 bg-slate-50 min-h-screen text-left font-sans">
      <header className="flex justify-between items-center bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Alvarás de Funcionamento</h1>
          <p className="text-[10px] font-black uppercase text-blue-600 tracking-widest mt-1">
            Escritório: {userOrg || 'Aguardando Perfil'}
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
                  Nenhum alvará encontrado para {userOrg}.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}