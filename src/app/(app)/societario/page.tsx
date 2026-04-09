'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useOrg } from '@/lib/org-context'
import toast from 'react-hot-toast'

// ─── Checklists operacionais por tipo de processo ────────────────────────────

const MODELOS_PROCESSOS: Record<string, { etapa: string; status: string }[]> = {
  Abertura: [
    { etapa: 'O.S.', status: 'Pendente' },
    { etapa: 'Verificar Regularidade com a ELOS', status: 'Pendente' },
    { etapa: 'Fatura (salvar na pasta Financeiro Elos após assinaturas)', status: 'Pendente' },
    { etapa: 'Análise de Atividade e Tributária', status: 'Pendente' },
    { etapa: 'Solicitar Documentos do Imóvel', status: 'Pendente' },
    { etapa: 'Busca de Nome JUCESP', status: 'Pendente' },
    { etapa: 'Certidão de Uso do Solo (Viabilidade)', status: 'Pendente' },
    { etapa: 'Definição de Mensalidade', status: 'Pendente' },
    { etapa: 'Verificar se o Profissional é Habilitado (Conselho Regional)', status: 'Pendente' },
    { etapa: 'Verificar Numeração Oficial', status: 'Pendente' },
    { etapa: 'Busca de Endereço no Correio', status: 'Pendente' },
    { etapa: 'Busca de Nome INPI', status: 'Pendente' },
    { etapa: 'Definir Endereço de Correspondência', status: 'Pendente' },
    { etapa: 'Salvar Senha Redesim — Vincular Contador (Elos)', status: 'Pendente' },
    { etapa: 'Minuta do Contrato', status: 'Pendente' },
    { etapa: 'FCPJ Receita Federal (Com Inclusão de Contador)', status: 'Pendente' },
    { etapa: 'VRE Jucesp', status: 'Pendente' },
    { etapa: 'Salvar Processo + Taxas em PDF (Junta)', status: 'Pendente' },
    { etapa: 'Solicitar Codificação (Abertura ou Alteração de Razão Social)', status: 'Pendente' },
    { etapa: 'Comunicado (Junta, Receita e Estado)', status: 'Pendente' },
    { etapa: 'Enviar Documentos Registrados para o Cliente por E-mail', status: 'Pendente' },
    { etapa: 'Cadastrar no Conselho Regional (incluir na Relação de Renovação)', status: 'Pendente' },
    { etapa: 'Termo de Abertura', status: 'Pendente' },
    { etapa: 'Cadastrar ou Alterar na Prosoft (CPD nº)', status: 'Pendente' },
    { etapa: 'Opção do Simples Nacional (Passar Comunicado)', status: 'Pendente' },
    { etapa: 'Opção do Simples Nacional (Informar a Prefeitura)', status: 'Pendente' },
    { etapa: 'Prefeitura (Alvará de Funcionamento)', status: 'Pendente' },
    { etapa: 'Prefeitura (Certificado de Licenciamento Integrado)', status: 'Pendente' },
    { etapa: 'Prefeitura (Incluir na Prosoft)', status: 'Pendente' },
    { etapa: 'Vigilância Sanitária (Salvar Anexo V + Taxa no Scanner)', status: 'Pendente' },
    { etapa: 'Comunicado (Concluiu a Abertura)', status: 'Pendente' },
    { etapa: 'Senha da Prefeitura (Incluir na Relação)', status: 'Pendente' },
    { etapa: 'Emitir Taxa de TFE e Encaminhar para o Cliente', status: 'Pendente' },
    { etapa: 'Enviar Todas as Senhas (Aliny, Paulo e Cliente)', status: 'Pendente' },
    { etapa: 'Incluir nas Relações: E-mail, Certidões e Alvará', status: 'Pendente' },
    { etapa: 'Enviar SEFIP (Cadastrar FGTS Automático)', status: 'Pendente' },
    { etapa: 'Cadastro FGTS', status: 'Pendente' },
    { etapa: 'Acrescentar na VERI de Certidões', status: 'Pendente' },
    { etapa: 'Procuração Eletrônica', status: 'Pendente' },
    { etapa: 'Procuração Padrão', status: 'Pendente' },
    { etapa: 'Contrato de Prestação de Serviços e Termo LGPD para Assinatura', status: 'Pendente' },
    { etapa: 'Pasta do Scanner', status: 'Pendente' },
    { etapa: 'Pasta Arquivo', status: 'Pendente' },
    { etapa: 'Cadastrar WhatsApp do Cliente na MultiPlataforma', status: 'Pendente' },
    { etapa: 'Termo Sindicato (Somente Abertura)', status: 'Pendente' },
    { etapa: 'Informativos Iniciais', status: 'Pendente' },
    { etapa: 'Libercon (Incluir na Relação)', status: 'Pendente' },
    { etapa: 'Salvar Processo em PDF', status: 'Pendente' },
    { etapa: 'Enviar E-mail de Apresentação do Responsável pelo Monitoramento de Satisfação', status: 'Pendente' },
    { etapa: 'Informar ao Cliente sobre o Certificado Digital A-1 PJ', status: 'Pendente' },
  ],
  Alteração: [
    { etapa: 'O.S.', status: 'Pendente' },
    { etapa: 'Verificar Regularidade com a ELOS', status: 'Pendente' },
    { etapa: 'Fatura (salvar na pasta Financeiro Elos após assinaturas)', status: 'Pendente' },
    { etapa: 'Análise de Atividade e Tributária', status: 'Pendente' },
    { etapa: 'Verificar se o Profissional é Habilitado (Se Tiver Conselho Regional)', status: 'Pendente' },
    { etapa: 'Solicitar Documentos do Imóvel', status: 'Pendente' },
    { etapa: 'Verificar Numeração Oficial', status: 'Pendente' },
    { etapa: 'Certidão de Uso do Solo (Viabilidade)', status: 'Pendente' },
    { etapa: 'Busca de Endereço no Correio', status: 'Pendente' },
    { etapa: 'Busca de Nome JUCESP', status: 'Pendente' },
    { etapa: 'Busca de Nome INPI', status: 'Pendente' },
    { etapa: 'Definir Endereço de Correspondência', status: 'Pendente' },
    { etapa: 'Salvar Senha Redesim — Vincular Contador (Elos)', status: 'Pendente' },
    { etapa: 'Minuta do Contrato', status: 'Pendente' },
    { etapa: 'FCPJ Receita Federal (Com Inclusão de Contador)', status: 'Pendente' },
    { etapa: 'VRE Jucesp', status: 'Pendente' },
    { etapa: 'Salvar Processo + Taxas em PDF (Junta)', status: 'Pendente' },
    { etapa: 'Solicitar Codificação (Abertura ou Alteração de Razão Social)', status: 'Pendente' },
    { etapa: 'Comunicado (Junta, Receita e Estado)', status: 'Pendente' },
    { etapa: 'Enviar Documentos Registrados para o Cliente por E-mail', status: 'Pendente' },
    { etapa: 'Termo de Abertura / Alteração', status: 'Pendente' },
    { etapa: 'Cadastrar no Conselho Regional (incluir na Relação de Renovação)', status: 'Pendente' },
    { etapa: 'Cadastrar ou Alterar na Prosoft (CPD nº)', status: 'Pendente' },
    { etapa: 'Opção do Simples Nacional (Se mudar o regime — Passar Comunicado)', status: 'Pendente' },
    { etapa: 'Opção do Simples Nacional (Informar a Prefeitura)', status: 'Pendente' },
    { etapa: 'Prefeitura (Alvará de Funcionamento)', status: 'Pendente' },
    { etapa: 'Vigilância Sanitária (Salvar Anexo V + Taxa no Scanner)', status: 'Pendente' },
    { etapa: 'Prefeitura (Certificado de Licenciamento Integrado)', status: 'Pendente' },
    { etapa: 'Comunicado (Concluiu a Abertura/Alteração Prefeitura)', status: 'Pendente' },
    { etapa: 'Senha da Prefeitura (Incluir na Relação)', status: 'Pendente' },
    { etapa: 'Enviar Todas as Senhas (Aliny, Paulo e Cliente)', status: 'Pendente' },
    { etapa: 'Emitir Taxa de TFE e Encaminhar para o Cliente', status: 'Pendente' },
    { etapa: 'Prefeitura (Incluir na Prosoft)', status: 'Pendente' },
    { etapa: 'Prefeitura (Cancelar de Outro Município)', status: 'Pendente' },
    { etapa: 'Comunicado (Concluiu Cancelamento Prefeitura)', status: 'Pendente' },
    { etapa: 'Incluir nas Relações: E-mail, Certidões e Alvará', status: 'Pendente' },
    { etapa: 'Procuração Eletrônica (Informar para a Liliana)', status: 'Pendente' },
    { etapa: 'Procuração Padrão', status: 'Pendente' },
    { etapa: 'Pasta do Scanner', status: 'Pendente' },
    { etapa: 'Pasta Arquivo', status: 'Pendente' },
    { etapa: 'Cadastro FGTS', status: 'Pendente' },
    { etapa: 'Enviar SEFIP (Cadastrar FGTS Automático)', status: 'Pendente' },
    { etapa: 'Libercon (Incluir na Relação)', status: 'Pendente' },
    { etapa: 'Salvar Processo em PDF', status: 'Pendente' },
    { etapa: 'Acrescentar ou Alterar a Empresa no Sistema VERI de Certidões', status: 'Pendente' },
    { etapa: 'Reunião com o Cliente (Falar com a Renata)', status: 'Pendente' },
    { etapa: 'EM CASO DE ALTERAÇÃO/EXCLUSÃO DE SÓCIOS: Questionar transferência, compra/venda de quotas, doação e ITCMD', status: 'Pendente' },
    { etapa: 'Enviar E-mail para Análise do Contábil (Copiar Paulo ou Claudomiro)', status: 'Pendente' },
    { etapa: 'Fazer o Termo de Responsabilidade (informar o procedimento)', status: 'Pendente' },
    { etapa: 'Verificar Procedimento: Declaração de ITCMD ou Venda de Quotas', status: 'Pendente' },
    { etapa: 'Salvar na Pasta do Cliente: E-mail Contábil e Documentos Comprobatórios', status: 'Pendente' },
    { etapa: 'Apresentação/Reunião de Alinhamento', status: 'Pendente' },
    { etapa: 'Procedimento de Acompanhamento pós 60 dias', status: 'Pendente' },
    { etapa: 'Informar ao Cliente sobre o Certificado Digital A-1 PJ', status: 'Pendente' },
  ],
  Transformação: [
    { etapa: 'O.S.', status: 'Pendente' },
    { etapa: 'Ata de Transformação / Contrato Social', status: 'Pendente' },
    { etapa: 'DBE de Natureza Jurídica', status: 'Pendente' },
    { etapa: 'Protocolo Junta Comercial', status: 'Pendente' },
    { etapa: 'Enquadramento ME/EPP', status: 'Pendente' },
    { etapa: 'Comunicado ao Cliente', status: 'Pendente' },
    { etapa: 'Salvar Processo em PDF', status: 'Pendente' },
  ],
  Encerramento: [
    { etapa: 'O.S.', status: 'Pendente' },
    { etapa: 'Distrato Social', status: 'Pendente' },
    { etapa: 'Certidões de Baixa', status: 'Pendente' },
    { etapa: 'DBE de Extinção', status: 'Pendente' },
    { etapa: 'Protocolo de Baixa', status: 'Pendente' },
    { etapa: 'Baixa na Prefeitura/Estado', status: 'Pendente' },
    { etapa: 'Comunicado ao Cliente', status: 'Pendente' },
    { etapa: 'Salvar Processo em PDF', status: 'Pendente' },
  ],
}

