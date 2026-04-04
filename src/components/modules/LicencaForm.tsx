'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { LicencaSanitaria, Empresa } from '@/types'
import { formatDateInput } from '@/lib/utils'
import toast from 'react-hot-toast'

interface Props {
  empresas: Empresa[]
  licenca?: LicencaSanitaria
  defaultEmpresaId?: string
  onSuccess: () => void
}

export default function LicencaForm({ empresas, licenca, defaultEmpresaId, onSuccess }: Props) {
  const [supabase] = useState(createClient)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    empresa_id: licenca?.empresa_id ?? defaultEmpresaId ?? '',
    orgao: licenca?.orgao ?? 'VISA_MUNICIPAL',
    numero_licenca: licenca?.numero_licenca ?? '',
    numero_processo_renovacao: licenca?.numero_processo_renovacao ?? '',
    atividade_sanitaria: licenca?.atividade_sanitaria ?? '',
    data_emissao: formatDateInput(licenca?.data_emissao),
    data_vencimento: formatDateInput(licenca?.data_vencimento),
    observacoes: licenca?.observacoes ?? '',
  })

  function set(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.empresa_id) { toast.error('Selecione uma empresa'); return }
    setLoading(true)

    const payload = {
      ...form,
      data_emissao: form.data_emissao || null,
      data_vencimento: form.data_vencimento || null,
    }

    let error
    if (licenca) {
      const res = await supabase.from('licencas_sanitarias').update(payload).eq('id', licenca.id)
      error = res.error
    } else {
      const res = await supabase.from('licencas_sanitarias').insert(payload)
      error = res.error
    }

    setLoading(false)
    if (error) { toast.error('Erro ao salvar: ' + error.message); return }
    toast.success(licenca ? 'Licença atualizada!' : 'Licença cadastrada!')
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

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Órgão *</label>
          <select className="input" required value={form.orgao}
            onChange={e => set('orgao', e.target.value)}>
            <option value="VISA_MUNICIPAL">VISA Municipal</option>
            <option value="ANVISA">ANVISA</option>
          </select>
        </div>
        <div>
          <label className="label">Número da Licença</label>
          <input className="input font-mono" value={form.numero_licenca}
            onChange={e => set('numero_licenca', e.target.value)} />
        </div>
      </div>

      <div>
        <label className="label">Nº do Processo de Renovação</label>
        <input className="input font-mono" value={form.numero_processo_renovacao}
          onChange={e => set('numero_processo_renovacao', e.target.value)} />
      </div>

      <div>
        <label className="label">Atividade Sanitária</label>
        <input className="input" placeholder="Ex: Comércio de alimentos" value={form.atividade_sanitaria}
          onChange={e => set('atividade_sanitaria', e.target.value)} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Data de Emissão</label>
          <input type="date" className="input" value={form.data_emissao}
            onChange={e => set('data_emissao', e.target.value)} />
        </div>
        <div>
          <label className="label">Data de Vencimento</label>
          <input type="date" className="input" value={form.data_vencimento}
            onChange={e => set('data_vencimento', e.target.value)} />
        </div>
      </div>

      <div>
        <label className="label">Observações</label>
        <textarea className="input resize-none" rows={3} value={form.observacoes}
          onChange={e => set('observacoes', e.target.value)} />
      </div>

      <div className="flex gap-3 pt-2">
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Salvando...' : licenca ? 'Salvar Alterações' : 'Cadastrar Licença'}
        </button>
      </div>
    </form>
  )
}
