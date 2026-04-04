'use client'

import { Suspense, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { LicencaSanitaria, Empresa } from '@/types'
import { formatDate, formatCNPJ } from '@/lib/utils'
import StatusBadge from '@/components/ui/StatusBadge'
import Modal from '@/components/ui/Modal'
import LicencaForm from '@/components/modules/LicencaForm'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import toast from 'react-hot-toast'
import { useSearchParams } from 'next/navigation'

function LicencasPageInner() {
  const searchParams = useSearchParams()
  const [licencas, setLicencas] = useState<LicencaSanitaria[]>([])
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editItem, setEditItem] = useState<LicencaSanitaria | null>(null)
  const [deleteItem, setDeleteItem] = useState<LicencaSanitaria | null>(null)
  const [filtroEmpresa, setFiltroEmpresa] = useState(searchParams.get('empresa') || '')
  const [supabase] = useState(createClient)

  async function load() {
    setLoading(true)
    const [{ data: lics }, { data: emps }] = await Promise.all([
      supabase.from('v_licencas_status').select('*').order('data_vencimento', { ascending: true }),
      supabase.from('empresas').select('id, razao_social, cnpj, url_portal_visa').eq('status', 'ativa').order('razao_social'),
    ])
    setLicencas(lics ?? [])
    setEmpresas((emps ?? []) as Empresa[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const filtered = filtroEmpresa ? licencas.filter(l => l.empresa_id === filtroEmpresa) : licencas

  async function handleDelete() {
    if (!deleteItem) return
    const { error } = await supabase.from('licencas_sanitarias').delete().eq('id', deleteItem.id)
    if (error) { toast.error('Erro ao excluir'); return }
    toast.success('Licença excluída')
    setDeleteItem(null)
    load()
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Licenças Sanitárias</h1>
          <p className="text-sm text-gray-500 mt-0.5">{filtered.length} licença(s)</p>
        </div>
        <button onClick={() => { setEditItem(null); setModalOpen(true) }} className="btn-primary">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nova Licença
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
          <div className="p-12 text-center text-gray-500"><p className="font-medium">Nenhuma licença encontrada</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Empresa</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Órgão</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Número</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Atividade</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Vencimento</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map(l => {
                  const empresa = empresas.find(e => e.id === l.empresa_id)
                  return (
                    <tr key={l.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900 truncate max-w-[160px]">{l.razao_social}</div>
                        <div className="text-xs text-gray-500 font-mono">{l.cnpj && formatCNPJ(l.cnpj)}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          l.orgao === 'ANVISA' ? 'bg-purple-100 text-purple-700' : 'bg-teal-100 text-teal-700'
                        }`}>{l.orgao}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 font-mono">{l.numero_licenca || '—'}</td>
                      <td className="px-4 py-3 text-gray-600 truncate max-w-[120px]">{l.atividade_sanitaria || '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{formatDate(l.data_vencimento)}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={l.status_cor ?? 'sem_data'} diasParaVencer={l.dias_para_vencer} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          {empresa?.url_portal_visa && (
                            <a href={empresa.url_portal_visa} target="_blank" rel="noopener noreferrer"
                              className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg" title="Portal VISA">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                              </svg>
                            </a>
                          )}
                          <button onClick={() => { setEditItem(l); setModalOpen(true) }}
                            className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button onClick={() => setDeleteItem(l)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => { setModalOpen(false); setEditItem(null) }}
        title={editItem ? 'Editar Licença' : 'Nova Licença Sanitária'} size="lg">
        <LicencaForm
          empresas={empresas}
          licenca={editItem ?? undefined}
          defaultEmpresaId={filtroEmpresa}
          onSuccess={() => { setModalOpen(false); setEditItem(null); load() }}
        />
      </Modal>

      <ConfirmDialog
        open={!!deleteItem}
        title="Excluir Licença"
        message={`Deseja excluir a licença de "${deleteItem?.razao_social}"?`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteItem(null)}
        danger
      />
    </div>
  )
}

export default function LicencasPage() {
  return <Suspense><LicencasPageInner /></Suspense>
}
