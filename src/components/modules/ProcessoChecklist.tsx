'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ProcessoSocietario, ProcessoEtapa, Profile } from '@/types'
import {
  TIPO_PROCESSO_LABELS, STATUS_PROCESSO_LABELS,
  STATUS_ETAPA_LABELS, StatusEtapa
} from '@/types'
import { formatDate, formatDateInput } from '@/lib/utils'
import toast from 'react-hot-toast'
import Link from 'next/link'

const ETAPA_STATUS_COLORS: Record<StatusEtapa, string> = {
  pendente: 'border-gray-200 bg-white',
  em_andamento: 'border-blue-300 bg-blue-50',
  concluido: 'border-green-300 bg-green-50',
  aguardando_cliente: 'border-yellow-300 bg-yellow-50',
}

const ETAPA_STATUS_DOT: Record<StatusEtapa, string> = {
  pendente: 'bg-gray-300',
  em_andamento: 'bg-blue-500',
  concluido: 'bg-green-500',
  aguardando_cliente: 'bg-yellow-500',
}

interface Props {
  processo: ProcessoSocietario & { empresa?: { razao_social: string; cnpj: string } }
  etapas: ProcessoEtapa[]
  profiles: Pick<Profile, 'id' | 'nome'>[]
}

export default function ProcessoChecklist({ processo, etapas: initialEtapas, profiles }: Props) {
  const router = useRouter()
  const [supabase] = useState(createClient)
  const [etapas, setEtapas] = useState<ProcessoEtapa[]>(initialEtapas)
  const [processoStatus, setProcessoStatus] = useState(processo.status)
  const [saving, setSaving] = useState<string | null>(null)

  const concluidas = etapas.filter(e => e.status === 'concluido').length
  const total = etapas.length
  const progresso = total > 0 ? Math.round((concluidas / total) * 100) : 0

  async function updateEtapa(etapaId: string, updates: Partial<ProcessoEtapa>) {
    setSaving(etapaId)
    const { error } = await supabase
      .from('processo_etapas')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', etapaId)

    if (error) {
      toast.error('Erro ao atualizar etapa')
    } else {
      setEtapas(prev => prev.map(e => e.id === etapaId ? { ...e, ...updates } : e))
    }
    setSaving(null)
  }

  async function updateProcessoStatus(newStatus: string) {
    const { error } = await supabase
      .from('processos_societarios')
      .update({ status: newStatus, data_conclusao: newStatus === 'concluido' ? new Date().toISOString().split('T')[0] : null })
      .eq('id', processo.id)

    if (error) { toast.error('Erro ao atualizar status'); return }
    setProcessoStatus(newStatus as any)
    toast.success('Status atualizado!')
  }

  return (
    <div className="p-6 max-w-4xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
        <Link href="/societario" className="hover:text-primary-600">Módulo Societário</Link>
        <span>/</span>
        <span className="text-gray-900">{processo.empresa?.razao_social}</span>
      </div>

      {/* Header */}
      <div className="card mb-6">
        <div className="card-body">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <h1 className="text-xl font-bold text-gray-900">{processo.empresa?.razao_social}</h1>
                <span className="text-sm px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-medium">
                  {TIPO_PROCESSO_LABELS[processo.tipo]}
                </span>
              </div>
              {processo.titulo && <p className="text-gray-600">{processo.titulo}</p>}
              <p className="text-sm text-gray-500 mt-1">Aberto em {formatDate(processo.data_abertura)}</p>
            </div>
            <div className="flex items-center gap-3">
              <select
                className="input text-sm w-44"
                value={processoStatus}
                onChange={e => updateProcessoStatus(e.target.value)}
              >
                <option value="em_andamento">Em Andamento</option>
                <option value="concluido">Concluído</option>
                <option value="cancelado">Cancelado</option>
              </select>
            </div>
          </div>

          {/* Progresso */}
          <div className="mt-4">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-600">Progresso</span>
              <span className="font-medium text-gray-900">{concluidas}/{total} etapas ({progresso}%)</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary-600 rounded-full transition-all"
                style={{ width: `${progresso}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Checklist */}
      <div className="space-y-3">
        <h2 className="text-base font-semibold text-gray-900">Checklist de Etapas</h2>
        {etapas.map((etapa, idx) => (
          <div
            key={etapa.id}
            className={`border rounded-xl p-4 transition-colors ${ETAPA_STATUS_COLORS[etapa.status]}`}
          >
            <div className="flex items-start gap-3">
              {/* Número */}
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5 ${
                etapa.status === 'concluido' ? 'bg-green-500 text-white' :
                etapa.status === 'em_andamento' ? 'bg-blue-500 text-white' :
                'bg-gray-200 text-gray-600'
              }`}>
                {etapa.status === 'concluido' ? (
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                ) : etapa.ordem}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-gray-900">{etapa.nome}</span>
                  <span className={`w-2 h-2 rounded-full ${ETAPA_STATUS_DOT[etapa.status]}`} />
                  <span className="text-xs text-gray-500">{STATUS_ETAPA_LABELS[etapa.status]}</span>
                </div>

                {etapa.observacoes && (
                  <p className="text-sm text-gray-600 mt-1">{etapa.observacoes}</p>
                )}

                {etapa.data_conclusao && (
                  <p className="text-xs text-gray-400 mt-1">Concluído em {formatDate(etapa.data_conclusao)}</p>
                )}
              </div>

              {/* Controls */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <select
                  className="text-xs border rounded-lg px-2 py-1 bg-white"
                  value={etapa.status}
                  disabled={saving === etapa.id}
                  onChange={e => updateEtapa(etapa.id, {
                    status: e.target.value as StatusEtapa,
                    data_conclusao: e.target.value === 'concluido'
                      ? new Date().toISOString().split('T')[0]
                      : undefined,
                  })}
                >
                  <option value="pendente">Pendente</option>
                  <option value="em_andamento">Em Andamento</option>
                  <option value="concluido">Concluído</option>
                  <option value="aguardando_cliente">Aguard. Cliente</option>
                </select>

                {saving === etapa.id && (
                  <svg className="animate-spin w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                )}
              </div>
            </div>

            {/* Observação inline */}
            <EtapaObsEditor etapa={etapa} onSave={obs => updateEtapa(etapa.id, { observacoes: obs })} />
          </div>
        ))}
      </div>
    </div>
  )
}

function EtapaObsEditor({ etapa, onSave }: { etapa: ProcessoEtapa; onSave: (obs: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(etapa.observacoes ?? '')

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="mt-2 ml-10 text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"
      >
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
        {etapa.observacoes ? 'Editar obs.' : 'Adicionar obs.'}
      </button>
    )
  }

  return (
    <div className="mt-2 ml-10 flex gap-2">
      <input
        className="input text-sm flex-1"
        value={value}
        onChange={e => setValue(e.target.value)}
        placeholder="Observação..."
        autoFocus
      />
      <button
        className="btn-primary text-xs py-1.5 px-3"
        onClick={() => { onSave(value); setEditing(false) }}
      >
        Salvar
      </button>
      <button
        className="btn-secondary text-xs py-1.5 px-3"
        onClick={() => { setValue(etapa.observacoes ?? ''); setEditing(false) }}
      >
        Cancelar
      </button>
    </div>
  )
}
