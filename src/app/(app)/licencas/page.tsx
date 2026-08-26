'use client'

import { useEffect, useState, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useOrg } from '@/lib/org-context'
import Link from 'next/link'
import toast from 'react-hot-toast'

const FORM_EMPTY = {
  empresa_id: '',
  orgao: 'VISA_MUNICIPAL',
  numero_licenca: '',
  atividade_sanitaria: '',
  data_emissao: '',
  data_vencimento: '',
  observacoes: '',
}

function diasParaVencer(data?: string): number | null {
  if (!data) return null
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
  return Math.round((new Date(data + 'T00:00:00').getTime() - hoje.getTime()) / 86400000)
}

function urgBorder(dias: number | null): string {
  if (dias === null) return '3px solid transparent'
  if (dias < 0)    return '3px solid #ef4444'
  if (dias <= 30)  return '3px solid #f97316'
  if (dias <= 60)  return '3px solid #eab308'
  return '3px solid #10b981'
}

function PrazoBadge({ dias }: { dias: number | null }) {
  if (dias === null) return <span className="text-xs text-slate-400">—</span>
  if (dias < 0) return <span className="inline-flex items-center text-[10px] font-black px-2 py-0.5 rounded-full bg-red-100 text-red-700">Vencida há {Math.abs(dias)}d</span>
  if (dias <= 30) return <span className="inline-flex items-center text-[10px] font-black px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">{dias}d</span>
  if (dias <= 60) return <span className="inline-flex items-center text-[10px] font-black px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">{dias}d</span>
  return <span className="inline-flex items-center text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">{dias}d</span>
}

