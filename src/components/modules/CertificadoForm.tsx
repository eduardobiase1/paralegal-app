'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CertificadoDigital, Empresa } from '@/types'
import { useOrg } from '@/lib/org-context'
import toast from 'react-hot-toast'
import { registrarAcao, diaLocal } from '@/lib/atividade'
import { mensagemCertificadora, enderecoEmpresa, valorCertificado } from '@/lib/certificadoMensagem'

// Colunas da migration_v16 — se ainda não existirem, salva sem elas
const COLUNAS_V16 = ['titular_email', 'titular_telefone', 'cliente_pagou_em']

const ACS = ['Serasa', 'Certisign', 'Valid', 'Soluti', 'Safeweb', 'VRSafe', 'Outro']

interface Props {
  empresas: Empresa[]
  certificado?: CertificadoDigital
  defaultEmpresaId?: string
  onSuccess: () => void
}

export default function CertificadoForm({ empresas, certificado, defaultEmpresaId, onSuccess }: Props) {
  const [supabase] = useState(createClient)
  const [loading, setLoading] = useState(false)
  const { orgId } = useOrg()

  const modoInicial = certificado?.empresa_nome_livre ? 'avulsa' : 'cadastrada'
  const [modoEmpresa, setModoEmpresa] = useState<'cadastrada' | 'avulsa'>(modoInicial)

  const [form, setForm] = useState({
    empresa_id:               certificado?.empresa_id ?? (defaultEmpresaId && defaultEmpresaId !== '__avulsa__' ? defaultEmpresaId : ''),
    empresa_nome_livre:       certificado?.empresa_nome_livre ?? '',
    empresa_cnpj_livre:       certificado?.empresa_cnpj_livre ?? '',
    titular:                  certificado?.titular ?? '',
    titular_email:            (certificado as any)?.titular_email ?? '',
    titular_telefone:         (certificado as any)?.titular_telefone ?? '',
    tipo:                     certificado?.tipo ?? 'A1',
    uso:                      certificado?.uso ?? 'e-CNPJ',
    autoridade_certificadora: certificado?.autoridade_certificadora ?? '',
    localizacao_fisica:       certificado?.localizacao_fisica ?? '',
    observacoes:              certificado?.observacoes ?? '',
  })

  function set(field: string, value: any) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const pessoaFisica = form.uso === 'e-CPF'
  const empresaSel: any = empresas.find(e => e.id === form.empresa_id)
  const mensagem = mensagemCertificadora({
    tipo: form.tipo,
    uso: form.uso,
    cnpj: modoEmpresa === 'cadastrada' ? empresaSel?.cnpj : form.empresa_cnpj_livre,
    razaoSocial: modoEmpresa === 'cadastrada' ? empresaSel?.razao_social : form.empresa_nome_livre,
    titular: form.titular,
    endereco: modoEmpresa === 'cadastrada' ? enderecoEmpresa(empresaSel) : '',
    email: form.titular_email,
    telefone: form.titular_telefone,
  })

  async function copiarMensagem() {
    try {
      await navigator.clipboard.writeText(mensagem)
      toast.success('Mensagem copiada: é só colar para a certificadora.')
    } catch {
      toast.error('Não foi possível copiar. Selecione o texto e copie manualmente.')
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (modoEmpresa === 'cadastrada' && !form.empresa_id) {
      toast.error('Selecione uma empresa'); return
    }
    if (modoEmpresa === 'avulsa' && !form.empresa_nome_livre.trim()) {
      toast.error('Informe o nome da empresa'); return
    }

    setLoading(true)

    // Datas de emissão e validade não entram aqui: são registradas na etapa "Certificado emitido"
    const payload: Record<string, any> = {
      titular:                  form.titular,
      titular_email:            form.titular_email.trim() || null,
      titular_telefone:         form.titular_telefone.trim() || null,
      tipo:                     form.tipo,
      uso:                      form.uso,
      autoridade_certificadora: form.autoridade_certificadora,
      localizacao_fisica:       form.tipo === 'A3' ? form.localizacao_fisica : null,
      observacoes:              form.observacoes || null,
    }

    if (modoEmpresa === 'cadastrada') {
      payload.empresa_id = form.empresa_id
      payload.empresa_nome_livre = null
      payload.empresa_cnpj_livre = null
      payload.org_id = null
    } else {
      payload.empresa_id = null
      payload.empresa_nome_livre = form.empresa_nome_livre.trim()
      payload.empresa_cnpj_livre = form.empresa_cnpj_livre.trim() || null
      payload.org_id = orgId
    }

    // Novo certificado = o cliente já pagou (primeiro passo do fluxo)
    if (!certificado) {
      payload.pagamento_confirmado = true
      payload.certificado_finalizado = false
      payload.cliente_pagou_em = diaLocal()
    }

    const gravar = (p: Record<string, any>) => certificado
      ? supabase.from('certificados_digitais').update(p).eq('id', certificado.id)
      : supabase.from('certificados_digitais').insert(p)

    let { error } = await gravar(payload)
    if (error && COLUNAS_V16.some(c => error!.message?.includes(c))) {
      const semNovas = Object.fromEntries(Object.entries(payload).filter(([k]) => !COLUNAS_V16.includes(k)))
      ;({ error } = await gravar(semNovas))
      if (!error) toast('Salvo sem e-mail/telefone — rode a migration_v16 no Supabase.')
    }

    setLoading(false)
    if (error) { toast.error('Erro ao salvar: ' + error.message); return }
    toast.success(certificado ? 'Certificado atualizado!' : 'Cadastrado com sucesso!')
    registrarAcao(certificado ? 'Atualização' : 'Cadastro', `Certificado digital ${certificado ? 'atualizado' : 'cadastrado'}`, { empresaId: payload.empresa_id ?? null })
    onSuccess()
  }

  const seg = (ativo: boolean) =>
    `flex-1 h-10 text-sm font-semibold transition-colors ${ativo ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 hover:bg-slate-50'}`

  return (
    <form onSubmit={handleSubmit} className="space-y-5">

      {/* Pessoa jurídica ou física */}
      <div>
        <span className="label">O certificado é de</span>
        <div className="flex rounded-lg overflow-hidden border border-slate-300" role="group" aria-label="Tipo de pessoa">
          <button type="button" aria-pressed={!pessoaFisica} className={seg(!pessoaFisica)}
            onClick={() => set('uso', form.uso === 'e-CPF' ? 'e-CNPJ' : form.uso)}>Pessoa jurídica (CNPJ)</button>
          <button type="button" aria-pressed={pessoaFisica} className={seg(pessoaFisica) + ' border-l border-slate-300'}
            onClick={() => set('uso', 'e-CPF')}>Pessoa física (CPF)</button>
        </div>
      </div>

      {/* Empresa */}
      <div>
        <span className="label">{pessoaFisica ? 'Empresa do cliente *' : 'Empresa *'}</span>
        <div className="flex rounded-lg overflow-hidden border border-slate-300 mb-3" role="group" aria-label="Origem da empresa">
          <button type="button" aria-pressed={modoEmpresa === 'cadastrada'} className={seg(modoEmpresa === 'cadastrada')}
            onClick={() => setModoEmpresa('cadastrada')}>Cliente da carteira</button>
          <button type="button" aria-pressed={modoEmpresa === 'avulsa'} className={seg(modoEmpresa === 'avulsa') + ' border-l border-slate-300'}
            onClick={() => setModoEmpresa('avulsa')}>Empresa avulsa</button>
        </div>

        {modoEmpresa === 'cadastrada' ? (
          <select className="input" aria-label="Empresa" value={form.empresa_id} onChange={e => set('empresa_id', e.target.value)}>
            <option value="">Selecione uma empresa...</option>
            {empresas.map(e => <option key={e.id} value={e.id}>{e.razao_social}</option>)}
          </select>
        ) : (
          <div className="space-y-2">
            <input className="input" aria-label="Nome ou razão social" placeholder="Nome / Razão Social *"
              value={form.empresa_nome_livre} onChange={e => set('empresa_nome_livre', e.target.value)} />
            <input className="input" aria-label="CNPJ" placeholder="CNPJ (opcional)"
              value={form.empresa_cnpj_livre} onChange={e => set('empresa_cnpj_livre', e.target.value)} />
          </div>
        )}
      </div>

      {/* Titular */}
      <div>
        <label className="label" htmlFor="cf-titular">Titular *</label>
        <input id="cf-titular" className="input" required placeholder="Nome do titular do certificado"
          value={form.titular} onChange={e => set('titular', e.target.value)} />
      </div>

      {/* E-mail e telefone que vão na mensagem para a certificadora */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="label" htmlFor="cf-email">E-mail</label>
          <input id="cf-email" className="input" type="email" placeholder="email@cliente.com.br"
            value={form.titular_email} onChange={e => set('titular_email', e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="cf-tel">Telefone</label>
          <input id="cf-tel" className="input" placeholder="(11) 90000-0000"
            value={form.titular_telefone} onChange={e => set('titular_telefone', e.target.value)} />
        </div>
      </div>

      {/* Tipo e certificadora */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <span className="label">Tipo *</span>
          <div className="flex rounded-lg overflow-hidden border border-slate-300" role="group" aria-label="Tipo do certificado">
            <button type="button" aria-pressed={form.tipo === 'A1'} className={seg(form.tipo === 'A1')} onClick={() => set('tipo', 'A1')}>A1 · 1 ano</button>
            <button type="button" aria-pressed={form.tipo === 'A3'} className={seg(form.tipo === 'A3') + ' border-l border-slate-300'} onClick={() => set('tipo', 'A3')}>A3 · 2 anos e 6 meses</button>
          </div>
        </div>
        <div>
          <label className="label" htmlFor="cf-ac">Autoridade certificadora *</label>
          <select id="cf-ac" className="input" required value={form.autoridade_certificadora}
            onChange={e => set('autoridade_certificadora', e.target.value)}>
            <option value="">Selecione...</option>
            {ACS.map(ac => <option key={ac} value={ac}>{ac}</option>)}
          </select>
        </div>
      </div>

      {form.tipo === 'A3' && (
        <div>
          <label className="label" htmlFor="cf-local">Localização física *</label>
          <input id="cf-local" className="input" required placeholder="Ex.: gaveta do Eduardo, cofre da sala"
            value={form.localizacao_fisica} onChange={e => set('localizacao_fisica', e.target.value)} />
        </div>
      )}

      {/* Mensagem para a certificadora, montada conforme o que foi escolhido acima */}
      <div className="border border-slate-200 rounded-lg overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-slate-50 border-b border-slate-200">
          <span className="text-sm font-semibold text-slate-900">Mensagem para a certificadora · valor R$ {valorCertificado(form.tipo, form.uso)}</span>
          <button type="button" onClick={copiarMensagem}
            className="h-8 px-3 rounded-md border border-slate-300 bg-white text-xs font-semibold text-slate-900 hover:bg-slate-50">Copiar</button>
        </div>
        <pre className="m-0 px-4 py-3 text-[0.8rem] leading-relaxed whitespace-pre-wrap font-mono text-slate-900">{mensagem}</pre>
      </div>

      {/* Observações */}
      <div>
        <label className="label" htmlFor="cf-obs">Observações</label>
        <textarea id="cf-obs" className="input resize-none" rows={2} value={form.observacoes}
          onChange={e => set('observacoes', e.target.value)} />
      </div>

      <p className="text-sm text-slate-600">
        As datas de emissão e de validade são registradas quando o certificado for concluído, na etapa “Certificado emitido”.
      </p>

      <div className="flex gap-3 pt-1">
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Salvando...' : certificado ? 'Salvar alterações' : 'Cadastrar certificado'}
        </button>
      </div>
    </form>
  )
}
