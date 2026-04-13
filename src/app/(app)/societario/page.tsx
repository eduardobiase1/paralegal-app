'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useOrg } from '@/lib/org-context'
import toast from 'react-hot-toast'

// ─── Labels ──────────────────────────────────────────────────────────────────

const TIPO_LABELS: Record<string, string> = {
  abertura: 'Abertura',
  alteracao_contratual: 'Alteração Contratual',
  encerramento: 'Encerramento',
  transferencia_entrada: 'Transferência (Entrada)',
  transferencia_saida: 'Transferência (Saída)',
}

const TIPO_COLORS: Record<string, string> = {
  abertura: 'bg-emerald-100 text-emerald-700',
  alteracao_contratual: 'bg-blue-100 text-blue-700',
  encerramento: 'bg-red-100 text-red-700',
  transferencia_entrada: 'bg-purple-100 text-purple-700',
  transferencia_saida: 'bg-orange-100 text-orange-700',
}

// ─── Modelos de etapas do processo ───────────────────────────────────────────

const MODELOS_PROCESSOS: Record<string, { etapa: string; status: string }[]> = {
  abertura: [
    { etapa: 'Reunião inicial — levantar atividade, endereço, sócios e capital social', status: 'Pendente' },
    { etapa: 'Definir nome empresarial com o cliente', status: 'Pendente' },
    { etapa: 'Definir atividade (CNAE) e regime tributário recomendado', status: 'Pendente' },
    { etapa: 'Definir capital social e percentual de participação dos sócios', status: 'Pendente' },
    { etapa: 'Consulta de Viabilidade de Nome — JUCESP', status: 'Pendente' },
    { etapa: 'Consulta de Viabilidade — Uso do Solo (Prefeitura)', status: 'Pendente' },
    { etapa: 'Verificar necessidade de registro de marca — INPI', status: 'Pendente' },
    { etapa: 'Receber e conferir todos os documentos solicitados ao cliente', status: 'Pendente' },
    { etapa: 'Elaborar minuta do Contrato Social', status: 'Pendente' },
    { etapa: 'Aprovar minuta com o cliente e coletar assinaturas', status: 'Pendente' },
    { etapa: 'Protocolar DBE — Receita Federal (Ato Constitutivo)', status: 'Pendente' },
    { etapa: 'Protocolar VRE — JUCESP', status: 'Pendente' },
    { etapa: 'Pagar taxa de registro — JUCESP', status: 'Pendente' },
    { etapa: 'Acompanhar aprovação na JUCESP', status: 'Pendente' },
    { etapa: 'Emitir CNPJ', status: 'Pendente' },
    { etapa: 'Solicitar Inscrição Estadual (se contribuinte ICMS)', status: 'Pendente' },
    { etapa: 'Solicitar Inscrição Municipal / habilitação para NFS-e', status: 'Pendente' },
    { etapa: 'Solicitar Alvará de Funcionamento — Prefeitura', status: 'Pendente' },
    { etapa: 'Solicitar Certificado de Licenciamento Integrado (CLI)', status: 'Pendente' },
    { etapa: 'Solicitar Licença Sanitária VISA (se aplicável)', status: 'Pendente' },
    { etapa: 'Fazer opção pelo Simples Nacional (se aplicável)', status: 'Pendente' },
    { etapa: 'Cadastrar no eSocial / FGTS', status: 'Pendente' },
    { etapa: 'Orientar cliente sobre Certificado Digital A1 PJ', status: 'Pendente' },
    { etapa: 'Emitir Procuração Eletrônica — e-CAC', status: 'Pendente' },
    { etapa: 'Assinar contrato de prestação de serviços contábeis', status: 'Pendente' },
    { etapa: 'Entregar todos os documentos finais ao cliente', status: 'Pendente' },
  ],
  alteracao_contratual: [
    { etapa: 'Reunião com o cliente — identificar o tipo de alteração pretendida', status: 'Pendente' },
    { etapa: 'Verificar documentação necessária conforme o tipo de alteração', status: 'Pendente' },
    { etapa: 'Receber e conferir todos os documentos solicitados ao cliente', status: 'Pendente' },
    { etapa: 'Consulta de Viabilidade — novo endereço (se mudança de sede)', status: 'Pendente' },
    { etapa: 'Busca de Nome — JUCESP (se alteração de razão social)', status: 'Pendente' },
    { etapa: 'Verificar necessidade de nova marca — INPI (se alteração de nome)', status: 'Pendente' },
    { etapa: 'Elaborar minuta da Alteração Contratual', status: 'Pendente' },
    { etapa: 'Aprovar minuta com o cliente e coletar assinaturas', status: 'Pendente' },
    { etapa: 'Protocolar DBE — Receita Federal (atualização cadastral)', status: 'Pendente' },
    { etapa: 'Protocolar VRE — JUCESP', status: 'Pendente' },
    { etapa: 'Pagar taxa de registro — JUCESP', status: 'Pendente' },
    { etapa: 'Acompanhar aprovação na JUCESP', status: 'Pendente' },
    { etapa: 'Atualizar Inscrição Estadual (se mudança de endereço, atividade ou razão social)', status: 'Pendente' },
    { etapa: 'Atualizar Inscrição Municipal (se mudança de endereço, atividade ou razão social)', status: 'Pendente' },
    { etapa: 'Solicitar novo Alvará de Funcionamento (se mudança de endereço ou atividade)', status: 'Pendente' },
    { etapa: 'Atualizar Certificado de Licenciamento Integrado — CLI (se necessário)', status: 'Pendente' },
    { etapa: 'Atualizar Procuração Eletrônica no e-CAC (se necessário)', status: 'Pendente' },
    { etapa: 'Entregar todos os documentos registrados ao cliente', status: 'Pendente' },
  ],
  encerramento: [
    { etapa: 'Contrato Social original (última versão registrada)', status: 'Pendente' },
    { etapa: 'RG / CNH e CPF — todos os sócios', status: 'Pendente' },
    { etapa: 'Comprovante de Residência — todos os sócios', status: 'Pendente' },
    { etapa: 'Distrato Social — assinado por todos os sócios', status: 'Pendente' },
    { etapa: 'CND Federal — Receita Federal', status: 'Pendente' },
    { etapa: 'CND Estadual', status: 'Pendente' },
    { etapa: 'CND Municipal', status: 'Pendente' },
    { etapa: 'CRF — FGTS', status: 'Pendente' },
    { etapa: 'CNDT — Certidão Negativa Trabalhista', status: 'Pendente' },
    { etapa: 'Baixa Simples Nacional — solicitada (se optante)', status: 'Pendente' },
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
    { etapa: 'Contato inicial — levantar regime tributário, porte e necessidades do cliente', status: 'Pendente' },
    { etapa: 'Enviar proposta de honorários ao cliente', status: 'Pendente' },
    { etapa: 'Assinar contrato de prestação de serviços contábeis', status: 'Pendente' },
    { etapa: 'Enviar checklist de documentos ao cliente', status: 'Pendente' },
    { etapa: 'Receber e conferir todos os documentos solicitados', status: 'Pendente' },
    { etapa: 'Emitir carta de apresentação ao escritório contábil anterior', status: 'Pendente' },
    { etapa: 'Receber carta de transferência / anuência do escritório anterior', status: 'Pendente' },
    { etapa: 'Cadastrar empresa no sistema contábil interno', status: 'Pendente' },
    { etapa: 'Solicitar e receber procuração para acesso ao e-CAC (Receita Federal)', status: 'Pendente' },
    { etapa: 'Credenciar no e-CAC — habilitar acesso à empresa na Receita Federal', status: 'Pendente' },
    { etapa: 'Verificar pendências fiscais na Receita Federal (SIEF / SIDA)', status: 'Pendente' },
    { etapa: 'Verificar pendências no Simples Nacional (PGDAS / parcelamentos)', status: 'Pendente' },
    { etapa: 'Verificar pendências no eSocial — eventos em aberto', status: 'Pendente' },
    { etapa: 'Levantar obrigações acessórias em aberto (DCTF, ECD, ECF, SPED)', status: 'Pendente' },
    { etapa: 'Importar histórico contábil e fiscal no sistema interno', status: 'Pendente' },
    { etapa: 'Conferir último balanço e balancete do período anterior', status: 'Pendente' },
    { etapa: 'Atualizar responsável contábil na Receita Federal (DBE)', status: 'Pendente' },
    { etapa: 'Emitir Declaração de Responsabilidade Técnica — CRC', status: 'Pendente' },
    { etapa: 'Arquivar documentação recebida do cliente e do escritório anterior', status: 'Pendente' },
    { etapa: 'Comunicar conclusão da transferência ao cliente — boas-vindas', status: 'Pendente' },
  ],
  transferencia_saida: [
    { etapa: 'Receber solicitação formal de transferência do cliente', status: 'Pendente' },
    { etapa: 'Verificar honorários em aberto — cobrar pendências financeiras', status: 'Pendente' },
    { etapa: 'Confirmar quitação de todos os honorários antes da liberação', status: 'Pendente' },
    { etapa: 'Verificar obrigações acessórias em aberto a entregar antes da saída', status: 'Pendente' },
    { etapa: 'Verificar pendências no eSocial e FGTS', status: 'Pendente' },
    { etapa: 'Exportar backup contábil completo do sistema', status: 'Pendente' },
    { etapa: 'Organizar XMLs das NF-e / NFS-e emitidas (últimos 5 anos)', status: 'Pendente' },
    { etapa: 'Organizar SPEDs (Fiscal e Contábil) entregues', status: 'Pendente' },
    { etapa: 'Organizar declarações entregues (ECF, ECD, DCTF, PGDAS/DASN)', status: 'Pendente' },
    { etapa: 'Organizar livros contábeis: Diário, Razão e Balancete', status: 'Pendente' },
    { etapa: 'Preparar pasta/arquivo digital completo para entrega', status: 'Pendente' },
    { etapa: 'Entregar toda a documentação ao cliente ou ao novo escritório', status: 'Pendente' },
    { etapa: 'Revogar procuração no e-CAC — retirar acesso à empresa', status: 'Pendente' },
    { etapa: 'Emitir Declaração de Encerramento de Responsabilidade Técnica — CRC', status: 'Pendente' },
    { etapa: 'Emitir carta de anuência / transferência assinada', status: 'Pendente' },
    { etapa: 'Arquivar cópia interna de toda a documentação entregue', status: 'Pendente' },
    { etapa: 'Comunicar encerramento formal dos serviços ao cliente', status: 'Pendente' },
  ],
}

