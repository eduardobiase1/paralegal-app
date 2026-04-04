'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Empresa } from '@/types'
import { buscarCEP, formatCNPJ, validateCNPJ } from '@/lib/utils'
import toast from 'react-hot-toast'

const UFS = ['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT',
             'PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO']

interface EmpresaFormProps {
  empresa?: Empresa
}

export default function EmpresaForm({ empresa }: EmpresaFormProps) {
  const router = useRouter()
  const [supabase] = useState(createClient)
  const isEdit = !!empresa

  const [loading, setLoading] = useState(false)
  const [buscandoCEP, setBuscandoCEP] = useState(false)
  const [form, setForm] = useState({
    razao_social: empresa?.razao_social ?? '',
    nome_fantasia: empresa?.nome_fantasia ?? '',
    cnpj: empresa?.cnpj ?? '',
    inscricao_estadual: empresa?.inscricao_estadual ?? '',
    inscricao_municipal: empresa?.inscricao_municipal ?? '',
    status: empresa?.status ?? 'ativa',
    cep: empresa?.cep ?? '',
    logradouro: empresa?.logradouro ?? '',
    numero: empresa?.numero ?? '',
    complemento: empresa?.complemento ?? '',
    bairro: empresa?.bairro ?? '',
    cidade: empresa?.cidade ?? '',
    uf: empresa?.uf ?? '',
    url_portal_alvara: empresa?.url_portal_alvara ?? '',
    url_certidao_municipal: empresa?.url_certidao_municipal ?? '',
    url_portal_visa: empresa?.url_portal_visa ?? '',
  })

  function set(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleCEP() {
    const cep = form.cep.replace(/\D/g, '')
    if (cep.length !== 8) return
    setBuscandoCEP(true)
    const result = await buscarCEP(cep)
    setBuscandoCEP(false)
    if (result) {
      setForm(prev => ({
        ...prev,
        logradouro: result.logradouro,
        bairro: result.bairro,
        cidade: result.localidade,
        uf: result.uf,
      }))
      toast.success('Endereço preenchido automaticamente')
    } else {
      toast.error('CEP não encontrado')
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const cnpjRaw = form.cnpj.replace(/\D/g, '')
    if (!validateCNPJ(cnpjRaw)) {
      toast.error('CNPJ inválido')
      return
    }

    setLoading(true)

    const payload = {
      ...form,
      cnpj: cnpjRaw,
      cep: form.cep.replace(/\D/g, ''),
    }

    let error
    if (isEdit) {
      const res = await supabase.from('empresas').update(payload).eq('id', empresa.id)
      error = res.error
    } else {
      const res = await supabase.from('empresas').insert(payload)
      error = res.error
    }

    setLoading(false)

    if (error) {
      if (error.code === '23505') {
        toast.error('CNPJ já cadastrado')
      } else {
        toast.error('Erro ao salvar: ' + error.message)
      }
      return
    }

    toast.success(isEdit ? 'Empresa atualizada!' : 'Empresa cadastrada!')
    router.push('/empresas')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-8">
      {/* Identificação */}
      <section>
        <h2 className="text-base font-semibold text-gray-900 mb-4 pb-2 border-b">Identificação</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="label">Razão Social *</label>
            <input className="input" required value={form.razao_social}
              onChange={e => set('razao_social', e.target.value)} />
          </div>
          <div>
            <label className="label">Nome Fantasia</label>
            <input className="input" value={form.nome_fantasia}
              onChange={e => set('nome_fantasia', e.target.value)} />
          </div>
          <div>
            <label className="label">CNPJ *</label>
            <input
              className="input font-mono"
              required
              placeholder="00.000.000/0000-00"
              value={form.cnpj}
              onChange={e => {
                const raw = e.target.value.replace(/\D/g, '').slice(0, 14)
                set('cnpj', formatCNPJ(raw))
              }}
            />
          </div>
          <div>
            <label className="label">Inscrição Estadual</label>
            <input className="input" value={form.inscricao_estadual}
              onChange={e => set('inscricao_estadual', e.target.value)} />
          </div>
          <div>
            <label className="label">Inscrição Municipal</label>
            <input className="input" value={form.inscricao_municipal}
              onChange={e => set('inscricao_municipal', e.target.value)} />
          </div>
          <div>
            <label className="label">Status</label>
            <select className="input" value={form.status} onChange={e => set('status', e.target.value)}>
              <option value="ativa">Ativa</option>
              <option value="inativa">Inativa</option>
              <option value="em_abertura">Em Abertura</option>
            </select>
          </div>
        </div>
      </section>

      {/* Endereço */}
      <section>
        <h2 className="text-base font-semibold text-gray-900 mb-4 pb-2 border-b">Endereço</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="label">CEP</label>
            <div className="flex gap-2">
              <input
                className="input"
                placeholder="00000-000"
                value={form.cep}
                onChange={e => {
                  const raw = e.target.value.replace(/\D/g, '').slice(0, 8)
                  const formatted = raw.length > 5 ? raw.slice(0,5) + '-' + raw.slice(5) : raw
                  set('cep', formatted)
                }}
                onBlur={handleCEP}
              />
              <button
                type="button"
                onClick={handleCEP}
                className="btn-secondary px-3 flex-shrink-0"
                disabled={buscandoCEP}
              >
                {buscandoCEP ? (
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                )}
              </button>
            </div>
          </div>
          <div className="md:col-span-2">
            <label className="label">Logradouro</label>
            <input className="input" value={form.logradouro}
              onChange={e => set('logradouro', e.target.value)} />
          </div>
          <div>
            <label className="label">Número</label>
            <input className="input" value={form.numero}
              onChange={e => set('numero', e.target.value)} />
          </div>
          <div>
            <label className="label">Complemento</label>
            <input className="input" value={form.complemento}
              onChange={e => set('complemento', e.target.value)} />
          </div>
          <div>
            <label className="label">Bairro</label>
            <input className="input" value={form.bairro}
              onChange={e => set('bairro', e.target.value)} />
          </div>
          <div>
            <label className="label">Cidade</label>
            <input className="input" value={form.cidade}
              onChange={e => set('cidade', e.target.value)} />
          </div>
          <div>
            <label className="label">UF</label>
            <select className="input" value={form.uf} onChange={e => set('uf', e.target.value)}>
              <option value="">Selecione</option>
              {UFS.map(uf => <option key={uf} value={uf}>{uf}</option>)}
            </select>
          </div>
        </div>
      </section>

      {/* URLs personalizadas */}
      <section>
        <h2 className="text-base font-semibold text-gray-900 mb-1 pb-2 border-b">Portais Municipais</h2>
        <p className="text-xs text-gray-500 mb-4">URLs dos portais específicos desta empresa para renovações e certidões municipais</p>
        <div className="grid grid-cols-1 gap-4">
          <div>
            <label className="label">Portal de Renovação de Alvará</label>
            <input className="input" type="url" placeholder="https://"
              value={form.url_portal_alvara}
              onChange={e => set('url_portal_alvara', e.target.value)} />
          </div>
          <div>
            <label className="label">Portal de Certidão Municipal</label>
            <input className="input" type="url" placeholder="https://"
              value={form.url_certidao_municipal}
              onChange={e => set('url_certidao_municipal', e.target.value)} />
          </div>
          <div>
            <label className="label">Portal VISA (Vigilância Sanitária)</label>
            <input className="input" type="url" placeholder="https://"
              value={form.url_portal_visa}
              onChange={e => set('url_portal_visa', e.target.value)} />
          </div>
        </div>
      </section>

      <div className="flex gap-3 pt-2">
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Salvando...' : isEdit ? 'Salvar Alterações' : 'Cadastrar Empresa'}
        </button>
        <button type="button" className="btn-secondary" onClick={() => router.back()}>
          Cancelar
        </button>
      </div>
    </form>
  )
}
