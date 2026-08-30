'use client'

import { useEffect, useState, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useOrg } from '@/lib/org-context'
import Link from 'next/link'
import toast from 'react-hot-toast'

const EMPTY_FORM = {
  id: '',
  empresa_id: '',
  tipo: '',
  orgao_emissor: '',
  data_emissao: '',
  data_vencimento: '',
  observacoes: '',
  pendencia_status: 'nenhuma',
}

const TIPO_OPTIONS = ['Federal', 'Estadual', 'Municipal', 'Trabalhista', 'FGTS', 'Previdenciária', 'Outro']
const ORGAO_OPTIONS = ['Receita Federal', 'PGFN', 'Estado', 'Prefeitura', 'CRF (FGTS)', 'TRT', 'TST', 'Outro']

const PENDENCIA_OPTIONS = [
  { value: 'nenhuma',            label: 'Sem pendência',          badge: 'bg-emerald-100 text-emerald-700' },
  { value: 'em_renovacao',       label: 'Em renovação',           badge: 'bg-blue-100 text-blue-700' },
  { value: 'aguardando_cliente', label: 'Aguardando cliente',     badge: 'bg-yellow-100 text-yellow-700' },
  { value: 'vencida_aguardando', label: 'Vencida — aguardando',   badge: 'bg-orange-100 text-orange-700' },
  { value: 'impossivel_renovar', label: 'Impossível renovar',     badge: 'bg-red-100 text-red-700' },
]

function diasParaVencer(data?: string): number | null {
  if (!data) return null
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
  const venc = new Date(data + 'T00:00:00')
  return Math.round((venc.getTime() - hoje.getTime()) / 86400000)
}

function vencBadge(dias: number | null) {
  if (dias === null) return { cls: 'bg-slate-100 text-slate-400', label: 'Sem data' }
  if (dias < 0)   return { cls: 'bg-red-600 text-white',          label: `Vencida há ${Math.abs(dias)}d` }
  if (dias <= 15) return { cls: 'bg-red-100 text-red-700',        label: `${dias}d` }
  if (dias <= 30) return { cls: 'bg-orange-100 text-orange-700',  label: `${dias}d` }
  if (dias <= 60) return { cls: 'bg-yellow-100 text-yellow-700',  label: `${dias}d` }
  return             { cls: 'bg-emerald-100 text-emerald-700', label: `${dias}d` }
}

