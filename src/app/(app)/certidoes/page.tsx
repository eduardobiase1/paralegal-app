'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useOrg } from '@/lib/org-context'
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

export default function CertidoesPage() {
  const { orgName } = useOrg()
  const [supabase] = useState(createClient())
  const [data, setData] = useState<any[]>([])
  const [empresas, setEmpresas] = useState<any[]>([])
  const [modal, setModal] = useState(false)
  const [modalMode, setModalMode] = useState<'novo' | 'editar' | 'renovar'>('novo')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [filterPendencia, setFilterPendencia] = useState('todas')

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
    setForm({ ...EMPTY_FORM })
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
      id: '',
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
      if (modalMode === 'editar' && form.id) {
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

  // Filtro/busca
  const filtered = data.filter(i => {
    const matchSearch = !search ||
      (i.empresas?.razao_social || '').toLowerCase().includes(search.toLowerCase()) ||
      (i.tipo || '').toLowerCase().includes(search.toLowerCase()) ||
      (i.orgao_emissor || '').toLowerCase().includes(search.toLowerCase())
    const matchPend = filterPendencia === 'todas' || (i.pendencia_status || 'nenhuma') === filterPendencia
    return matchSearch && matchPend
  })

  const modalTitle = { novo: 'Nova Certidão Negativa', editar: 'Editar Certidão', renovar: 'Renovar Certidão' }

  return (
    <div className="p-4 md:p-8 space-y-4 bg-slate-50 min-h-screen font-sans">

      {/* Header */}
      <header className="flex flex-wrap justify-between items-center gap-3 bg-white p-4 md:p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900">Certidões Negativas</h1>
          <p className="text-[10px] font-black uppercase text-blue-600 tracking-widest mt-1">{orgName}</p>
        </div>
        <button onClick={openNovo} className="bg-slate-900 text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-slate-800 transition-all whitespace-nowrap">
          + Nova Certidão
        </button>
      </header>

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
                  <tr key={i.id} className={`hover:bg-slate-50 transition-colors ${dias !== null && dias < 0 ? 'bg-red-50/40' : dias !== null && dias <= 15 ? 'bg-orange-50/40' : ''}`}>
                    <td className="px-5 py-3.5 text-sm font-bold text-slate-800 max-w-[180px] truncate">{i.empresas?.razao_social}</td>
                    <td className="px-5 py-3.5 text-xs font-bold uppercase text-slate-600">{i.tipo}</td>
                    <td className="px-5 py-3.5 text-xs text-slate-500">{i.orgao_emissor}</td>
                    <td className="px-5 py-3.5 text-xs font-mono text-slate-600">
                      {i.data_emissao ? new Date(i.data_emissao + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}
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
                      <div className="flex items-center justify-end gap-1.5">
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
