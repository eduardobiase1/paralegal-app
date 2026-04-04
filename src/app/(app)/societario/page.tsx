'use client'

import { Suspense, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ProcessoSocietario, Empresa } from '@/types'
import { TIPO_PROCESSO_LABELS, STATUS_PROCESSO_LABELS } from '@/types'
import { formatDate } from '@/lib/utils'
import Link from 'next/link'
import Modal from '@/components/ui/Modal'
import ProcessoForm from '@/components/modules/ProcessoForm'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import toast from 'react-hot-toast'
import { useSearchParams } from 'next/navigation'

const STATUS_COLORS: Record<string, string> = {
  em_andamento: 'bg-blue-100 text-blue-700',
  concluido: 'bg-green-100 text-green-700',
  cancelado: 'bg-gray-100 text-gray-600',
}

function SocietarioPageInner() {
  const searchParams = useSearchParams()
  const [processos, setProcessos] = useState<ProcessoSocietario[]>([])
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [deleteItem, setDeleteItem] = useState<ProcessoSocietario | null>(null)
  const [filtroEmpresa, setFiltroEmpresa] = useState(searchParams.get('empresa') || '')
  const [filtroStatus, setFiltroStatus] = useState('em_andamento')
  const [supabase] = useState(createClient)

  async function load() {
    setLoading(true)
    const [{ data: procs }, { data: emps }] = await Promise.all([
      supabase
        .from('processos_societarios')
        .select(`*, empresa:empresas(razao_social, cnpj)`)
        .order('created_at', { ascending: false }),
      supabase.from('empresas').select('id, razao_social').order('razao_social'),
    ])
    setProcessos((procs ?? []).map((p: any) => ({
      ...p,
      razao_social: p.empresa?.razao_social,
    })))
    setEmpresas((emps ?? []) as Empresa[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const filtered = processos
    .filter(p => !filtroEmpresa || p.empresa_id === filtroEmpresa)
    .filter(p => !filtroStatus || p.status === filtroStatus)

  async function handleDelete() {
    if (!deleteItem) return
    const { error } = await supabase.from('processos_societarios').delete().eq('id', deleteItem.id)
    if (error) { toast.error('Erro ao excluir'); return }
    toast.success('Processo excluído')
    setDeleteItem(null)
    load()
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Módulo Societário</h1>
          <p className="text-sm text-gray-500 mt-0.5">{filtered.length} processo(s)</p>
        </div>
        <button onClick={() => setModalOpen(true)} className="btn-primary">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Novo Processo
        </button>
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <select className="input max-w-xs" value={filtroEmpresa} onChange={e => setFiltroEmpresa(e.target.value)}>
          <option value="">Todas as empresas</option>
          {empresas.map(e => <option key={e.id} value={e.id}>{e.razao_social}</option>)}
        </select>
        <select className="input w-40" value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}>
          <option value="">Todos os status</option>
          <option value="em_andamento">Em Andamento</option>
          <option value="concluido">Concluído</option>
          <option value="cancelado">Cancelado</option>
        </select>
      </div>

      <div className="card">
        {loading ? (
          <div className="p-12 text-center text-gray-400">Carregando...</div>
        ) : !filtered.length ? (
          <div className="p-12 text-center text-gray-500">
            <p className="font-medium">Nenhum processo encontrado</p>
          </div>
        ) : (
          <div className="divide-y">
            {filtered.map(proc => (
              <div key={proc.id} className="px-6 py-4 hover:bg-gray-50 flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-gray-900">{proc.razao_social}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-medium">
                      {TIPO_PROCESSO_LABELS[proc.tipo]}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[proc.status]}`}>
                      {STATUS_PROCESSO_LABELS[proc.status]}
                    </span>
                  </div>
                  {proc.titulo && <p className="text-sm text-gray-600 mt-0.5">{proc.titulo}</p>}
                  <p className="text-xs text-gray-400 mt-0.5">
                    Aberto em {formatDate(proc.data_abertura)}
                    {proc.data_conclusao && ` · Concluído em ${formatDate(proc.data_conclusao)}`}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Link href={`/societario/${proc.id}`} className="btn-secondary text-xs py-1.5 px-3">
                    Ver checklist
                  </Link>
                  <button onClick={() => setDeleteItem(proc)}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Novo Processo Societário" size="md">
        <ProcessoForm
          empresas={empresas}
          defaultEmpresaId={filtroEmpresa}
          onSuccess={() => { setModalOpen(false); load() }}
        />
      </Modal>

      <ConfirmDialog
        open={!!deleteItem}
        title="Excluir Processo"
        message={`Deseja excluir o processo "${deleteItem && TIPO_PROCESSO_LABELS[deleteItem.tipo]}" de "${deleteItem?.razao_social}"? Todas as etapas serão excluídas.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteItem(null)}
        danger
      />
    </div>
  )
}

export default function SocietarioPage() {
  return <Suspense><SocietarioPageInner /></Suspense>
}
