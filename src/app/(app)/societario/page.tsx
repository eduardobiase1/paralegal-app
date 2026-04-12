'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useOrg } from '@/lib/org-context'
import toast from 'react-hot-toast'

// ─── Mapeamento tipo DB → label de exibição ───────────────────────────────────

const TIPO_LABELS: Record<string, string> = {
  abertura: 'Abertura',
  alteracao_contratual: 'Alteração Contratual',
  encerramento: 'Encerramento',
  transferencia_entrada: 'Transferência (Entrada)',
  transferencia_saida: 'Transferência (Saída)',
}

// ─── Etapas (documentos) por tipo de processo ────────────────────────────────

const MODELOS_PROCESSOS: Record<string, { etapa: string; status: string }[]> = {
  abertura: [
    // ── Documentos do Cliente ──
    { etapa: 'RG / CNH (frente e verso) — todos os sócios', status: 'Pendente' },
    { etapa: 'CPF — todos os sócios', status: 'Pendente' },
    { etapa: 'Comprovante de Residência — sócios (máx. 90 dias)', status: 'Pendente' },
    { etapa: 'Certidão de Estado Civil — sócios', status: 'Pendente' },
    { etapa: 'IPTU do Imóvel (sede da empresa)', status: 'Pendente' },
    { etapa: 'Contrato de Locação do Imóvel (ou Escritura de Propriedade)', status: 'Pendente' },
    { etapa: 'Conta de Energia ou Água do Imóvel', status: 'Pendente' },
    { etapa: 'Definição da Atividade (CNAE) — acordado com o cliente', status: 'Pendente' },
    { etapa: 'Definição do Capital Social', status: 'Pendente' },
    { etapa: 'Nome Empresarial — aprovado pelo cliente', status: 'Pendente' },
    // ── Etapas Institucionais ──
    { etapa: 'Consulta de Viabilidade (Uso do Solo) — emitida', status: 'Pendente' },
    { etapa: 'Busca de Nome — JUCESP aprovada', status: 'Pendente' },
    { etapa: 'Busca de Nome — INPI verificado', status: 'Pendente' },
    { etapa: 'Contrato Social — minuta aprovada e assinada pelos sócios', status: 'Pendente' },
    { etapa: 'DBE — Receita Federal protocolado', status: 'Pendente' },
    { etapa: 'VRE — JUCESP protocolado', status: 'Pendente' },
    { etapa: 'Taxa de Registro — JUCESP paga', status: 'Pendente' },
    { etapa: 'CNPJ — emitido', status: 'Pendente' },
    { etapa: 'Inscrição Estadual — emitida (se aplicável)', status: 'Pendente' },
    { etapa: 'Alvará de Funcionamento — Prefeitura emitido', status: 'Pendente' },
    { etapa: 'Inscrição Municipal (ISS) — emitida', status: 'Pendente' },
    { etapa: 'Certificado de Licenciamento Integrado — emitido', status: 'Pendente' },
    { etapa: 'Licença Sanitária VISA — emitida (se aplicável)', status: 'Pendente' },
    { etapa: 'Opção pelo Simples Nacional — solicitada (se aplicável)', status: 'Pendente' },
    { etapa: 'Cadastro FGTS — realizado', status: 'Pendente' },
    { etapa: 'Procuração Eletrônica — emitida', status: 'Pendente' },
    { etapa: 'Certificado Digital A-1 PJ — informado ao cliente', status: 'Pendente' },
    { etapa: 'Contrato de Prestação de Serviços — assinado', status: 'Pendente' },
    { etapa: 'Todos os documentos entregues ao cliente por e-mail', status: 'Pendente' },
  ],
  alteracao_contratual: [
    // ── Documentos do Cliente ──
    { etapa: 'Contrato Social original (última versão registrada)', status: 'Pendente' },
    { etapa: 'RG / CNH — sócios envolvidos na alteração', status: 'Pendente' },
    { etapa: 'CPF — sócios envolvidos na alteração', status: 'Pendente' },
    { etapa: 'Comprovante de Residência — sócios (máx. 90 dias)', status: 'Pendente' },
    { etapa: 'Certidão de Estado Civil — sócios (se alteração de quadro societário)', status: 'Pendente' },
    { etapa: 'IPTU ou Contrato de Locação — novo endereço (se mudança de sede)', status: 'Pendente' },
    { etapa: 'Conta de Energia do novo imóvel (se mudança de sede)', status: 'Pendente' },
    { etapa: 'Instrumento de Cessão de Quotas — assinado (se transferência de quotas)', status: 'Pendente' },
    { etapa: 'Comprovante de pagamento das quotas (se cessão onerosa)', status: 'Pendente' },
    { etapa: 'Declaração de ITCMD ou comprovante de isenção (se cessão)', status: 'Pendente' },
    // ── Etapas Institucionais ──
    { etapa: 'Consulta de Viabilidade — novo endereço (se mudança de sede)', status: 'Pendente' },
    { etapa: 'Busca de Nome JUCESP (se alteração de razão social)', status: 'Pendente' },
    { etapa: 'Minuta de Alteração Contratual — aprovada e assinada', status: 'Pendente' },
    { etapa: 'DBE Atualizado — Receita Federal protocolado', status: 'Pendente' },
    { etapa: 'VRE — JUCESP protocolado', status: 'Pendente' },
    { etapa: 'Taxa de Registro — JUCESP paga', status: 'Pendente' },
    { etapa: 'Inscrições atualizadas — Municipal e Estadual', status: 'Pendente' },
    { etapa: 'Novo Alvará de Funcionamento (se mudança de endereço ou atividade)', status: 'Pendente' },
    { etapa: 'Procuração Eletrônica atualizada (se necessário)', status: 'Pendente' },
    { etapa: 'Todos os documentos registrados entregues ao cliente', status: 'Pendente' },
  ],
  encerramento: [
    // ── Documentos do Cliente ──
    { etapa: 'Contrato Social original (última versão registrada)', status: 'Pendente' },
    { etapa: 'RG / CNH e CPF — todos os sócios', status: 'Pendente' },
    { etapa: 'Comprovante de Residência — todos os sócios', status: 'Pendente' },
    { etapa: 'Distrato Social — assinado por todos os sócios', status: 'Pendente' },
    // ── Certidões e Regularidade ──
    { etapa: 'Certidão Negativa de Débitos — Receita Federal (CND Federal)', status: 'Pendente' },
    { etapa: 'Certidão Negativa de Débitos — Estadual', status: 'Pendente' },
    { etapa: 'Certidão Negativa de Débitos — Municipal', status: 'Pendente' },
    { etapa: 'Certidão de Regularidade do FGTS — CRF', status: 'Pendente' },
    { etapa: 'Certidão Negativa Trabalhista — CNDT', status: 'Pendente' },
    // ── Baixas ──
    { etapa: 'Baixa SIMPLES Nacional — solicitada (se optante)', status: 'Pendente' },
    { etapa: 'Baixa ICMS / Inscrição Estadual — concluída', status: 'Pendente' },
    { etapa: 'Baixa ISS / Inscrição Municipal — concluída', status: 'Pendente' },
    { etapa: 'Baixa INSS — concluída', status: 'Pendente' },
    { etapa: 'Baixa FGTS — concluída', status: 'Pendente' },
    { etapa: 'Taxa de Baixa — JUCESP paga', status: 'Pendente' },
    { etapa: 'Protocolo de Baixa — JUCESP registrado', status: 'Pendente' },
    { etapa: 'Baixa do CNPJ — Receita Federal concluída', status: 'Pendente' },
    { etapa: 'Comprovantes de encerramento entregues ao cliente', status: 'Pendente' },
  ],
  transferencia_entrada: [
    // ── Documentos do Sócio Entrante ──
    { etapa: 'RG / CNH (frente e verso) — sócio entrante', status: 'Pendente' },
    { etapa: 'CPF — sócio entrante', status: 'Pendente' },
    { etapa: 'Comprovante de Residência — sócio entrante (máx. 90 dias)', status: 'Pendente' },
    { etapa: 'Certidão de Estado Civil — sócio entrante', status: 'Pendente' },
    // ── Documentos da Operação ──
    { etapa: 'Contrato Social vigente (última versão)', status: 'Pendente' },
    { etapa: 'Instrumento de Cessão de Quotas — assinado pelas partes', status: 'Pendente' },
    { etapa: 'Comprovante de pagamento das quotas (se cessão onerosa)', status: 'Pendente' },
    { etapa: 'Declaração de ITCMD ou comprovante de isenção', status: 'Pendente' },
    // ── Etapas Institucionais ──
    { etapa: 'Minuta de Alteração Contratual (Transferência) — aprovada e assinada', status: 'Pendente' },
    { etapa: 'DBE Atualizado — Receita Federal protocolado', status: 'Pendente' },
    { etapa: 'VRE — JUCESP protocolado', status: 'Pendente' },
    { etapa: 'Taxa de Registro — JUCESP paga', status: 'Pendente' },
    { etapa: 'Documentos registrados entregues ao cliente', status: 'Pendente' },
  ],
  transferencia_saida: [
    // ── Documentos do Sócio Sainte ──
    { etapa: 'RG / CNH (frente e verso) — sócio sainte', status: 'Pendente' },
    { etapa: 'CPF — sócio sainte', status: 'Pendente' },
    { etapa: 'Comprovante de Residência — sócio sainte (máx. 90 dias)', status: 'Pendente' },
    { etapa: 'Certidão de Estado Civil — sócio sainte', status: 'Pendente' },
    // ── Documentos da Operação ──
    { etapa: 'Contrato Social vigente (última versão)', status: 'Pendente' },
    { etapa: 'Instrumento de Cessão de Quotas — assinado pelas partes', status: 'Pendente' },
    { etapa: 'Comprovante de pagamento das quotas (se cessão onerosa)', status: 'Pendente' },
    { etapa: 'Declaração de ITCMD ou comprovante de isenção', status: 'Pendente' },
    // ── Etapas Institucionais ──
    { etapa: 'Minuta de Alteração Contratual (Retirada) — aprovada e assinada', status: 'Pendente' },
    { etapa: 'DBE Atualizado — Receita Federal protocolado', status: 'Pendente' },
    { etapa: 'VRE — JUCESP protocolado', status: 'Pendente' },
    { etapa: 'Taxa de Registro — JUCESP paga', status: 'Pendente' },
    { etapa: 'Documentos registrados entregues ao cliente', status: 'Pendente' },
  ],
}

