'use client'

import { useEffect, useState, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useOrg } from '@/lib/org-context'
import Link from 'next/link'
import toast from 'react-hot-toast'

type Alvara = {
  id: string
  empresa_id: string
  tipo: string
  orgao_emissor: string
  numero: string | null
  data_emissao: string | null
  data_vencimento: string | null
  observacoes: string | null
  empresas?: { razao_social: string; municipio?: string }
}

const FORM_EMPTY = {
  empresa_id: '', tipo: 'fixo', orgao_emissor: '',
  numero: '', data_emissao: '', data_vencimento: '', observacoes: '',
}

// ── Badge de urgência ──────────────────────────────────────────────────────────
function urgencia(data_venc: string | null) {
  if (!data_venc) return null
  const diff = Math.ceil((new Date(data_venc + 'T00:00:00').getTime() - Date.now()) / 86_400_000)
  if (diff < 0)   return { label: 'Vencido',      cls: 'bg-red-100 text-red-700 border-red-300',     dot: 'bg-red-500' }
  if (diff <= 30) return { label: `Vence em ${diff}d`, cls: 'bg-red-50 text-red-600 border-red-200', dot: 'bg-red-400' }
  if (diff <= 60) return { label: `${diff}d`,     cls: 'bg-orange-50 text-orange-600 border-orange-200', dot: 'bg-orange-400' }
  if (diff <= 90) return { label: `${diff}d`,     cls: 'bg-amber-50 text-amber-600 border-amber-200',   dot: 'bg-amber-400' }
  return null
}

// ── Formatação de data ─────────────────────────────────────────────────────────
function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR')
}

