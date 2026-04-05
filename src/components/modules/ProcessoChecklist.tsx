'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ProcessoSocietario, ProcessoEtapa, Profile, TimerLogEntry } from '@/types'
import { TIPO_PROCESSO_LABELS, StatusEtapa } from '@/types'
import { formatDate } from '@/lib/utils'
import toast from 'react-hot-toast'
import Link from 'next/link'

// ─── Cores por status ────────────────────────────────────────────────────────

const STATUS_CARD: Record<string, string> = {
  pendente:           'border-gray-200 bg-white',
  em_andamento:       'border-blue-300 bg-blue-50',
  concluido:          'border-green-300 bg-green-50',
  aguardando_cliente: 'border-yellow-300 bg-yellow-50',
  em_exigencia:       'border-orange-400 bg-orange-50',
}

const STATUS_BADGE: Record<string, string> = {
  pendente:           'bg-gray-100 text-gray-600',
  em_andamento:       'bg-blue-100 text-blue-700',
  concluido:          'bg-green-100 text-green-700',
  aguardando_cliente: 'bg-yellow-100 text-yellow-700',
  em_exigencia:       'bg-orange-100 text-orange-700 font-semibold',
}

const STATUS_CIRCLE: Record<string, string> = {
  pendente:           'bg-gray-200 text-gray-600',
  em_andamento:       'bg-blue-500 text-white',
  concluido:          'bg-green-500 text-white',
  aguardando_cliente: 'bg-yellow-500 text-white',
  em_exigencia:       'bg-orange-500 text-white',
}

