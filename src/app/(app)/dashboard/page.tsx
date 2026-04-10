'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useOrg } from '@/lib/org-context'
import Link from 'next/link'

export default function DashboardPage() {
  const { orgId, orgName } = useOrg()
  const [supabase] = useState(createClient())
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ empresas: 0, processosAndamento: 0, processosFinalizado: 0, cobrancas: 0 })
  const [alertas, setAlertas] = useState<any[]>([])
  const [processosRecentes, setProcessosRecentes] = useState<any[]>([])

  useEffect(() => {
    async function loadDashboardData() {
      setLoading(true)
      const [empRes, procRes, cobRes, certRes, alvRes] = await Promise.all([
        supabase.from('empresas').select('id', { count: 'exact', head: true }),
        supabase.from('processos_societarios').select('id, status, tipo, cliente_nome, empresas(razao_social)').eq('org_id', orgId).order('created_at', { ascending: false }).limit(10),
        supabase.from('cobrancas').select('id', { count: 'exact', head: true }).eq('status', 'pendente'),
        supabase.from('certidoes').select('*, empresas(razao_social)').order('data_vencimento').limit(5),
        supabase.from('alvaras').select('*, empresas(razao_social)').order('data_vencimento').limit(5),
      ])

      const processos = procRes.data || []
      const emAndamento = processos.filter((p: any) => p.status === 'Andamento').length
      const finalizados = processos.filter((p: any) => p.status === 'Finalizado').length

      setStats({
        empresas: empRes.count || 0,
        processosAndamento: emAndamento,
        processosFinalizado: finalizados,
        cobrancas: cobRes.count || 0,
      })

      setProcessosRecentes(processos.filter((p: any) => p.status === 'Andamento').slice(0, 5))

      const listaAlertas = [
        ...(certRes.data || []).map(i => ({ ...i, categoria: 'Certidão' })),
        ...(alvRes.data || []).map(i => ({ ...i, categoria: 'Alvará' })),
      ]
      setAlertas(listaAlertas)
      setLoading(false)
    }
    if (orgId) loadDashboardData()
  }, [supabase, orgId])

  if (loading) return <div className="p-10 text-slate-400 font-sans italic">Carregando...</div>

  return (
    <div className="p-4 md:p-8 space-y-6 md:space-y-8 bg-slate-50 min-h-screen font-sans text-left">
      <header className="flex justify-between items-end border-b border-slate-200 pb-4 md:pb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">Dashboard</h1>
          <p className="text-slate-500 font-medium text-xs uppercase tracking-[0.2em] mt-1">
            Escritório: <span className="text-blue-600 font-black">{orgName}</span>
          </p>
        </div>
      </header>

      {/* Cards de estatísticas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6">
        <div className="bg-white p-5 md:p-8 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
          <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Carteira de Clientes</p>
          <h2 className="text-3xl md:text-4xl font-black text-slate-900 mt-2">{stats.empresas}</h2>
        </div>

        {/* Card Processos com breakdown */}
        <div className="bg-white p-5 md:p-8 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow col-span-2">
          <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-3">Processos Societários</p>
          <div className="flex items-center gap-4 md:gap-6">
            <div>
              <p className="text-[9px] font-black uppercase text-blue-400 tracking-widest">Em Andamento</p>
              <h2 className="text-3xl md:text-4xl font-black text-blue-600">{stats.processosAndamento}</h2>
            </div>
            <div className="w-px h-10 bg-slate-200" />
            <div>
              <p className="text-[9px] font-black uppercase text-emerald-400 tracking-widest">Finalizados</p>
              <h2 className="text-3xl md:text-4xl font-black text-emerald-600">{stats.processosFinalizado}</h2>
            </div>
          </div>
        </div>

        <div className="bg-white p-5 md:p-8 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
          <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Cobranças Pendentes</p>
          <h2 className="text-3xl md:text-4xl font-black text-orange-500 mt-2">{stats.cobrancas}</h2>
        </div>
      </div>

      {/* Processos em andamento */}
      {processosRecentes.length > 0 && (
        <section className="space-y-4">
          <div className="flex justify-between items-center ml-1">
            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">Processos em Andamento</h3>
            <Link href="/societario" className="text-blue-600 text-xs font-bold hover:underline">Ver todos →</Link>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-x-auto">
            <table className="w-full text-left min-w-[400px]">
              <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-black uppercase text-slate-500">
                <tr>
                  <th className="px-4 md:px-6 py-4">Cliente / Empresa</th>
                  <th className="px-4 md:px-6 py-4">Tipo</th>
                  <th className="px-4 md:px-6 py-4 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {processosRecentes.map((proc: any) => (
                  <tr key={proc.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 text-sm font-bold text-slate-800">
                      {proc.empresas?.razao_social || proc.cliente_nome || '—'}
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-[10px] font-black px-2 py-1 rounded bg-blue-50 text-blue-700 border border-blue-100 uppercase">
                        {proc.tipo?.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link href="/societario" className="text-blue-600 font-bold text-xs hover:underline">
                        Abrir →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Documentos com vencimento próximo */}
      <section className="space-y-4">
        <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest ml-1">Documentos com Vencimento Próximo</h3>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-x-auto">
          <table className="w-full text-left min-w-[500px]">
            <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-black uppercase text-slate-500">
              <tr>
                <th className="px-4 md:px-6 py-4">Empresa</th>
                <th className="px-4 md:px-6 py-4">Documento</th>
                <th className="px-4 md:px-6 py-4">Vencimento</th>
                <th className="px-4 md:px-6 py-4 text-right">Ação</th>
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