function LicencasPage() {
  const { orgName } = useOrg()
  const searchParams = useSearchParams()
  const empresaFiltro = searchParams.get('empresa')
  const [supabase] = useState(createClient())
  const [dados, setDados] = useState<any[]>([])
  const [empresas, setEmpresas] = useState<any[]>([])
  const [modal, setModal] = useState(false)
  const [editItem, setEditItem] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [filterPrazo, setFilterPrazo] = useState<'todas' | 'vencidas' | 'alerta' | 'ok'>('todas')
  const [search, setSearch] = useState('')
  const [form, setForm] = useState(FORM_EMPTY)

  const load = useCallback(async () => {
    const [res, empRes] = await Promise.all([
      supabase.from('licencas_sanitarias').select('*, empresas(razao_social)').order('data_vencimento', { ascending: true }),
      supabase.from('empresas').select('id, razao_social').order('razao_social'),
    ])
    setDados(res.data || [])
    setEmpresas(empRes.data || [])
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const payload = {
      empresa_id: form.empresa_id,
      orgao: form.orgao,
      numero_licenca: form.numero_licenca || null,
      atividade_sanitaria: form.atividade_sanitaria || null,
      data_emissao: form.data_emissao || null,
      data_vencimento: form.data_vencimento || null,
      observacoes: form.observacoes || null,
    }
    const { error } = editItem
      ? await supabase.from('licencas_sanitarias').update(payload).eq('id', editItem.id)
      : await supabase.from('licencas_sanitarias').insert([payload])
    setSaving(false)
    if (!error) {
      toast.success(editItem ? 'Licença atualizada!' : 'Licença cadastrada!')
      setModal(false)
      setEditItem(null)
      setForm(FORM_EMPTY)
      load()
    } else {
      toast.error(`Erro: ${error.message}`)
    }
  }

  function openEdit(item: any) {
    setForm({
      empresa_id: item.empresa_id,
      orgao: item.orgao || 'VISA_MUNICIPAL',
      numero_licenca: item.numero_licenca || '',
      atividade_sanitaria: item.atividade_sanitaria || '',
      data_emissao: item.data_emissao || '',
      data_vencimento: item.data_vencimento || '',
      observacoes: item.observacoes || '',
    })
    setEditItem(item)
    setModal(true)
  }

  function openNovo() {
    setForm({ ...FORM_EMPTY, empresa_id: empresaFiltro || '' })
    setEditItem(null)
    setModal(true)
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir esta licença?')) return
    await supabase.from('licencas_sanitarias').delete().eq('id', id)
    setDados(prev => prev.filter(i => i.id !== id))
    toast.success('Licença excluída.')
  }

  const empresaNome = empresaFiltro ? (empresas.find(e => e.id === empresaFiltro)?.razao_social || '') : ''
  const dadosBase = empresaFiltro ? dados.filter(i => i.empresa_id === empresaFiltro) : dados

  // Métricas
  const totalVencidas = dadosBase.filter(i => { const d = diasParaVencer(i.data_vencimento); return d !== null && d < 0 }).length
  const totalAlerta   = dadosBase.filter(i => { const d = diasParaVencer(i.data_vencimento); return d !== null && d >= 0 && d <= 30 }).length
  const totalOk       = dadosBase.filter(i => { const d = diasParaVencer(i.data_vencimento); return d === null || d > 30 }).length

  const dadosFiltrados = dadosBase.filter(i => {
    if (search) {
      const q = search.toLowerCase()
      if (!(i.empresas?.razao_social || '').toLowerCase().includes(q) &&
          !(i.orgao || '').toLowerCase().includes(q) &&
          !(i.atividade_sanitaria || '').toLowerCase().includes(q)) return false
    }
    const d = diasParaVencer(i.data_vencimento)
    if (filterPrazo === 'vencidas') return d !== null && d < 0
    if (filterPrazo === 'alerta')   return d !== null && d >= 0 && d <= 30
    if (filterPrazo === 'ok')       return d === null || d > 30
    return true
  })

  if (loading) return <div className="p-10 font-sans text-slate-400">Carregando...</div>

  return (
    <div className="p-4 md:p-8 space-y-4 bg-slate-50 min-h-screen font-sans">

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
          <h1 className="text-xl md:text-2xl font-bold text-slate-900">Licenças Sanitárias</h1>
          <p className="text-[10px] font-black uppercase text-blue-600 tracking-widest mt-1">{empresaNome || orgName}</p>
        </div>
        <button onClick={openNovo}
          className="bg-slate-900 text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-slate-800 transition-all whitespace-nowrap">
          + Nova Licença
        </button>
      </header>

      {/* Métricas */}
      {!empresaFiltro && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <button onClick={() => setFilterPrazo('todas')}
            className={`text-left p-4 rounded-xl border transition-all ${filterPrazo === 'todas' ? 'bg-slate-900 border-slate-900' : 'bg-white border-slate-200 hover:border-slate-300'}`}>
            <p className="text-[10px] font-black uppercase tracking-widest mb-1 text-slate-400">Total</p>
            <p className={`text-2xl font-bold ${filterPrazo === 'todas' ? 'text-white' : 'text-slate-800'}`}>{dadosBase.length}</p>
            <p className="text-xs mt-0.5 text-slate-400">licenças cadastradas</p>
          </button>
          <button onClick={() => setFilterPrazo(filterPrazo === 'vencidas' ? 'todas' : 'vencidas')}
            className={`text-left p-4 rounded-xl border transition-all ${filterPrazo === 'vencidas' ? 'bg-red-600 border-red-600' : 'bg-white border-slate-200 hover:border-red-200'}`}>
            <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${filterPrazo === 'vencidas' ? 'text-red-200' : 'text-slate-400'}`}>Vencidas</p>
            <p className={`text-2xl font-bold ${filterPrazo === 'vencidas' ? 'text-white' : totalVencidas > 0 ? 'text-red-600' : 'text-slate-800'}`}>{totalVencidas}</p>
            <p className={`text-xs mt-0.5 ${filterPrazo === 'vencidas' ? 'text-red-200' : 'text-slate-400'}`}>exigem ação imediata</p>
          </button>
          <button onClick={() => setFilterPrazo(filterPrazo === 'alerta' ? 'todas' : 'alerta')}
            className={`text-left p-4 rounded-xl border transition-all ${filterPrazo === 'alerta' ? 'bg-orange-500 border-orange-500' : 'bg-white border-slate-200 hover:border-orange-200'}`}>
            <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${filterPrazo === 'alerta' ? 'text-orange-100' : 'text-slate-400'}`}>Vencendo em 30d</p>
            <p className={`text-2xl font-bold ${filterPrazo === 'alerta' ? 'text-white' : totalAlerta > 0 ? 'text-orange-500' : 'text-slate-800'}`}>{totalAlerta}</p>
            <p className={`text-xs mt-0.5 ${filterPrazo === 'alerta' ? 'text-orange-100' : 'text-slate-400'}`}>requerem atenção</p>
          </button>
          <button onClick={() => setFilterPrazo(filterPrazo === 'ok' ? 'todas' : 'ok')}
            className={`text-left p-4 rounded-xl border transition-all ${filterPrazo === 'ok' ? 'bg-emerald-600 border-emerald-600' : 'bg-white border-slate-200 hover:border-emerald-200'}`}>
            <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${filterPrazo === 'ok' ? 'text-emerald-100' : 'text-slate-400'}`}>Regulares</p>
            <p className={`text-2xl font-bold ${filterPrazo === 'ok' ? 'text-white' : 'text-emerald-600'}`}>{totalOk}</p>
            <p className={`text-xs mt-0.5 ${filterPrazo === 'ok' ? 'text-emerald-100' : 'text-slate-400'}`}>dentro do prazo</p>
          </button>
        </div>
      )}

      {/* Busca */}
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none">🔍</span>
        <input
          placeholder="Buscar por empresa, órgão ou atividade..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 pl-9 text-sm outline-none focus:border-slate-400 transition-all"
        />
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[640px]">
            <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-black uppercase text-slate-500 tracking-widest">
              <tr>
                <th className="px-5 py-4">Empresa</th>
                <th className="px-5 py-4">Órgão</th>
                <th className="px-5 py-4">Nº Licença</th>
                <th className="px-5 py-4">Atividade</th>
                <th className="px-5 py-4">Vencimento</th>
                <th className="px-5 py-4">Prazo</th>
                <th className="px-5 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {dadosFiltrados.map(item => {
                const dias = diasParaVencer(item.data_vencimento)
                return (
                  <tr key={item.id}
                    className="hover:bg-slate-50 transition-colors group"
                    style={{ borderLeft: urgBorder(dias) }}
                  >
                    <td className="px-5 py-3.5 text-sm font-bold text-slate-800 max-w-[180px] truncate">{item.empresas?.razao_social || '—'}</td>
                    <td className="px-5 py-3.5 text-xs font-bold uppercase text-slate-600">{item.orgao}</td>
                    <td className="px-5 py-3.5 text-xs font-mono text-slate-600">{item.numero_licenca || '—'}</td>
                    <td className="px-5 py-3.5 text-xs text-slate-500 max-w-[180px] truncate">{item.atividade_sanitaria || '—'}</td>
                    <td className="px-5 py-3.5 text-xs font-mono font-bold text-slate-700">
                      {item.data_vencimento ? new Date(item.data_vencimento + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}
                    </td>
                    <td className="px-5 py-3.5">
                      <PrazoBadge dias={dias} />
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openEdit(item)} title="Editar licença"
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-yellow-100 text-slate-500 hover:text-yellow-700 text-[10px] font-black uppercase transition-all">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          Editar
                        </button>
                        <button onClick={() => handleDelete(item.id)} title="Excluir"
                          className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-red-100 text-slate-400 hover:text-red-600 flex items-center justify-center text-xs transition-all">✕</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {dadosFiltrados.length === 0 && (
                <tr><td colSpan={7} className="px-6 py-12 text-center text-slate-400 italic text-sm">
                  {dados.length === 0 ? 'Nenhuma licença sanitária cadastrada.' : 'Nenhum resultado para os filtros aplicados.'}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Novo / Editar */}
      {modal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-lg rounded-3xl p-6 md:p-8 border border-slate-200 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-slate-900">
                {editItem ? 'Editar Licença Sanitária' : 'Nova Licença Sanitária'}
              </h2>
              <button onClick={() => { setModal(false); setEditItem(null) }} className="text-slate-400 hover:text-slate-700 font-black text-lg leading-none">✕</button>
            </div>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wide block mb-1">Empresa *</label>
                <select required value={form.empresa_id} onChange={e => setForm({ ...form, empresa_id: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm outline-none focus:border-slate-400">
                  <option value="">Selecione...</option>
                  {empresas.map(e => <option key={e.id} value={e.id}>{e.razao_social}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wide block mb-1">Órgão *</label>
                  <select required value={form.orgao} onChange={e => setForm({ ...form, orgao: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm outline-none focus:border-slate-400">
                    <option value="VISA_MUNICIPAL">VISA Municipal</option>
                    <option value="ANVISA">ANVISA</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wide block mb-1">Nº da Licença</label>
                  <input value={form.numero_licenca} onChange={e => setForm({ ...form, numero_licenca: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm outline-none focus:border-slate-400" />
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wide block mb-1">Atividade Sanitária</label>
                  <input value={form.atividade_sanitaria} onChange={e => setForm({ ...form, atividade_sanitaria: e.target.value })}
                    placeholder="Ex: Manipulação de alimentos"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm outline-none focus:border-slate-400" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wide block mb-1">Data de Emissão</label>
                  <input type="date" value={form.data_emissao} onChange={e => setForm({ ...form, data_emissao: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm outline-none focus:border-slate-400" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wide block mb-1">Data de Vencimento</label>
                  <input type="date" value={form.data_vencimento} onChange={e => setForm({ ...form, data_vencimento: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm outline-none focus:border-slate-400" />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wide block mb-1">Observações</label>
                <input value={form.observacoes} onChange={e => setForm({ ...form, observacoes: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm outline-none focus:border-slate-400" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setModal(false); setEditItem(null) }}
                  className="flex-1 bg-slate-100 text-slate-600 py-3 rounded-xl font-bold text-sm hover:bg-slate-200 transition-all">Cancelar</button>
                <button type="submit" disabled={saving}
                  className="flex-1 bg-slate-900 text-white py-3 rounded-xl font-bold text-sm hover:bg-slate-800 transition-all disabled:opacity-50">
                  {saving ? 'Salvando...' : editItem ? '✓ Salvar Alterações' : '✓ Cadastrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default function LicencasPageWrapper() {
  return <Suspense><LicencasPage /></Suspense>
}