const STATUS_LABELS: Record<string, string> = {
  pendente:           'Pendente',
  em_andamento:       'Em Andamento',
  concluido:          'Concluído',
  aguardando_cliente: 'Aguard. Cliente',
  em_exigencia:       'Em Exigência',
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function diasNaFase(timerLog?: TimerLogEntry[]): number | null {
  if (!timerLog || timerLog.length === 0) return null
  const last = timerLog[timerLog.length - 1]
  const ms = Date.now() - new Date(last.timestamp).getTime()
  return Math.max(0, Math.floor(ms / 86_400_000))
}

function today() { return new Date().toISOString().split('T')[0] }

function slaInfo(previsao?: string, status?: string) {
  if (!previsao) return null
  const diff = Math.ceil((new Date(previsao).getTime() - new Date(today()).getTime()) / 86_400_000)
  const vencido = diff < 0 && status !== 'concluido'
  return { diff, vencido }
}

// ─── Checklist de Documentos Templates ──────────────────────────────────────

const DOCS_TEMPLATES: Record<string, { doc: string; obrigatorio: boolean }[]> = {
  abertura: [
    { doc: 'RG e CPF de todos os sócios (cópias autenticadas)', obrigatorio: true },
    { doc: 'Comprovante de residência dos sócios (até 90 dias)', obrigatorio: true },
    { doc: 'Comprovante de endereço da sede (IPTU ou conta de luz)', obrigatorio: true },
    { doc: 'Minuta do Contrato Social assinada', obrigatorio: true },
    { doc: 'DBE — Documento Básico de Entrada (Receita Federal)', obrigatorio: true },
    { doc: 'Formulário de cadastro da Junta Comercial', obrigatorio: true },
    { doc: 'Procuração (se houver representante)', obrigatorio: false },
    { doc: 'IPTU da sede (para uso exclusivo ou compartilhado)', obrigatorio: false },
    { doc: 'Declaração de desimpedimento dos sócios', obrigatorio: false },
  ],
  alteracao_contratual: [
    { doc: 'RG e CPF dos sócios envolvidos', obrigatorio: true },
    { doc: 'Minuta da Alteração Contratual assinada', obrigatorio: true },
    { doc: 'Contrato Social consolidado vigente', obrigatorio: true },
    { doc: 'Certidão de situação fiscal (se exigido)', obrigatorio: false },
    { doc: 'Comprovante do novo endereço (se alteração de sede)', obrigatorio: false },
    { doc: 'Autorização dos sócios (ata ou assembleia)', obrigatorio: false },
  ],
  encerramento: [
    { doc: 'RG e CPF dos sócios', obrigatorio: true },
    { doc: 'Minuta do Distrato Social assinada', obrigatorio: true },
    { doc: 'Certidão Negativa de Débitos — Receita Federal', obrigatorio: true },
    { doc: 'Certidão Negativa de Débitos — Estadual (SEFAZ)', obrigatorio: true },
    { doc: 'Certidão Negativa Municipal (ISS)', obrigatorio: true },
    { doc: 'CRF — Certificado de Regularidade do FGTS', obrigatorio: true },
    { doc: 'Baixa do CNPJ na Receita Federal', obrigatorio: true },
    { doc: 'DARF de encerramento (se aplicável)', obrigatorio: false },
    { doc: 'Distrato de contratos de aluguel / locação', obrigatorio: false },
  ],
  transferencia_entrada: [
    { doc: 'RG e CPF do novo sócio', obrigatorio: true },
    { doc: 'Comprovante de residência do novo sócio', obrigatorio: true },
    { doc: 'Contrato/Instrumento de Cessão de Quotas', obrigatorio: true },
    { doc: 'Minuta de Alteração Contratual assinada', obrigatorio: true },
    { doc: 'Certidão de situação fiscal do cedente', obrigatorio: false },
  ],
  transferencia_saida: [
    { doc: 'RG e CPF do sócio retirante', obrigatorio: true },
    { doc: 'Contrato/Instrumento de Cessão de Quotas', obrigatorio: true },
    { doc: 'Minuta de Alteração Contratual assinada', obrigatorio: true },
    { doc: 'Ata de reunião de sócios', obrigatorio: false },
    { doc: 'Certidão de situação fiscal do cessionário', obrigatorio: false },
  ],
}

// ─── Props ───────────────────────────────────────────────────────────────────

interface DocItem {
  id: string
  documento: string
  recebido: boolean
  observacao: string
  obrigatorio: boolean
}

interface Props {
  processo: ProcessoSocietario & { empresa?: { razao_social: string; cnpj: string } }
  etapas: ProcessoEtapa[]
  profiles: Pick<Profile, 'id' | 'nome'>[]
}

// ─── Componente principal ────────────────────────────────────────────────────

export default function ProcessoChecklist({ processo, etapas: initialEtapas }: Props) {
  const [supabase] = useState(createClient)
  const [etapas, setEtapas] = useState<ProcessoEtapa[]>(initialEtapas)
  const [processoStatus, setProcessoStatus] = useState(processo.status)
  const [previsao, setPrevisao] = useState(processo.data_previsao_entrega ?? '')
  const [saving, setSaving] = useState<string | null>(null)
  const [uploading, setUploading] = useState<string | null>(null)

  // Checklist de Documentos
  const [docs, setDocs] = useState<DocItem[]>([])
  const [docsLoaded, setDocsLoaded] = useState(false)
  const [savingDoc, setSavingDoc] = useState<string | null>(null)

  const concluidas = etapas.filter(e => e.status === 'concluido').length
  const total = etapas.length
  const progresso = total > 0 ? Math.round((concluidas / total) * 100) : 0
  const temExigencia = etapas.some(e => e.status === 'em_exigencia')
  const sla = slaInfo(previsao, processoStatus)

  const barColor = temExigencia
    ? 'bg-orange-500'
    : progresso === 100 ? 'bg-green-500' : 'bg-primary-600'

  // ── Carregar Checklist de Documentos ──────────────────────────────────────

  useEffect(() => {
    async function loadDocs() {
      const { data } = await supabase
        .from('checklist_documentos')
        .select('*')
        .eq('processo_id', processo.id)
        .order('created_at')
      if (data && data.length > 0) {
        setDocs(data as DocItem[])
      } else {
        const template = DOCS_TEMPLATES[processo.tipo] ?? []
        if (template.length === 0) { setDocsLoaded(true); return }
        const inserts = template.map(t => ({
          processo_id:  processo.id,
          documento:    t.doc,
          obrigatorio:  t.obrigatorio,
          recebido:     false,
          observacao:   '',
        }))
        const { data: created } = await supabase.from('checklist_documentos').insert(inserts).select()
        setDocs((created ?? []) as DocItem[])
      }
      setDocsLoaded(true)
    }
    loadDocs()
  }, [processo.id])

  async function toggleDoc(doc: DocItem) {
    const recebido = !doc.recebido
    setSavingDoc(doc.id)
    await supabase.from('checklist_documentos').update({ recebido }).eq('id', doc.id)
    setDocs(prev => prev.map(d => d.id === doc.id ? { ...d, recebido } : d))
    setSavingDoc(null)
  }

  async function saveDocObs(doc: DocItem, observacao: string) {
    await supabase.from('checklist_documentos').update({ observacao }).eq('id', doc.id)
    setDocs(prev => prev.map(d => d.id === doc.id ? { ...d, observacao } : d))
  }

  // ── Ações ──────────────────────────────────────────────────────────────────

  async function saveEtapa(id: string, updates: Partial<ProcessoEtapa>) {
    setSaving(id)
    const { error } = await supabase
      .from('processo_etapas')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) toast.error('Erro ao salvar etapa')
    else setEtapas(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e))
    setSaving(null)
  }

  async function handleStatusChange(etapa: ProcessoEtapa, newStatus: string) {
    const timerLog: TimerLogEntry[] = [
      ...(etapa.timer_log ?? []),
      { status: newStatus, timestamp: new Date().toISOString() },
    ]
    await saveEtapa(etapa.id, {
      status: newStatus as StatusEtapa,
      timer_log: timerLog,
      data_conclusao: newStatus === 'concluido' ? today() : undefined,
    })
  }

  async function handlePrevisao(date: string) {
    setPrevisao(date)
    await supabase
      .from('processos_societarios')
      .update({ data_previsao_entrega: date || null })
      .eq('id', processo.id)
  }

  async function handleProcessoStatus(status: string) {
    const { error } = await supabase
      .from('processos_societarios')
      .update({ status, data_conclusao: status === 'concluido' ? today() : null })
      .eq('id', processo.id)
    if (error) { toast.error('Erro ao atualizar status'); return }
    setProcessoStatus(status as any)
    toast.success('Status atualizado!')
  }

  async function handleUpload(etapa: ProcessoEtapa, file: File) {
    setUploading(etapa.id)
    const ext = file.name.split('.').pop()
    const path = `societario/${processo.id}/${etapa.id}_${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('certidoes-docs').upload(path, file, { upsert: true })
    if (error) { toast.error('Erro no upload'); setUploading(null); return }
    const { data: urlData } = supabase.storage.from('certidoes-docs').getPublicUrl(path)
    await saveEtapa(etapa.id, { arquivo_url: urlData.publicUrl, arquivo_nome: file.name })
    toast.success('Arquivo enviado!')
    setUploading(null)
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 max-w-4xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
        <Link href="/societario" className="hover:text-primary-600">Módulo Societário</Link>
        <span>/</span>
        <span className="text-gray-900">{processo.empresa?.razao_social}</span>
      </div>

      {/* Header card */}
      <div className="card mb-6">
        <div className="card-body">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h1 className="text-xl font-bold text-gray-900 truncate">{processo.empresa?.razao_social}</h1>
                <span className="text-sm px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-medium whitespace-nowrap">
                  {TIPO_PROCESSO_LABELS[processo.tipo]}
                </span>
                {temExigencia && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 font-semibold whitespace-nowrap">
                    ⚠ Em Exigência
                  </span>
                )}
              </div>
              {processo.titulo && <p className="text-sm text-gray-600">{processo.titulo}</p>}
              <p className="text-xs text-gray-400 mt-1">Aberto em {formatDate(processo.data_abertura)}</p>
            </div>

            {/* Controles direita */}
            <div className="flex items-center gap-3 flex-wrap">
              {/* SLA */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-gray-500">Previsão:</span>
                <input
                  type="date"
                  className={`text-xs border rounded-lg px-2 py-1 ${sla?.vencido ? 'border-red-400 text-red-600 bg-red-50' : 'border-gray-200 bg-white'}`}
                  value={previsao}
                  onChange={e => handlePrevisao(e.target.value)}
                />
                {sla && !sla.vencido && (
                  <span className="text-xs text-gray-400">{sla.diff}d restantes</span>
                )}
                {sla?.vencido && (
                  <span className="text-xs font-semibold text-red-600">Atrasado!</span>
                )}
              </div>

              {/* Status O.S. */}
              <select
                className="input text-sm w-44"
                value={processoStatus}
                onChange={e => handleProcessoStatus(e.target.value)}
              >
                <option value="em_andamento">Em Andamento</option>
                <option value="em_exigencia">Em Exigência</option>
                <option value="concluido">Concluído</option>
                <option value="cancelado">Cancelado</option>
              </select>
            </div>
          </div>

          {/* Barra de progresso */}
          <div className="mt-4">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-600">Progresso</span>
              <span className="font-medium text-gray-900">{concluidas}/{total} etapas ({progresso}%)</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${progresso}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* ── Checklist de Documentos ── */}
      {docsLoaded && docs.length > 0 && (
        <div className="card mb-6">
          <div className="card-header flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-gray-900">Checklist de Documentos</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {docs.filter(d => d.recebido).length}/{docs.length} documentos recebidos
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-24 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-green-500 transition-all"
                  style={{ width: `${Math.round((docs.filter(d => d.recebido).length / docs.length) * 100)}%` }}
                />
              </div>
              <span className="text-xs text-gray-500">
                {Math.round((docs.filter(d => d.recebido).length / docs.length) * 100)}%
              </span>
            </div>
          </div>
          <div className="divide-y">
            {docs.map(doc => (
              <DocCheckItem
                key={doc.id}
                doc={doc}
                saving={savingDoc === doc.id}
                onToggle={() => toggleDoc(doc)}
                onSaveObs={obs => saveDocObs(doc, obs)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Checklist */}
      <div className="space-y-3">
        <h2 className="text-base font-semibold text-gray-900">Checklist de Etapas</h2>
        {etapas.map(etapa => (
          <EtapaCard
            key={etapa.id}
            etapa={etapa}
            empresaNome={processo.empresa?.razao_social ?? ''}
            processoId={processo.id}
            saving={saving === etapa.id}
            uploading={uploading === etapa.id}
            onStatusChange={s => handleStatusChange(etapa, s)}
            onSaveField={(f, v) => saveEtapa(etapa.id, { [f]: v } as any)}
            onUpload={file => handleUpload(etapa, file)}
          />
        ))}
      </div>
    </div>
  )
}

// ─── EtapaCard ───────────────────────────────────────────────────────────────

interface EtapaCardProps {
  etapa: ProcessoEtapa
  empresaNome: string
  processoId: string
  saving: boolean
  uploading: boolean
  onStatusChange: (s: string) => void
  onSaveField: (field: string, value: any) => void
  onUpload: (file: File) => void
}

function EtapaCard({ etapa, empresaNome, saving, uploading, onStatusChange, onSaveField, onUpload }: EtapaCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [obsInterna, setObsInterna] = useState(etapa.observacao_interna ?? '')
  const [obsExterna, setObsExterna] = useState(etapa.observacao_externa ?? '')
  const [protocolo, setProtocolo] = useState(etapa.numero_protocolo ?? '')

  const dias = diasNaFase(etapa.timer_log)
  const cardCls  = STATUS_CARD[etapa.status]   ?? STATUS_CARD.pendente
  const badgeCls = STATUS_BADGE[etapa.status]  ?? STATUS_BADGE.pendente
  const circCls  = STATUS_CIRCLE[etapa.status] ?? STATUS_CIRCLE.pendente
  const hasObs   = !!(etapa.observacao_interna || etapa.observacao_externa)

  return (
    <div className={`border-2 rounded-xl p-4 transition-all ${cardCls}`}>
      {/* Linha principal */}
      <div className="flex items-start gap-3">
        {/* Círculo numerado */}
        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5 ${circCls}`}>
          {etapa.status === 'concluido' ? (
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          ) : etapa.status === 'em_exigencia' ? '!' : etapa.ordem}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-gray-900">{etapa.nome}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full ${badgeCls}`}>
              {STATUS_LABELS[etapa.status] ?? etapa.status}
            </span>
            {dias !== null && (
              <span className="flex items-center gap-1 text-xs text-gray-400">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {dias === 0 ? 'Hoje' : `${dias}d nesta fase`}
              </span>
            )}
          </div>
          {etapa.data_conclusao && (
            <p className="text-xs text-gray-400 mt-0.5">Concluído em {formatDate(etapa.data_conclusao)}</p>
          )}
        </div>

        {/* Select de status */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <select
            className="text-xs border rounded-lg px-2 py-1 bg-white"
            value={etapa.status}
            disabled={saving}
            onChange={e => onStatusChange(e.target.value)}
          >
            <option value="pendente">Pendente</option>
            <option value="em_andamento">Em Andamento</option>
            <option value="concluido">Concluído</option>
            <option value="aguardando_cliente">Aguard. Cliente</option>
            <option value="em_exigencia">Em Exigência</option>
          </select>
          {saving && (
            <svg className="animate-spin w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          )}
        </div>
      </div>

      {/* Ações especiais */}
      <div className="mt-3 ml-10 space-y-2">

        {/* ── Etapa 2: Minuta ── */}
        {etapa.ordem === 2 && (
          <div className="flex items-center gap-2 flex-wrap">
            {/* Upload */}
            <label className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border cursor-pointer transition-colors
              ${uploading ? 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'
                         : 'border-gray-200 bg-white text-gray-600 hover:border-blue-300 hover:text-blue-600'}`}>
              {uploading ? (
                <>
                  <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                  </svg>
                  Enviando...
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  Upload Minuta
                </>
              )}
              <input type="file" className="hidden" accept=".pdf,.docx,.doc" disabled={uploading}
                onChange={e => e.target.files?.[0] && onUpload(e.target.files[0])} />
            </label>

            {/* Arquivo enviado */}
            {etapa.arquivo_url && (
              <a href={etapa.arquivo_url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-green-200 bg-green-50 text-green-700 hover:bg-green-100">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                {etapa.arquivo_nome ?? 'Ver arquivo'}
              </a>
            )}

            {/* Gerar Minuta */}
            <Link href="/contratos"
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Gerar Minuta
            </Link>
          </div>
        )}

        {/* ── Etapa 3: Assinatura / WhatsApp ── */}
        {etapa.ordem === 3 && (
          <div className="flex items-center gap-2 flex-wrap">
            <a
              href={`https://api.whatsapp.com/send?text=${encodeURIComponent(`Olá, a minuta da ${empresaNome} está pronta para assinatura. Podemos ajudar?`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-green-300 bg-green-50 text-green-700 hover:bg-green-100"
            >
              {/* WhatsApp icon */}
              <svg className="w-4 h-4 fill-green-600" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              Enviar WhatsApp
            </a>
          </div>
        )}

        {/* ── Etapa 4: Registro / Protocolo ── */}
        {etapa.ordem === 4 && (
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-500 whitespace-nowrap">Nº Protocolo:</span>
              <input
                className="text-xs border rounded-lg px-2 py-1 bg-white w-36"
                placeholder="Ex: 123456/2024"
                value={protocolo}
                onChange={e => setProtocolo(e.target.value)}
                onBlur={() => {
                  if (protocolo !== (etapa.numero_protocolo ?? ''))
                    onSaveField('numero_protocolo', protocolo)
                }}
              />
            </div>
            <a href="https://www.jucesponline.sp.gov.br" target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-600 hover:border-blue-300 hover:text-blue-600">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              JUCESP Online
            </a>
            <a href="https://www.redesim.gov.br" target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-600 hover:border-blue-300 hover:text-blue-600">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              REDESIM
            </a>
          </div>
        )}

        {/* Botão expandir observações */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 mt-1"
        >
          <svg className={`w-3 h-3 transition-transform ${expanded ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          {hasObs ? 'Ver observações' : 'Adicionar observação'}
          {hasObs && <span className="w-1.5 h-1.5 rounded-full bg-blue-400 ml-0.5" />}
        </button>
      </div>

      {/* Painel de observações */}
      {expanded && (
        <div className="mt-3 ml-10 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="flex items-center gap-1 text-xs font-medium text-gray-500 mb-1">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              Obs. Interna
            </label>
            <textarea
              className="input text-xs resize-none h-16"
              placeholder="Visível apenas internamente..."
              value={obsInterna}
              onChange={e => setObsInterna(e.target.value)}
              onBlur={() => {
                if (obsInterna !== (etapa.observacao_interna ?? ''))
                  onSaveField('observacao_interna', obsInterna)
              }}
            />
          </div>
          <div>
            <label className="flex items-center gap-1 text-xs font-medium text-gray-500 mb-1">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              Obs. Externa (cliente)
            </label>
            <textarea
              className="input text-xs resize-none h-16"
              placeholder="Comunicação com o cliente..."
              value={obsExterna}
              onChange={e => setObsExterna(e.target.value)}
              onBlur={() => {
                if (obsExterna !== (etapa.observacao_externa ?? ''))
                  onSaveField('observacao_externa', obsExterna)
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

// ─── DocCheckItem ─────────────────────────────────────────────────────────────

interface DocCheckItemProps {
  doc: DocItem
  saving: boolean
  onToggle: () => void
  onSaveObs: (obs: string) => void
}

function DocCheckItem({ doc, saving, onToggle, onSaveObs }: DocCheckItemProps) {
  const [obs, setObs] = useState(doc.observacao ?? '')
  const [expanded, setExpanded] = useState(false)

  return (
    <div className={`px-5 py-3 transition-colors ${doc.recebido ? 'bg-green-50' : ''}`}>
      <div className="flex items-start gap-3">
        <button
          onClick={onToggle}
          disabled={saving}
          className={`mt-0.5 w-5 h-5 rounded flex-shrink-0 border-2 flex items-center justify-center transition-colors ${
            doc.recebido
              ? 'bg-green-500 border-green-500 text-white'
              : 'border-gray-300 hover:border-green-400'
          }`}
        >
          {doc.recebido && (
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className={`text-sm ${doc.recebido ? 'line-through text-gray-400' : 'text-gray-900'}`}>
              {doc.documento}
            </p>
            {doc.obrigatorio && !doc.recebido && (
              <span className="text-xs px-1.5 py-0.5 bg-red-100 text-red-600 rounded flex-shrink-0">Obrigatório</span>
            )}
          </div>
          {doc.observacao && !expanded && (
            <p className="text-xs text-gray-500 mt-0.5">{doc.observacao}</p>
          )}
          {expanded && (
            <input
              className="input text-xs mt-1"
              placeholder="Observação (ex: enviado por e-mail em 10/04)"
              value={obs}
              onChange={e => setObs(e.target.value)}
              onBlur={() => onSaveObs(obs)}
            />
          )}
        </div>
        <button
          onClick={() => setExpanded(p => !p)}
          className="text-gray-400 hover:text-gray-600 flex-shrink-0 p-1"
          title="Adicionar observação"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </button>
      </div>
    </div>
  )
}
