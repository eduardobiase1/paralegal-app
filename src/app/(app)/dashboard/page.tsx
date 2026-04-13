'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useOrg } from '@/lib/org-context'
import Link from 'next/link'

function diasParaVencer(data?: string): number | null {
  if (!data) return null
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
  const venc = new Date(data + 'T00:00:00')
  return Math.round((venc.getTime() - hoje.getTime()) / 86400000)
}

const isFGTS = (desc?: string) => !!(desc && /fgts|crf|caixa/i.test(desc))

function urgenciaClass(dias: number | null, desc?: string) {
  const limCritico = isFGTS(desc) ? 4 : 15
  if (dias === null) return { row: '', badge: 'bg-slate-100 text-slate-500', label: 'Sem data' }
  if (dias < 0)          return { row: 'bg-red-50',    badge: 'bg-red-600 text-white',          label: `Vencida há ${Math.abs(dias)}d` }
  if (dias <= limCritico) return { row: 'bg-red-50',    badge: 'bg-red-100 text-red-700',        label: `${dias}d` }
  if (dias <= 30)         return { row: 'bg-orange-50', badge: 'bg-orange-100 text-orange-700',  label: `${dias}d` }
  if (dias <= 60)         return { row: 'bg-yellow-50', badge: 'bg-yellow-100 text-yellow-700',  label: `${dias}d` }
  return                         { row: '',             badge: 'bg-emerald-100 text-emerald-700', label: `${dias}d` }
}

