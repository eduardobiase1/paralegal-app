'use client'

import { Suspense, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CertificadoDigital, Empresa } from '@/types'
import { formatDate, formatCNPJ } from '@/lib/utils'
import { AC_URLS } from '@/types'
import StatusBadge from '@/components/ui/StatusBadge'
import Modal from '@/components/ui/Modal'
import CertificadoForm from '@/components/modules/CertificadoForm'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import toast from 'react-hot-toast'
import { useSearchParams } from 'next/navigation'

function CertificadosPageInner() {
  const searchParams = useSearchParams()
  const [certs, setCerts] = useState<CertificadoDigital[]>([])
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editItem, setEditItem] = useState<CertificadoDigital | null>(null)
  const [deleteItem, setDeleteItem] = useState<CertificadoDigital | null>(null)
  const [filtroEmpresa, setFiltroEmpresa] = useState(searchParams.get('empresa') || '')
  const [supabase] = useState(createClient)
  const [expandedControl, setExpandedControl] = useState<string | null>(null)
  const [savingControl, setSavingControl] = useState<string | null>(null)

  async function saveControl(id: string, fields: Record<string, any>) {
    setSavingControl(id)
    await supabase.from('certificados_digitais').update(fields).eq('id', id)
    setCerts(prev => prev.map(c => c.id === id ? { ...c, ...fields } : c))
    setSavingControl(null)
    toast.success('Salvo!')
  }

  async function load() {
    setLoading(true)
    const [{ data: cs }, { data: emps }] = await Promise.all([
      supabase.from('v_certificados_status').select('*').order('data_vencimento', { ascending: true }),
      supabase.from('empresas').select('id, razao_social, cnpj').order('razao_social'),
    ])
    setCerts(cs ?? [])
    setEmpresas((emps ?? []) as Empresa[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const filtered = filtroEmpresa ? certs.filter(c => c.empresa_id === filtroEmpresa) : certs

  async function handleDelete() {
    if (!deleteItem) return
    const { error } = await supabase.from('certificados_digitais').delete().eq('id', deleteItem.id)
    if (error) { toast.error('Erro ao excluir'); return }
    toast.success('Certificado excluído')
    setDeleteItem(null)
    load()
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Certificados Digitais</h1>
          <p className="text-sm text-gray-500 mt-0.5">{filtered.length} certificado(s)</p>
        </div>
        <button onClick={() => { setEditItem(null); setModalOpen(true) }} className="btn-primary">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Novo Certificado
        </button>
      </div>

      <div className="mb-4">
        <select className="input max-w-xs" value={filtroEmpresa} onChange={e => setFiltroEmpresa(e.target.value)}>
          <option value="">Todas as empresas</option>
          {empresas.map(e => <option key={e.id} value={e.id}>{e.razao_social}</option>)}
        </select>
      </div>

      <div className="card">
        {loading ? (
          <div className="p-12 text-center text-gray-400">Carregando...</div>
        ) : !filtered.length ? (
          <div className="p-12 text-center text-gray-500"><p className="font-medium">Nenhum certificado encontrado</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Empresa</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Titular</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Tipo/Uso</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">AC</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Vencimento</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Renovação</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map(c => {
                  const isOpen = expandedControl === c.id
                  const agendadoFmt = (c as any).data_agendamento
                    ? new Date((c as any).data_agendamento).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                    : null
                  const avisoFmt = (c as any).data_aviso_cliente
                    ? new Date((c as any).data_aviso_cliente + 'T12:00:00').toLocaleDateString('pt-BR')
                    : null
                  return (
                    <>
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900 truncate max-w-[140px]">{c.razao_social}</div>
                        <div className="text-xs text-gray-500 font-mono">{c.cnpj && formatCNPJ(c.cnpj)}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-700">{c.titular}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-xs px-1.5 py-0.5 rounded font-mono font-bold ${
                            c.tipo === 'A1' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                          }`}>{c.tipo}</span>
                          <span className="text-gray-600">{c.uso}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {AC_URLS[c.autoridade_certificadora] ? (
                          <a href={AC_URLS[c.autoridade_certificadora]} target="_blank" rel="noopener noreferrer"
                            className="text-primary-600 hover:underline">{c.autoridade_certificadora}</a>
                        ) : (
                          <span className="text-gray-600">{c.autoridade_certificadora}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{formatDate(c.data_vencimento)}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={c.status_cor ?? 'sem_data'} diasParaVencer={c.dias_para_vencer} />
                      </td>

                      {/* Coluna Renovação — resumo rápido */}
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full w-fit ${
                            (c as any).pagamento_confirmado ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                          }`}>
                            {(c as any).pagamento_confirmado ? '💰 Pago' : '💰 Pendente'}
                          </span>
                          {avisoFmt && <span className="text-[10px] text-gray-500">📧 {avisoFmt}</span>}
                          {agendadoFmt && <span className="text-[10px] text-blue-600 font-semibold">📅 {agendadoFmt}</span>}
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          <button
                            onClick={() => setExpandedControl(isOpen ? null : c.id)}
                            className={`p-1.5 rounded-lg transition-colors ${isOpen ? 'bg-yellow-100 text-yellow-700' : 'text-gray-400 hover:text-yellow-600 hover:bg-yellow-50'}`}
                            title="Controle de Renovação"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                            </svg>
                          </button>
                          {AC_URLS[c.autoridade_certificadora] && (
                            <a href={AC_URLS[c.autoridade_certificadora]} target="_blank" rel="noopener noreferrer"
                              className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg" title="Renovar">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                              </svg>
                            </a>
                          )}
                          <button onClick={() => { setEditItem(c); setModalOpen(true) }}
                            className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button onClick={() => setDeleteItem(c)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Painel de Controle de Renovação */}
                    {isOpen && (
                      <tr key={`ctrl-${c.id}`} className="bg-yellow-50/60 border-b border-yellow-100">
                        <td colSpan={8} className="px-6 py-4">
                          <div className="flex flex-wrap gap-6 items-end">
                            <p className="text-[10px] font-black uppercase tracking-widest text-yellow-700 w-full mb-1">Controle de Renovação — {c.razao_social}</p>

                            {/* Pagamento */}
                            <div className="flex flex-col gap-1.5">
                              <label className="text-[9px] font-black uppercase tracking-widest text-gray-500">Pagamento</label>
                              <div className="flex gap-2">
                                {[{ v: true, label: '💰 Confirmado', cls: 'bg-emerald-500 text-white' }, { v: false, label: 'Pendente', cls: 'bg-amber-400 text-black' }].map(opt => (
                                  <button key={String(opt.v)}
                                    onClick={() => saveControl(c.id, { pagamento_confirmado: opt.v })}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${(c as any).pagamento_confirmado === opt.v ? opt.cls + ' shadow-sm' : 'bg-white border border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                                    {opt.label}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Aviso ao cliente */}
                            <div className="flex flex-col gap-1.5">
                              <label className="text-[9px] font-black uppercase tracking-widest text-gray-500">📧 Data do Aviso ao Cliente</label>
                              <div className="flex gap-2 items-center">
                                <input type="date"
                                  defaultValue={(c as any).data_aviso_cliente || ''}
                                  id={`aviso-${c.id}`}
                                  className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-yellow-400 bg-white"
                                />
                                <button onClick={() => {
                                  const val = (document.getElementById(`aviso-${c.id}`) as HTMLInputElement)?.value || null
                                  saveControl(c.id, { data_aviso_cliente: val })
                                }} disabled={savingControl === c.id}
                                  className="bg-black text-yellow-400 px-3 py-1.5 rounded-lg text-xs font-black hover:bg-slate-800 disabled:opacity-50">
                                  Salvar
                                </button>
                              </div>
                            </div>

                            {/* Agendamento */}
                            <div className="flex flex-col gap-1.5">
                              <label className="text-[9px] font-black uppercase tracking-widest text-gray-500">📅 Agendamento (Data e Horário)</label>
                              <div className="flex gap-2 items-center">
                                <input type="datetime-local"
                                  defaultValue={(c as any).data_agendamento ? new Date((c as any).data_agendamento).toISOString().slice(0,16) : ''}
                                  id={`agenda-${c.id}`}
                                  className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-yellow-400 bg-white"
                                />
                                <button onClick={() => {
                                  const val = (document.getElementById(`agenda-${c.id}`) as HTMLInputElement)?.value || null
                                  saveControl(c.id, { data_agendamento: val || null })
                                }} disabled={savingControl === c.id}
                                  className="bg-black text-yellow-400 px-3 py-1.5 rounded-lg text-xs font-black hover:bg-slate-800 disabled:opacity-50">
                                  Salvar
                                </button>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                    </>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => { setModalOpen(false); setEditItem(null) }}
        title={editItem ? 'Editar Certificado' : 'Novo Certificado Digital'} size="lg">
        <CertificadoForm
          empresas={empresas}
          certificado={editItem ?? undefined}
          defaultEmpresaId={filtroEmpresa}
          onSuccess={() => { setModalOpen(false); setEditItem(null); load() }}
        />
      </Modal>

      <ConfirmDialog
        open={!!deleteItem}
        title="Excluir Certificado"
        message={`Deseja excluir o certificado de "${deleteItem?.titular}"?`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteItem(null)}
        danger
      />
    </div>
  )
}

export default function CertificadosPage() {
  return <Suspense><CertificadosPageInner /></Suspense>
}
