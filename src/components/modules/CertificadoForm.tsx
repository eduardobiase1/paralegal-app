'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CertificadoDigital, Empresa } from '@/types'
import { formatDateInput } from '@/lib/utils'
import toast from 'react-hot-toast'

const ACS = ['Serasa', 'Certisign', 'Valid', 'Soluti', 'Safeweb', 'VRSafe', 'Outro']

interface Props {
  empresas: Empresa[]
  certificado?: CertificadoDigital
  defaultEmpresaId?: string
  onSuccess: () => void
}

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

export default function CertificadoForm({ empresas, certificado, defaultEmpresaId, onSuccess }: Props) {
  const [supabase] = useState(createClient)
  const [loading, setLoading] = useState(false)

  const modoInicial = certificado?.empresa_nome_livre ? 'avulsa' : 'cadastrada'
  const [modoEmpresa, setModoEmpresa] = useState<'cadastrada' | 'avulsa'>(modoInicial)

  const [form, setForm] = useState({
    empresa_id:             certificado?.empresa_id ?? defaultEmpresaId ?? '',
    empresa_nome_livre:     certificado?.empresa_nome_livre ?? '',
    empresa_cnpj_livre:     certificado?.empresa_cnpj_livre ?? '',
    titular:                certificado?.titular ?? '',
    tipo:                   certificado?.tipo ?? 'A1',
    uso:                    certificado?.uso ?? 'e-CNPJ',
    autoridade_certificadora: certificado?.autoridade_certificadora ?? '',
    data_emissao:           formatDateInput(certificado?.data_emissao),
    data_vencimento:        formatDateInput(certificado?.data_vencimento),
    localizacao_fisica:     certificado?.localizacao_fisica ?? '',
    observacoes:            certificado?.observacoes ?? '',
    // Controle do processo
    pagamento_confirmado:   certificado?.pagamento_confirmado ?? false,
    data_aviso_cliente:     (certificado as any)?.data_aviso_cliente ?? '',
    data_agendamento:       (certificado as any)?.data_agendamento
                              ? new Date((certificado as any).data_agendamento).toISOString().slice(0, 16)
                              : '',
    certificado_finalizado: (certificado as any)?.certificado_finalizado ?? false,
  })

  function set(field: string, value: any) {
    setForm(prev => ({ ...prev, [field]: value }))
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

    const payload: Record<string, any> = {
      titular:                  form.titular,
      tipo:                     form.tipo,
      uso:                      form.uso,
      autoridade_certificadora: form.autoridade_certificadora,
      data_emissao:             form.data_emissao || null,
      data_vencimento:          form.data_vencimento || null,
      localizacao_fisica:       form.tipo === 'A3' ? form.localizacao_fisica : null,
      observacoes:              form.observacoes || null,
      // Controle
      pagamento_confirmado:     form.pagamento_confirmado,
      data_aviso_cliente:       form.data_aviso_cliente || null,
      data_agendamento:         form.data_agendamento || null,
      certificado_finalizado:   form.certificado_finalizado,
    }

    if (modoEmpresa === 'cadastrada') {
      payload.empresa_id = form.empresa_id
      payload.empresa_nome_livre = null
      payload.empresa_cnpj_livre = null
    } else {
      payload.empresa_id = null
      payload.empresa_nome_livre = form.empresa_nome_livre.trim()
      payload.empresa_cnpj_livre = form.empresa_cnpj_livre.trim() || null
    }

    let error
    if (certificado) {
      const res = await supabase.from('certificados_digitais').update(payload).eq('id', certificado.id)
      error = res.error
    } else {
      const res = await supabase.from('certificados_digitais').insert(payload)
      error = res.error
    }

    setLoading(false)
    if (error) { toast.error('Erro ao salvar: ' + error.message); return }
    toast.success(certificado ? 'Certificado atualizado!' : 'Cadastrado com sucesso!')
    onSuccess()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">

      {/* Empresa */}
      <div>
        <label className="label mb-1.5">Empresa *</label>
        <div className="flex rounded-xl overflow-hidden border border-slate-200 mb-3">
          {[
            { v: 'cadastrada', label: '📋 Cliente da Base' },
            { v: 'avulsa',     label: '✍️ Empresa Avulsa' },
          ].map(opt => (
            <button type="button" key={opt.v}
              onClick={() => setModoEmpresa(opt.v as 'cadastrada' | 'avulsa')}
              className={`flex-1 py-2 text-xs font-bold transition-all ${
                modoEmpresa === opt.v ? 'bg-black text-yellow-400' : 'bg-white text-slate-500 hover:bg-slate-50'
              }`}>
              {opt.label}
            </button>
          ))}
        </div>

        {modoEmpresa === 'cadastrada' ? (
          <select className="input" value={form.empresa_id} onChange={e => set('empresa_id', e.target.value)}>
            <option value="">Selecione uma empresa...</option>
            {empresas.map(e => <option key={e.id} value={e.id}>{e.razao_social}</option>)}
          </select>
        ) : (
          <div className="space-y-2">
            <input className="input" placeholder="Nome / Razão Social *"
              value={form.empresa_nome_livre} onChange={e => set('empresa_nome_livre', e.target.value)} />
            <input className="input font-mono" placeholder="CNPJ (opcional)"
              value={form.empresa_cnpj_livre} onChange={e => set('empresa_cnpj_livre', e.target.value)} />
          </div>
        )}
      </div>

      {/* Titular */}
      <div>
        <label className="label">Titular *</label>
        <input className="input" required placeholder="Nome do titular do certificado"
          value={form.titular} onChange={e => set('titular', e.target.value)} />
      </div>

      {/* Tipo + Uso */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Tipo *</label>
          <select className="input" required value={form.tipo} onChange={e => set('tipo', e.target.value)}>
            <option value="A1">A1</option>
            <option value="A3">A3</option>
          </select>
        </div>
        <div>
          <label className="label">Uso *</label>
          <select className="input" required value={form.uso} onChange={e => set('uso', e.target.value)}>
            <option value="e-CNPJ">e-CNPJ</option>
            <option value="e-CPF">e-CPF</option>
            <option value="NF-e">NF-e</option>
            <option value="CT-e">CT-e</option>
            <option value="eSocial">eSocial</option>
            <option value="outro">Outro</option>
          </select>
        </div>
      </div>

      {/* AC */}
      <div>
        <label className="label">Autoridade Certificadora *</label>
        <select className="input" required value={form.autoridade_certificadora}
          onChange={e => set('autoridade_certificadora', e.target.value)}>
          <option value="">Selecione...</option>
          {ACS.map(ac => <option key={ac} value={ac}>{ac}</option>)}
        </select>
      </div>

      {/* Datas — opcionais, preencher após emissão */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">
            Data de Emissão
            <span className="ml-1 text-[9px] font-normal text-slate-400 normal-case">(preencher após emissão)</span>
          </label>
          <input type="date" className="input" value={form.data_emissao}
            onChange={e => set('data_emissao', e.target.value)} />
        </div>
        <div>
          <label className="label">
            Data de Vencimento
            <span className="ml-1 text-[9px] font-normal text-slate-400 normal-case">(preencher após emissão)</span>
          </label>
          <input type="date" className="input" value={form.data_vencimento}
            onChange={e => set('data_vencimento', e.target.value)} />
        </div>
      </div>

      {form.tipo === 'A3' && (
        <div>
          <label className="label">Localização Física *</label>
          <input className="input" required placeholder="Ex: Gaveta do Eduardo, Cofre da sala"
            value={form.localizacao_fisica} onChange={e => set('localizacao_fisica', e.target.value)} />
        </div>
      )}

      {/* ===== CONTROLE DO PROCESSO ===== */}
      <div className="border border-slate-200 rounded-2xl overflow-hidden">
        <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">📋 Controle do Processo de Renovação</p>
        </div>
        <div className="p-4 space-y-4">

          {/* Aviso ao cliente */}
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1.5">
              📧 Aviso Enviado ao Cliente
            </label>
            <div className="flex gap-2 items-center">
              <input type="date" className="input flex-1" value={form.data_aviso_cliente}
                onChange={e => set('data_aviso_cliente', e.target.value)} />
              <button type="button"
                onClick={() => set('data_aviso_cliente', todayISO())}
                className="flex-shrink-0 bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-2 rounded-xl text-xs font-bold transition-all">
                Hoje
              </button>
            </div>
          </div>

          {/* Pagamento */}
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1.5">
              💰 Pagamento pelo Cliente
            </label>
            <div className="flex gap-2">
              {[
                { v: false, label: 'Pendente',    cls: 'bg-amber-400 text-black border-amber-400' },
                { v: true,  label: '✓ Confirmado', cls: 'bg-emerald-500 text-white border-emerald-500' },
              ].map(opt => (
                <button type="button" key={String(opt.v)}
                  onClick={() => set('pagamento_confirmado', opt.v)}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold border-2 transition-all ${
                    form.pagamento_confirmado === opt.v
                      ? opt.cls
                      : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'
                  }`}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Agendamento de videoconferência */}
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1.5">
              🎥 Videoconferência Agendada
            </label>
            <input type="datetime-local" className="input w-full" value={form.data_agendamento}
              onChange={e => set('data_agendamento', e.target.value)} />
          </div>

          {/* Certificado emitido/finalizado */}
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1.5">
              ✅ Certificado Emitido / Finalizado
            </label>
            <div className="flex gap-2">
              {[
                { v: false, label: 'Não emitido ainda', cls: 'bg-slate-200 text-slate-600 border-slate-200' },
                { v: true,  label: '✓ Emitido e Finalizado', cls: 'bg-emerald-500 text-white border-emerald-500' },
              ].map(opt => (
                <button type="button" key={String(opt.v)}
                  onClick={() => set('certificado_finalizado', opt.v)}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold border-2 transition-all ${
                    form.certificado_finalizado === opt.v
                      ? opt.cls
                      : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'
                  }`}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* Observações */}
      <div>
        <label className="label">Observações</label>
        <textarea className="input resize-none" rows={2} value={form.observacoes}
          onChange={e => set('observacoes', e.target.value)} />
      </div>

      <div className="flex gap-3 pt-1">
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Salvando...' : certificado ? 'Salvar Alterações' : 'Cadastrar Certificado'}
        </button>
      </div>
    </form>
  )
}
