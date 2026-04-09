'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function DashboardPage() {
  const [supabase] = useState(createClient())
  const [loading, setLoading] = useState(true)
  const [userOrg, setUserOrg] = useState<string | null>(null)
  
  // Estados para os dados do Dashboard
  const [stats, setStats] = useState({ empresas: 0, processos: 0, financeiro: 0 })
  const [alertas, setAlertas] = useState<any[]>([])

  useEffect(() => {
    async function loadDashboardData() {
      setLoading(true)
      
      // 1. Identifica o usuário e sua organização (Tabela profiles)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('organizacao')
        .eq('id', user.id)
        .single()

      if (profile?.organizacao) {
        const org = profile.organizacao
        setUserOrg(org)

        // 2. Busca contadores e alertas em paralelo (TODOS FILTRADOS POR ORG)
        const [empRes, procRes, finRes, certRes, alvRes] = await Promise.all([
          supabase.from('empresas').select('id', { count: 'exact' }).eq('organizacao', org),
          supabase.from('processos_societarios').select('id', { count: 'exact' }).eq('organizacao', org),
          supabase.from('financeiro_pro').select('id', { count: 'exact' }).eq('organizacao', org).eq('status', 'Pendente'),
          // Busca certidões vencendo (exemplo de alerta)
          supabase.from('certidoes').select('*, empresas(razao_social)').eq('organizacao', org).limit(5),
          // Busca alvarás vencendo
          supabase.from('alvaras').select('*, empresas(razao_social)').eq('organizacao', org).limit(5)
        ])

        setStats({
          empresas: empRes.count || 0,
          processos: procRes.count || 0,
          financeiro: finRes.count || 0
        })

        // Unifica os alertas para exibir na tela
        const listaAlertas = [
          ...(certRes.data || []).map(i => ({ ...i, categoria: 'Certidão' })),
          ...(alvRes.data || []).map(i => ({ ...i, categoria: 'Alvará' }))
        ]
        setAlertas(listaAlertas)
      }
      setLoading(false)
    }

    loadDashboardData()
  }, [])

  if (loading) return <div className="p-10 text-slate-400 font-sans italic">Sincronizando ambiente seguro...</div>

  return (
    <div className="p-8 space-y-8 bg-slate-50 min-h-screen font-sans text-left">
      <header className="flex justify-between items-end border-b border-slate-200 pb-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Dashboard</h1>
          <p className="text-slate-500 font-medium text-xs uppercase tracking-[0.2em] mt-1">
            Escritório: <span className="text-blue-600 font-black">{userOrg}</span>
          </p>
        </div>
        <div className="text-right text-[10px] font-bold text-slate-400 uppercase tracking-widest">
          Sessão Segura Protegida por RLS
        </div>
      </header>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm transition-hover hover:shadow-md">
          <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Carteira de Clientes</p>
          <h2 className="text-4xl font-black text-slate-900 mt-2">{stats.empresas}</h2>
        </div>
        <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm transition-hover hover:shadow-md">
          <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Processos Societários</p>
          <h2 className="text-4xl font-black text-blue-600 mt-2">{stats.processos}</h2>
        </div>
        <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm transition-hover hover:shadow-md">
          <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Pendências Financeiras</p>
          <h2 className="text-4xl font-black text-orange-500 mt-2">{stats.financeiro}</h2>
        </div>
      </div>

      {/* Seção de Alertas Próximos ao Vencimento */}
      <section className="space-y-4">
        <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest ml-1">Alertas Prioritários</h3>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-black uppercase text-slate-500">
              <tr>
                <th className="px-6 py-4">Empresa</th>
                <th className="px-6 py-4">Documento</th>
                <th className="px-6 py-4">Vencimento</th>
                <th className="px-6 py-4 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {alertas.length > 0 ? alertas.map((alerta, idx) => (
                <tr key={idx} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <p className="text-sm font-bold text-slate-800">{alerta.empresas?.razao_social}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-[10px] font-black px-2 py-1 rounded bg-slate-100 text-slate-600 border border-slate-200 uppercase tracking-tighter">
                      {alerta.categoria}: {alerta.tipo}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-mono text-sm font-bold text-slate-700">
                    {new Date(alerta.data_vencimento).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link href={`/${alerta.categoria.toLowerCase()}`} className="text-blue-600 font-bold text-xs hover:underline">Tratar →</Link>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-slate-400 italic">Nenhum alerta crítico para {userOrg} no momento.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