// ─── Documentos a solicitar ao cliente por tipo ───────────────────────────────

const DOCS_MODELOS: Record<string, { doc: string; recebido: boolean }[]> = {
  abertura: [
    { doc: 'RG / CNH (frente e verso) — todos os sócios', recebido: false },
    { doc: 'CPF — todos os sócios', recebido: false },
    { doc: 'Comprovante de Residência — sócios (máx. 90 dias)', recebido: false },
    { doc: 'Certidão de Estado Civil — todos os sócios', recebido: false },
    { doc: 'IPTU do Imóvel (sede da empresa)', recebido: false },
    { doc: 'Contrato de Locação ou Escritura do Imóvel', recebido: false },
    { doc: 'Conta de Energia ou Água do Imóvel', recebido: false },
    { doc: 'AVCB — Auto de Vistoria do Corpo de Bombeiros', recebido: false },
    { doc: 'Planta do Imóvel aprovada pela Prefeitura', recebido: false },
    { doc: 'Nome empresarial definido e aprovado pelo cliente', recebido: false },
    { doc: 'Atividade (CNAE) definida e aprovada pelo cliente', recebido: false },
    { doc: 'Capital social e % de participação de cada sócio definidos', recebido: false },
    { doc: 'Contrato Social — assinado por todos os sócios', recebido: false },
  ],
  alteracao_contratual: [
    { doc: 'Contrato Social original (última versão registrada)', recebido: false },
    { doc: 'RG / CNH — sócios envolvidos na alteração', recebido: false },
    { doc: 'CPF — sócios envolvidos na alteração', recebido: false },
    { doc: 'Comprovante de Residência — sócios (máx. 90 dias)', recebido: false },
    { doc: 'Certidão de Estado Civil — sócios (se alteração de QSA)', recebido: false },
    { doc: 'IPTU ou Contrato de Locação — novo endereço (se mudança de sede)', recebido: false },
    { doc: 'Conta de Energia do novo imóvel (se mudança de sede)', recebido: false },
    { doc: 'AVCB — Auto de Vistoria do Corpo de Bombeiros (se mudança de sede)', recebido: false },
    { doc: 'Planta do Imóvel aprovada pela Prefeitura (se mudança de sede)', recebido: false },
    { doc: 'Instrumento de Cessão de Quotas — assinado pelas partes (se transferência de quotas)', recebido: false },
    { doc: 'Comprovante de pagamento das quotas (se cessão onerosa)', recebido: false },
    { doc: 'Declaração de ITCMD ou comprovante de isenção (se cessão de quotas)', recebido: false },
  ],
  encerramento: [
    { doc: 'Contrato Social original (última versão registrada)', recebido: false },
    { doc: 'RG / CNH e CPF — todos os sócios', recebido: false },
    { doc: 'Comprovante de Residência — todos os sócios', recebido: false },
    { doc: 'Distrato Social — assinado por todos os sócios', recebido: false },
    { doc: 'CND Federal — Receita Federal', recebido: false },
    { doc: 'CND Estadual', recebido: false },
    { doc: 'CND Municipal', recebido: false },
    { doc: 'CRF — FGTS (Certidão de Regularidade)', recebido: false },
    { doc: 'CNDT — Certidão Negativa Trabalhista', recebido: false },
    { doc: 'Balanço Patrimonial de Encerramento', recebido: false },
  ],
  transferencia_entrada: [
    // Documentos Societários
    { doc: 'Contrato Social / Estatuto Social (última versão registrada)', recebido: false },
    { doc: 'Última alteração contratual arquivada na Junta Comercial', recebido: false },
    { doc: 'Cartão CNPJ atualizado', recebido: false },
    { doc: 'Inscrição Estadual (se houver)', recebido: false },
    { doc: 'Inscrição Municipal / Alvará de funcionamento', recebido: false },
    // Documentos dos Sócios
    { doc: 'RG / CNH (frente e verso) — todos os sócios', recebido: false },
    { doc: 'CPF — todos os sócios', recebido: false },
    { doc: 'Comprovante de Residência — todos os sócios (máx. 90 dias)', recebido: false },
    // Obrigações Fiscais
    { doc: 'Última declaração entregue (IRPJ / DEFIS / DASN conforme regime)', recebido: false },
    { doc: 'Enquadramento tributário atual (Simples / Presumido / Real)', recebido: false },
    { doc: 'CND Federal — Certidão de Regularidade Receita Federal', recebido: false },
    { doc: 'Certidão Negativa Municipal', recebido: false },
    { doc: 'Certidão Negativa Estadual (se contribuinte ICMS)', recebido: false },
    // Folha de Pagamento / eSocial
    { doc: 'Relação de funcionários ativos (nome, CPF, cargo, salário, admissão)', recebido: false },
    { doc: 'Último FGTS recolhido (GFIP / SEFIP ou eSocial)', recebido: false },
    { doc: 'Última folha de pagamento processada', recebido: false },
    { doc: 'Histórico de pró-labore dos sócios', recebido: false },
    // Financeiro
    { doc: 'Últimos 3 extratos bancários de todas as contas da empresa', recebido: false },
    { doc: 'Relação de contas a pagar e a receber em aberto', recebido: false },
    { doc: 'Contratos de financiamento ou leasing ativos (se houver)', recebido: false },
    // Arquivos do escritório anterior
    { doc: 'Backup contábil completo (XML ou formato exportável)', recebido: false },
    { doc: 'Livros Contábeis: Diário, Razão e Balancete (últimos 5 anos)', recebido: false },
    { doc: 'Arquivos XML das NF-e / NFS-e emitidas (últimos 5 anos)', recebido: false },
    { doc: 'SPED Fiscal e SPED Contábil entregues', recebido: false },
    { doc: 'Declarações entregues: ECF, ECD, DCTF, PGDAS', recebido: false },
    { doc: 'Carta de apresentação / dispensa do escritório anterior', recebido: false },
    // Informações Gerais
    { doc: 'Procuração para representação no e-CAC (Receita Federal)', recebido: false },
    { doc: 'Pendências ou parcelamentos em aberto (REFIS, PERT, etc.)', recebido: false },
    { doc: 'Data do último balanço fechado', recebido: false },
  ],
  transferencia_saida: [
    { doc: 'Contrato Social e todas as alterações registradas', recebido: false },
    { doc: 'Cartão CNPJ atualizado', recebido: false },
    { doc: 'Inscrição Estadual e Inscrição Municipal', recebido: false },
    { doc: 'Livros Contábeis: Diário, Razão e Balancete (últimos 5 anos)', recebido: false },
    { doc: 'Balanços e Demonstrações Financeiras', recebido: false },
    { doc: 'Declarações entregues: ECF, ECD, DCTF, PGDAS, DASN, DEFIS', recebido: false },
    { doc: 'SPED Fiscal e SPED Contábil', recebido: false },
    { doc: 'Arquivos XML das NF-e / NFS-e emitidas (últimos 5 anos)', recebido: false },
    { doc: 'GFIPs / eSocial entregues', recebido: false },
    { doc: 'Certidões negativas obtidas durante o contrato', recebido: false },
    { doc: 'Contratos de financiamento/leasing arquivados (se houver)', recebido: false },
    { doc: 'Carta de anuência assinada pelo escritório', recebido: false },
    { doc: 'Comprovante de quitação de honorários', recebido: false },
  ],
}