export default function DashboardPage() {
  const { orgId, orgName } = useOrg()
  const [supabase] = useState(createClient())
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ clientes: 0, emAndamento: 0, vencimentos: 0, cobrancas: 0, parados: 0 })
  const [alertas, setAlertas] = useState<any[]>([])
  const [processos, setProcessos] = useState<any[]>([])
  const [parados, setParados] = useState<any[]>([])

  useEffect(() => {
    async function load() {
      setLoading(true)
      const [empRes, procRes, cobRes, certRes, alvRes, licRes, cerRes] = await Promise.all([
        supabase.from('empresas').select('id', { count: 'exact', head: true }),
        supabase.from('processos_societarios')
          .select('id, status, tipo, cliente_nome, created_at, updated_at, checklist, titulo, empresas(razao_social)')
          .eq('org_id', orgId).eq('status', 'Andamento')
          .order('created_at', { ascending: false }),
        supabase.from('cobrancas').select('id', { count: 'exact', head: true }).eq('status', 'pendente'),
        supabase.from('certidoes').select('id, tipo, orgao_emissor, data_vencimento, empresas(razao_social)').order('data_vencimento'),
        supabase.from('alvaras').select('id, tipo, orgao_emissor, data_vencimento, empresas(razao_social)').order('data_vencimento'),
        supabase.from('licencas_sanitarias').select('id, orgao, atividade_sanitaria, data_vencimento, empresas(razao_social)').order('data_vencimento'),
        supabase.from('certificados_digitais').select('id, tipo, uso, titular, data_vencimento, empresas(razao_social)').order('data_vencimento'),
      ])

      const procsData = procRes.data || []

      // Processos parados: sem atualização há mais de 5 dias
      const agora = Date.now()
      const paradosList = procsData.filter((p: any) => {
        const ultima = p.updated_at || p.created_at
        if (!ultima) return false
        const diasSem = Math.floor((agora - new Date(ultima).getTime()) / 86400000)
        return diasSem >= 5
      }).map((p: any) => {
        const ultima = p.updated_at || p.created_at
        const diasSem = Math.floor((agora - new Date(ultima).getTime()) / 86400000)
        return { ...p, diasSemMovimento: diasSem }
      }).sort((a: any, b: any) => b.diasSemMovimento - a.diasSemMovimento)

      const todos = [
        ...(certRes.data || []).map((i: any) => ({ ...i, categoria: 'Certidão',    desc: [i.tipo, i.orgao_emissor].filter(Boolean).join(' — '), href: '/certidoes' })),
        ...(alvRes.data  || []).map((i: any) => ({ ...i, categoria: 'Alvará',      desc: [i.tipo, i.orgao_emissor].filter(Boolean).join(' — '), href: '/alvaras' })),
        ...(licRes.data  || []).map((i: any) => ({ ...i, categoria: 'Licença',     desc: [i.orgao, i.atividade_sanitaria].filter(Boolean).join(' — '), href: '/licencas' })),
        ...(cerRes.data  || []).map((i: any) => ({ ...i, categoria: 'Certificado', desc: [i.tipo, i.uso, i.titular].filter(Boolean).join(' · '), href: '/certificados' })),
      ].sort((a, b) => {
        const da = diasParaVencer(a.data_vencimento), db = diasParaVencer(b.data_vencimento)
        if (da === null) return 1; if (db === null) return -1; return da - db
      })

      setStats({
        clientes: empRes.count || 0,
        emAndamento: procsData.length,
        vencimentos: todos.filter(a => { const d = diasParaVencer(a.data_vencimento); return d !== null && d <= 15 }).length,
        cobrancas: cobRes.count || 0,
        parados: paradosList.length,
      })
      setProcessos(procsData.slice(0, 8))
      setAlertas(todos.slice(0, 25))
      setParados(paradosList)
      setLoading(false)
    }
    if (orgId) load()
  }, [orgId])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-slate-400 text-sm animate-pulse">Carregando painel...</div>
    </div>
  )

  const hoje = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  const KPIS = [
    {
      label: 'Carteira de Clientes', value: stats.clientes,
      color: 'text-slate-900', bg: 'bg-white', link: '/empresas',
      icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>,
    },
    {
      label: 'Processos em Andamento', value: stats.emAndamento,
      color: 'text-blue-600', bg: 'bg-white', link: '/societario',
      icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>,
    },
    {
      label: 'Vencimentos ≤ 15 dias', value: stats.vencimentos,
      color: stats.vencimentos > 0 ? 'text-orange-600' : 'text-emerald-600',
      bg: stats.vencimentos > 0 ? 'bg-orange-50' : 'bg-white', link: '/certidoes',
      icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    },
    {
      label: 'Cobranças Pendentes', value: stats.cobrancas,
      color: stats.cobrancas > 0 ? 'text-amber-600' : 'text-emerald-600',
      bg: stats.cobrancas > 0 ? 'bg-amber-50' : 'bg-white', link: '/financeiro',
      icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    },
    {
      label: 'Processos Parados', value: stats.parados,
      color: stats.parados > 0 ? 'text-red-600' : 'text-emerald-600',
      bg: stats.parados > 0 ? 'bg-red-50' : 'bg-white', link: '/societario',
      icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>,
    },
  ]

  return (
    <div className="p-4 md:p-8 bg-[#F8FAFC] min-h-screen font-sans">

      {/* Header */}
      <header className="mb-8">
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-1 capitalize">{hoje}</p>
        <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">Painel de Controle</h1>
        <p className="text-sm text-slate-500 mt-0.5"><span className="font-bold text-slate-700">{orgName}</span></p>
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        {KPIS.map(kpi => (
          <Link key={kpi.label} href={kpi.link}
            className={`${kpi.bg} p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all group`}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 leading-tight">{kpi.label}</p>
              <span className={`${kpi.color} opacity-40 group-hover:opacity-100 transition-opacity`}>{kpi.icon}</span>
            </div>
            <p className={`text-3xl font-black ${kpi.color}`}>{kpi.value}</p>
          </Link>
        ))}
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">

        {/* Processos em Andamento */}
        <section className="xl:col-span-2 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Processos em Andamento</h3>
            <Link href="/societario" className="text-[10px] font-bold text-blue-600 hover:underline">Ver todos →</Link>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex-1">
            {processos.length === 0 ? (
              <div className="p-10 text-center text-slate-400 text-sm italic">Nenhum processo ativo.</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {processos.map((proc: any) => {
                  const checklist = proc.checklist || []
                  const conc = checklist.filter((i: any) => i.status === 'Concluido').length
                  const total = checklist.length || 1
                  const porc = Math.round((conc / total) * 100)
                  return (
                    <div key={proc.id} className="p-4 hover:bg-slate-50 transition-colors">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="min-w-0">
                          <p className="font-bold text-slate-800 text-sm truncate">{proc.empresas?.razao_social || proc.cliente_nome || '—'}</p>
                          <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 uppercase mt-0.5 inline-block">
                            {(proc.tipo || '').replace(/_/g, ' ')}
                          </span>
                        </div>
                        <Link href="/societario" className="text-[10px] font-bold text-blue-600 hover:underline flex-shrink-0 mt-0.5">Abrir</Link>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex-1 h-1 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-yellow-400 rounded-full" style={{ width: `${porc}%` }} />
                        </div>
                        <span className="text-[9px] font-black text-slate-400 flex-shrink-0">{porc}%</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </section>

        {/* Alertas de Vencimento */}
        <section className="xl:col-span-3 flex flex-col gap-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Alertas de Vencimento</h3>
            <div className="flex gap-3 text-[9px] font-bold text-slate-500">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" />Crítico ≤15d</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-400 inline-block" />≤30d</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" />≤60d</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />OK</span>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[480px]">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    {['Empresa', 'Documento', 'Vencimento', 'Prazo', ''].map(h => (
                      <th key={h} className="px-4 py-3 text-[9px] font-black uppercase text-slate-400 tracking-widest">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {alertas.length === 0 ? (
                    <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-400 italic text-sm">Nenhum alerta de vencimento.</td></tr>
                  ) : alertas.map((alerta, idx) => {
                    const { row, badge, label } = urgenciaClass(diasParaVencer(alerta.data_vencimento), alerta.desc)
                    return (
                      <tr key={idx} className={`${row} hover:brightness-95 transition-all`}>
                        <td className="px-4 py-3 text-sm font-bold text-slate-800">
                          <p className="max-w-[130px] truncate">{alerta.empresas?.razao_social || '—'}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 uppercase block w-fit">{alerta.categoria}</span>
                          <p className="text-[10px] text-slate-500 mt-0.5 max-w-[150px] truncate">{alerta.desc}</p>
                        </td>
                        <td className="px-4 py-3 text-xs font-mono font-bold text-slate-700 whitespace-nowrap">
                          {alerta.data_vencimento ? new Date(alerta.data_vencimento + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-[9px] font-black px-2 py-0.5 rounded-full whitespace-nowrap ${badge}`}>{label}</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link href={alerta.href} className="text-[10px] font-bold text-blue-600 hover:underline whitespace-nowrap">Tratar →</Link>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>

      </div>

      {/* Gargalos — Processos sem movimentação */}
      {parados.length > 0 && (
        <section className="mt-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Gargalos — Processos sem movimentação</h3>
            </div>
            <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-red-100 text-red-700">{parados.length} processo{parados.length > 1 ? 's' : ''}</span>
            <div className="flex gap-3 ml-auto text-[9px] font-bold text-slate-400">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" />5–9 dias</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-400 inline-block" />10–14 dias</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" />15+ dias</span>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="divide-y divide-slate-100">
              {parados.map((proc: any) => {
                const dias = proc.diasSemMovimento
                const urgencia = dias >= 15
                  ? { bar: 'bg-red-500', badge: 'bg-red-100 text-red-700', row: 'hover:bg-red-50', label: `${dias} dias parado` }
                  : dias >= 10
                  ? { bar: 'bg-orange-400', badge: 'bg-orange-100 text-orange-700', row: 'hover:bg-orange-50', label: `${dias} dias parado` }
                  : { bar: 'bg-yellow-400', badge: 'bg-yellow-100 text-yellow-700', row: 'hover:bg-yellow-50', label: `${dias} dias parado` }
                const checklist = proc.checklist || []
                const conc = checklist.filter((i: any) => i.status === 'Concluido').length
                const total = checklist.length || 1
                const porc = Math.round((conc / total) * 100)
                const proxEtapa = checklist.find((i: any) => i.status !== 'Concluido')?.etapa
                return (
                  <div key={proc.id} className={`flex items-center gap-4 px-5 py-3.5 transition-colors ${urgencia.row}`}>
                    <div className={`w-1 h-10 rounded-full flex-shrink-0 ${urgencia.bar}`} />
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-slate-800 text-sm truncate">{proc.empresas?.razao_social || proc.cliente_nome || '—'}</p>
                      <p className="text-[10px] text-slate-400 truncate mt-0.5">{proxEtapa ? `⏳ ${proxEtapa}` : 'Sem próxima etapa'}</p>
                    </div>
                    <div className="hidden sm:block text-[9px] font-black px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 uppercase flex-shrink-0">
                      {(proc.tipo || '').replace(/_/g, ' ')}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 w-28">
                      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${urgencia.bar}`} style={{ width: `${porc}%` }} />
                      </div>
                      <span className="text-[9px] font-black text-slate-400 w-7 text-right">{porc}%</span>
                    </div>
                    <span className={`text-[9px] font-black px-2.5 py-1 rounded-full flex-shrink-0 ${urgencia.badge}`}>{urgencia.label}</span>
                    <Link href="/societario" className="text-[10px] font-bold text-blue-600 hover:underline flex-shrink-0">Tratar →</Link>
                  </div>
                )
              })}
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
