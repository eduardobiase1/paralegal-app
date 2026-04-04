'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Alvara, Empresa } from '@/types'
import { formatDateInput } from '@/lib/utils'
import toast from 'react-hot-toast'

interface Props {
  empresas: Empresa[]
  alvara?: Alvara
  defaultEmpresaId?: string
  onSuccess: () => void
}

export default function AlvaraForm({ empresas, alvara, defaultEmpresaId, onSuccess }: Props) {
  const [supabase] = useState(createClient)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    empresa_id: alvara?.empresa_id ?? defaultEmpresaId ?? '',
    tipo: alvara?.tipo ?? 'fixo',
    orgao_emissor: alvara?.orgao_emissor ?? '',
    numero: alvara?.numero ?? '',
    data_emissao: formatDateInput(alvara?.data_emissao),
    data_vencimento: formatDateInput(alvara?.data_vencimento),
    observacoes: alvara?.observacoes ?? '',
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
    if (alvara) {
      const res = await supabase.from('alvaras').update(payload).eq('id', alvara.id)
      error = res.error
    } else {
      const res = await supabase.from('alvaras').insert(payload)
      error = res.error
    }

    setLoading(false)
    if (error) { toast.error('Erro ao salvar: ' + error.message); return }
    toast.success(alvara ? 'Alvará atualizado!' : 'Alvará cadastrado!')
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
            <option value="fixo">Fixo</option>
            <option value="temporario">Temporário</option>
            <option value="provisorio">Provisório</option>
          </select>
        </div>
        <div>
          <label className="label">Órgão Emissor *</label>
          <input className="input" required placeholder="Ex: Prefeitura Municipal" value={form.orgao_emissor}
            onChange={e => set('orgao_emissor', e.target.value)} />
        </div>
      </div>

      <div>
        <label className="label">Número do Alvará</label>
        <input className="input font-mono" placeholder="000/0000" value={form.numero}
          onChange={e => set('numero', e.target.value)} />
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
          {loading ? 'Salvando...' : alvara ? 'Salvar Alterações' : 'Cadastrar Alvará'}
        </button>
      </div>
    </form>
  )
}