// ══════════════════════════════════════════════════════════════════════════════
function AlvarasPage() {
  const { orgName } = useOrg()
  const searchParams = useSearchParams()
  const empresaFiltro = searchParams.get('empresa')
  const [supabase] = useState(createClient())

  const [dados,    setDados]    = useState<Alvara[]>([])
  const [empresas, setEmpresas] = useState<any[]>([])
  const [loading,  setLoading]  = useState(true)

  // Modais
  const [modalNovo,    setModalNovo]    = useState(false)
  const [editItem,     setEditItem]     = useState<Alvara | null>(null)
  const [renovarItem,  setRenovarItem]  = useState<Alvara | null>(null)
  const [historicoItem, setHistoricoItem] = useState<Alvara | null>(null)
  const [historico,    setHistorico]    = useState<Alvara[]>([])
  const [loadingHist,  setLoadingHist]  = useState(false)

  // Forms
  const [form,       setForm]       = useState(FORM_EMPTY)
  const [renovForm,  setRenovForm]  = useState({ data_emissao: '', data_vencimento: '', numero: '', observacoes: '' })
  const [saving,     setSaving]     = useState(false)

  // Filtros
  const [busca,        setBusca]        = useState('')
  const [filtroOrgao,  setFiltroOrgao]  = useState('')
  const [filtroStatus, setFiltroStatus] = useState<'todos' | 'vencido' | 'alerta' | 'ok'>('todos')

  const load = useCallback(async () => {
    const [res, empRes] = await Promise.all([
      supabase.from('alvaras')
        .select('*, empresas(razao_social, municipio)')
        .order('data_vencimento', { ascending: true }),
      supabase.from('empresas').select('id, razao_social').order('razao_social'),
    ])
    setDados(res.data || [])
    setEmpresas(empRes.data || [])
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  // ── Criar novo ───────────────────────────────────────────────────────────────
  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const { error } = await supabase.from('alvaras').insert([{
      empresa_id: form.empresa_id, tipo: form.tipo,
      orgao_emissor: form.orgao_emissor,
      numero: form.numero || null, data_emissao: form.data_emissao || null,
      data_vencimento: form.data_vencimento || null, observacoes: form.observacoes || null,
    }])
    setSaving(false)
    if (!error) { toast.success('Alvará cadastrado!'); setModalNovo(false); setForm(FORM_EMPTY); load() }
    else toast.error('Erro: ' + error.message)
  }

  // ── Editar ───────────────────────────────────────────────────────────────────
  function openEdit(item: Alvara) {
    setForm({
      empresa_id: item.empresa_id, tipo: item.tipo,
      orgao_emissor: item.orgao_emissor, numero: item.numero || '',
      data_emissao: item.data_emissao || '', data_vencimento: item.data_vencimento || '',
      observacoes: item.observacoes || '',
    })
    setEditItem(item)
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault()
    if (!editItem) return
    setSaving(true)
    const { error } = await supabase.from('alvaras').update({
      tipo: form.tipo, orgao_emissor: form.orgao_emissor,
      numero: form.numero || null, data_emissao: form.data_emissao || null,
      data_vencimento: form.data_vencimento || null, observacoes: form.observacoes || null,
    }).eq('id', editItem.id)
    setSaving(false)
    if (!error) { toast.success('Alvará atualizado!'); setEditItem(null); setForm(FORM_EMPTY); load() }
    else toast.error('Erro: ' + error.message)
  }

  // ── Renovar ──────────────────────────────────────────────────────────────────
  function openRenovar(item: Alvara) {
    setRenovForm({
      data_emissao: new Date().toISOString().split('T')[0],
      data_vencimento: '', numero: item.numero || '', observacoes: '',
    })
    setRenovarItem(item)
  }

  async function handleRenovar(e: React.FormEvent) {
    e.preventDefault()
    if (!renovarItem) return
    setSaving(true)
    const { error } = await supabase.from('alvaras').insert([{
      empresa_id: renovarItem.empresa_id, tipo: renovarItem.tipo,
      orgao_emissor: renovarItem.orgao_emissor,
      numero: renovForm.numero || null,
      data_emissao: renovForm.data_emissao || null,
      data_vencimento: renovForm.data_vencimento || null,
      observacoes: renovForm.observacoes || null,
    }])
    setSaving(false)
    if (!error) { toast.success('Renovação registrada!'); setRenovarItem(null); load() }
    else toast.error('Erro: ' + error.message)
  }

  // ── Histórico ────────────────────────────────────────────────────────────────
  async function openHistorico(item: Alvara) {
    setHistoricoItem(item)
    setLoadingHist(true)
    const { data } = await supabase.from('alvaras')
      .select('*')
      .eq('empresa_id', item.empresa_id)
      .eq('orgao_emissor', item.orgao_emissor)
      .order('data_vencimento', { ascending: false })
    setHistorico(data || [])
    setLoadingHist(false)
  }

  // ── Excluir ──────────────────────────────────────────────────────────────────
  async function handleDelete(id: string) {
    if (!confirm('Excluir este alvará? Esta ação não pode ser desfeita.')) return
    await supabase.from('alvaras').delete().eq('id', id)
    setDados(prev => prev.filter(i => i.id !== id))
    toast.success('Alvará excluído.')
  }

  // ── Filtros derivados ─────────────────────────────────────────────────────────
  const orgaos = Array.from(new Set(dados.map(d => d.orgao_emissor).filter(Boolean))).sort()

  const dadosFiltrados = dados.filter(item => {
    if (empresaFiltro && item.empresa_id !== empresaFiltro) return false
    if (filtroOrgao && item.orgao_emissor !== filtroOrgao) return false
    if (busca) {
      const q = busca.toLowerCase()
      const nome = (item.empresas?.razao_social || '').toLowerCase()
      const mun  = (item.empresas?.municipio || '').toLowerCase()
      if (!nome.includes(q) && !mun.includes(q) && !(item.orgao_emissor || '').toLowerCase().includes(q)) return false
    }
    if (filtroStatus !== 'todos') {
      const diff = item.data_vencimento
        ? Math.ceil((new Date(item.data_vencimento + 'T00:00:00').getTime() - Date.now()) / 86_400_000)
        : null
      if (filtroStatus === 'vencido' && (diff === null || diff >= 0)) return false
      if (filtroStatus === 'alerta' && (diff === null || diff < 0 || diff > 90)) return false
      if (filtroStatus === 'ok'     && (diff === null || diff <= 90)) return false
    }
    return true
  })

  const totalVencido = dados.filter(d => { if (!d.data_vencimento) return false; return Math.ceil((new Date(d.data_vencimento + 'T00:00:00').getTime() - Date.now()) / 86_400_000) < 0 }).length
  const totalAlerta  = dados.filter(d => { if (!d.data_vencimento) return false; const diff = Math.ceil((new Date(d.data_vencimento + 'T00:00:00').getTime() - Date.now()) / 86_400_000); return diff >= 0 && diff <= 90 }).length
  const totalOk      = dados.filter(d => { if (!d.data_vencimento) return true; return Math.ceil((new Date(d.data_vencimento + 'T00:00:00').getTime() - Date.now()) / 86_400_000) > 90 }).length
  const empresaNome  = empresaFiltro ? (empresas.find(e => e.id === empresaFiltro)?.razao_social || '') : ''

  if (loading) return <div className="p-10 font-sans text-slate-400">Carregando...</div>

  return (
    <div className="bg-slate-50 min-h-screen font-sans">

      {/* ── HEADER ─────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-slate-200 px-6 py-5">
        <div className="max-w-7xl mx-auto">

          {empresaFiltro && (
            <div className="flex items-center gap-3 mb-4 bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5 w-fit">
              <Link href={`/empresas/${empresaFiltro}`} className="flex items-center gap-1.5 text-blue-600 hover:text-blue-800 text-sm font-semibold transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                Voltar para empresa
              </Link>
              <span className="text-blue-200">|</span>
              <span className="text-sm text-blue-800 font-bold">{empresaNome}</span>
            </div>
          )}

          <div className="flex flex-wrap justify-between items-start gap-4">
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-blue-600 mb-1">CONTROLES</p>
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Alvarás de Funcionamento</h1>
              <p className="text-sm text-slate-400 mt-1">{empresaNome || orgName}</p>
            </div>
            <button
              onClick={() => { setForm(f => ({ ...f, empresa_id: empresaFiltro || '' })); setModalNovo(true) }}
              className="bg-slate-900 text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-slate-700 transition-all flex-shrink-0">
              + Novo Alvará
            </button>
          </div>

          {/* Métricas */}
          {!empresaFiltro && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
              <button onClick={() => setFiltroStatus('todos')}
                className={`text-left p-4 rounded-xl border transition-all ${filtroStatus === 'todos' ? 'bg-slate-900 border-slate-900 text-white' : 'bg-white border-slate-200 hover:border-slate-300'}`}>
                <p className="text-[10px] font-black uppercase tracking-widest mb-1 text-slate-400">Total</p>
                <p className={`text-2xl font-bold ${filtroStatus === 'todos' ? 'text-white' : 'text-slate-800'}`}>{dados.length}</p>
                <p className="text-xs mt-0.5 text-slate-400">alvarás cadastrados</p>
              </button>
              <button onClick={() => setFiltroStatus(filtroStatus === 'vencido' ? 'todos' : 'vencido')}
                className={`text-left p-4 rounded-xl border transition-all ${filtroStatus === 'vencido' ? 'bg-red-600 border-red-600' : 'bg-white border-slate-200 hover:border-red-200'}`}>
                <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${filtroStatus === 'vencido' ? 'text-red-200' : 'text-slate-400'}`}>Vencidos</p>
                <p className={`text-2xl font-bold ${filtroStatus === 'vencido' ? 'text-white' : totalVencido > 0 ? 'text-red-600' : 'text-slate-800'}`}>{totalVencido}</p>
                <p className={`text-xs mt-0.5 ${filtroStatus === 'vencido' ? 'text-red-200' : 'text-slate-400'}`}>exigem ação imediata</p>
              </button>
              <button onClick={() => setFiltroStatus(filtroStatus === 'alerta' ? 'todos' : 'alerta')}
                className={`text-left p-4 rounded-xl border transition-all ${filtroStatus === 'alerta' ? 'bg-orange-500 border-orange-500' : 'bg-white border-slate-200 hover:border-orange-200'}`}>
                <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${filtroStatus === 'alerta' ? 'text-orange-100' : 'text-slate-400'}`}>Alertas (90d)</p>
                <p className={`text-2xl font-bold ${filtroStatus === 'alerta' ? 'text-white' : totalAlerta > 0 ? 'text-orange-500' : 'text-slate-800'}`}>{totalAlerta}</p>
                <p className={`text-xs mt-0.5 ${filtroStatus === 'alerta' ? 'text-orange-100' : 'text-slate-400'}`}>vencem em até 90 dias</p>
              </button>
              <button onClick={() => setFiltroStatus(filtroStatus === 'ok' ? 'todos' : 'ok')}
                className={`text-left p-4 rounded-xl border transition-all ${filtroStatus === 'ok' ? 'bg-emerald-600 border-emerald-600' : 'bg-white border-slate-200 hover:border-emerald-200'}`}>
                <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${filtroStatus === 'ok' ? 'text-emerald-100' : 'text-slate-400'}`}>Em dia</p>
                <p className={`text-2xl font-bold ${filtroStatus === 'ok' ? 'text-white' : 'text-emerald-600'}`}>{totalOk}</p>
                <p className={`text-xs mt-0.5 ${filtroStatus === 'ok' ? 'text-emerald-100' : 'text-slate-400'}`}>dentro do prazo</p>
              </button>
            </div>
          )}

          {/* Filtros */}
          <div className="flex flex-wrap gap-3 mt-5">
            <div className="relative flex-1 min-w-48">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none">🔍</span>
              <input placeholder="Buscar empresa, cidade ou órgão..."
                value={busca} onChange={e => setBusca(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-blue-300 transition-colors" />
            </div>

            <select value={filtroOrgao} onChange={e => setFiltroOrgao(e.target.value)}
              className="text-sm bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 outline-none text-slate-600 focus:border-blue-300 transition-colors">
              <option value="">Todos os órgãos</option>
              {orgaos.map(o => <option key={o} value={o}>{o}</option>)}
            </select>

            <div className="flex gap-1.5">
              {([
                { id: 'todos',   label: 'Todos',   hex: '#1E293B', glow: 'rgba(30,41,59,0.25)' },
                { id: 'vencido', label: 'Vencidos', hex: '#EF4444', glow: 'rgba(239,68,68,0.25)' },
                { id: 'alerta',  label: 'Alertas',  hex: '#F97316', glow: 'rgba(249,115,22,0.25)' },
                { id: 'ok',      label: 'Em dia',   hex: '#10B981', glow: 'rgba(16,185,129,0.25)' },
              ] as const).map(f => {
                const isActive = filtroStatus === f.id
                return (
                  <button key={f.id} onClick={() => setFiltroStatus(f.id)}
                    style={isActive ? { background: f.hex, boxShadow: `0 4px 16px ${f.glow}, 0 1px 3px rgba(0,0,0,0.1)` } : {}}
                    className={[
                      'px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap select-none outline-none',
                      'transition-all duration-200 ease-in-out',
                      isActive
                        ? 'text-white -translate-y-px'
                        : 'text-slate-500 bg-[#F3F4F6] hover:-translate-y-px hover:shadow-md',
                    ].join(' ')}>
                    {f.label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── TABELA ─────────────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[780px]">
              <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                <tr>
                  <th className="px-5 py-3.5">Empresa / Cidade</th>
                  <th className="px-5 py-3.5">Tipo</th>
                  <th className="px-5 py-3.5">Órgão Emissor</th>
                  <th className="px-5 py-3.5">Número</th>
                  <th className="px-5 py-3.5">Vencimento</th>
                  <th className="px-5 py-3.5">Situação</th>
                  <th className="px-5 py-3.5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dadosFiltrados.map(item => {
                  const urg = urgencia(item.data_vencimento)
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition-colors group"
                      style={{ borderLeft: (() => {
                        if (!item.data_vencimento) return '3px solid transparent'
                        const d = Math.ceil((new Date(item.data_vencimento + 'T00:00:00').getTime() - Date.now()) / 86_400_000)
                        if (d < 0)    return '3px solid #ef4444'
                        if (d <= 30)  return '3px solid #f97316'
                        if (d <= 90)  return '3px solid #eab308'
                        return '3px solid #10b981'
                      })() }}
                    >

                      {/* Empresa */}
                      <td className="px-5 py-3.5">
                        <p className="text-sm font-semibold text-slate-800 leading-tight">
                          {item.empresas?.razao_social || '—'}
                        </p>
                        {item.empresas?.municipio && (
                          <p className="text-xs text-slate-400 mt-0.5">{item.empresas.municipio}</p>
                        )}
                        {item.observacoes && (
                          <p className="text-xs text-slate-400 mt-0.5 italic truncate max-w-xs">{item.observacoes}</p>
                        )}
                      </td>

                      {/* Tipo */}
                      <td className="px-5 py-3.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-slate-100 px-2 py-1 rounded-md">
                          {item.tipo}
                        </span>
                      </td>

                      {/* Órgão */}
                      <td className="px-5 py-3.5 text-sm text-slate-600">{item.orgao_emissor || '—'}</td>

                      {/* Número */}
                      <td className="px-5 py-3.5 text-xs font-mono text-slate-500">{item.numero || '—'}</td>

                      {/* Vencimento */}
                      <td className="px-5 py-3.5">
                        <span className={`text-sm font-mono ${urg ? (urg.label === 'Vencido' ? 'text-red-600 font-bold' : 'text-orange-600 font-semibold') : 'text-slate-700'}`}>
                          {fmtDate(item.data_vencimento)}
                        </span>
                      </td>

                      {/* Situação badge */}
                      <td className="px-5 py-3.5">
                        {urg ? (
                          <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full border ${urg.cls}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${urg.dot}`} />
                            {urg.label}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full border bg-green-50 text-green-700 border-green-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                            Em dia
                          </span>
                        )}
                      </td>

                      {/* Ações */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">

                          {/* Histórico */}
                          <button onClick={() => openHistorico(item)} title="Ver histórico de renovações"
                            className="flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800 hover:bg-slate-100 px-2.5 py-1.5 rounded-lg transition-all">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Histórico
                          </button>

                          {/* Renovar */}
                          <button onClick={() => openRenovar(item)} title="Registrar renovação"
                            className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2.5 py-1.5 rounded-lg transition-all">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            Renovar
                          </button>

                          {/* Editar */}
                          <button onClick={() => openEdit(item)} title="Editar dados"
                            className="flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 px-2.5 py-1.5 rounded-lg transition-all">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            Editar
                          </button>

                          {/* Excluir */}
                          <button onClick={() => handleDelete(item.id)} title="Excluir"
                            className="text-slate-300 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-all">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {dadosFiltrados.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-16 text-center text-slate-400 italic text-sm">
                      Nenhum alvará encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ══ MODAL NOVO ALVARÁ ════════════════════════════════════════════ */}
      {modalNovo && (
        <Modal title="Novo Alvará de Funcionamento" onClose={() => { setModalNovo(false); setForm(FORM_EMPTY) }}>
          <form onSubmit={handleSave} className="space-y-4">
            <FormField label="Empresa *">
              <select required value={form.empresa_id} onChange={e => setForm({ ...form, empresa_id: e.target.value })}
                className={inputCls}>
                <option value="">Selecione...</option>
                {empresas.map(e => <option key={e.id} value={e.id}>{e.razao_social}</option>)}
              </select>
            </FormField>
            <AlvaraFormFields form={form} setForm={setForm} />
            <ModalFooter onCancel={() => { setModalNovo(false); setForm(FORM_EMPTY) }} saving={saving} label="Cadastrar" />
          </form>
        </Modal>
      )}

      {/* ══ MODAL EDITAR ════════════════════════════════════════════════ */}
      {editItem && (
        <Modal title={`Editar Alvará — ${editItem.empresas?.razao_social || ''}`} onClose={() => { setEditItem(null); setForm(FORM_EMPTY) }}>
          <form onSubmit={handleUpdate} className="space-y-4">
            <AlvaraFormFields form={form} setForm={setForm} />
            <ModalFooter onCancel={() => { setEditItem(null); setForm(FORM_EMPTY) }} saving={saving} label="Salvar Alterações" />
          </form>
        </Modal>
      )}

      {/* ══ MODAL RENOVAR ══════════════════════════════════════════════ */}
      {renovarItem && (
        <Modal title={`Renovar Alvará — ${renovarItem.empresas?.razao_social || ''}`} onClose={() => setRenovarItem(null)}>
          <div className="mb-5 p-3 bg-blue-50 rounded-xl border border-blue-100 text-sm text-blue-700">
            <p className="font-semibold">{renovarItem.orgao_emissor}</p>
            <p className="text-xs mt-1 text-blue-500">
              Vencimento atual: <strong>{fmtDate(renovarItem.data_vencimento)}</strong>
              {' '}· Um novo registro será criado preservando o histórico.
            </p>
          </div>
          <form onSubmit={handleRenovar} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Data de Emissão">
                <input type="date" value={renovForm.data_emissao}
                  onChange={e => setRenovForm(f => ({ ...f, data_emissao: e.target.value }))}
                  className={inputCls} />
              </FormField>
              <FormField label="Novo Vencimento *">
                <input type="date" required value={renovForm.data_vencimento}
                  onChange={e => setRenovForm(f => ({ ...f, data_vencimento: e.target.value }))}
                  className={inputCls} />
              </FormField>
            </div>
            <FormField label="Número do Alvará">
              <input value={renovForm.numero} placeholder="Novo número (se houver)"
                onChange={e => setRenovForm(f => ({ ...f, numero: e.target.value }))}
                className={inputCls} />
            </FormField>
            <FormField label="Observações">
              <input value={renovForm.observacoes} placeholder="Ex: renovado via portal, protocolo 123..."
                onChange={e => setRenovForm(f => ({ ...f, observacoes: e.target.value }))}
                className={inputCls} />
            </FormField>
            <ModalFooter onCancel={() => setRenovarItem(null)} saving={saving} label="Confirmar Renovação" />
          </form>
        </Modal>
      )}

      {/* ══ PAINEL HISTÓRICO ════════════════════════════════════════════ */}
      {historicoItem && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-slate-900/40 backdrop-blur-sm" onClick={() => setHistoricoItem(null)} />
          <div className="w-full max-w-md bg-white shadow-2xl flex flex-col">
            <div className="flex items-start justify-between px-6 py-5 border-b border-slate-100">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-blue-600 mb-1">Histórico de Renovações</p>
                <p className="text-base font-bold text-slate-900 leading-tight">{historicoItem.empresas?.razao_social}</p>
                <p className="text-xs text-slate-400 mt-1">{historicoItem.orgao_emissor}</p>
              </div>
              <button onClick={() => setHistoricoItem(null)}
                className="text-slate-300 hover:text-slate-600 transition-colors mt-1">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5">
              {loadingHist ? (
                <p className="text-sm text-slate-400 italic">Carregando...</p>
              ) : historico.length === 0 ? (
                <p className="text-sm text-slate-400 italic">Nenhum registro encontrado.</p>
              ) : (
                <div className="relative">
                  {/* Linha vertical do timeline */}
                  <div className="absolute left-3 top-2 bottom-2 w-px bg-slate-200" />
                  <div className="space-y-5">
                    {historico.map((h, i) => {
                      const urg = urgencia(h.data_vencimento)
                      const isLatest = i === 0
                      return (
                        <div key={h.id} className="flex gap-4">
                          <div className={`w-6 h-6 rounded-full border-2 flex-shrink-0 flex items-center justify-center z-10 ${isLatest ? 'bg-blue-600 border-blue-600' : 'bg-white border-slate-300'}`}>
                            {isLatest && <span className="w-2 h-2 rounded-full bg-white" />}
                          </div>
                          <div className={`flex-1 rounded-xl border p-4 ${isLatest ? 'bg-blue-50 border-blue-200' : 'bg-white border-slate-200'}`}>
                            <div className="flex justify-between items-start gap-2">
                              <div>
                                {isLatest && <span className="text-[9px] font-black uppercase tracking-wider text-blue-600 mb-1 block">Atual</span>}
                                <p className="text-sm font-semibold text-slate-800">
                                  Vence: {fmtDate(h.data_vencimento)}
                                </p>
                                {h.data_emissao && (
                                  <p className="text-xs text-slate-400 mt-0.5">Emissão: {fmtDate(h.data_emissao)}</p>
                                )}
                              </div>
                              {urg && (
                                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${urg.cls}`}>
                                  {urg.label}
                                </span>
                              )}
                            </div>
                            {h.numero && <p className="text-xs font-mono text-slate-500 mt-2">Nº {h.numero}</p>}
                            {h.observacoes && <p className="text-xs text-slate-500 mt-1 italic">{h.observacoes}</p>}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-slate-100">
              <button onClick={() => { setHistoricoItem(null); openRenovar(historicoItem) }}
                className="w-full bg-blue-600 text-white font-bold py-2.5 rounded-xl text-sm hover:bg-blue-700 transition-all">
                + Registrar Nova Renovação
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Componentes auxiliares ─────────────────────────────────────────────────────

const inputCls = 'w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm mt-1 outline-none focus:border-blue-300 transition-colors'

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{label}</label>
      {children}
    </div>
  )
}

function AlvaraFormFields({ form, setForm }: { form: typeof FORM_EMPTY; setForm: React.Dispatch<React.SetStateAction<typeof FORM_EMPTY>> }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Tipo *">
          <select required value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))} className={inputCls}>
            <option value="fixo">Fixo</option>
            <option value="temporario">Temporário</option>
            <option value="provisorio">Provisório</option>
          </select>
        </FormField>
        <FormField label="Órgão Emissor *">
          <input required value={form.orgao_emissor} placeholder="Ex: Prefeitura Municipal"
            onChange={e => setForm(f => ({ ...f, orgao_emissor: e.target.value }))} className={inputCls} />
        </FormField>
        <FormField label="Número do Alvará">
          <input value={form.numero} onChange={e => setForm(f => ({ ...f, numero: e.target.value }))} className={inputCls} />
        </FormField>
        <FormField label="Data de Emissão">
          <input type="date" value={form.data_emissao} onChange={e => setForm(f => ({ ...f, data_emissao: e.target.value }))} className={inputCls} />
        </FormField>
        <div className="col-span-2">
          <FormField label="Data de Vencimento">
            <input type="date" value={form.data_vencimento} onChange={e => setForm(f => ({ ...f, data_vencimento: e.target.value }))} className={inputCls} />
          </FormField>
        </div>
      </div>
      <FormField label="Observações">
        <input value={form.observacoes} placeholder="Anotações internas sobre este alvará..."
          onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} className={inputCls} />
      </FormField>
    </>
  )
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100">
          <h2 className="text-base font-bold text-slate-900">{title}</h2>
          <button onClick={onClose} className="text-slate-300 hover:text-slate-600 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  )
}

function ModalFooter({ onCancel, saving, label }: { onCancel: () => void; saving: boolean; label: string }) {
  return (
    <div className="flex gap-3 pt-2">
      <button type="button" onClick={onCancel} className="flex-1 bg-slate-100 text-slate-600 py-2.5 rounded-xl font-bold text-sm hover:bg-slate-200 transition-all">
        Cancelar
      </button>
      <button type="submit" disabled={saving} className="flex-1 bg-slate-900 text-white py-2.5 rounded-xl font-bold text-sm hover:bg-slate-700 transition-all disabled:opacity-50">
        {saving ? 'Salvando...' : label}
      </button>
    </div>
  )
}

export default function AlvarasPageWrapper() {
  return <Suspense><AlvarasPage /></Suspense>
}
