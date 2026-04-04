'use client'

import { Suspense, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Certidao, Empresa } from '@/types'
import { formatDate, formatCNPJ } from '@/lib/utils'
import StatusBadge from '@/components/ui/StatusBadge'
import Modal from '@/components/ui/Modal'
import CertidaoForm from '@/components/modules/CertidaoForm'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import toast from 'react-hot-toast'
import { useSearchParams } from 'next/navigation'

const PORTAIS = [
  { label: 'CND Federal', url: 'https://solucoes.receita.fazenda.gov.br/Servicos/certidaointer/default.aspx' },
  { label: 'CNDT Trabalhista', url: 'https://cndt-certidao.tst.jus.br' },
  { label: 'FGTS (CRF)', url: 'https://consulta-crf.caixa.gov.br' },
  { label: 'e-CAC', url: 'https://cav.receita.fazenda.gov.br' },
]

function CertidoesPageInner() {
  const searchParams = useSearchParams()
  const empresaFiltro = searchParams.get('empresa')

  const [certidoes, setCertidoes] = useState<Certidao[]>([])
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editItem, setEditItem] = useState<Certidao | null>(null)
  const [deleteItem, setDeleteItem] = useState<Certidao | null>(null)
  const [filtroEmpresa, setFiltroEmpresa] = useState(empresaFiltro || '')
  const [supabase] = useState(createClient)

  async function load() {
    setLoading(true)
    const [{ data: certs }, { data: emps }] = await Promise.all([
      supabase.from('v_certidoes_status').select('*').order('data_vencimento', { ascending: true }),
      supabase.from('empresas').select('id, razao_social, cnpj, uf, url_certidao_municipal').eq('status', 'ativa').order('razao_social'),
    ])
    setCertidoes(certs ?? [])
    setEmpresas((emps ?? []) as Empresa[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const filtered = filtroEmpresa
    ? certidoes.filter(c => c.empresa_id === filtroEmpresa)
    : certidoes

  async function handleDelete() {
    if (!deleteItem) return
    const { error } = await supabase.from('certidoes').delete().eq('id', deleteItem.id)
    if (error) { toast.error('Erro ao excluir'); return }
    toast.success('Certidão excluída')
    setDeleteItem(null)
    load()
  }

  function openNew() { setEditItem(null); setModalOpen(true) }
  function openEdit(c: Certidao) { setEditItem(c); setModalOpen(true) }
  function closeModal() { setModalOpen(false); setEditItem(null) }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Certidões Negativas</h1>
          <p className="text-sm text-gray-500 mt-0.5">{filtered.length} certidão(ões)</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Acesso rápido portais */}
          <div className="hidden md:flex gap-1">
            {PORTAIS.map(p => (
              <a key={p.label} href={p.url} target="_blank" rel="noopener noreferrer"
                className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg transition-colors">
                {p.label}
              </a>
            ))}
          </div>
          <button onClick={openNew} className="btn-primary">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nova Certidão
          </button>
        </div>
      </div>

      {/* Filtro empresa */}
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
          <div className="p-12 text-center text-gray-500">
            <p className="font-medium">Nenhuma certidão encontrada</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Empresa</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Tipo</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Órgão</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Emissão</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Vencimento</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map(c => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900 truncate max-w-[160px]">{c.razao_social}</div>
                      <div className="text-xs text-gray-500 font-mono">{c.cnpj && formatCNPJ(c.cnpj)}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{c.tipo}</td>
                    <td className="px-4 py-3 text-gray-600">{c.orgao_emissor}</td>
                    <td className="px-4 py-3 text-gray-600">{formatDate(c.data_emissao)}</td>
                    <td className="px-4 py-3 text-gray-600">{formatDate(c.data_vencimento)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={c.status_cor ?? 'sem_data'} diasParaVencer={c.dias_para_vencer} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        {c.arquivo_url && (
                          <a href={c.arquivo_url} target="_blank" rel="noopener noreferrer"
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg" title="Ver documento">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                            </svg>
                          </a>
                        )}
                        <button onClick={() => openEdit(c)}
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
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={modalOpen} onClose={closeModal}
        title={editItem ? 'Editar Certidão' : 'Nova Certidão'} size="lg">
        <CertidaoForm
          empresas={empresas}
          certidao={editItem ?? undefined}
          defaultEmpresaId={filtroEmpresa}
          onSuccess={() => { closeModal(); load() }}
        />
      </Modal>

      <ConfirmDialog
        open={!!deleteItem}
        title="Excluir Certidão"
        message={`Deseja excluir a certidão "${deleteItem?.tipo}" da empresa "${deleteItem?.razao_social}"?`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteItem(null)}
        danger
      />
    </div>
  )
}

export default function CertidoesPage() {
  return <Suspense><CertidoesPageInner /></Suspense>
}
