'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useOrg } from '@/lib/org-context'
import { Empresa } from '@/types'
import { buscarCEP, formatCNPJ, validateCNPJ } from '@/lib/utils'
import toast from 'react-hot-toast'

const UFS = ['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT',
             'PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO']

const NATUREZAS_JURIDICAS = [
  'Empresário Individual (EI)',
  'Empresa Individual de Responsabilidade Limitada (EIRELI)',
  'Sociedade Limitada (LTDA)',
  'Sociedade Limitada Unipessoal (SLU)',
  'Sociedade Anônima (S/A)',
  'Sociedade Simples',
  'Microempreendedor Individual (MEI)',
  'Associação',
  'Fundação',
  'Cooperativa',
  'Outro',
]

interface EmpresaFormProps {
  empresa?: Empresa
}

export default function EmpresaForm({ empresa }: EmpresaFormProps) {
  const router = useRouter()
  const { orgId } = useOrg()
  const [supabase] = useState(createClient)
  const isEdit = !!empresa

  const [loading, setLoading] = useState(false)
  const [buscandoCEP, setBuscandoCEP] = useState(false)
  const [form, setForm] = useState({
    // Identificação
    razao_social:         empresa?.razao_social ?? '',
    nome_fantasia:        empresa?.nome_fantasia ?? '',
    cnpj:                 empresa?.cnpj ?? '',
    inscricao_estadual:   empresa?.inscricao_estadual ?? '',
    inscricao_municipal:  empresa?.inscricao_municipal ?? '',
    status:               empresa?.status ?? 'ativa',
    // Endereço
    cep:                  empresa?.cep ?? '',
    logradouro:           empresa?.logradouro ?? '',
    numero:               empresa?.numero ?? '',
    complemento:          empresa?.complemento ?? '',
    bairro:               empresa?.bairro ?? '',
    cidade:               empresa?.cidade ?? '',
    uf:                   empresa?.uf ?? '',
    // Registro Junta
    nire:                 (empresa as any)?.nire ?? '',
    sessao_junta:         (empresa as any)?.sessao_junta ?? '',
    // Cartão CNPJ
    natureza_juridica:    (empresa as any)?.natureza_juridica ?? '',
    data_abertura:        (empresa as any)?.data_abertura ?? '',
    cnae_principal:       (empresa as any)?.cnae_principal ?? '',
    cnaes_secundarios_txt:((empresa as any)?.cnaes_secundarios ?? []).join('\n'),
    // Capital Social
    capital_social:       (empresa as any)?.capital_social ?? '',
    capital_quotas:       (empresa as any)?.capital_quotas ?? '',
    valor_quota:          (empresa as any)?.valor_quota ?? '1,00',
    // Contatos
    email:                (empresa as any)?.email ?? '',
    telefone:             (empresa as any)?.telefone ?? '',
    telefone2:            (empresa as any)?.telefone2 ?? '',
    // URLs
    url_portal_alvara:    empresa?.url_portal_alvara ?? '',
    url_certidao_municipal: empresa?.url_certidao_municipal ?? '',
    url_portal_visa:      empresa?.url_portal_visa ?? '',
  })

  function set(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const isEmAbertura = form.status === 'em_abertura'

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

    // CNPJ obrigatório apenas quando não for "Em Abertura"
    if (!isEmAbertura) {
      if (!cnpjRaw) {
        toast.error('CNPJ é obrigatório para empresas ativas ou inativas')
        return
      }
      if (!validateCNPJ(cnpjRaw)) {
        toast.error('CNPJ inválido')
        return
      }
    }

    setLoading(true)

    // Processa CNAEs secundários (um por linha)
    const cnaes_secundarios = form.cnaes_secundarios_txt
      .split('\n')
      .map((s: string) => s.trim())
      .filter(Boolean)

    const payload: Record<string, any> = {
      razao_social:        form.razao_social,
      nome_fantasia:       form.nome_fantasia,
      cnpj:                cnpjRaw || null,
      inscricao_estadual:  form.inscricao_estadual,
      inscricao_municipal: form.inscricao_municipal,
      status:              form.status,
      cep:                 form.cep.replace(/\D/g, ''),
      logradouro:          form.logradouro,
      numero:              form.numero,
      complemento:         form.complemento,
      bairro:              form.bairro,
      cidade:              form.cidade,
      uf:                  form.uf,
      nire:                form.nire,
      sessao_junta:        form.sessao_junta,
      natureza_juridica:   form.natureza_juridica,
      data_abertura:       form.data_abertura || null,
      cnae_principal:      form.cnae_principal,
      cnaes_secundarios,
      capital_social:      form.capital_social,
      capital_quotas:      form.capital_quotas,
      valor_quota:         form.valor_quota,
      email:               form.email,
      telefone:            form.telefone,
      telefone2:           form.telefone2,
      url_portal_alvara:   form.url_portal_alvara,
      url_certidao_municipal: form.url_certidao_municipal,
      url_portal_visa:     form.url_portal_visa,
    }

    // Vincula à organização apenas no insert (não sobrescreve no update)
    if (!isEdit) {
      payload.org_id = orgId
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

      {/* ── Identificação ─────────────────────────────────────────────────────── */}
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
            <label className="label">Status</label>
            <select className="input" value={form.status} onChange={e => set('status', e.target.value)}>
              <option value="ativa">Ativa</option>
              <option value="inativa">Inativa</option>
              <option value="em_abertura">Em Abertura</option>
            </select>
          </div>
          <div>
            <label className="label">
              CNPJ {isEmAbertura ? <span className="text-gray-400 text-xs ml-1">(opcional em abertura)</span> : '*'}
            </label>
            <input
              className="input font-mono"
              required={!isEmAbertura}
              placeholder={isEmAbertura ? 'Ainda não disponível' : '00.000.000/0000-00'}
              value={form.cnpj}
              onChange={e => {
                const raw = e.target.value.replace(/\D/g, '').slice(0, 14)
                set('cnpj', formatCNPJ(raw))
              }}
            />
            {isEmAbertura && (
              <p className="text-xs text-amber-600 mt-1">Empresa em abertura — CNPJ pode ser preenchido após registro.</p>
            )}
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
        </div>
      </section>

      {/* ── Cartão CNPJ ───────────────────────────────────────────────────────── */}
      <section>
        <h2 className="text-base font-semibold text-gray-900 mb-4 pb-2 border-b">Dados do Cartão CNPJ</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="label">Natureza Jurídica</label>
            <select className="input" value={form.natureza_juridica} onChange={e => set('natureza_juridica', e.target.value)}>
              <option value="">Selecione</option>
              {NATUREZAS_JURIDICAS.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Data de Abertura</label>
            <input className="input" type="date" value={form.data_abertura}
              onChange={e => set('data_abertura', e.target.value)} />
          </div>
          <div>
            <label className="label">CNAE Principal</label>
            <input className="input" placeholder="Ex: 6920-6/01 — Atividades de contabilidade"
              value={form.cnae_principal}
              onChange={e => set('cnae_principal', e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <label className="label">CNAEs Secundários</label>
            <textarea
              className="input resize-none h-20 text-sm"
              placeholder={"Um CNAE por linha:\n6920-6/02 — Atividades de assessoria\n7020-4/00 — Consultoria em gestão empresarial"}
              value={form.cnaes_secundarios_txt}
              onChange={e => set('cnaes_secundarios_txt', e.target.value)}
            />
            <p className="text-xs text-gray-400 mt-1">Um CNAE por linha. Estes valores alimentam o campo objeto_social nos contratos.</p>
          </div>
        </div>
      </section>

      {/* ── Capital Social ────────────────────────────────────────────────────── */}
      <section>
        <h2 className="text-base font-semibold text-gray-900 mb-4 pb-2 border-b">Capital Social</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="label">Capital Social (R$)</label>
            <input className="input" placeholder="Ex: 10.000,00"
              value={form.capital_social}
              onChange={e => set('capital_social', e.target.value)} />
          </div>
          <div>
            <label className="label">Quantidade de Quotas</label>
            <input className="input" placeholder="Ex: 10.000"
              value={form.capital_quotas}
              onChange={e => set('capital_quotas', e.target.value)} />
          </div>
          <div>
            <label className="label">Valor por Quota (R$)</label>
            <input className="input" placeholder="Ex: 1,00"
              value={form.valor_quota}
              onChange={e => set('valor_quota', e.target.value)} />
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-2">Esses valores alimentam automaticamente as tags dos contratos (capital_social_extenso, capital_quotas_extenso etc.).</p>
      </section>

      {/* ── Contatos ──────────────────────────────────────────────────────────── */}
      <section>
        <h2 className="text-base font-semibold text-gray-900 mb-4 pb-2 border-b">Contatos</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <label className="label">E-mail</label>
            <input className="input" type="email" placeholder="contato@empresa.com.br"
              value={form.email}
              onChange={e => set('email', e.target.value)} />
          </div>
          <div>
            <label className="label">Telefone Principal</label>
            <input className="input" placeholder="(11) 99999-9999"
              value={form.telefone}
              onChange={e => set('telefone', e.target.value)} />
          </div>
          <div>
            <label className="label">Telefone Secundário</label>
            <input className="input" placeholder="(11) 3333-4444"
              value={form.telefone2}
              onChange={e => set('telefone2', e.target.value)} />
          </div>
        </div>
      </section>

      {/* ── Endereço ──────────────────────────────────────────────────────────── */}
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

      {/* ── Registro na Junta ─────────────────────────────────────────────────── */}
      <section>
        <h2 className="text-base font-semibold text-gray-900 mb-4 pb-2 border-b">Registro na Junta Comercial</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="label">NIRE</label>
            <input className="input font-mono" placeholder="Ex: 35123456789"
              value={form.nire}
              onChange={e => set('nire', e.target.value)} />
          </div>
          <div>
            <label className="label">Sessão (Registro na Junta)</label>
            <input className="input" placeholder="Ex: 3ª Sessão Ordinária de 2024"
              value={form.sessao_junta}
              onChange={e => set('sessao_junta', e.target.value)} />
          </div>
        </div>
      </section>

      {/* ── URLs personalizadas ───────────────────────────────────────────────── */}
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
