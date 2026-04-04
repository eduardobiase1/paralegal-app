'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Empresa, TipoProcesso } from '@/types'
import { TIPO_PROCESSO_LABELS } from '@/types'
import toast from 'react-hot-toast'

interface Props {
  empresas: Empresa[]
  defaultEmpresaId?: string
  onSuccess: () => void
}

export default function ProcessoForm({ empresas, defaultEmpresaId, onSuccess }: Props) {
  const [supabase] = useState(createClient)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    empresa_id: defaultEmpresaId ?? '',
    tipo: 'abertura' as TipoProcesso,
    titulo: '',
    observacoes: '',
  })

  function set(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.empresa_id) { toast.error('Selecione uma empresa'); return }
    setLoading(true)

    // Criar processo
    const { data: processo, error: procError } = await supabase
      .from('processos_societarios')
      .insert({
        empresa_id: form.empresa_id,
        tipo: form.tipo,
        titulo: form.titulo || null,
        observacoes: form.observacoes || null,
      })
      .select()
      .single()

    if (procError || !processo) {
      toast.error('Erro ao criar processo: ' + procError?.message)
      setLoading(false)
      return
    }

    // Buscar etapas padrão via função do banco
    const { data: etapasPadrao } = await supabase
      .rpc('get_etapas_padrao', { tipo_processo: form.tipo })

    if (etapasPadrao && etapasPadrao.length > 0) {
      const etapas = etapasPadrao.map((ep: { ordem: number; nome: string }) => ({
        processo_id: processo.id,
        ordem: ep.ordem,
        nome: ep.nome,
        status: 'pendente',
      }))
      await supabase.from('processo_etapas').insert(etapas)
    }

    setLoading(false)
    toast.success('Processo criado com checklist!')
    onSuccess()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="label">Empresa *</label>
        <select className="input" required value={form.empresa_id}
          onChange={e => set('empresa_id', e.target.value)}>
          <option value="">Selecione...</option>
          {empresas.map(e => <option key={e.id} value={e.id}>{e.razao_social}</option>)}
        </select>
      </div>

      <div>
        <label className="label">Tipo de Processo *</label>
        <select className="input" required value={form.tipo}
          onChange={e => set('tipo', e.target.value)}>
          {Object.entries(TIPO_PROCESSO_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="label">Título / Referência</label>
        <input className="input" placeholder="Ex: Alteração de endereço" value={form.titulo}
          onChange={e => set('titulo', e.target.value)} />
      </div>

      <div>
        <label className="label">Observações</label>
        <textarea className="input resize-none" rows={3} value={form.observacoes}
          onChange={e => set('observacoes', e.target.value)} />
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
        As etapas do checklist serão criadas automaticamente de acordo com o tipo de processo selecionado.
      </div>

      <div className="flex gap-3 pt-2">
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Criando...' : 'Criar Processo'}
        </button>
      </div>
    </form>
  )
}
