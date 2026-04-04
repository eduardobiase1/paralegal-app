'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Certidao, Empresa } from '@/types'
import { formatDateInput } from '@/lib/utils'
import toast from 'react-hot-toast'

const TIPOS_CERTIDAO = [
  'CND Federal', 'CNDT Trabalhista', 'FGTS (CRF)', 'SEFAZ Estadual',
  'Certidão Municipal', 'CRDA', 'Dívida Ativa Municipal', 'Outro'
]

const ORGAOS = [
  'Receita Federal', 'TST', 'Caixa Econômica Federal', 'SEFAZ',
  'Prefeitura Municipal', 'Outros'
]

interface Props {
  empresas: Empresa[]
  certidao?: Certidao
  defaultEmpresaId?: string
  onSuccess: () => void
}

export default function CertidaoForm({ empresas, certidao, defaultEmpresaId, onSuccess }: Props) {
  const [supabase] = useState(createClient)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    empresa_id: certidao?.empresa_id ?? defaultEmpresaId ?? '',
    tipo: certidao?.tipo ?? '',
    orgao_emissor: certidao?.orgao_emissor ?? '',
    data_emissao: formatDateInput(certidao?.data_emissao),
    data_vencimento: formatDateInput(certidao?.data_vencimento),
    observacoes: certidao?.observacoes ?? '',
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
    if (certidao) {
      const res = await supabase.from('certidoes').update(payload).eq('id', certidao.id)
      error = res.error
    } else {
      const res = await supabase.from('certidoes').insert(payload)
      error = res.error
    }

    setLoading(false)
    if (error) { toast.error('Erro ao salvar: ' + error.message); return }
    toast.success(certidao ? 'Certidão atualizada!' : 'Certidão cadastrada!')
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
          <label className="label">Tipo *</label>
          <select className="input" required value={form.tipo}
            onChange={e => set('tipo', e.target.value)}>
            <option value="">Selecione...</option>
            {TIPOS_CERTIDAO.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Órgão Emissor *</label>
          <select className="input" required value={form.orgao_emissor}
            onChange={e => set('orgao_emissor', e.target.value)}>
            <option value="">Selecione...</option>
            {ORGAOS.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
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
          {loading ? 'Salvando...' : certidao ? 'Salvar Alterações' : 'Cadastrar Certidão'}
        </button>
      </div>
    </form>
  )
}
