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

  function setField(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.empresa_id) { 
      toast.error('Selecione uma empresa')
      return 
    }
    setLoading(true)

    try {
      // 1. Criar o processo principal
      const { data: processo, error: procError } = await supabase
        .from('processos_societarios')
        .insert({
          empresa_id: form.empresa_id,
          tipo: form.tipo,
          titulo: form.titulo || null,
          observacoes: form.observacoes || null,
          status: 'em_andamento'
        })
        .select()
        .single()

      if (procError || !processo) throw new Error(procError?.message || 'Erro ao criar processo')

      // 2. Tradução para busca no banco (Conforme seus itens no Supabase)
      let buscaBanco = ''
      const tipoParaComparar = String(form.tipo).toLowerCase()

      if (tipoParaComparar.includes('abertura')) {
        buscaBanco = 'ABERTURA'
      } else if (tipoParaComparar.includes('alteracao')) {
        buscaBanco = 'ALTERAÇÃO'
      } else if (tipoParaComparar.includes('encerramento')) {
        buscaBanco = 'ENCERRAMENTO'
      }

      // 3. Buscar e Inserir Etapas se houver mapeamento
      if (buscaBanco) {
        const { data: etapasPadrao } = await supabase
          .from('modelos_checklist')
          .select('*')
          .ilike('tipo_servico', `%${buscaBanco}%`)
          .order('ordem', { ascending: true })

        if (etapasPadrao && etapasPadrao.length > 0) {
          const etapasParaInserir = etapasPadrao.map((ep) => ({
            processo_id: processo.id,
            ordem: ep.ordem,
            nome: ep.descricao_etapa,
            status: 'pendente',
          }))
          
          const { error: erroInsert } = await supabase
            .from('processo_etapas')
            .insert(etapasParaInserir)

          if (erroInsert) console.error("Erro ao inserir etapas:", erroInsert.message)
        }
      }

      toast.success('Processo criado com sucesso!')
      onSuccess()
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-bold text-gray-700 mb-1">Empresa *</label>
        <select 
          className="w-full p-2 border rounded-md" 
          required 
          value={form.empresa_id}
          onChange={e => setField('empresa_id', e.target.value)}
        >
          <option value="">Selecione uma empresa...</option>
          {empresas.map(e => (
            <option key={e.id} value={e.id}>{e.razao_social}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-bold text-gray-700 mb-1">Tipo de Processo *</label>
        <select 
          className="w-full p-2 border rounded-md" 
          required 
          value={form.tipo}
          onChange={e => setField('tipo', e.target.value)}
        >
          {Object.entries(TIPO_PROCESSO_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-bold text-gray-700 mb-1">Título / Referência</label>
        <input 
          className="w-full p-2 border rounded-md" 
          placeholder="Ex: Alteração de endereço" 
          value={form.titulo}
          onChange={e => setField('titulo', e.target.value)} 
        />
      </div>

      <div>
        <label className="block text-sm font-bold text-gray-700 mb-1">Observações</label>
        <textarea 
          className="w-full p-2 border rounded-md resize-none" 
          rows={3} 
          value={form.observacoes}
          onChange={e => setField('observacoes', e.target.value)} 
        />
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
        O checklist será gerado automaticamente com base no tipo selecionado.
      </div>

      <div className="flex gap-3 pt-2">
        <button 
          type="submit" 
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400" 
          disabled={loading}
        >
          {loading ? 'Processando...' : 'Criar Processo'}
        </button>
      </div>
    </form>
  )
}