const STATUS_CYCLE: Record<string, string> = {
  Pendente: 'Andamento', Andamento: 'Concluido', Concluido: 'Pendente',
}

function proximaEtapa(checklist: any[]): string {
  const next = checklist?.find(i => i.status !== 'Concluido')
  if (!next) return 'Concluído ✓'
  const t = next.etapa as string
  return t.length > 38 ? t.substring(0, 38) + '…' : t
}

function getInitials(nome: string): string {
  return nome.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function SocietarioPage() {
  const { orgId, orgName, role } = useOrg()
  const isViewer = role === 'viewer'
  const [supabase] = useState(createClient())

  // ── Dados ────────────────────────────────────────────────────────────────
  const [processos, setProcessos] = useState<any[]>([])
  const [empresas, setEmpresas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // ── Navegação ────────────────────────────────────────────────────────────
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [filtroStatus, setFiltroStatus] = useState<'todos' | 'Andamento' | 'Finalizado'>('Andamento')
  const [activeDetailTab, setActiveDetailTab] = useState<'etapas' | 'documentos' | 'anotacoes'>('etapas')

  // ── Modal novo processo ──────────────────────────────────────────────────
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [formData, setFormData] = useState({ empresa_id: '', cliente_nome: '', tipo: 'abertura', titulo: '' })

  // ── Edição inline etapas ─────────────────────────────────────────────────
  const [editingItem, setEditingItem] = useState<{ procId: string; index: number } | null>(null)
  const [editText, setEditText] = useState('')
  const [addingTo, setAddingTo] = useState<string | null>(null)
  const [newItemText, setNewItemText] = useState('')

  // ── Título / O.S. ────────────────────────────────────────────────────────
  const [editingTituloId, setEditingTituloId] = useState<string | null>(null)
  const [tituloText, setTituloText] = useState('')

  // ── Documentos checklist (edição admin) ─────────────────────────────────
  const [editingDocIndex, setEditingDocIndex] = useState<number | null>(null)
  const [editDocText, setEditDocText] = useState('')
  const [addingDoc, setAddingDoc] = useState(false)
  const [newDocText, setNewDocText] = useState('')

  // ── Anotações ────────────────────────────────────────────────────────────
  const [notas, setNotas] = useState<Record<string, any[]>>({})
  const [notaInput, setNotaInput] = useState('')
  const [savingNota, setSavingNota] = useState(false)

  // ── Computed ─────────────────────────────────────────────────────────────
  const selectedProcesso = processos.find(p => p.id === selectedId) ?? null
  const processosFiltrados = useMemo(() =>
    processos.filter(p => filtroStatus === 'todos' ? true : p.status === filtroStatus),
    [processos, filtroStatus]
  )

  // ─── Fetch ─────────────────────────────────────────────────────────────────

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

  // Quando seleciona processo, carrega notas e inicializa docs se necessário
  useEffect(() => {
    if (!selectedId) return
    const p = processos.find(x => x.id === selectedId)
    if (!p) return
    if (!notas[selectedId]) loadNotas(selectedId)
    if (!p.docs_solicitados || p.docs_solicitados.length === 0) initDocs(p, false)
  }, [selectedId])

  // ─── Handlers ──────────────────────────────────────────────────────────────

  async function handleIniciar(e: React.FormEvent) {
    e.preventDefault()
    if (!formData.empresa_id && !formData.cliente_nome.trim())
      return toast.error('Selecione uma empresa ou informe o nome do cliente.')
    const checklist = MODELOS_PROCESSOS[formData.tipo] ?? []
    const payload: any = { org_id: orgId, tipo: formData.tipo, checklist, status: 'Andamento', titulo: formData.titulo.trim() || null }
    if (formData.empresa_id) payload.empresa_id = formData.empresa_id
    else payload.cliente_nome = formData.cliente_nome.trim()
    const { data, error } = await supabase.from('processos_societarios').insert([payload]).select().single()
    if (!error && data) {
      toast.success('Processo iniciado!')
      setIsModalOpen(false)
      setFormData({ empresa_id: '', cliente_nome: '', tipo: 'abertura', titulo: '' })
      await fetchData()
      setSelectedId(data.id)
      setActiveDetailTab('etapas')
    } else {
      toast.error(`Erro: ${error?.message}`)
    }
  }

  async function initDocs(processo: any, force = false) {
    const docs = DOCS_MODELOS[processo.tipo] ?? []
    if (!force && processo.docs_solicitados && processo.docs_solicitados.length > 0) return
    try {
      await supabase.from('processos_societarios').update({ docs_solicitados: docs }).eq('id', processo.id)
      setProcessos(prev => prev.map(p => p.id === processo.id ? { ...p, docs_solicitados: docs } : p))
      if (force) toast.success(`Modelo restaurado com ${docs.length} documentos.`)
    } catch { /* coluna pode não existir ainda */ }
  }

  async function toggleDoc(procId: string, docs: any[], index: number) {
    const updated = [...docs]
    updated[index] = { ...updated[index], recebido: !updated[index].recebido }
    try {
      await supabase.from('processos_societarios').update({ docs_solicitados: updated }).eq('id', procId)
      setProcessos(prev => prev.map(p => p.id === procId ? { ...p, docs_solicitados: updated } : p))
    } catch { toast.error('Erro ao salvar. Execute a migração SQL.') }
  }

  async function saveEditDoc(procId: string, docs: any[], index: number) {
    if (!editDocText.trim()) { setEditingDocIndex(null); return }
    const updated = [...docs]
    updated[index] = { ...updated[index], doc: editDocText.trim() }
    await supabase.from('processos_societarios').update({ docs_solicitados: updated }).eq('id', procId)
    setProcessos(prev => prev.map(p => p.id === procId ? { ...p, docs_solicitados: updated } : p))
    setEditingDocIndex(null)
  }

  async function deleteDoc(procId: string, docs: any[], index: number) {
    const updated = docs.filter((_, i) => i !== index)
    await supabase.from('processos_societarios').update({ docs_solicitados: updated }).eq('id', procId)
    setProcessos(prev => prev.map(p => p.id === procId ? { ...p, docs_solicitados: updated } : p))
  }

  async function addDoc(procId: string, docs: any[]) {
    if (!newDocText.trim()) { setAddingDoc(false); return }
    const updated = [...docs, { doc: newDocText.trim(), recebido: false }]
    await supabase.from('processos_societarios').update({ docs_solicitados: updated }).eq('id', procId)
    setProcessos(prev => prev.map(p => p.id === procId ? { ...p, docs_solicitados: updated } : p))
    setNewDocText(''); setAddingDoc(false)
  }

  async function saveTitulo(procId: string) {
    await supabase.from('processos_societarios').update({ titulo: tituloText.trim() || null }).eq('id', procId)
    setProcessos(prev => prev.map(p => p.id === procId ? { ...p, titulo: tituloText.trim() || null } : p))
    setEditingTituloId(null)
  }

  async function loadNotas(procId: string) {
    const { data } = await supabase.from('processo_notas').select('*').eq('processo_id', procId).order('created_at', { ascending: false })
    setNotas(prev => ({ ...prev, [procId]: data || [] }))
  }

  async function addNota(procId: string) {
    const texto = notaInput.trim()
    if (!texto) return
    setSavingNota(true)
    const { data, error } = await supabase.from('processo_notas').insert([{ processo_id: procId, org_id: orgId, texto }]).select().single()
    if (!error && data) {
      setNotas(prev => ({ ...prev, [procId]: [data, ...(prev[procId] || [])] }))
      setNotaInput('')
    } else { toast.error('Erro ao salvar anotação.') }
    setSavingNota(false)
  }

  async function deleteNota(notaId: string, procId: string) {
    await supabase.from('processo_notas').delete().eq('id', notaId)
    setNotas(prev => ({ ...prev, [procId]: (prev[procId] || []).filter(n => n.id !== notaId) }))
  }

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
    setNewItemText(''); setAddingTo(null)
  }

  async function deleteProcesso(id: string) {
    if (!confirm('Excluir este processo permanentemente?')) return
    await supabase.from('processos_societarios').delete().eq('id', id)
    setProcessos(prev => prev.filter(p => p.id !== id))
    setSelectedId(null)
    toast.success('Processo excluído.')
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  // ── DETALHE DO PROCESSO ──────────────────────────────────────────────────
  if (selectedId && selectedProcesso) {
    const p = selectedProcesso
    const checklist: any[] = p.checklist ?? []
    const docs: any[] = p.docs_solicitados ?? []
    const concluido = checklist.filter(i => i.status === 'Concluido').length
    const total = checklist.length || 1
    const porc = Math.round((concluido / total) * 100)
    const docsRecebidos = docs.filter(d => d.recebido).length
    const nomeExibido = p.empresas?.razao_social || p.cliente_nome || '—'

    return (
      <div className="p-4 md:p-6 bg-[#F8FAFC] min-h-screen font-sans text-slate-900">

        {/* Topo: voltar + título */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <button
            onClick={() => { setSelectedId(null); setActiveDetailTab('etapas') }}
            className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-black transition-colors group"
          >
            <svg className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
            Voltar aos Processos
          </button>
          {!isViewer && (
            <button
              onClick={() => deleteProcesso(p.id)}
              className="text-xs text-red-400 hover:text-red-600 font-bold transition-colors"
            >
              Excluir processo
            </button>
          )}
        </div>

        {/* Card de cabeçalho do processo */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 mb-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className={`text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wide ${TIPO_COLORS[p.tipo] ?? 'bg-slate-100 text-slate-600'}`}>
                  {TIPO_LABELS[p.tipo] ?? p.tipo}
                </span>
                <span className={`text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wide ${
                  p.status === 'Finalizado' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
                }`}>
                  {p.status === 'Finalizado' ? 'Finalizado' : 'Em Andamento'}
                </span>
              </div>
              <h2 className="text-xl font-black text-slate-900">{nomeExibido}</h2>

              {/* O.S. / Título editável */}
              <div className="mt-2">
                {isViewer ? (
                  p.titulo ? <span className="text-xs font-bold bg-yellow-50 text-yellow-700 border border-yellow-200 rounded-lg px-3 py-1">{p.titulo}</span> : null
                ) : editingTituloId === p.id ? (
                  <div className="flex items-center gap-2 mt-1">
                    <input autoFocus value={tituloText} onChange={e => setTituloText(e.target.value)}
                      onBlur={() => saveTitulo(p.id)} onKeyDown={e => { if (e.key === 'Enter') saveTitulo(p.id); if (e.key === 'Escape') setEditingTituloId(null) }}
                      placeholder="Ex: O.S. 001/2026 — Abertura Padaria Central"
                      className="w-72 text-xs border-2 border-yellow-400 rounded-lg px-3 py-1.5 outline-none bg-yellow-50 font-medium" />
                    <button onClick={() => saveTitulo(p.id)} className="bg-yellow-400 text-black text-[10px] font-black px-3 py-1.5 rounded-lg">OK</button>
                    <button onClick={() => setEditingTituloId(null)} className="text-slate-400 text-[10px]">✕</button>
                  </div>
                ) : (
                  <button onClick={() => { setTituloText(p.titulo || ''); setEditingTituloId(p.id) }}
                    className={`text-xs font-bold rounded-lg px-3 py-1 transition-all mt-1 ${p.titulo ? 'bg-yellow-50 text-yellow-700 border border-yellow-200 hover:bg-yellow-100' : 'text-slate-400 hover:text-yellow-500 border border-dashed border-slate-200 hover:border-yellow-300'}`}>
                    {p.titulo ? `✎ ${p.titulo}` : '+ Definir O.S. / Título'}
                  </button>
                )}
              </div>
            </div>

            {/* Progresso circular compacto */}
            <div className="flex items-center gap-4 flex-shrink-0">
              <div className="text-right">
                <div className="text-2xl font-black text-slate-900">{porc}%</div>
                <div className="text-[10px] text-slate-400 font-bold uppercase">{concluido}/{total} etapas</div>
              </div>
              <div className="relative w-14 h-14">
                <svg viewBox="0 0 36 36" className="w-14 h-14 -rotate-90">
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="#f1f5f9" strokeWidth="3.5" />
                  <circle cx="18" cy="18" r="15.9" fill="none"
                    stroke={porc === 100 ? '#10b981' : '#f59e0b'}
                    strokeWidth="3.5"
                    strokeDasharray={`${porc} ${100 - porc}`}
                    strokeLinecap="round" />
                </svg>
              </div>
            </div>
          </div>

          {/* Barra de progresso */}
          <div className="mt-4 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all ${porc === 100 ? 'bg-emerald-400' : 'bg-yellow-400'}`} style={{ width: `${porc}%` }} />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-4 bg-white border border-slate-200 rounded-xl p-1 w-fit">
          {([
            ['etapas', '📋 Etapas do Processo', checklist.length],
            ['documentos', '📁 Documentos do Cliente', docs.length],
            ['anotacoes', '📝 Anotações', (notas[p.id] || []).length],
          ] as const).map(([tab, label, count]) => (
            <button key={tab} onClick={() => setActiveDetailTab(tab)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wide transition-all whitespace-nowrap ${
                activeDetailTab === tab ? 'bg-black text-yellow-400' : 'text-slate-500 hover:text-slate-700'
              }`}>
              {label}
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${activeDetailTab === tab ? 'bg-yellow-400/20 text-yellow-300' : 'bg-slate-100 text-slate-400'}`}>
                {count}
              </span>
            </button>
          ))}
        </div>

        {/* ── Tab: Etapas ───────────────────────────────────────────────────── */}
        {activeDetailTab === 'etapas' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            {role === 'admin' && MODELOS_PROCESSOS[p.tipo] && (
              <div className="flex justify-end mb-3">
                <button
                  onClick={() => {
                    if (!confirm(`Restaurar as ${MODELOS_PROCESSOS[p.tipo].length} etapas do modelo padrão? As etapas atuais serão substituídas.`)) return
                    const novas = MODELOS_PROCESSOS[p.tipo]
                    supabase.from('processos_societarios').update({ checklist: novas, status: 'Andamento' }).eq('id', p.id).then(() => {
                      setProcessos(prev => prev.map(x => x.id === p.id ? { ...x, checklist: novas, status: 'Andamento' } : x))
                      toast.success(`Modelo restaurado com ${novas.length} etapas.`)
                    })
                  }}
                  className="text-[10px] font-black text-slate-400 hover:text-yellow-600 border border-dashed border-slate-200 hover:border-yellow-400 px-2.5 py-1 rounded-lg transition-all"
                >
                  ↺ Restaurar modelo
                </button>
              </div>
            )}
            <div className="flex flex-col">
              {checklist.map((item: any, i: number) => (
                <div key={i} className={`group flex items-center gap-3 py-2.5 px-2 rounded-xl transition-colors hover:bg-slate-50 ${i < checklist.length - 1 ? 'border-b border-slate-100' : ''}`}>
                  <span className="text-[10px] font-bold text-slate-300 w-5 text-right flex-shrink-0 select-none">{i + 1}</span>
                  <button
                    onClick={() => !isViewer && updateEtapa(p.id, checklist, i)}
                    disabled={isViewer}
                    className={`w-5 h-5 rounded-full border-2 flex-shrink-0 transition-all ${!isViewer ? 'hover:scale-110 cursor-pointer' : 'cursor-default'} ${
                      item.status === 'Concluido' ? 'bg-emerald-500 border-emerald-500' : item.status === 'Andamento' ? 'bg-yellow-400 border-yellow-400' : 'bg-white border-slate-300'
                    }`}>
                    {item.status === 'Concluido' && <svg className="w-3 h-3 text-white mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                    {item.status === 'Andamento' && <span className="block w-1.5 h-1.5 bg-white rounded-full mx-auto" />}
                  </button>
                  {editingItem?.procId === p.id && editingItem?.index === i ? (
                    <div className="flex flex-1 gap-2">
                      <input autoFocus value={editText} onChange={e => setEditText(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') saveEditItem(p.id, checklist); if (e.key === 'Escape') setEditingItem(null) }}
                        className="flex-1 border-2 border-yellow-400 rounded-lg px-2 py-1 text-sm outline-none" />
                      <button onClick={() => saveEditItem(p.id, checklist)} className="bg-yellow-400 text-black text-xs font-black px-3 py-1 rounded-lg">OK</button>
                      <button onClick={() => setEditingItem(null)} className="bg-slate-100 text-slate-500 text-xs px-2 py-1 rounded-lg">✕</button>
                    </div>
                  ) : (
                    <span onClick={() => !isViewer && updateEtapa(p.id, checklist, i)}
                      className={`flex-1 text-sm transition-colors ${!isViewer ? 'cursor-pointer' : ''} ${
                        item.status === 'Concluido' ? 'line-through text-slate-400' : item.status === 'Andamento' ? 'text-yellow-700 font-medium' : 'text-slate-700'
                      }`}>{item.etapa}</span>
                  )}
                  <span className={`hidden group-hover:inline-flex text-[9px] font-black px-2 py-0.5 rounded-full flex-shrink-0 ${
                    item.status === 'Concluido' ? 'bg-emerald-100 text-emerald-700' : item.status === 'Andamento' ? 'bg-yellow-100 text-yellow-700' : 'bg-slate-100 text-slate-400'
                  }`}>{item.status}</span>
                  {!isViewer && editingItem === null && (
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                      <button onClick={() => { setEditingItem({ procId: p.id, index: i }); setEditText(item.etapa) }} className="w-6 h-6 bg-yellow-100 hover:bg-yellow-400 text-yellow-600 hover:text-black rounded-full text-[10px] font-black flex items-center justify-center transition-all">✎</button>
                      <button onClick={() => deleteItem(p.id, checklist, i)} className="w-6 h-6 bg-red-50 hover:bg-red-400 text-red-400 hover:text-white rounded-full text-[10px] font-black flex items-center justify-center transition-all">✕</button>
                    </div>
                  )}
                </div>
              ))}
              {!isViewer && (addingTo === p.id ? (
                <div className="flex items-center gap-2 mt-3 px-2">
                  <span className="w-5" /><span className="w-5" />
                  <input autoFocus value={newItemText} onChange={e => setNewItemText(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') addItem(p.id, checklist); if (e.key === 'Escape') { setAddingTo(null); setNewItemText('') } }}
                    placeholder="Nome da nova etapa..." className="flex-1 border-2 border-yellow-400 rounded-lg px-3 py-2 text-sm outline-none" />
                  <button onClick={() => addItem(p.id, checklist)} className="bg-yellow-400 text-black text-xs font-black px-3 py-2 rounded-lg">Adicionar</button>
                  <button onClick={() => { setAddingTo(null); setNewItemText('') }} className="bg-slate-100 text-slate-500 text-xs px-2 py-2 rounded-lg">✕</button>
                </div>
              ) : (
                <button onClick={() => setAddingTo(p.id)} className="mt-3 mx-2 py-2 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 hover:border-yellow-400 hover:text-yellow-500 transition-all text-sm font-bold">+ Adicionar Etapa</button>
              ))}
            </div>
          </div>
        )}

        {/* ── Tab: Documentos do Cliente ────────────────────────────────────── */}
        {activeDetailTab === 'documentos' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Documentos Solicitados ao Cliente</p>
                <p className="text-xs text-slate-400 mt-0.5">{docsRecebidos} de {docs.length} recebidos</p>
              </div>
              <div className="flex items-center gap-3">
                {role === 'admin' && DOCS_MODELOS[p.tipo] && (
                  <button
                    onClick={() => {
                      if (!confirm(`Restaurar os ${DOCS_MODELOS[p.tipo].length} documentos do modelo padrão? Os documentos atuais serão substituídos.`)) return
                      initDocs(p, true)
                    }}
                    className="text-[10px] font-black text-slate-400 hover:text-yellow-600 border border-dashed border-slate-200 hover:border-yellow-400 px-2.5 py-1 rounded-lg transition-all whitespace-nowrap"
                    title="Substituir lista pelo modelo padrão deste tipo de processo"
                  >
                    ↺ Restaurar modelo
                  </button>
                )}
                <div className="flex items-center gap-2">
                  <div className="h-2 w-24 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${docsRecebidos === docs.length ? 'bg-emerald-400' : 'bg-yellow-400'}`} style={{ width: `${docs.length ? Math.round((docsRecebidos / docs.length) * 100) : 0}%` }} />
                  </div>
                  <span className="text-xs font-black text-slate-500">{docs.length ? Math.round((docsRecebidos / docs.length) * 100) : 0}%</span>
                </div>
              </div>
            </div>
            <div className="flex flex-col">
              {docs.map((d: any, i: number) => (
                <div key={i} className={`group flex items-center gap-3 py-3 px-2 rounded-xl transition-colors hover:bg-slate-50 ${i < docs.length - 1 ? 'border-b border-slate-100' : ''}`}>
                  <button
                    onClick={() => !isViewer && toggleDoc(p.id, docs, i)}
                    disabled={isViewer}
                    className={`w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center transition-all ${!isViewer ? 'hover:scale-110 cursor-pointer' : 'cursor-default'} ${
                      d.recebido ? 'bg-emerald-500 border-emerald-500' : 'bg-white border-slate-300'
                    }`}>
                    {d.recebido && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                  </button>
                  {role === 'admin' && editingDocIndex === i ? (
                    <div className="flex flex-1 gap-2">
                      <input autoFocus value={editDocText} onChange={e => setEditDocText(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') saveEditDoc(p.id, docs, i); if (e.key === 'Escape') setEditingDocIndex(null) }}
                        className="flex-1 border-2 border-yellow-400 rounded-lg px-2 py-1 text-sm outline-none bg-yellow-50" />
                      <button onClick={() => saveEditDoc(p.id, docs, i)} className="bg-yellow-400 text-black text-xs font-black px-3 py-1 rounded-lg">OK</button>
                      <button onClick={() => setEditingDocIndex(null)} className="bg-slate-100 text-slate-500 text-xs px-2 py-1 rounded-lg">✕</button>
                    </div>
                  ) : (
                    <span className={`flex-1 text-sm transition-colors ${d.recebido ? 'line-through text-slate-400' : 'text-slate-700'}`}>{d.doc}</span>
                  )}
                  {!(role === 'admin' && editingDocIndex === i) && (
                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-full flex-shrink-0 ${d.recebido ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-50 text-amber-600'}`}>
                      {d.recebido ? 'Recebido' : 'Pendente'}
                    </span>
                  )}
                  {role === 'admin' && editingDocIndex !== i && (
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                      <button onClick={() => { setEditingDocIndex(i); setEditDocText(d.doc) }} className="w-6 h-6 bg-yellow-100 hover:bg-yellow-400 text-yellow-600 hover:text-black rounded-full text-[10px] font-black flex items-center justify-center transition-all" title="Editar">✎</button>
                      <button onClick={() => deleteDoc(p.id, docs, i)} className="w-6 h-6 bg-red-50 hover:bg-red-400 text-red-400 hover:text-white rounded-full text-[10px] font-black flex items-center justify-center transition-all" title="Excluir">✕</button>
                    </div>
                  )}
                </div>
              ))}
              {docs.length === 0 && (
                <p className="text-sm text-slate-400 italic text-center py-8">Nenhum documento configurado para este tipo de processo.</p>
              )}
            </div>
            {role === 'admin' && (
              <div className="mt-3 pt-3 border-t border-slate-100">
                {addingDoc ? (
                  <div className="flex items-center gap-2">
                    <input autoFocus value={newDocText} onChange={e => setNewDocText(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') addDoc(p.id, docs); if (e.key === 'Escape') { setAddingDoc(false); setNewDocText('') } }}
                      placeholder="Nome do documento..."
                      className="flex-1 border-2 border-yellow-400 rounded-xl px-3 py-2 text-sm outline-none bg-yellow-50" />
                    <button onClick={() => addDoc(p.id, docs)} className="bg-black text-yellow-400 text-xs font-black px-4 py-2 rounded-xl hover:bg-slate-800 transition-all">Adicionar</button>
                    <button onClick={() => { setAddingDoc(false); setNewDocText('') }} className="bg-slate-100 text-slate-500 text-xs px-3 py-2 rounded-xl">Cancelar</button>
                  </div>
                ) : (
                  <button onClick={() => setAddingDoc(true)} className="flex items-center gap-2 text-xs font-black text-slate-400 hover:text-yellow-600 transition-colors px-2 py-1 rounded-lg hover:bg-yellow-50">
                    <span className="w-5 h-5 bg-slate-100 hover:bg-yellow-100 rounded-full flex items-center justify-center text-base leading-none">+</span>
                    Adicionar documento
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Tab: Anotações ────────────────────────────────────────────────── */}
        {activeDetailTab === 'anotacoes' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            {!isViewer && (
              <div className="flex flex-col sm:flex-row gap-2 mb-5">
                <textarea rows={2} value={notaInput} onChange={e => setNotaInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) addNota(p.id) }}
                  placeholder="Registre o que aconteceu, o que foi feito, próximos passos... (Ctrl+Enter para salvar)"
                  className="flex-1 border-2 border-slate-200 focus:border-yellow-400 rounded-xl px-3 py-2 text-sm outline-none resize-none" />
                <button onClick={() => addNota(p.id)} disabled={savingNota || !notaInput.trim()}
                  className="bg-black text-yellow-400 px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wide disabled:opacity-40 hover:bg-slate-800 transition-all sm:self-start whitespace-nowrap">
                  Registrar
                </button>
              </div>
            )}
            <div className="space-y-2">
              {!notas[p.id] ? (
                <p className="text-xs text-slate-400 italic">Carregando...</p>
              ) : notas[p.id].length === 0 ? (
                <p className="text-xs text-slate-400 italic text-center py-8">Nenhuma anotação ainda.</p>
              ) : notas[p.id].map((nota: any) => (
                <div key={nota.id} className="group flex gap-3 bg-slate-50 rounded-xl px-4 py-3 border border-slate-100">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-700 whitespace-pre-wrap break-words">{nota.texto}</p>
                    <p className="text-[10px] text-slate-400 font-mono mt-1">
                      {new Date(nota.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  {!isViewer && (
                    <button onClick={() => deleteNota(nota.id, p.id)} className="opacity-0 group-hover:opacity-100 text-red-300 hover:text-red-500 text-xs font-black flex-shrink-0 transition-all self-start" title="Excluir">✕</button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── LISTA DE PROCESSOS ───────────────────────────────────────────────────

  const stats = {
    total: processos.length,
    andamento: processos.filter(p => p.status === 'Andamento').length,
    finalizado: processos.filter(p => p.status === 'Finalizado').length,
  }

  return (
    <div className="p-4 md:p-6 bg-[#F8FAFC] min-h-screen font-sans text-slate-900">

      {/* Cabeçalho */}
      <header className="flex flex-wrap justify-between items-center gap-3 mb-6">
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
          <button onClick={() => setIsModalOpen(true)} className="bg-black text-yellow-400 px-8 py-3 rounded-2xl font-bold text-xs shadow-xl hover:scale-105 transition-all">
            + NOVO PROCESSO
          </button>
        )}
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: 'Total', value: stats.total, color: 'bg-slate-900 text-white' },
          { label: 'Em Andamento', value: stats.andamento, color: 'bg-yellow-400 text-black' },
          { label: 'Finalizados', value: stats.finalizado, color: 'bg-emerald-500 text-white' },
        ].map(k => (
          <div key={k.label} className={`${k.color} rounded-2xl p-4 text-center`}>
            <div className="text-2xl font-black">{k.value}</div>
            <div className="text-[10px] font-black uppercase tracking-widest opacity-75 mt-0.5">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 mb-5">
        {([['Andamento', 'Em Andamento'], ['Finalizado', 'Finalizados'], ['todos', 'Todos']] as const).map(([val, label]) => (
          <button key={val} onClick={() => setFiltroStatus(val)}
            className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wide transition-all ${
              filtroStatus === val ? 'bg-black text-yellow-400' : 'bg-white text-slate-400 border border-slate-200 hover:bg-slate-50'
            }`}>
            {label} <span className="ml-1 opacity-60">({val === 'todos' ? processos.length : processos.filter(p => p.status === val).length})</span>
          </button>
        ))}
      </div>

      {loading && <p className="text-slate-400 text-sm italic text-center py-12">Carregando processos...</p>}

      {/* Tabela */}
      {!loading && processosFiltrados.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Cabeçalho da tabela */}
          <div className="hidden md:grid grid-cols-[2fr_2fr_2.5fr_1.5fr_1fr] gap-4 px-5 py-3 bg-slate-50 border-b border-slate-100">
            {['Processo / Empresa', 'O.S. / Título', 'Próxima Etapa', 'Progresso', 'Ações'].map(h => (
              <span key={h} className="text-[10px] font-black uppercase tracking-widest text-slate-400">{h}</span>
            ))}
          </div>

          {/* Linhas */}
          <div className="divide-y divide-slate-100">
            {processosFiltrados.map(p => {
              const checklist: any[] = p.checklist ?? []
              const concluido = checklist.filter(i => i.status === 'Concluido').length
              const total = checklist.length || 1
              const porc = Math.round((concluido / total) * 100)
              const nomeExibido = p.empresas?.razao_social || p.cliente_nome || '—'
              const proxEtapa = proximaEtapa(checklist)
              const docs: any[] = p.docs_solicitados ?? []
              const docsRec = docs.filter(d => d.recebido).length

              return (
                <div key={p.id} className="grid grid-cols-1 md:grid-cols-[2fr_2fr_2.5fr_1.5fr_1fr] gap-4 px-5 py-4 hover:bg-slate-50 transition-colors cursor-pointer group items-center"
                  onClick={() => { setSelectedId(p.id); setActiveDetailTab('etapas') }}>

                  {/* Processo / Empresa */}
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-full flex-shrink-0 uppercase tracking-wide ${TIPO_COLORS[p.tipo] ?? 'bg-slate-100 text-slate-500'}`}>
                      {TIPO_LABELS[p.tipo] ?? p.tipo}
                    </span>
                    <span className="font-black text-slate-800 text-sm truncate">{nomeExibido}</span>
                  </div>

                  {/* O.S. / Título */}
                  <div className="text-xs text-slate-500 truncate">
                    {p.titulo ? <span className="font-medium text-yellow-700">{p.titulo}</span> : <span className="italic text-slate-300">—</span>}
                  </div>

                  {/* Próxima Etapa */}
                  <div className="text-xs text-slate-600 truncate">{proxEtapa}</div>

                  {/* Progresso */}
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden min-w-0">
                      <div className={`h-full rounded-full transition-all ${porc === 100 ? 'bg-emerald-400' : 'bg-yellow-400'}`} style={{ width: `${porc}%` }} />
                    </div>
                    <span className="text-[10px] font-black text-slate-400 flex-shrink-0">{porc}%</span>
                  </div>

                  {/* Ações */}
                  <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                    {docs.length > 0 && (
                      <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${docsRec === docs.length ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                        📁 {docsRec}/{docs.length}
                      </span>
                    )}
                    <button onClick={() => { setSelectedId(p.id); setActiveDetailTab('etapas') }}
                      className="w-8 h-8 bg-black text-yellow-400 rounded-xl flex items-center justify-center hover:bg-slate-800 transition-all group-hover:scale-105">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {!loading && processosFiltrados.length === 0 && (
        <div className="text-center py-20 text-slate-400 italic">
          {filtroStatus === 'Andamento' ? 'Nenhum processo em andamento.' : 'Nenhum processo encontrado.'}
        </div>
      )}

      {/* ── Modal novo processo ──────────────────────────────────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 md:p-10 rounded-[40px] w-full max-w-md border-t-8 border-yellow-400 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button onClick={() => { setIsModalOpen(false); setFormData({ empresa_id: '', cliente_nome: '', tipo: 'abertura', titulo: '' }) }} className="absolute top-6 right-6 font-bold text-slate-300 hover:text-red-500">FECHAR ✕</button>
            <h2 className="text-2xl font-black mb-8 tracking-tighter text-slate-900">Iniciar Novo Processo</h2>
            <form onSubmit={handleIniciar} className="space-y-5">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Título / Nº O.S.</label>
                <input type="text" placeholder="Ex: O.S. 001/2026 — Abertura Padaria Central"
                  className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl mt-1 text-sm font-bold outline-none focus:border-yellow-400"
                  value={formData.titulo} onChange={e => setFormData({ ...formData, titulo: e.target.value })} />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Tipo de Serviço</label>
                <select className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl mt-1 text-sm font-bold outline-none focus:border-yellow-400 text-slate-800"
                  value={formData.tipo} onChange={e => setFormData({ ...formData, tipo: e.target.value })}>
                  {Object.keys(MODELOS_PROCESSOS).map(tipo => (
                    <option key={tipo} value={tipo}>{TIPO_LABELS[tipo] ?? tipo}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Empresa <span className="text-slate-300 font-normal">(opcional)</span></label>
                <select className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl mt-1 text-sm font-bold outline-none focus:border-yellow-400 text-slate-800"
                  value={formData.empresa_id} onChange={e => setFormData({ ...formData, empresa_id: e.target.value, cliente_nome: '' })}>
                  <option value="">— Sem empresa cadastrada —</option>
                  {empresas.map(e => <option key={e.id} value={e.id}>{e.razao_social}</option>)}
                </select>
              </div>
              {!formData.empresa_id && (
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Nome do Cliente <span className="text-red-400">*</span></label>
                  <input type="text" placeholder="Ex: João da Silva"
                    className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl mt-1 text-sm font-bold outline-none focus:border-yellow-400"
                    value={formData.cliente_nome} onChange={e => setFormData({ ...formData, cliente_nome: e.target.value })} />
                </div>
              )}
              <button type="submit" className="w-full bg-black text-yellow-400 p-4 rounded-2xl font-black text-sm uppercase tracking-wide hover:bg-slate-900 transition-all mt-2">
                Iniciar Processo →
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