function CertidoesPage() {
  const { orgId, orgName } = useOrg()
  const searchParams = useSearchParams()
  const empresaFiltro = searchParams.get('empresa')
  const [supabase] = useState(createClient())
  const [data, setData] = useState<any[]>([])
  const [empresas, setEmpresas] = useState<any[]>([])
  const [modal, setModal] = useState(false)
  const [modalMode, setModalMode] = useState<'novo' | 'editar' | 'renovar'>('novo')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [filterPendencia, setFilterPendencia] = useState('todas')
  const [filterPrazo, setFilterPrazo] = useState<'todas' | 'vencidas' | 'alerta' | 'ok'>('todas')
  const [comunicandoItem, setComunicandoItem] = useState<any | null>(null)

  const [form, setForm] = useState<typeof EMPTY_FORM>({ ...EMPTY_FORM })

  const load = useCallback(async () => {
    const [res, empRes] = await Promise.all([
      supabase.from('certidoes').select('*, empresas(razao_social)').order('data_vencimento', { ascending: true }),
      supabase.from('empresas').select('id, razao_social').order('razao_social'),
    ])
    setData(res.data || [])
    setEmpresas(empRes.data || [])
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  function openNovo() {
    setForm({ ...EMPTY_FORM, empresa_id: empresaFiltro || '' })
    setModalMode('novo')
    setModal(true)
  }

  function openEditar(item: any) {
    setForm({
      id: item.id,
      empresa_id: item.empresa_id,
      tipo: item.tipo || '',
      orgao_emissor: item.orgao_emissor || '',
      data_emissao: item.data_emissao || '',
      data_vencimento: item.data_vencimento || '',
      observacoes: item.observacoes || '',
      pendencia_status: item.pendencia_status || 'nenhuma',
    })
    setModalMode('editar')
    setModal(true)
  }

  function openRenovar(item: any) {
    setForm({
      id: item.id,  // UPDATE no registro existente, não cria novo
      empresa_id: item.empresa_id,
      tipo: item.tipo || '',
      orgao_emissor: item.orgao_emissor || '',
      data_emissao: new Date().toISOString().split('T')[0],
      data_vencimento: '',
      observacoes: '',
      pendencia_status: 'nenhuma',
    })
    setModalMode('renovar')
    setModal(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)

    const payload = {
      empresa_id: form.empresa_id,
      tipo: form.tipo,
      orgao_emissor: form.orgao_emissor,
      data_emissao: form.data_emissao || null,
      data_vencimento: form.data_vencimento || null,
      observacoes: form.observacoes || null,
      pendencia_status: form.pendencia_status,
    }

    async function doSave(p: typeof payload) {
      if (form.id) {
        // Editar ou Renovar: sempre atualiza o registro existente
        return supabase.from('certidoes').update(p).eq('id', form.id)
      }
      return supabase.from('certidoes').insert([p])
    }

    let { error } = await doSave(payload)

    // Se a coluna pendencia_status ainda não existe no banco, tenta sem ela
    if (error && error.message?.includes('pendencia_status')) {
      const { pendencia_status, ...payloadSemPend } = payload
      ;({ error } = await doSave(payloadSemPend as any))
      if (!error) toast('⚠️ Salvo sem pendência — rode o SQL no Supabase para habilitar esse campo.')
    }

    if (!error) {
      const msgs = { novo: 'Certidão cadastrada!', editar: 'Certidão atualizada!', renovar: 'Renovação registrada!' }
      toast.success(msgs[modalMode])

      // Ao renovar: limpa campos de comunicado e registra no histórico
      if (modalMode === 'renovar' && form.id) {
        await supabase.from('certidoes').update({
          comunicado_em: null,
          comunicado_para: null,
          comunicado_canal: null,
        }).eq('id', form.id)

        try {
          const item = data.find(d => d.id === form.id)
          await supabase.from('historico_empresa').insert([{
            org_id: orgId,
            empresa_id: form.empresa_id,
            tipo: 'certidao_renovada',
            descricao: `Certidão ${form.tipo} (${form.orgao_emissor}) renovada — nova validade: ${form.data_vencimento ? new Date(form.data_vencimento + 'T00:00:00').toLocaleDateString('pt-BR') : 'não informada'}${item?.comunicado_para ? ` — comunicado anterior para ${item.comunicado_para} foi removido` : ''}`,
          }])
        } catch {
          // histórico não crítico
        }
      }

      setModal(false)
      setForm({ ...EMPTY_FORM })
      load()
    } else {
      toast.error(`Erro: ${error.message}`)
    }
    setSaving(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir esta certidão?')) return
    await supabase.from('certidoes').delete().eq('id', id)
    setData(prev => prev.filter(i => i.id !== id))
    toast.success('Certidão excluída.')
  }

  async function handleRegistrarComunicado(para: string, canal: string, descricaoComunicado: string) {
    if (!comunicandoItem) return
    const agora = new Date().toISOString()
    const { error } = await supabase.from('certidoes').update({
      comunicado_em: agora,
      comunicado_para: para,
      comunicado_canal: canal,
    }).eq('id', comunicandoItem.id)
    if (error) {
      if (error.message.includes('comunicado_em') || error.message.includes('comunicado_para')) {
        toast('Execute a migration_v10 no Supabase SQL Editor para habilitar o registro de comunicações.')
      } else {
        toast.error('Erro ao registrar: ' + error.message)
      }
      return
    }
    // Registra no histórico da empresa
    try {
      await supabase.from('historico_empresa').insert([{
        org_id: orgId,
        empresa_id: comunicandoItem.empresa_id,
        tipo: 'comunicado_enviado',
        descricao: descricaoComunicado,
        canal,
      }])
    } catch {
      // historico não crítico — não interrompe o fluxo
    }
    toast.success('Comunicação registrada!')
    setComunicandoItem(null)
    load()
  }

  // Métricas
  const totalVencidas = data.filter(i => { const d = diasParaVencer(i.data_vencimento); return d !== null && d < 0 }).length
  const totalAlerta   = data.filter(i => { const d = diasParaVencer(i.data_vencimento); return d !== null && d >= 0 && d <= 30 }).length
  const totalOk       = data.filter(i => { const d = diasParaVencer(i.data_vencimento); return d === null || d > 30 }).length

  // Filtro/busca
  const empresaNome = empresaFiltro ? (empresas.find(e => e.id === empresaFiltro)?.razao_social || '') : ''
  const filtered = data.filter(i => {
    const matchEmpresa = !empresaFiltro || i.empresa_id === empresaFiltro
    const matchSearch = !search ||
      (i.empresas?.razao_social || '').toLowerCase().includes(search.toLowerCase()) ||
      (i.tipo || '').toLowerCase().includes(search.toLowerCase()) ||
      (i.orgao_emissor || '').toLowerCase().includes(search.toLowerCase())
    const matchPend = filterPendencia === 'todas' || (i.pendencia_status || 'nenhuma') === filterPendencia
    const d = diasParaVencer(i.data_vencimento)
    const matchPrazo =
      filterPrazo === 'todas'   ? true :
      filterPrazo === 'vencidas'? (d !== null && d < 0) :
      filterPrazo === 'alerta'  ? (d !== null && d >= 0 && d <= 30) :
      /* ok */                    (d === null || d > 30)
    return matchEmpresa && matchSearch && matchPend && matchPrazo
  })

  const modalTitle = { novo: 'Nova Certidão Negativa', editar: 'Editar Certidão', renovar: 'Renovar Certidão' }

  return (
    <div className="p-4 md:p-8 space-y-4 bg-slate-50 min-h-screen font-sans">

      {/* Banner empresa filtrada */}
      {empresaFiltro && (
        <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-2xl px-5 py-3">
          <Link href={`/empresas/${empresaFiltro}`} className="flex items-center gap-1.5 text-blue-600 hover:text-blue-800 text-sm font-semibold transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
            Voltar para empresa
          </Link>
          <span className="text-blue-300">|</span>
          <span className="text-sm text-blue-800 font-bold truncate">{empresaNome}</span>
        </div>
      )}

      {/* Header */}
      <header className="flex flex-wrap justify-between items-center gap-3 bg-white p-4 md:p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <p className="text-[9px] font-black uppercase tracking-widest text-blue-600 mb-1">CONTROLES</p>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Certidões Negativas</h1>
          <p className="text-sm text-slate-400 mt-0.5">{empresaNome || orgName}</p>
        </div>
        <button onClick={openNovo} className="bg-slate-900 text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-slate-800 transition-all whitespace-nowrap">
          + Nova Certidão
        </button>
      </header>

      {/* Métricas */}
      {!empresaFiltro && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <button onClick={() => setFilterPrazo('todas')}
            className={`text-left p-4 rounded-xl border transition-all ${filterPrazo === 'todas' ? 'bg-slate-900 border-slate-900 text-white' : 'bg-white border-slate-200 hover:border-slate-300'}`}>
            <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${filterPrazo === 'todas' ? 'text-slate-400' : 'text-slate-400'}`}>Total</p>
            <p className={`text-2xl font-bold ${filterPrazo === 'todas' ? 'text-white' : 'text-slate-800'}`}>{data.length}</p>
            <p className={`text-xs mt-0.5 ${filterPrazo === 'todas' ? 'text-slate-400' : 'text-slate-400'}`}>certidões cadastradas</p>
          </button>
          <button onClick={() => setFilterPrazo(filterPrazo === 'vencidas' ? 'todas' : 'vencidas')}
            className={`text-left p-4 rounded-xl border transition-all ${filterPrazo === 'vencidas' ? 'bg-red-600 border-red-600 text-white' : 'bg-white border-slate-200 hover:border-red-200'}`}>
            <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${filterPrazo === 'vencidas' ? 'text-red-200' : 'text-slate-400'}`}>Vencidas</p>
            <p className={`text-2xl font-bold ${filterPrazo === 'vencidas' ? 'text-white' : totalVencidas > 0 ? 'text-red-600' : 'text-slate-800'}`}>{totalVencidas}</p>
            <p className={`text-xs mt-0.5 ${filterPrazo === 'vencidas' ? 'text-red-200' : 'text-slate-400'}`}>exigem ação imediata</p>
          </button>
          <button onClick={() => setFilterPrazo(filterPrazo === 'alerta' ? 'todas' : 'alerta')}
            className={`text-left p-4 rounded-xl border transition-all ${filterPrazo === 'alerta' ? 'bg-orange-500 border-orange-500 text-white' : 'bg-white border-slate-200 hover:border-orange-200'}`}>
            <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${filterPrazo === 'alerta' ? 'text-orange-100' : 'text-slate-400'}`}>Vencendo em 30d</p>
            <p className={`text-2xl font-bold ${filterPrazo === 'alerta' ? 'text-white' : totalAlerta > 0 ? 'text-orange-500' : 'text-slate-800'}`}>{totalAlerta}</p>
            <p className={`text-xs mt-0.5 ${filterPrazo === 'alerta' ? 'text-orange-100' : 'text-slate-400'}`}>requerem atenção</p>
          </button>
          <button onClick={() => setFilterPrazo(filterPrazo === 'ok' ? 'todas' : 'ok')}
            className={`text-left p-4 rounded-xl border transition-all ${filterPrazo === 'ok' ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white border-slate-200 hover:border-emerald-200'}`}>
            <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${filterPrazo === 'ok' ? 'text-emerald-100' : 'text-slate-400'}`}>Regulares</p>
            <p className={`text-2xl font-bold ${filterPrazo === 'ok' ? 'text-white' : 'text-emerald-600'}`}>{totalOk}</p>
            <p className={`text-xs mt-0.5 ${filterPrazo === 'ok' ? 'text-emerald-100' : 'text-slate-400'}`}>dentro do prazo</p>
          </button>
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none">🔍</span>
          <input
            placeholder="Buscar por empresa, tipo ou órgão..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 pl-9 text-sm outline-none focus:border-slate-400 transition-all"
          />
        </div>
        <select
          value={filterPendencia}
          onChange={e => setFilterPendencia(e.target.value)}
          className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-slate-400"
        >
          <option value="todas">Todas as pendências</option>
          {PENDENCIA_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[700px]">
            <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-black uppercase text-slate-500 tracking-widest">
              <tr>
                <th className="px-5 py-4">Empresa</th>
                <th className="px-5 py-4">Tipo</th>
                <th className="px-5 py-4">Órgão Emissor</th>
                <th className="px-5 py-4">Emissão</th>
                <th className="px-5 py-4">Vencimento</th>
                <th className="px-5 py-4">Prazo</th>
                <th className="px-5 py-4">Pendência</th>
                <th className="px-5 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(i => {
                const dias = diasParaVencer(i.data_vencimento)
                const { cls: vCls, label: vLabel } = vencBadge(dias)
                const pend = PENDENCIA_OPTIONS.find(p => p.value === (i.pendencia_status || 'nenhuma')) || PENDENCIA_OPTIONS[0]
                return (
                  <tr key={i.id}
                    className={`hover:bg-slate-50 transition-colors ${dias !== null && dias < 0 ? 'bg-red-50/40' : dias !== null && dias <= 15 ? 'bg-orange-50/40' : ''}`}
                    style={{ borderLeft: dias !== null && dias < 0 ? '3px solid #ef4444' : dias !== null && dias <= 30 ? '3px solid #f97316' : dias !== null && dias <= 60 ? '3px solid #eab308' : '3px solid transparent' }}
                  >
                    <td className="px-5 py-3.5 text-sm font-bold text-slate-800 max-w-[180px] truncate">{i.empresas?.razao_social}</td>
                    <td className="px-5 py-3.5 text-xs font-bold uppercase text-slate-600">{i.tipo}</td>
                    <td className="px-5 py-3.5 text-xs text-slate-500">{i.orgao_emissor}</td>
                    <td className="px-5 py-3.5">
                      <span className="text-xs font-mono text-slate-600 block">
                        {i.data_emissao ? new Date(i.data_emissao + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}
                      </span>
                      {i.data_emissao && (() => {
                        const d = new Date(); d.setHours(0,0,0,0)
                        const e = new Date(i.data_emissao + 'T00:00:00')
                        const diff = Math.round((d.getTime() - e.getTime()) / 86400000)
                        return <span className="text-[10px] text-slate-400">{diff === 0 ? 'hoje' : `há ${diff}d`}</span>
                      })()}
                    </td>
                    <td className="px-5 py-3.5 text-xs font-mono font-bold text-slate-700">
                      {i.data_vencimento ? new Date(i.data_vencimento + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${vCls}`}>{vLabel}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      {pend.value !== 'nenhuma' && (
                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${pend.badge}`}>{pend.label}</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5 flex-wrap">
                        {/* Comunicar — só para impossível renovar */}
                        {(i.pendencia_status || 'nenhuma') === 'impossivel_renovar' && !i.comunicado_em && (
                          <button onClick={() => setComunicandoItem(i)} title="Gerar comunicado"
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-violet-50 hover:bg-violet-100 text-violet-700 text-[10px] font-black uppercase transition-all">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                            </svg>
                            Comunicar
                          </button>
                        )}
                        {(i.pendencia_status || 'nenhuma') === 'impossivel_renovar' && i.comunicado_em && (
                          <button onClick={() => setComunicandoItem(i)} title={`Comunicado para ${i.comunicado_para || '?'} em ${new Date(i.comunicado_em).toLocaleDateString('pt-BR')}`}
                            className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-[9px] font-black transition-all hover:bg-green-200">
                            ✓ Comunicado
                          </button>
                        )}
                        {/* Renovar */}
                        <button
                          onClick={() => openRenovar(i)}
                          title="Renovar certidão"
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-[10px] font-black uppercase transition-all"
                        >
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          Renovar
                        </button>
                        {/* Editar */}
                        <button
                          onClick={() => openEditar(i)}
                          title="Editar certidão"
                          className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-yellow-100 text-slate-500 hover:text-yellow-700 flex items-center justify-center text-sm transition-all"
                        >✎</button>
                        {/* Excluir */}
                        <button
                          onClick={() => handleDelete(i.id)}
                          title="Excluir"
                          className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-red-100 text-slate-400 hover:text-red-600 flex items-center justify-center text-xs transition-all"
                        >✕</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && !loading && (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-400 italic text-sm">
                    {data.length === 0 ? 'Nenhuma certidão cadastrada.' : 'Nenhum resultado para os filtros aplicados.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Comunicado */}
      {comunicandoItem && (
        <ComunicadoModal
          item={comunicandoItem}
          orgName={orgName}
          onClose={() => setComunicandoItem(null)}
          onRegistrar={handleRegistrarComunicado}
        />
      )}

      {/* Modal Novo / Editar / Renovar */}
      {modal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-lg rounded-3xl p-6 md:p-8 border border-slate-200 shadow-2xl max-h-[90vh] overflow-y-auto">

            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-bold text-slate-900">{modalTitle[modalMode]}</h2>
                {modalMode === 'renovar' && (
                  <p className="text-xs text-blue-600 mt-0.5">Nova emissão será registrada — histórico anterior é mantido.</p>
                )}
              </div>
              <button onClick={() => setModal(false)} className="text-slate-400 hover:text-slate-700 font-black text-lg leading-none">✕</button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">

              {/* Empresa */}
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wide block mb-1">Empresa *</label>
                <select required value={form.empresa_id} onChange={e => setForm({ ...form, empresa_id: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm outline-none focus:border-slate-400">
                  <option value="">Selecione...</option>
                  {empresas.map(e => <option key={e.id} value={e.id}>{e.razao_social}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Tipo */}
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wide block mb-1">Tipo *</label>
                  <select required value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm outline-none focus:border-slate-400">
                    <option value="">Selecione...</option>
                    {TIPO_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>

                {/* Órgão Emissor */}
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wide block mb-1">Órgão Emissor *</label>
                  <select required value={form.orgao_emissor} onChange={e => setForm({ ...form, orgao_emissor: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm outline-none focus:border-slate-400">
                    <option value="">Selecione...</option>
                    {ORGAO_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>

                {/* Data Emissão */}
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wide block mb-1">Data de Emissão</label>
                  <input type="date" value={form.data_emissao} onChange={e => setForm({ ...form, data_emissao: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm outline-none focus:border-slate-400" />
                </div>

                {/* Data Vencimento */}
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wide block mb-1">Data de Vencimento</label>
                  <input type="date" value={form.data_vencimento} onChange={e => setForm({ ...form, data_vencimento: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm outline-none focus:border-slate-400" />
                </div>
              </div>

              {/* Pendência */}
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wide block mb-1">Status de Pendência</label>
                <select value={form.pendencia_status} onChange={e => setForm({ ...form, pendencia_status: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm outline-none focus:border-slate-400">
                  {PENDENCIA_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>

              {/* Observações */}
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wide block mb-1">Observações / Motivo da Pendência</label>
                <textarea rows={2} value={form.observacoes} onChange={e => setForm({ ...form, observacoes: e.target.value })}
                  placeholder="Descreva motivo da pendência, protocolo, etc."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm outline-none focus:border-slate-400 resize-none" />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setModal(false)}
                  className="flex-1 bg-slate-100 text-slate-600 py-3 rounded-xl font-bold text-sm hover:bg-slate-200 transition-all">
                  Cancelar
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 bg-slate-900 text-white py-3 rounded-xl font-bold text-sm hover:bg-slate-700 transition-all disabled:opacity-50">
                  {saving ? 'Salvando...' : modalMode === 'renovar' ? '🔄 Confirmar Renovação' : '✓ Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default function CertidoesPageWrapper() {
  return <Suspense><CertidoesPage /></Suspense>
}

// ── Helpers do ComunicadoModal ────────────────────────────────────────────────
function saudacao() {
  const h = new Date().getHours()
  if (h >= 6 && h < 12) return 'Bom dia'
  if (h >= 12 && h < 18) return 'Boa tarde'
  return 'Boa noite'
}

function detectEsfera(tipo: string, orgao: string): string {
  const t = (tipo || '').toLowerCase()
  const o = (orgao || '').toLowerCase()
  if (t === 'fgts' || o.includes('fgts') || o.includes('crf') || o.includes('caixa econômica')) return 'do FGTS'
  if (t === 'federal' || o.includes('receita federal') || o.includes('pgfn')) return 'Federal'
  if (t === 'estadual' || o.includes('sefaz') || o.includes('estado')) return 'Estadual'
  if (t === 'municipal' || o.includes('prefeitura') || o.includes('municipal') || o.includes('iss')) return 'Municipal'
  if (t === 'trabalhista' || o.includes('trt') || o.includes('tst') || o.includes('trabalhista')) return 'Trabalhista'
  if (t === 'previdenciária' || o.includes('previdenciária') || o.includes('inss')) return 'Previdenciária'
  return 'de Débitos'
}

const DPTOS = [
  { value: 'fiscal',   label: 'Departamento Fiscal' },
  { value: 'contabil', label: 'Departamento Contábil' },
  { value: 'dp',       label: 'Departamento Pessoal' },
]
const DP_TIMES = ['DP1', 'DP2', 'DP3', 'DP4', 'DP5']

// ── Modal de Comunicado ───────────────────────────────────────────────────────
function ComunicadoModal({ item, orgName, onClose, onRegistrar }: {
  item: any; orgName: string; onClose: () => void
  onRegistrar: (para: string, canal: string, descricao: string) => Promise<void>
}) {
  const [tab, setTab] = useState<'cliente' | 'interno'>('cliente')
  const [dpto, setDpto] = useState('fiscal')
  const [dpTime, setDpTime] = useState('DP1')
  const [para, setPara] = useState(item.comunicado_para || '')
  const [canal, setCanal] = useState(item.comunicado_canal || 'whatsapp')
  const [registrando, setRegistrando] = useState(false)
  const [copiado, setCopiado] = useState(false)

  const empresa   = item.empresas?.razao_social || ''
  const empresaMaius = empresa.toUpperCase()

  const dataVenc  = item.data_vencimento ? new Date(item.data_vencimento + 'T00:00:00').toLocaleDateString('pt-BR') : '—'
  const esfera    = detectEsfera(item.tipo || '', item.orgao_emissor || '')
  const sauda     = saudacao()
  const obsLine   = item.observacoes ? `\n\nMotivo informado: ${item.observacoes}` : ''

  const dptoLabel = dpto === 'dp'
    ? `Departamento Pessoal — ${dpTime}`
    : DPTOS.find(d => d.value === dpto)?.label || ''

  const textoCliente = `Prezado(a) cliente, ${sauda}! Tudo bem?

Segue em anexo o relatório de Pendências em aberto da empresa ${empresaMaius} que está impossibilitando de renovar a certidão negativa de débitos ${esfera}.${obsLine}

Para regularização, será necessário verificar e quitar as pendências junto ao(à) ${item.orgao_emissor} para que possamos solicitar a emissão de nova certidão.

Ficamos à disposição para orientações.`

  const textoInterno = `${sauda}! Tudo bem?

Segue abaixo o relatório de Pendências em aberto da empresa ${empresaMaius} que está impossibilitando de renovar a certidão negativa de débitos ${esfera}.

Solicitamos verificação e providências junto ao cliente para regularização.`

  const texto = tab === 'cliente' ? textoCliente : textoInterno

  // Descrição para o histórico
  const descricaoHistorico = tab === 'cliente'
    ? `Comunicado enviado ao cliente sobre certidão ${item.tipo} (${item.orgao_emissor}) — ${esfera} — vencimento ${dataVenc}`
    : `Comunicado enviado ao ${dptoLabel} sobre certidão ${item.tipo} (${item.orgao_emissor}) — ${esfera} — vencimento ${dataVenc}`

  async function copiar() {
    await navigator.clipboard.writeText(texto)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  async function registrar() {
    if (!para.trim()) { alert('Informe para quem foi comunicado.'); return }
    setRegistrando(true)
    await onRegistrar(para.trim(), canal, descricaoHistorico)
    setRegistrando(false)
  }

  const jaComunicado = !!item.comunicado_em

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white w-full max-w-xl rounded-3xl border border-slate-200 shadow-2xl max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between p-6 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[9px] font-black uppercase tracking-widest text-violet-600 bg-violet-50 border border-violet-200 px-2 py-0.5 rounded">Comunicado</span>
              <span className="text-[9px] font-black uppercase tracking-widest text-blue-600 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">{esfera}</span>
              {jaComunicado && <span className="text-[9px] font-black uppercase tracking-widest text-green-600 bg-green-50 border border-green-200 px-2 py-0.5 rounded">✓ Já registrado</span>}
            </div>
            <h2 className="text-lg font-bold text-slate-900">{empresa}</h2>
            <p className="text-xs text-slate-500 mt-0.5">{item.tipo} · {item.orgao_emissor} · vence {dataVenc}</p>
            {jaComunicado && (
              <p className="text-xs text-green-600 mt-1">
                Comunicado para <strong>{item.comunicado_para}</strong> via {item.comunicado_canal} em {new Date(item.comunicado_em).toLocaleDateString('pt-BR')}
              </p>
            )}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 font-black text-lg leading-none flex-shrink-0 ml-4">✕</button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1.5 p-4 pb-0">
          {([
            { id: 'cliente', label: 'Para o cliente', hex: '#3B82F6', glow: 'rgba(59,130,246,0.25)' },
            { id: 'interno', label: 'Para departamento interno', hex: '#8B5CF6', glow: 'rgba(139,92,246,0.25)' },
          ] as const).map(t => {
            const isActive = tab === t.id
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                style={isActive ? { background: t.hex, boxShadow: `0 4px 16px ${t.glow}, 0 1px 3px rgba(0,0,0,0.1)` } : {}}
                className={[
                  'px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap select-none outline-none',
                  'transition-all duration-200 ease-in-out',
                  isActive
                    ? 'text-white -translate-y-px'
                    : 'text-slate-500 bg-[#F3F4F6] hover:-translate-y-px hover:shadow-md',
                ].join(' ')}>
                {t.label}
              </button>
            )
          })}
        </div>

        {/* Seletor de departamento (só aba interna) */}
        {tab === 'interno' && (
          <div className="px-4 pt-3 flex flex-wrap gap-1.5 items-center">
            {DPTOS.map(d => {
              const isActive = dpto === d.value
              return (
              <button key={d.value} onClick={() => setDpto(d.value)}
                style={isActive ? { background: '#1E293B', boxShadow: '0 4px 16px rgba(30,41,59,0.25), 0 1px 3px rgba(0,0,0,0.1)' } : {}}
                className={[
                  'px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap select-none outline-none',
                  'transition-all duration-200 ease-in-out',
                  isActive
                    ? 'text-white -translate-y-px'
                    : 'text-slate-500 bg-[#F3F4F6] hover:-translate-y-px hover:shadow-md',
                ].join(' ')}>
                {d.label}
              </button>
              )
            })}
            {dpto === 'dp' && (
              <select value={dpTime} onChange={e => setDpTime(e.target.value)}
                className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-1.5 text-xs font-bold text-blue-700 outline-none">
                {DP_TIMES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            )}
          </div>
        )}

        {/* Texto gerado */}
        <div className="p-4">
          <div className="relative">
            <pre className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-700 whitespace-pre-wrap font-sans leading-relaxed max-h-64 overflow-y-auto">{texto}</pre>
            <button onClick={copiar}
              className={`absolute top-2 right-2 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${copiado ? 'bg-green-500 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
              {copiado ? '✓ Copiado!' : 'Copiar'}
            </button>
          </div>
          <p className="text-[10px] text-slate-400 mt-2 text-center">
            * = negrito no WhatsApp · saudação automática conforme horário · esfera detectada automaticamente
          </p>
        </div>

        {/* Registro */}
        <div className="px-4 pb-6 border-t border-slate-100 pt-4">
          <p className="text-xs font-black text-slate-500 uppercase tracking-wide mb-3">Registrar comunicação</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wide block mb-1">
                {tab === 'interno' ? `${dptoLabel} *` : 'Para quem (cliente) *'}
              </label>
              <input value={para} onChange={e => setPara(e.target.value)}
                placeholder={tab === 'interno' ? `Nome do responsável no ${dpto === 'dp' ? dpTime : dptoLabel}` : 'Nome ou e-mail do cliente'}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-sm outline-none focus:border-slate-400" />
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wide block mb-1">Canal</label>
              <select value={canal} onChange={e => setCanal(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-sm outline-none focus:border-slate-400">
                <option value="whatsapp">WhatsApp</option>
                <option value="email">E-mail</option>
                <option value="telefone">Telefone</option>
                <option value="outro">Outro</option>
              </select>
            </div>
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={onClose}
              className="flex-1 bg-slate-100 text-slate-600 py-2.5 rounded-xl font-bold text-sm hover:bg-slate-200 transition-all">
              {jaComunicado ? 'Fechar' : 'Cancelar'}
            </button>
            <button type="button" onClick={registrar} disabled={registrando}
              className="flex-1 bg-violet-600 text-white py-2.5 rounded-xl font-bold text-sm hover:bg-violet-700 transition-all disabled:opacity-50">
              {registrando ? 'Registrando...' : jaComunicado ? '↻ Atualizar registro' : '✓ Registrar comunicação'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