const STATUS_CYCLE: Record<string, string> = {
  Pendente: 'Andamento', Andamento: 'Concluido', Concluido: 'Pendente',
}

function getStatusColor(status: string) {
  if (status === 'Concluido') return 'bg-emerald-500 border-emerald-600 text-white'
  if (status === 'Andamento') return 'bg-blue-500 border-blue-600 text-white'
  return 'bg-white border-slate-200 text-slate-400'
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function SocietarioPage() {
  const { orgId, orgName, role } = useOrg()
  const isViewer = role === 'viewer'
  const [supabase] = useState(createClient())
  const [processos, setProcessos] = useState<any[]>([])
  const [empresas, setEmpresas] = useState<any[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editingItem, setEditingItem] = useState<{ procId: string; index: number } | null>(null)
  const [editText, setEditText] = useState('')
  const [addingTo, setAddingTo] = useState<string | null>(null)
  const [newItemText, setNewItemText] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<'todos' | 'Andamento' | 'Finalizado'>('Andamento')
  const [editingTituloId, setEditingTituloId] = useState<string | null>(null)
  const [tituloText, setTituloText] = useState('')
  const [notas, setNotas] = useState<Record<string, any[]>>({})
  const [notaInput, setNotaInput] = useState<Record<string, string>>({})
  const [savingNota, setSavingNota] = useState(false)

  const [formData, setFormData] = useState({ empresa_id: '', cliente_nome: '', tipo: 'abertura', titulo: '' })

  const fetchData = useCallback(async () => {
    setLoading(true)
    const { data: proc } = await supabase
      .from('processos_societarios')
      .select('*, empresas(razao_social)')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
    const { data: emp } = await supabase.from('empresas').select('id, razao_social').order('razao_social')
    setProcessos(proc || [])
    setEmpresas(emp || [])
    setLoading(false)
  }, [supabase, orgId])

  useEffect(() => { if (orgId) fetchData() }, [orgId, fetchData])

  // ── Iniciar processo ──────────────────────────────────────────────────────

  async function handleIniciar(e: React.FormEvent) {
    e.preventDefault()
    if (!formData.empresa_id && !formData.cliente_nome.trim())
      return toast.error('Selecione uma empresa ou informe o nome do cliente.')

    const checklist = MODELOS_PROCESSOS[formData.tipo] ?? []
    const payload: any = {
      org_id: orgId,
      tipo: formData.tipo,
      checklist,
      status: 'Andamento',
      titulo: formData.titulo.trim() || null,
    }
    if (formData.empresa_id) payload.empresa_id = formData.empresa_id
    else payload.cliente_nome = formData.cliente_nome.trim()

    const { data, error } = await supabase.from('processos_societarios').insert([payload]).select().single()
    if (!error && data) {
      toast.success('Processo iniciado!')
      setIsModalOpen(false)
      setFormData({ empresa_id: '', cliente_nome: '', tipo: 'abertura', titulo: '' })
      setExpandedId(data.id)
      fetchData()
    } else {
      toast.error(`Erro: ${error?.message}`)
    }
  }

  // ── Salvar título / O.S. ──────────────────────────────────────────────────

  async function saveTitulo(procId: string) {
    await supabase.from('processos_societarios').update({ titulo: tituloText.trim() || null }).eq('id', procId)
    setProcessos(prev => prev.map(p => p.id === procId ? { ...p, titulo: tituloText.trim() || null } : p))
    setEditingTituloId(null)
  }

  // ── Notas / Anotações ────────────────────────────────────────────────────

  async function loadNotas(procId: string) {
    const { data } = await supabase
      .from('processo_notas')
      .select('*')
      .eq('processo_id', procId)
      .order('created_at', { ascending: false })
    setNotas(prev => ({ ...prev, [procId]: data || [] }))
  }

  async function addNota(procId: string) {
    const texto = (notaInput[procId] || '').trim()
    if (!texto) return
    setSavingNota(true)
    const { data, error } = await supabase
      .from('processo_notas')
      .insert([{ processo_id: procId, org_id: orgId, texto }])
      .select()
      .single()
    if (!error && data) {
      setNotas(prev => ({ ...prev, [procId]: [data, ...(prev[procId] || [])] }))
      setNotaInput(prev => ({ ...prev, [procId]: '' }))
    } else {
      toast.error('Erro ao salvar anotação.')
    }
    setSavingNota(false)
  }

  async function deleteNota(notaId: string, procId: string) {
    await supabase.from('processo_notas').delete().eq('id', notaId)
    setNotas(prev => ({ ...prev, [procId]: (prev[procId] || []).filter(n => n.id !== notaId) }))
  }

  // ── Ciclar etapa ──────────────────────────────────────────────────────────

  async function updateEtapa(procId: string, checklist: any[], index: number) {
    const updated = [...checklist]
    updated[index] = { ...updated[index], status: STATUS_CYCLE[updated[index].status] ?? 'Pendente' }
    const concluidos = updated.filter(i => i.status === 'Concluido').length
    const novoStatus = concluidos === updated.length ? 'Finalizado' : 'Andamento'
    await supabase.from('processos_societarios').update({ checklist: updated, status: novoStatus }).eq('id', procId)
    setProcessos(prev => prev.map(p => p.id === procId ? { ...p, checklist: updated, status: novoStatus } : p))
  }

  async function saveEditItem(procId: string, checklist: any[]) {
    if (!editingItem || !editText.trim()) { setEditingItem(null); return }
    const updated = [...checklist]
    updated[editingItem.index] = { ...updated[editingItem.index], etapa: editText.trim() }
    await supabase.from('processos_societarios').update({ checklist: updated }).eq('id', procId)
    setProcessos(prev => prev.map(p => p.id === procId ? { ...p, checklist: updated } : p))
    setEditingItem(null)
  }

  async function deleteItem(procId: string, checklist: any[], index: number) {
    const updated = checklist.filter((_, i) => i !== index)
    await supabase.from('processos_societarios').update({ checklist: updated }).eq('id', procId)
    setProcessos(prev => prev.map(p => p.id === procId ? { ...p, checklist: updated } : p))
  }

  async function addItem(procId: string, checklist: any[]) {
    if (!newItemText.trim()) { setAddingTo(null); return }
    const updated = [...checklist, { etapa: newItemText.trim(), status: 'Pendente' }]
    await supabase.from('processos_societarios').update({ checklist: updated }).eq('id', procId)
    setProcessos(prev => prev.map(p => p.id === procId ? { ...p, checklist: updated } : p))
    setNewItemText('')
    setAddingTo(null)
  }

  async function deleteProcesso(id: string) {
    if (!confirm('Excluir este processo?')) return
    await supabase.from('processos_societarios').delete().eq('id', id)
    setProcessos(prev => prev.filter(p => p.id !== id))
    if (expandedId === id) setExpandedId(null)
    toast.success('Processo excluído.')
  }

  // ── Filtro ────────────────────────────────────────────────────────────────

  const processosFiltrados = processos.filter(p =>
    filtroStatus === 'todos' ? true : p.status === filtroStatus
  )

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-4 md:p-8 bg-[#F8FAFC] min-h-screen font-sans text-slate-900">

      {/* Cabeçalho */}
      <header className="flex flex-wrap justify-between items-center gap-3 mb-6 md:mb-8">
        <div>
          <h1 className="text-2xl font-black italic tracking-tighter uppercase">
            PARALEGAL PRO <span className="text-yellow-500">| SOCIETÁRIO</span>
          </h1>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{orgName}</p>
        </div>
        {isViewer ? (
          <span className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-700 px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wide">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            Modo Visualização
          </span>
        ) : (
          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-black text-yellow-400 px-8 py-3 rounded-2xl font-bold text-xs shadow-xl hover:scale-105 transition-all"
          >
            + NOVO PROCESSO
          </button>
        )}
      </header>

      {/* Filtros de status */}
      <div className="flex flex-wrap gap-2 mb-6">
        {([['Andamento', 'Em Andamento'], ['Finalizado', 'Finalizados'], ['todos', 'Todos']] as const).map(([val, label]) => (
          <button
            key={val}
            onClick={() => setFiltroStatus(val)}
            className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wide transition-all whitespace-nowrap ${
              filtroStatus === val
                ? 'bg-black text-yellow-400'
                : 'bg-white text-slate-400 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {label}
            <span className="ml-1.5 opacity-60">
              ({val === 'todos' ? processos.length : processos.filter(p => p.status === val).length})
            </span>
          </button>
        ))}
      </div>

      {loading && <p className="text-slate-400 text-sm italic">Carregando processos...</p>}

      {/* ── Lista de processos ── */}
      <div className="space-y-3">
        {processosFiltrados.map(p => {
          const checklist: any[] = p.checklist ?? []
          const concluido = checklist.filter(i => i.status === 'Concluido').length
          const total = checklist.length || 1
          const porc = Math.round((concluido / total) * 100)
          const nomeExibido = p.empresas?.razao_social || p.cliente_nome || '—'
          const isOpen = expandedId === p.id

          return (
            <div key={p.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

              {/* Linha de resumo — clicável */}
              <div className="w-full">
                <button
                  onClick={() => {
                    const next = isOpen ? null : p.id
                    setExpandedId(next)
                    if (next && !notas[next]) loadNotas(next)
                  }}
                  className="w-full flex flex-col px-4 md:px-6 py-4 hover:bg-slate-50 transition-colors text-left gap-2"
                >
                  {/* Linha 1: badge + nome + seta */}
                  <div className="flex items-center gap-2">
                    <span className={`text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-wide flex-shrink-0 ${
                      p.status === 'Finalizado' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {TIPO_LABELS[p.tipo] ?? p.tipo}
                    </span>
                    <span className="font-black text-slate-800 text-sm flex-1 min-w-0 truncate">{nomeExibido}</span>
                    <span className={`text-slate-300 transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`}>▼</span>
                  </div>

                  {/* Linha 2: barra de progresso */}
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${porc === 100 ? 'bg-emerald-400' : 'bg-yellow-400'}`}
                        style={{ width: `${porc}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-black text-slate-400 flex-shrink-0">{porc}% · {concluido}/{total} etapas</span>
                  </div>

                </button>

                {/* Título / O.S. editável (sempre visível abaixo do card) */}
                <div className="px-4 md:px-6 pb-3 flex items-center gap-2" onClick={e => e.stopPropagation()}>
                  {isViewer ? (
                    p.titulo ? (
                      <span className="text-xs font-bold bg-yellow-50 text-yellow-700 border border-yellow-200 rounded-lg px-3 py-1">
                        {p.titulo}
                      </span>
                    ) : null
                  ) : editingTituloId === p.id ? (
                    <div className="flex items-center gap-2 flex-1">
                      <input
                        autoFocus
                        value={tituloText}
                        onChange={e => setTituloText(e.target.value)}
                        onBlur={() => saveTitulo(p.id)}
                        onKeyDown={e => { if (e.key === 'Enter') saveTitulo(p.id); if (e.key === 'Escape') setEditingTituloId(null) }}
                        placeholder="Ex: O.S. 001/2026 — Abertura Padaria Central"
                        className="flex-1 text-xs border-2 border-yellow-400 rounded-lg px-3 py-1.5 outline-none bg-yellow-50 font-medium"
                      />
                      <button onClick={() => saveTitulo(p.id)} className="bg-yellow-400 text-black text-[10px] font-black px-3 py-1.5 rounded-lg">OK</button>
                      <button onClick={() => setEditingTituloId(null)} className="text-slate-400 text-[10px] px-2 py-1.5">✕</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setTituloText(p.titulo || ''); setEditingTituloId(p.id) }}
                      className={`text-xs font-bold rounded-lg px-3 py-1 transition-all ${
                        p.titulo
                          ? 'bg-yellow-50 text-yellow-700 border border-yellow-200 hover:bg-yellow-100'
                          : 'text-slate-300 hover:text-yellow-500 border border-dashed border-slate-200 hover:border-yellow-300'
                      }`}
                    >
                      {p.titulo ? `✎ ${p.titulo}` : '+ Definir O.S. / Título'}
                    </button>
                  )}
                </div>
              </div>

              {/* Checklist expandido */}
              {isOpen && (
                <div className="border-t border-slate-100 px-6 pb-6 pt-4">
                  {/* Header da seção de etapas */}
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Etapas do Processo</h3>
                    {!isViewer && (
                      <button
                        onClick={() => deleteProcesso(p.id)}
                        className="text-[10px] text-red-300 hover:text-red-500 font-bold transition-colors"
                      >
                        Excluir processo
                      </button>
                    )}
                  </div>

                  {/* Progresso compacto */}
                  <div className="flex items-center gap-3 mb-4 p-3 bg-slate-50 rounded-xl">
                    <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${porc === 100 ? 'bg-emerald-400' : 'bg-yellow-400'}`}
                        style={{ width: `${porc}%` }}
                      />
                    </div>
                    <span className="text-xs font-black text-slate-500 flex-shrink-0">{concluido}/{total} concluídas</span>
                  </div>

                  {/* Lista vertical de etapas */}
                  <div className="flex flex-col">
                    {checklist.map((item: any, i: number) => (
                      <div
                        key={i}
                        className={`group flex items-center gap-3 py-2.5 px-3 rounded-xl transition-colors hover:bg-slate-50 ${
                          i < checklist.length - 1 ? 'border-b border-slate-100' : ''
                        }`}
                      >
                        {/* Número */}
                        <span className="text-[10px] font-bold text-slate-300 w-5 text-right flex-shrink-0 select-none">{i + 1}</span>

                        {/* Botão de status (círculo colorido) */}
                        <button
                          onClick={() => !isViewer && updateEtapa(p.id, checklist, i)}
                          title={isViewer ? item.status : `Clique para avançar: ${item.status}`}
                          disabled={isViewer}
                          className={`w-5 h-5 rounded-full border-2 flex-shrink-0 transition-all ${!isViewer ? 'hover:scale-110 cursor-pointer' : 'cursor-default'} ${
                            item.status === 'Concluido'
                              ? 'bg-emerald-500 border-emerald-500'
                              : item.status === 'Andamento'
                              ? 'bg-blue-500 border-blue-500'
                              : 'bg-white border-slate-300'
                          }`}
                        >
                          {item.status === 'Concluido' && (
                            <svg className="w-3 h-3 text-white mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                          {item.status === 'Andamento' && (
                            <span className="block w-1.5 h-1.5 bg-white rounded-full mx-auto" />
                          )}
                        </button>

                        {/* Texto da etapa ou input de edição */}
                        {editingItem !== null && editingItem.procId === p.id && editingItem.index === i ? (
                          <div className="flex flex-1 gap-2">
                            <input
                              autoFocus
                              value={editText}
                              onChange={e => setEditText(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') saveEditItem(p.id, checklist); if (e.key === 'Escape') setEditingItem(null) }}
                              className="flex-1 border-2 border-yellow-400 rounded-lg px-2 py-1 text-sm outline-none"
                            />
                            <button onClick={() => saveEditItem(p.id, checklist)} className="bg-yellow-400 text-black text-xs font-black px-3 py-1 rounded-lg">OK</button>
                            <button onClick={() => setEditingItem(null)} className="bg-slate-100 text-slate-500 text-xs px-2 py-1 rounded-lg">✕</button>
                          </div>
                        ) : (
                          <span
                            onClick={() => !isViewer && updateEtapa(p.id, checklist, i)}
                            className={`flex-1 text-sm transition-colors ${!isViewer ? 'cursor-pointer select-none' : 'cursor-default select-text'} ${
                              item.status === 'Concluido'
                                ? 'line-through text-slate-400'
                                : item.status === 'Andamento'
                                ? 'text-blue-700 font-medium'
                                : 'text-slate-700'
                            }`}
                          >
                            {item.etapa}
                          </span>
                        )}

                        {/* Badge de status — visível no hover */}
                        {editingItem === null && (
                          <span className={`hidden group-hover:inline-flex items-center text-[9px] font-black px-2 py-0.5 rounded-full flex-shrink-0 ${
                            item.status === 'Concluido' ? 'bg-emerald-100 text-emerald-700' :
                            item.status === 'Andamento' ? 'bg-blue-100 text-blue-700' :
                            'bg-slate-100 text-slate-400'
                          }`}>
                            {item.status}
                          </span>
                        )}

                        {/* Ações — visíveis no hover (apenas para não-viewers) */}
                        {!isViewer && editingItem === null && (
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                            <button
                              onClick={() => { setEditingItem({ procId: p.id, index: i }); setEditText(item.etapa) }}
                              className="w-6 h-6 bg-yellow-100 hover:bg-yellow-400 text-yellow-600 hover:text-black rounded-full text-[10px] font-black flex items-center justify-center transition-all"
                            >✎</button>
                            <button
                              onClick={() => deleteItem(p.id, checklist, i)}
                              className="w-6 h-6 bg-red-50 hover:bg-red-400 text-red-400 hover:text-white rounded-full text-[10px] font-black flex items-center justify-center transition-all"
                            >✕</button>
                          </div>
                        )}
                      </div>
                    ))}

                    {/* Adicionar nova etapa (apenas para não-viewers) */}
                    {!isViewer && (addingTo === p.id ? (
                      <div className="flex items-center gap-2 mt-2 px-3">
                        <span className="w-5 flex-shrink-0" />
                        <span className="w-5 flex-shrink-0" />
                        <input
                          autoFocus
                          value={newItemText}
                          onChange={e => setNewItemText(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') addItem(p.id, checklist); if (e.key === 'Escape') { setAddingTo(null); setNewItemText('') } }}
                          placeholder="Nome da nova etapa..."
                          className="flex-1 border-2 border-yellow-400 rounded-lg px-3 py-2 text-sm outline-none"
                        />
                        <button onClick={() => addItem(p.id, checklist)} className="bg-yellow-400 text-black text-xs font-black px-3 py-2 rounded-lg">Adicionar</button>
                        <button onClick={() => { setAddingTo(null); setNewItemText('') }} className="bg-slate-100 text-slate-500 text-xs px-2 py-2 rounded-lg">✕</button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setAddingTo(p.id)}
                        className="mt-2 mx-3 py-2 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 hover:border-yellow-400 hover:text-yellow-500 transition-all text-sm font-bold"
                      >+ Adicionar Etapa</button>
                    ))}
                  </div>

                  {/* ── Anotações / Andamento ── */}
                  <div className="mt-6 border-t border-slate-100 pt-5">
                    <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-4">Anotações do Processo</h3>

                    {/* Input para nova anotação (apenas para não-viewers) */}
                    {!isViewer && (
                      <div className="flex flex-col sm:flex-row gap-2 mb-4">
                        <textarea
                          rows={2}
                          value={notaInput[p.id] || ''}
                          onChange={e => setNotaInput(prev => ({ ...prev, [p.id]: e.target.value }))}
                          onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) addNota(p.id) }}
                          placeholder="Registre o que aconteceu, o que foi feito, próximos passos... (Ctrl+Enter para salvar)"
                          className="flex-1 border-2 border-slate-200 focus:border-yellow-400 rounded-xl px-3 py-2 text-sm outline-none resize-none"
                        />
                        <button
                          onClick={() => addNota(p.id)}
                          disabled={savingNota || !(notaInput[p.id] || '').trim()}
                          className="bg-black text-yellow-400 px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wide disabled:opacity-40 hover:bg-slate-800 transition-all sm:self-start sm:mt-0 whitespace-nowrap"
                        >
                          Registrar
                        </button>
                      </div>
                    )}

                    {/* Feed de notas */}
                    <div className="space-y-2">
                      {!notas[p.id] ? (
                        <p className="text-xs text-slate-400 italic">Carregando...</p>
                      ) : notas[p.id].length === 0 ? (
                        <p className="text-xs text-slate-400 italic">Nenhuma anotação ainda.</p>
                      ) : notas[p.id].map((nota: any) => (
                        <div key={nota.id} className="group flex gap-3 bg-slate-50 rounded-xl px-4 py-3 border border-slate-100">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-slate-700 whitespace-pre-wrap break-words">{nota.texto}</p>
                            <p className="text-[10px] text-slate-400 font-mono mt-1">
                              {new Date(nota.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                          {!isViewer && (
                            <button
                              onClick={() => deleteNota(nota.id, p.id)}
                              className="opacity-0 group-hover:opacity-100 text-red-300 hover:text-red-500 text-xs font-black flex-shrink-0 transition-all self-start"
                              title="Excluir anotação"
                            >✕</button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                </div>
              )}
            </div>
          )
        })}
      </div>

      {!loading && processosFiltrados.length === 0 && (
        <div className="text-center py-20 text-slate-400 italic">
          {filtroStatus === 'Andamento'
            ? 'Nenhum processo em andamento.'
            : 'Nenhum processo encontrado.'}
        </div>
      )}

      {/* ── Modal novo processo ─────────────────────────────────────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 md:p-10 rounded-[40px] w-full max-w-md border-t-8 border-yellow-400 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button onClick={() => { setIsModalOpen(false); setFormData({ empresa_id: '', cliente_nome: '', tipo: 'abertura', titulo: '' }) }} className="absolute top-6 right-6 font-bold text-slate-300 hover:text-red-500">FECHAR ✕</button>
            <h2 className="text-2xl font-black mb-8 tracking-tighter text-slate-900">Iniciar Novo Processo</h2>
            <form onSubmit={handleIniciar} className="space-y-5">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Título / Nº O.S.</label>
                <input
                  type="text"
                  placeholder="Ex: O.S. 001/2026 — Abertura Padaria Central"
                  className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl mt-1 text-sm font-bold outline-none focus:border-yellow-400"
                  value={formData.titulo}
                  onChange={e => setFormData({ ...formData, titulo: e.target.value })}
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Tipo de Serviço</label>
                <select
                  className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl mt-1 text-sm font-bold outline-none focus:border-yellow-400 text-slate-800"
                  value={formData.tipo}
                  onChange={e => setFormData({ ...formData, tipo: e.target.value })}
                >
                  {Object.keys(MODELOS_PROCESSOS).map(tipo => (
                    <option key={tipo} value={tipo}>{TIPO_LABELS[tipo] ?? tipo}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">
                  Empresa <span className="text-slate-300 font-normal">(opcional)</span>
                </label>
                <select
                  className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl mt-1 text-sm font-bold outline-none focus:border-yellow-400 text-slate-800"
                  value={formData.empresa_id}
                  onChange={e => setFormData({ ...formData, empresa_id: e.target.value, cliente_nome: '' })}
                >
                  <option value="">— Sem empresa cadastrada —</option>
                  {empresas.map(e => <option key={e.id} value={e.id}>{e.razao_social}</option>)}
                </select>
              </div>
              {!formData.empresa_id && (
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1">
                    Nome do Cliente <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: João da Silva"
                    className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl mt-1 text-sm font-bold outline-none focus:border-yellow-400"
                    value={formData.cliente_nome}
                    onChange={e => setFormData({ ...formData, cliente_nome: e.target.value })}
                  />
                </div>
              )}
              <button type="submit" className="w-full bg-black text-yellow-400 py-5 rounded-3xl font-black text-xs uppercase tracking-widest shadow-xl hover:bg-slate-800 transition-all mt-2">
                INICIAR PROCESSO SOCIETÁRIO
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
