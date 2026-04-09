'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useOrg } from '@/lib/org-context'
import Link from 'next/link'

export default function DashboardPage() {
  const { orgName } = useOrg()
  const [supabase] = useState(createClient())
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ empresas: 0, processos: 0, cobrancas: 0 })
  const [alertas, setAlertas] = useState<any[]>([])

  useEffect(() => {
    async function loadDashboardData() {
      setLoading(true)
      // RLS handles org isolation automatically
      const [empRes, procRes, cobRes, certRes, alvRes] = await Promise.all([
        supabase.from('empresas').select('id', { count: 'exact', head: true }),
        supabase.from('processos_societarios').select('id', { count: 'exact', head: true }),
        supabase.from('cobrancas').select('id', { count: 'exact', head: true }).eq('status', 'pendente'),
        supabase.from('certidoes').select('*, empresas(razao_social)').order('data_vencimento').limit(5),
        supabase.from('alvaras').select('*, empresas(razao_social)').order('data_vencimento').limit(5),
      ])

      setStats({
        empresas: empRes.count || 0,
        processos: procRes.count || 0,
        cobrancas: cobRes.count || 0,
      })

      const listaAlertas = [
        ...(certRes.data || []).map(i => ({ ...i, categoria: 'Certidão' })),
        ...(alvRes.data || []).map(i => ({ ...i, categoria: 'Alvará' })),
      ]
      setAlertas(listaAlertas)
      setLoading(false)
    }
    loadDashboardData()
  }, [supabase])

  if (loading) return <div className="p-10 text-slate-400 font-sans italic">Carregando...</div>

  return (
    <div className="p-8 space-y-8 bg-slate-50 min-h-screen font-sans text-left">
      <header className="flex justify-between items-end border-b border-slate-200 pb-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Dashboard</h1>
          <p className="text-slate-500 font-medium text-xs uppercase tracking-[0.2em] mt-1">
            Escritório: <span className="text-blue-600 font-black">{orgName}</span>
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
          <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Carteira de Clientes</p>
          <h2 className="text-4xl font-black text-slate-900 mt-2">{stats.empresas}</h2>
        </div>
        <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
          <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Processos Societários</p>
          <h2 className="text-4xl font-black text-blue-600 mt-2">{stats.processos}</h2>
        </div>
        <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
          <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Cobranças Pendentes</p>
          <h2 className="text-4xl font-black text-orange-500 mt-2">{stats.cobrancas}</h2>
        </div>
      </div>

      <section className="space-y-4">
        <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest ml-1">Documentos com Vencimento Próximo</h3>
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
                  <td className="px-6 py-4 text-sm font-bold text-slate-800">{alerta.empresas?.razao_social}</td>
                  <td className="px-6 py-4">
                    <span className="text-[10px] font-black px-2 py-1 rounded bg-slate-100 text-slate-600 border border-slate-200 uppercase">
                      {alerta.categoria}: {alerta.tipo}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-mono text-sm font-bold text-slate-700">
                    {alerta.data_vencimento ? new Date(alerta.data_vencimento + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link href={`/${alerta.categoria === 'Certidão' ? 'certidoes' : 'alvaras'}`} className="text-blue-600 font-bold text-xs hover:underline">
                      Tratar →
                    </Link>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-slate-400 italic">Nenhum alerta no momento.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