const STATUS_CYCLE: Record<string, string> = {
  Pendente: 'Andamento',
  Andamento: 'Concluido',
  Concluido: 'Pendente',
}

function getStatusColor(status: string) {
  if (status === 'Concluido') return 'bg-emerald-500 border-emerald-600 text-white'
  if (status === 'Andamento') return 'bg-blue-500 border-blue-600 text-white'
  return 'bg-white border-slate-200 text-slate-400'
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function SocietarioPage() {
  const { orgId, orgName } = useOrg()
  const [supabase] = useState(createClient())
  const [processos, setProcessos] = useState<any[]>([])
  const [empresas, setEmpresas] = useState<any[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [editingItem, setEditingItem] = useState<{ procId: string; index: number } | null>(null)
  const [editText, setEditText] = useState('')
  const [addingTo, setAddingTo] = useState<string | null>(null)
  const [newItemText, setNewItemText] = useState('')

  const [formData, setFormData] = useState({
    empresa_id: '',
    cliente_nome: '',
    tipo: 'Abertura',
  })

  const fetchData = useCallback(async () => {
    setLoading(true)
    const { data: proc } = await supabase
      .from('processos_societarios')
      .select('*, empresas(razao_social)')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
    const { data: emp } = await supabase
      .from('empresas')
      .select('id, razao_social')
      .order('razao_social')
    setProcessos(proc || [])
    setEmpresas(emp || [])
    setLoading(false)
  }, [supabase, orgId])

  useEffect(() => {
    if (orgId) fetchData()
  }, [orgId, fetchData])

  // ── Iniciar novo processo ──────────────────────────────────────────────────

  async function handleIniciar(e: React.FormEvent) {
    e.preventDefault()
    if (!formData.empresa_id && !formData.cliente_nome.trim()) {
      return toast.error('Selecione uma empresa ou informe o nome do cliente.')
    }

    const checklist = MODELOS_PROCESSOS[formData.tipo] ?? []
    const payload: any = {
      org_id: orgId,
      tipo: formData.tipo,
      checklist,
      status: 'Andamento',
    }
    if (formData.empresa_id) payload.empresa_id = formData.empresa_id
    if (!formData.empresa_id && formData.cliente_nome.trim()) {
      payload.cliente_nome = formData.cliente_nome.trim()
    }

    const { error } = await supabase.from('processos_societarios').insert([payload])
    if (!error) {
      toast.success('Processo iniciado!')
      setIsModalOpen(false)
      setFormData({ empresa_id: '', cliente_nome: '', tipo: 'Abertura' })
      fetchData()
    } else {
      console.error(error)
      toast.error(`Erro: ${error.message}`)
    }
  }

  // ── Ciclar status de uma etapa ─────────────────────────────────────────────

  async function updateEtapa(procId: string, checklist: any[], index: number) {
    const updated = [...checklist]
    updated[index] = { ...updated[index], status: STATUS_CYCLE[updated[index].status] ?? 'Pendente' }
    const concluidos = updated.filter(i => i.status === 'Concluido').length
    const novoStatus = concluidos === updated.length ? 'Finalizado' : 'Andamento'

    await supabase
      .from('processos_societarios')
      .update({ checklist: updated, status: novoStatus })
      .eq('id', procId)

    setProcessos(prev =>
      prev.map(p => p.id === procId ? { ...p, checklist: updated, status: novoStatus } : p)
    )
  }

  // ── Editar texto de uma etapa ──────────────────────────────────────────────

  async function saveEditItem(procId: string, checklist: any[]) {
    if (!editingItem || !editText.trim()) { setEditingItem(null); return }
    const updated = [...checklist]
    updated[editingItem.index] = { ...updated[editingItem.index], etapa: editText.trim() }
    await supabase.from('processos_societarios').update({ checklist: updated }).eq('id', procId)
    setProcessos(prev => prev.map(p => p.id === procId ? { ...p, checklist: updated } : p))
    setEditingItem(null)
  }

  // ── Excluir uma etapa ──────────────────────────────────────────────────────

  async function deleteItem(procId: string, checklist: any[], index: number) {
    const updated = checklist.filter((_, i) => i !== index)
    await supabase.from('processos_societarios').update({ checklist: updated }).eq('id', procId)
    setProcessos(prev => prev.map(p => p.id === procId ? { ...p, checklist: updated } : p))
  }

  // ── Adicionar nova etapa ───────────────────────────────────────────────────

  async function addItem(procId: string, checklist: any[]) {
    if (!newItemText.trim()) { setAddingTo(null); return }
    const updated = [...checklist, { etapa: newItemText.trim(), status: 'Pendente' }]
    await supabase.from('processos_societarios').update({ checklist: updated }).eq('id', procId)
    setProcessos(prev => prev.map(p => p.id === procId ? { ...p, checklist: updated } : p))
    setNewItemText('')
    setAddingTo(null)
  }

  // ── Excluir processo ───────────────────────────────────────────────────────

  async function deleteProcesso(id: string) {
    if (!confirm('Excluir este processo? Esta ação não pode ser desfeita.')) return
    await supabase.from('processos_societarios').delete().eq('id', id)
    setProcessos(prev => prev.filter(p => p.id !== id))
    toast.success('Processo excluído.')
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="p-8 bg-[#F8FAFC] min-h-screen font-sans text-slate-900">
      <header className="flex justify-between items-center mb-10">
        <div>
          <h1 className="text-2xl font-black italic tracking-tighter uppercase">
            PARALEGAL PRO <span className="text-yellow-500">| SOCIETÁRIO</span>
          </h1>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{orgName}</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-black text-yellow-400 px-8 py-3 rounded-2xl font-bold text-xs shadow-xl hover:scale-105 transition-all"
        >
          + NOVO PROCESSO
        </button>
      </header>

      {loading && <p className="text-slate-400 text-sm italic">Carregando processos...</p>}

      <div className="space-y-8">
        {processos.map(p => {
          const checklist: any[] = p.checklist ?? []
          const concluido = checklist.filter(i => i.status === 'Concluido').length
          const total = checklist.length || 1
          const porc = Math.round((concluido / total) * 100)
          const nomeExibido = p.empresas?.razao_social || p.cliente_nome || '—'

          return (
            <div key={p.id} className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm">
              {/* Cabeçalho do processo */}
              <div className="flex justify-between items-start mb-4">
                <div>
                  <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">{p.tipo}</span>
                  <h3 className="text-xl font-black text-slate-800 uppercase mt-1">{nomeExibido}</h3>
                  <span className={`text-[9px] font-black px-2 py-0.5 rounded-full mt-1 inline-block ${
                    p.status === 'Finalizado' ? 'bg-emerald-100 text-emerald-700' :
                    p.status === 'Andamento' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'
                  }`}>{p.status}</span>
                </div>
                <div className="flex items-start gap-4">
                  <div className="text-right">
                    <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Progresso {porc}%</p>
                    <div className="w-48 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-yellow-400 transition-all duration-500" style={{ width: `${porc}%` }} />
                    </div>
                    <p className="text-[9px] text-slate-400 mt-1">{concluido} / {total} etapas</p>
                  </div>
                  <button
                    onClick={() => deleteProcesso(p.id)}
                    className="text-red-300 hover:text-red-500 text-xs transition-colors mt-1"
                    title="Excluir processo"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Grid de etapas */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 mt-4">
                {checklist.map((item: any, i: number) => (
                  <div key={i} className="relative group">
                    {editingItem?.procId === p.id && editingItem.index === i ? (
                      <div className="flex flex-col gap-1">
                        <textarea
                          autoFocus
                          value={editText}
                          onChange={e => setEditText(e.target.value)}
                          className="w-full border-2 border-yellow-400 rounded-xl p-2 text-[9px] font-bold resize-none outline-none"
                          rows={3}
                        />
                        <div className="flex gap-1">
                          <button onClick={() => saveEditItem(p.id, checklist)} className="flex-1 bg-yellow-400 text-black text-[8px] font-black py-1 rounded-lg">OK</button>
                          <button onClick={() => setEditingItem(null)} className="flex-1 bg-slate-100 text-slate-500 text-[8px] font-black py-1 rounded-lg">✕</button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => updateEtapa(p.id, checklist, i)}
                        className={`w-full p-3 rounded-xl border-2 text-[9px] font-black uppercase leading-tight transition-all text-left h-16 flex flex-col justify-between ${getStatusColor(item.status)} shadow-sm`}
                      >
                        <span className="line-clamp-3 leading-tight">{item.etapa}</span>
                        <span className="opacity-60 text-[7px]">{item.status}</span>
                      </button>
                    )}
                    {/* Ações de edição/exclusão */}
                    {!(editingItem?.procId === p.id && editingItem.index === i) && (
                      <div className="absolute -top-1 -right-1 hidden group-hover:flex gap-0.5 z-10">
                        <button
                          onClick={() => { setEditingItem({ procId: p.id, index: i }); setEditText(item.etapa) }}
                          className="bg-yellow-400 text-black text-[8px] w-4 h-4 rounded-full font-black flex items-center justify-center hover:bg-yellow-300"
                          title="Editar"
                        >✎</button>
                        <button
                          onClick={() => deleteItem(p.id, checklist, i)}
                          className="bg-red-400 text-white text-[8px] w-4 h-4 rounded-full font-black flex items-center justify-center hover:bg-red-500"
                          title="Excluir"
                        >✕</button>
                      </div>
                    )}
                  </div>
                ))}

                {/* Botão adicionar etapa */}
                {addingTo === p.id ? (
                  <div className="flex flex-col gap-1 h-16">
                    <input
                      autoFocus
                      value={newItemText}
                      onChange={e => setNewItemText(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') addItem(p.id, checklist); if (e.key === 'Escape') { setAddingTo(null); setNewItemText('') } }}
                      placeholder="Nome da etapa..."
                      className="w-full border-2 border-yellow-400 rounded-xl p-2 text-[9px] outline-none"
                    />
                    <div className="flex gap-1">
                      <button onClick={() => addItem(p.id, checklist)} className="flex-1 bg-yellow-400 text-black text-[8px] font-black py-1 rounded-lg">Adicionar</button>
                      <button onClick={() => { setAddingTo(null); setNewItemText('') }} className="flex-1 bg-slate-100 text-slate-500 text-[8px] font-black py-1 rounded-lg">✕</button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setAddingTo(p.id)}
                    className="h-16 border-2 border-dashed border-slate-200 rounded-xl text-slate-300 hover:border-yellow-400 hover:text-yellow-500 transition-all text-xl font-light flex items-center justify-center"
                    title="Adicionar etapa"
                  >
                    +
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {!loading && processos.length === 0 && (
        <div className="text-center py-20 text-slate-400 italic">
          Nenhum processo iniciado ainda. Clique em &quot;+ NOVO PROCESSO&quot; para começar.
        </div>
      )}

      {/* ── Modal novo processo ───────────────────────────────────────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-white p-10 rounded-[40px] w-full max-w-md border-t-8 border-yellow-400 shadow-2xl relative">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-6 right-6 font-bold text-slate-300 hover:text-red-500 transition-colors"
            >
              FECHAR ✕
            </button>
            <h2 className="text-2xl font-black mb-8 tracking-tighter text-slate-900">Iniciar Novo Processo</h2>

            <form onSubmit={handleIniciar} className="space-y-5">
              {/* Tipo */}
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Tipo de Serviço</label>
                <select
                  className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl mt-1 text-sm font-bold outline-none focus:border-yellow-400 text-slate-800"
                  value={formData.tipo}
                  onChange={e => setFormData({ ...formData, tipo: e.target.value })}
                >
                  {Object.keys(MODELOS_PROCESSOS).map(tipo => (
                    <option key={tipo} value={tipo}>{tipo}</option>
                  ))}
                </select>
              </div>

              {/* Empresa (opcional) */}
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">
                  Empresa <span className="text-slate-300 font-normal">(opcional)</span>
                </label>
                <select
                  className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl mt-1 text-sm font-bold outline-none focus:border-yellow-400 text-slate-800"
                  value={formData.empresa_id}
                  onChange={e => setFormData({ ...formData, empresa_id: e.target.value, cliente_nome: e.target.value ? '' : formData.cliente_nome })}
                >
                  <option value="">— Sem empresa cadastrada —</option>
                  {empresas.map(e => <option key={e.id} value={e.id}>{e.razao_social}</option>)}
                </select>
              </div>

              {/* Nome do cliente (só quando sem empresa) */}
              {!formData.empresa_id && (
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1">
                    Nome do Cliente <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: João da Silva"
                    className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl mt-1 text-sm font-bold outline-none focus:border-yellow-400 text-slate-800"
                    value={formData.cliente_nome}
                    onChange={e => setFormData({ ...formData, cliente_nome: e.target.value })}
                  />
                </div>
              )}

              <button
                type="submit"
                className="w-full bg-black text-yellow-400 py-5 rounded-3xl font-black text-xs uppercase tracking-widest shadow-xl hover:bg-slate-800 transition-all mt-2"
              >
                INICIAR PROCESSO SOCIETÁRIO
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
