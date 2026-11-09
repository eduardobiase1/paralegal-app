'use client'

import { Suspense, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Empresa, AC_URLS } from '@/types'
import { formatDate, formatCNPJ } from '@/lib/utils'
import StatusBadge from '@/components/ui/StatusBadge'
import Modal from '@/components/ui/Modal'
import CertificadoForm from '@/components/modules/CertificadoForm'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import toast from 'react-hot-toast'
import { registrarAcao, diaLocal } from '@/lib/atividade'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Download, FileText, Search, Ellipsis } from 'lucide-react'
import { useOrg } from '@/lib/org-context'

type Aba = 'processo' | 'renovar' | 'emitidos' | 'quinzena'

const MESES = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro']
const MESES_ABREV = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ']

// ── Etapas do processo (da venda à emissão) ──────────────────────────────────
const ETAPAS = [
  { nome: 'Cliente pagou',                  acao: 'Confirmar pagamento', parado: 'Confirmar pagamento' },
  { nome: 'Dados enviados à certificadora', acao: 'Copiar dados',        parado: 'Enviar dados' },
  { nome: 'Boleto recebido',                acao: 'Registrar boleto',    parado: 'Aguardando boleto' },
  { nome: 'Boleto pago',                    acao: 'Marcar boleto pago',  parado: 'Pagar boleto' },
  { nome: 'Voucher emitido',                acao: 'Informar voucher',    parado: 'Emitir voucher' },
  { nome: 'Atendimento agendado',           acao: 'Agendar',             parado: 'Agendar atendimento' },
  { nome: 'Certificado emitido',            acao: 'Marcar emitido',      parado: 'Aguardando atendimento' },
]

const MODELO_OFERTA_PADRAO =
  'Olá, {titular}! O certificado digital {certificado} de {empresa} vence em {vencimento}. ' +
  'Para não ficar sem emitir notas e acessar o e-CAC, podemos renovar agora. Valor: R$ [VALOR]. ' +
  'Posso seguir com a renovação?'

function etapasFeitas(c: any): boolean[] {
  return [
    !!(c.cliente_pagou_em || c.pagamento_confirmado),
    !!c.dados_enviados_em,
    !!c.boleto_recebido_em,
    !!c.boleto_pago_em,
    !!(c.voucher_emitido_em || c.voucher_numero),
    !!c.data_agendamento,
    !!c.certificado_finalizado,
  ]
}
function etapaAtual(c: any): number {
  const i = etapasFeitas(c).indexOf(false)
  return i === -1 ? 6 : i
}

function diasAte(d?: string | null): number | null {
  if (!d) return null
  const h = new Date(); h.setHours(0, 0, 0, 0)
  return Math.round((new Date(d.slice(0, 10) + 'T00:00:00').getTime() - h.getTime()) / 86400000)
}
function fmtCurto(d?: string | null) {
  if (!d) return ''
  return new Date(d.slice(0, 10) + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}
function fmtDateTime(iso?: string | null) {
  if (!iso) return ''
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}
function quandoAgenda(c: any) {
  if (!c.data_agendamento) return ''
  const d = new Date(c.data_agendamento)
  return `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
}
function fmtAgenda(c: any) {
  if (!c.data_agendamento) return ''
  return `${c.agendamento_modalidade === 'presencial' ? 'presencial' : 'videoconferência'} ${quandoAgenda(c)}`
}
function moeda(v?: number | null) {
  return v == null ? '' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function toLocalDatetimeInput(iso: string): string {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}
function somarAnos(iso: string, anos: number) {
  const d = new Date(iso + 'T12:00:00'); d.setFullYear(d.getFullYear() + anos)
  return diaLocal(d)
}

// Texto curto da etapa: o que já aconteceu nela
function infoEtapa(c: any, i: number): string {
  switch (i) {
    case 0: return c.cliente_pagou_em ? formatDate(c.cliente_pagou_em) : (c.pagamento_confirmado ? 'confirmado' : '')
    case 1: return c.dados_enviados_em ? formatDate(c.dados_enviados_em) : ''
    case 2: return c.boleto_recebido_em ? [moeda(c.boleto_valor), c.boleto_vencimento ? `vencimento ${formatDate(c.boleto_vencimento)}` : ''].filter(Boolean).join(' · ') : ''
    case 3: return c.boleto_pago_em ? formatDate(c.boleto_pago_em) : ''
    case 4: return c.voucher_numero ? `nº ${c.voucher_numero}` : (c.voucher_emitido_em ? formatDate(c.voucher_emitido_em) : '')
    case 5: return fmtAgenda(c)
    case 6: return c.certificado_finalizado ? [c.data_conclusao ? formatDate(c.data_conclusao) : '', c.data_vencimento ? `válido até ${formatDate(c.data_vencimento)}` : ''].filter(Boolean).join(' · ') : ''
  }
  return ''
}

// Contexto da etapa atual, mostrado na lista
function contextoAtual(c: any, i: number): string {
  switch (i) {
    case 1: return c.cliente_pagou_em ? `cliente pagou em ${fmtCurto(c.cliente_pagou_em)}` : ''
    case 2: return c.dados_enviados_em ? `dados enviados em ${fmtCurto(c.dados_enviados_em)}` : ''
    case 3: return [moeda(c.boleto_valor), c.boleto_vencimento ? `vence ${fmtCurto(c.boleto_vencimento)}` : ''].filter(Boolean).join(', ')
    case 4: return c.boleto_pago_em ? `boleto pago em ${fmtCurto(c.boleto_pago_em)}` : ''
    case 5: return c.voucher_numero ? `voucher ${c.voucher_numero}` : ''
    case 6: return fmtAgenda(c)
  }
  return ''
}

// Avisos de atraso, em laranja
function alertaEtapa(c: any, i: number): string {
  const desde = (d?: string | null) => { const x = diasAte(d); return x === null ? null : -x }
  if (i === 1) { const n = desde(c.cliente_pagou_em); if (n !== null && n >= 2) return `Cliente pagou há ${n} dias e os dados ainda não foram enviados` }
  if (i === 3) {
    const n = diasAte(c.boleto_vencimento)
    if (n !== null && n < 0) return `Boleto vencido há ${-n} dia${n === -1 ? '' : 's'}`
    if (n === 0) return 'Boleto vence hoje'
    if (n === 1) return 'Boleto vence amanhã'
    if (n === 2) return 'Boleto vence depois de amanhã'
  }
  if (i === 4) { const n = desde(c.boleto_pago_em); if (n !== null && n >= 2) return `Boleto pago há ${n} dias, voucher ainda não emitido` }
  if (i === 5) { const n = desde(c.voucher_emitido_em); if (n !== null && n >= 3) return `Voucher emitido há ${n} dias sem agendamento` }
  if (i === 6 && c.data_agendamento && new Date(c.data_agendamento).getTime() < Date.now()) return 'O atendimento já passou: o certificado foi emitido?'
  return ''
}

// Quinzena: 1ª = dias 1 a 15 · 2ª = dia 16 ao fim do mês
function periodoQuinzena(mes: string, num: 1 | 2) {
  const [y, m] = mes.split('-').map(Number)
  const ultimo = new Date(y, m, 0).getDate()
  const ini = `${mes}-${num === 1 ? '01' : '16'}`
  const fim = `${mes}-${num === 1 ? '15' : String(ultimo)}`
  const br = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`
  return { ini, fim, titulo: `${num}ª quinzena de ${MESES[m - 1]} de ${y}`, faixa: `${br(ini)} a ${br(fim)}` }
}

function statusCor(d: number | null) {
  if (d === null) return 'sem_data'
  if (d < 0) return 'vencido'
  if (d <= 30) return 'critico'
  if (d <= 60) return 'atencao'
  if (d <= 90) return 'alerta'
  return 'ok'
}

function erroDeColuna(error: { code?: string; message?: string } | null) {
  return !!error && (error.code === 'PGRST204' || /column/i.test(error.message || ''))
}

const PASSO_VAZIO = { data: '', valor: '', vencimento: '', voucher: '', agenda: '', modalidade: 'video', emissao: '', validade: '' }

function CertificadosPageInner() {
  const searchParams = useSearchParams()
  const { orgName, orgId } = useOrg()
  const [supabase] = useState(createClient)
  const [certs, setCerts] = useState<any[]>([])
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editItem, setEditItem] = useState<any | null>(null)
  const [deleteItem, setDeleteItem] = useState<any | null>(null)
  const [filtroEmpresa, setFiltroEmpresa] = useState(searchParams.get('empresa') || '')
  const [aba, setAba] = useState<Aba>('processo')
  const [busca, setBusca] = useState('')
  const [filtroEtapa, setFiltroEtapa] = useState<number | null>(null)
  const [filtroEmissao, setFiltroEmissao] = useState<number | null>(null)
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set())
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [passo, setPasso] = useState(PASSO_VAZIO)
  const [salvando, setSalvando] = useState(false)
  const [menuAberto, setMenuAberto] = useState<string | null>(null)
  const [modeloOferta, setModeloOferta] = useState(MODELO_OFERTA_PADRAO)
  const [editandoModelo, setEditandoModelo] = useState(false)
  const [modeloTexto, setModeloTexto] = useState('')
  // Relatório quinzenal — abre sempre na quinzena de hoje (no dia 16 vira sozinho para a 2ª)
  const [qMes, setQMes] = useState(() => diaLocal().slice(0, 7))
  const [qNum, setQNum] = useState<1 | 2>(() => (new Date().getDate() <= 15 ? 1 : 2))

  async function load() {
    if (!orgId) return
    setLoading(true)
    const [{ data: cs }, { data: emps }, { data: org }] = await Promise.all([
      supabase.from('certificados_digitais')
        .select('*, empresas(razao_social, cnpj, email, telefone, logradouro, numero, complemento, bairro, cidade, uf, cep, org_id)')
        .order('data_vencimento', { ascending: true }),
      supabase.from('empresas').select('id, razao_social, cnpj').eq('org_id', orgId).order('razao_social'),
      supabase.from('organizations').select('*').eq('id', orgId).maybeSingle(),
    ])
    // Só certificados da organização selecionada: de empresas dela ou avulsos cadastrados nela
    const daOrg = (c: any) => c.empresa_id ? c.empresas?.org_id === orgId : c.org_id === orgId
    setCerts((cs ?? []).filter(daOrg).map((c: any) => {
      const dias = diasAte(c.data_vencimento)
      return {
        ...c,
        razao_social: c.empresas?.razao_social || c.empresa_nome_livre || '',
        cnpj: c.empresas?.cnpj || c.empresa_cnpj_livre || '',
        dias_para_vencer: dias,
        status_cor: statusCor(dias),
      }
    }))
    setEmpresas((emps ?? []) as Empresa[])
    if ((org as any)?.modelo_oferta_certificado) setModeloOferta((org as any).modelo_oferta_certificado)
    setLoading(false)
  }

  useEffect(() => { load() }, [orgId])

  useEffect(() => {
    if (!menuAberto) return
    const fechar = () => setMenuAberto(null)
    document.addEventListener('click', fechar)
    return () => document.removeEventListener('click', fechar)
  }, [menuAberto])

  // Ao abrir um certificado, prepara o formulário da etapa atual
  useEffect(() => {
    const c = certs.find(x => x.id === selectedId)
    if (!c) return
    const hoje = diaLocal()
    setPasso({
      data: hoje,
      valor: c.boleto_valor != null ? String(c.boleto_valor).replace('.', ',') : '',
      vencimento: c.boleto_vencimento || '',
      voucher: c.voucher_numero || '',
      agenda: c.data_agendamento ? toLocalDatetimeInput(c.data_agendamento) : '',
      modalidade: c.agendamento_modalidade || 'video',
      emissao: hoje,
      validade: somarAnos(hoje, c.tipo === 'A3' ? 3 : 1),
    })
  }, [selectedId])

  // ── Gravação ──────────────────────────────────────────────────────────────
  async function salvar(id: string, fields: Record<string, any>): Promise<boolean> {
    setSalvando(true)
    const { error } = await supabase.from('certificados_digitais').update(fields).eq('id', id)
    setSalvando(false)
    if (error) {
      toast.error(erroDeColuna(error) ? 'Rode a migration_v16 no Supabase para usar as novas etapas.' : 'Erro ao salvar: ' + error.message)
      return false
    }
    setCerts(prev => prev.map(c => c.id === id ? { ...c, ...fields } : c))
    return true
  }

  function camposEtapa(i: number): Record<string, any> | null {
    switch (i) {
      case 0: return { cliente_pagou_em: passo.data || diaLocal(), pagamento_confirmado: true }
      case 1: return { dados_enviados_em: passo.data || diaLocal() }
      case 2: {
        const valor = passo.valor ? Number(passo.valor.replace(/\./g, '').replace(',', '.')) : null
        if (passo.valor && Number.isNaN(valor)) { toast.error('Valor do boleto inválido.'); return null }
        return { boleto_recebido_em: diaLocal(), boleto_valor: valor, boleto_vencimento: passo.vencimento || null }
      }
      case 3: return { boleto_pago_em: passo.data || diaLocal() }
      case 4:
        if (!passo.voucher.trim()) { toast.error('Informe o número do voucher.'); return null }
        return { voucher_numero: passo.voucher.trim(), voucher_emitido_em: diaLocal() }
      case 5:
        if (!passo.agenda) { toast.error('Informe a data e a hora do atendimento.'); return null }
        return { data_agendamento: new Date(passo.agenda).toISOString(), agendamento_modalidade: passo.modalidade }
      case 6:
        if (!passo.emissao || !passo.validade) { toast.error('Informe a emissão e a nova validade.'); return null }
        return { certificado_finalizado: true, data_conclusao: passo.emissao, data_emissao: passo.emissao, data_vencimento: passo.validade }
    }
    return null
  }

  async function concluirEtapa(c: any, i: number, campos?: Record<string, any>) {
    const f = campos ?? camposEtapa(i)
    if (!f) return
    if (!(await salvar(c.id, f))) return
    toast.success(i === 6 ? 'Certificado emitido! Movido para Emitidos.' : `${ETAPAS[i].nome}: registrado.`)
    registrarAcao(i === 6 ? 'Certificado finalizado' : 'Certificado digital',
      `${ETAPAS[i].nome} — ${c.titular} (${c.uso} ${c.tipo})`, { empresaId: c.empresa_id, empresaNome: c.razao_social })
    if (i === 6) { setSelectedId(null); setAba('emitidos') }
  }

  async function desfazerEtapa(c: any, i: number) {
    const limpar: Record<number, Record<string, any>> = {
      0: { cliente_pagou_em: null, pagamento_confirmado: false },
      1: { dados_enviados_em: null },
      2: { boleto_recebido_em: null, boleto_valor: null, boleto_vencimento: null },
      3: { boleto_pago_em: null },
      4: { voucher_numero: null, voucher_emitido_em: null },
      5: { data_agendamento: null, agendamento_modalidade: null },
      6: { certificado_finalizado: false, data_conclusao: null },
    }
    if (await salvar(c.id, limpar[i])) toast.success(i === 6 ? 'Processo reaberto.' : `${ETAPAS[i].nome}: desfeito.`)
  }

  // ── Dados para a certificadora e mensagens ───────────────────────────────
  function textoDados(c: any) {
    const e = c.empresas || {}
    const endereco = [[e.logradouro, e.numero].filter(Boolean).join(', '), e.complemento, e.bairro, [e.cidade, e.uf].filter(Boolean).join('/'), e.cep]
      .filter(Boolean).join(' · ')
    return [
      `Tipo: ${c.uso} ${c.tipo}`,
      `Razão social: ${(c.razao_social || '').toUpperCase()}`,
      `CNPJ: ${c.cnpj ? formatCNPJ(c.cnpj) : '—'}`,
      `Titular: ${(c.titular || '').toUpperCase()}`,
      `E-mail: ${c.titular_email || e.email || '—'}`,
      `Telefone: ${c.titular_telefone || e.telefone || '—'}`,
      `Endereço: ${endereco || '—'}`,
    ].join('\n')
  }

  async function copiarDados(c: any) {
    try {
      await navigator.clipboard.writeText(textoDados(c))
      toast.success('Dados copiados: é só colar no e-mail ou no site da certificadora.')
      return true
    } catch {
      toast.error('Não foi possível copiar. Selecione o texto e copie manualmente.')
      return false
    }
  }

  function abrirEmail(c: any) {
    const assunto = `Emissão de certificado digital ${c.uso} ${c.tipo} — ${c.razao_social}`
    window.location.href = `mailto:?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(textoDados(c))}`
  }

  function telefoneWhats(c: any) {
    const tel = String(c.titular_telefone || c.empresas?.telefone || '').replace(/\D/g, '')
    if (!tel) return ''
    return tel.startsWith('55') ? tel : `55${tel}`
  }
  function abrirWhats(c: any, texto: string) {
    const tel = telefoneWhats(c)
    window.open(`https://api.whatsapp.com/send?${tel ? `phone=${tel}&` : ''}text=${encodeURIComponent(texto)}`, '_blank')
  }

  function msgConfirmacao(c: any) {
    const primeiroNome = (c.titular || '').split(' ')[0]
    const presencial = c.agendamento_modalidade === 'presencial'
    return [
      `Olá, ${primeiroNome}! Seu certificado digital ${c.uso} ${c.tipo} está agendado:`,
      `Data: ${quandoAgenda(c)}${presencial ? ', presencial' : ', por videoconferência'}`,
      presencial ? '' : `Link: será enviado pela ${c.autoridade_certificadora || 'certificadora'} no seu e-mail`,
      `Tenha em mãos: documento com foto (RG ou CNH)${presencial ? '' : ' e celular com câmera'}.`,
      `Qualquer dúvida, estamos à disposição. ${orgName}`,
    ].filter(Boolean).join('\n')
  }

  function msgOferta(c: any) {
    return modeloOferta
      .replace(/\{titular\}/g, (c.titular || '').split(' ')[0])
      .replace(/\{empresa\}/g, c.razao_social || '')
      .replace(/\{certificado\}/g, `${c.uso} ${c.tipo}`)
      .replace(/\{vencimento\}/g, c.data_vencimento ? formatDate(c.data_vencimento) : '')
      + `\n${orgName}`
  }

  async function oferecerRenovacao(c: any) {
    abrirWhats(c, msgOferta(c))
    if (await salvar(c.id, { oferta_renovacao_em: diaLocal() })) {
      registrarAcao('Comunicado', `Renovação de certificado oferecida — ${c.titular}`, { empresaId: c.empresa_id, empresaNome: c.razao_social })
    }
  }

  async function salvarModelo() {
    const texto = modeloTexto.trim() || MODELO_OFERTA_PADRAO
    const { error } = await supabase.from('organizations').update({ modelo_oferta_certificado: texto }).eq('id', orgId)
    if (error) { toast.error(erroDeColuna(error) ? 'Rode a migration_v16 no Supabase para salvar o modelo.' : 'Não foi possível salvar o modelo: ' + error.message); return }
    setModeloOferta(texto)
    setEditandoModelo(false)
    toast.success('Modelo da mensagem salvo.')
  }

  // Renovação paga: abre um novo processo copiando os dados do certificado atual
  async function clientePagouRenovacao(c: any) {
    const base: Record<string, any> = {
      empresa_id: c.empresa_id, empresa_nome_livre: c.empresa_nome_livre, empresa_cnpj_livre: c.empresa_cnpj_livre,
      org_id: c.empresa_id ? null : orgId,
      titular: c.titular, tipo: c.tipo, uso: c.uso, autoridade_certificadora: c.autoridade_certificadora,
      localizacao_fisica: c.localizacao_fisica, pagamento_confirmado: true, certificado_finalizado: false,
    }
    const novos = { cliente_pagou_em: diaLocal(), renovacao_de: c.id, titular_email: c.titular_email, titular_telefone: c.titular_telefone }
    let { data, error } = await supabase.from('certificados_digitais').insert({ ...base, ...novos }).select('id').single()
    if (erroDeColuna(error)) {
      ;({ data, error } = await supabase.from('certificados_digitais').insert(base).select('id').single())
      if (!error) toast('Renovação aberta. Rode a migration_v16 para registrar as etapas novas.')
    }
    if (error || !data) { toast.error('Erro ao abrir a renovação: ' + (error?.message || '')); return }
    toast.success('Renovação aberta em Em processo.')
    registrarAcao('Cadastro', `Renovação de certificado digital iniciada — ${c.titular}`, { empresaId: c.empresa_id, empresaNome: c.razao_social })
    await load()
    setAba('processo')
    setSelectedId(data.id)
  }

  // ── Ação rápida da lista ─────────────────────────────────────────────────
  async function acaoRapida(c: any) {
    const i = etapaAtual(c)
    if (i === 1) {
      if (await copiarDados(c)) await concluirEtapa(c, 1, { dados_enviados_em: diaLocal() })
      return
    }
    if (i === 0) return concluirEtapa(c, 0, { cliente_pagou_em: diaLocal(), pagamento_confirmado: true })
    if (i === 3) return concluirEtapa(c, 3, { boleto_pago_em: diaLocal() })
    setSelectedId(c.id)
  }

  // ── Filtros ──────────────────────────────────────────────────────────────
  const byEmpresa = (list: any[]) =>
    filtroEmpresa === '__avulsa__' ? list.filter(c => !c.empresa_id)
      : filtroEmpresa ? list.filter(c => c.empresa_id === filtroEmpresa) : list

  const norm = (str: string) => str.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  const byBusca = (list: any[]) => {
    const q = norm(busca.trim())
    if (!q) return list
    const qDigits = q.replace(/\D/g, '')
    return list.filter(c => norm(c.razao_social || '').includes(q) || norm(c.titular || '').includes(q)
      || (qDigits && String(c.cnpj || '').replace(/\D/g, '').includes(qDigits)))
  }

  const emProcessoTodos = byBusca(byEmpresa(certs.filter(c => !c.certificado_finalizado)))
    .sort((a, b) => etapaAtual(a) - etapaAtual(b) || (a.created_at || '').localeCompare(b.created_at || ''))
  const contagemEtapas = ETAPAS.map((_, i) => emProcessoTodos.filter(c => etapaAtual(c) === i).length)
  const emProcesso = filtroEtapa === null ? emProcessoTodos : emProcessoTodos.filter(c => etapaAtual(c) === filtroEtapa)

  const byEmissao = (list: any[]) => {
    if (!filtroEmissao) return list
    const corte = new Date(); corte.setDate(corte.getDate() - filtroEmissao); corte.setHours(0, 0, 0, 0)
    return list.filter(c => c.data_emissao && new Date(c.data_emissao + 'T12:00:00') >= corte)
  }
  const finalizados = byEmissao(byBusca(byEmpresa(certs.filter(c => !!c.certificado_finalizado))))

  // Renovar em breve: emitidos que vencem nos próximos 45 dias (ou venceram há até 30) e sem renovação aberta
  const comRenovacaoAberta = new Set(certs.filter(c => c.renovacao_de).map(c => c.renovacao_de))
  const paraRenovar = byBusca(byEmpresa(certs.filter(c => {
    const d = c.dias_para_vencer
    return c.certificado_finalizado && d !== null && d >= -30 && d <= 45 && !comRenovacaoAberta.has(c.id)
  }))).sort((a, b) => (a.data_vencimento || '').localeCompare(b.data_vencimento || ''))
  const gruposRenovar = [
    { titulo: 'Já venceram', tom: 'bg-red-50 text-red-800', itens: paraRenovar.filter(c => c.dias_para_vencer < 0) },
    { titulo: 'Vencem em até 15 dias', tom: 'bg-orange-50 text-orange-800', itens: paraRenovar.filter(c => c.dias_para_vencer >= 0 && c.dias_para_vencer <= 15) },
    { titulo: 'Vencem em 16 a 45 dias', tom: 'bg-slate-100 text-slate-700', itens: paraRenovar.filter(c => c.dias_para_vencer > 15) },
  ].filter(g => g.itens.length > 0)

  // ── Seleção e exportação para Excel ──────────────────────────────────────
  function toggleSel(id: string) {
    setSelecionados(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  }
  function toggleTodos(lista: any[]) {
    setSelecionados(prev => {
      const n = new Set(prev)
      const todos = lista.length > 0 && lista.every(c => n.has(c.id))
      lista.forEach(c => { if (todos) n.delete(c.id); else n.add(c.id) })
      return n
    })
  }
  const todosMarcados = (lista: any[]) => lista.length > 0 && lista.every(c => selecionados.has(c.id))

  const cadastradoEm = (c: any) => (c.created_at ? diaLocal(new Date(c.created_at)) : '')
  const concluidoEm = (c: any) => (c.data_conclusao as string | null) || ''

  async function exportarExcel(lista: any[], arquivo: string, cabecalho: (string | number)[][] = []) {
    if (lista.length === 0) { toast.error('Nada para exportar.'); return }
    const XLSX = await import('xlsx')
    const linhas = lista.map(c => [
      c.razao_social, c.cnpj ? formatCNPJ(c.cnpj) : '', c.titular, c.tipo, c.uso, c.autoridade_certificadora,
      c.created_at ? formatDate(cadastradoEm(c)) : '',
      c.certificado_finalizado ? 'Emitido' : ETAPAS[etapaAtual(c)].parado,
      c.boleto_valor != null ? Number(c.boleto_valor) : '', c.voucher_numero || '', fmtDateTime(c.data_agendamento),
      c.data_emissao ? formatDate(c.data_emissao) : '', c.data_vencimento ? formatDate(c.data_vencimento) : '',
      concluidoEm(c) ? formatDate(concluidoEm(c)) : '', c.observacoes || '',
    ])
    const titulos = ['Empresa', 'CNPJ', 'Titular', 'Tipo', 'Uso', 'Autoridade certificadora', 'Cadastrado em',
      'Etapa', 'Valor do boleto', 'Voucher', 'Atendimento', 'Emissão', 'Vencimento', 'Concluído em', 'Observações']
    const ws = XLSX.utils.aoa_to_sheet([...cabecalho, titulos, ...linhas])
    ws['!cols'] = [38, 20, 28, 6, 10, 20, 14, 24, 14, 14, 18, 12, 12, 14, 40].map(wch => ({ wch }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Certificados')
    XLSX.writeFile(wb, arquivo + '.xlsx')
    toast.success(`${lista.length} certificado(s) exportado(s).`)
  }

  function exportarLista() {
    const visiveis = aba === 'processo' ? emProcesso : aba === 'renovar' ? paraRenovar : finalizados
    const marcados = certs.filter(c => selecionados.has(c.id))
    exportarExcel(marcados.length > 0 ? marcados : visiveis, `certificados_${diaLocal()}`)
  }

  // ── Relatório quinzenal ──────────────────────────────────────────────────
  const quinzena = periodoQuinzena(qMes, qNum)
  const noPeriodo = (d: string) => !!d && d >= quinzena.ini && d <= quinzena.fim
  const daQuinzena = byEmpresa(certs)
    .filter(c => noPeriodo(cadastradoEm(c)) || noPeriodo(concluidoEm(c)))
    .sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''))
  const qCadastrados = daQuinzena.filter(c => noPeriodo(cadastradoEm(c)))
  const qConcluidos  = daQuinzena.filter(c => noPeriodo(concluidoEm(c)))
  const qPendentes   = qCadastrados.filter(c => !c.certificado_finalizado)
  const empresaNomeAtual = filtroEmpresa && filtroEmpresa !== '__avulsa__'
    ? (empresas.find(e => e.id === filtroEmpresa)?.razao_social || '') : ''

  function mudarQuinzena(delta: 1 | -1) {
    if (delta === 1 && qNum === 1) { setQNum(2); return }
    if (delta === -1 && qNum === 2) { setQNum(1); return }
    const [y, m] = qMes.split('-').map(Number)
    setQMes(diaLocal(new Date(y, m - 1 + delta, 1)).slice(0, 7))
    setQNum(delta === 1 ? 1 : 2)
  }

  function exportarQuinzena() {
    exportarExcel(daQuinzena, `certificados_${qMes}_${qNum}a-quinzena`, [
      [`Certificados digitais — ${quinzena.titulo} (${quinzena.faixa})`],
      ['Cadastrados na quinzena', qCadastrados.length, 'Concluídos na quinzena', qConcluidos.length, 'Cadastrados ainda pendentes', qPendentes.length],
      [],
    ])
  }

  // PDF do relatório quinzenal — abre em nova aba, sem baixar
  async function abrirPdfQuinzena() {
    if (daQuinzena.length === 0) { toast.error('Nada para gerar nesta quinzena.'); return }
    // a aba precisa ser aberta já no clique, senão o navegador bloqueia como popup
    const janela = window.open('', '_blank')
    if (!janela) { toast.error('Permita popups neste site para abrir o PDF.'); return }
    janela.document.title = 'Gerando relatório...'
    try {
      const jsPDF = (await import('jspdf')).default
      await import('jspdf-autotable')
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
      const W = doc.internal.pageSize.getWidth()
      const H = doc.internal.pageSize.getHeight()
      doc.setFillColor(13, 13, 13); doc.rect(0, 0, W, 24, 'F')
      doc.setFont('helvetica', 'bold'); doc.setFontSize(16)
      doc.setTextColor(255, 255, 255); doc.text('PARALEGAL', 14, 15)
      doc.setTextColor(245, 158, 11); doc.text('PRO', 14 + doc.getTextWidth('PARALEGAL '), 15)
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(200, 200, 200)
      doc.text(orgName, W - 14, 11, { align: 'right' })
      doc.text(`Emitido em ${new Date().toLocaleDateString('pt-BR')}`, W - 14, 16, { align: 'right' })
      doc.setTextColor(15, 23, 42); doc.setFont('helvetica', 'bold'); doc.setFontSize(14)
      doc.text('Certificados digitais — relatório quinzenal', 14, 36)
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(71, 85, 105)
      const t = quinzena.titulo
      doc.text(`${t.charAt(0).toUpperCase() + t.slice(1)} · ${quinzena.faixa}${empresaNomeAtual ? ' · ' + empresaNomeAtual : ''}`, 14, 42)
      const totais: Array<[string, number]> = [
        ['Cadastrados na quinzena', qCadastrados.length],
        ['Concluídos na quinzena', qConcluidos.length],
        ['Cadastrados ainda pendentes', qPendentes.length],
      ]
      totais.forEach(([rotulo, valor], i) => {
        const x = 14 + i * 68
        doc.setDrawColor(226, 232, 240); doc.setFillColor(248, 250, 252)
        doc.roundedRect(x, 48, 62, 18, 2, 2, 'FD')
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(71, 85, 105); doc.text(rotulo, x + 4, 54)
        doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(15, 23, 42); doc.text(String(valor), x + 4, 62)
      })
      ;(doc as any).autoTable({
        startY: 72,
        margin: { left: 14, right: 14, bottom: 14 },
        head: [['Cadastrado em', 'Concluído em', 'Empresa', 'CNPJ', 'Titular', 'Tipo / Uso', 'AC', 'Situação']],
        body: daQuinzena.map(c => [
          c.created_at ? formatDate(cadastradoEm(c)) : '—',
          concluidoEm(c) ? formatDate(concluidoEm(c)) : '—',
          c.razao_social || '—',
          c.cnpj ? formatCNPJ(c.cnpj) : '—',
          c.titular || '—',
          `${c.tipo} · ${c.uso}`,
          c.autoridade_certificadora || '—',
          c.certificado_finalizado ? (concluidoEm(c) ? 'Concluído' : 'Concluído · sem data') : `Pendente · ${ETAPAS[etapaAtual(c)].parado}`,
        ]),
        styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 2.2, textColor: [15, 23, 42], lineColor: [226, 232, 240], lineWidth: 0.1 },
        headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5 },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: { 0: { cellWidth: 24 }, 1: { cellWidth: 24 }, 3: { cellWidth: 36 }, 5: { cellWidth: 26 }, 7: { cellWidth: 46 } },
        didParseCell: (d: any) => {
          if (d.section === 'body' && d.column.index === 7) {
            d.cell.styles.fontStyle = 'bold'
            d.cell.styles.textColor = String(d.cell.raw).startsWith('Concluído') ? [22, 101, 52] : [154, 52, 18]
          }
        },
        didDrawPage: () => {
          doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(100, 116, 139)
          doc.text(`Página ${doc.getNumberOfPages()}`, W - 14, H - 6, { align: 'right' })
          doc.text('Paralegal PRO · relatório quinzenal de certificados digitais', 14, H - 6)
        },
      })
      doc.setProperties({ title: `Certificados - ${quinzena.titulo}` })
      janela.location.href = doc.output('bloburl') as unknown as string
    } catch (e: any) {
      janela.close()
      toast.error('Erro ao gerar o PDF: ' + (e?.message || ''))
    }
  }

  async function handleDelete() {
    if (!deleteItem) return
    const { error } = await supabase.from('certificados_digitais').delete().eq('id', deleteItem.id)
    if (error) { toast.error('Erro ao excluir'); return }
    toast.success('Certificado excluído')
    if (selectedId === deleteItem.id) setSelectedId(null)
    setDeleteItem(null)
    load()
  }

  // ── Pedaços de interface ─────────────────────────────────────────────────
  const btnSec = 'inline-flex items-center gap-2 h-10 px-4 rounded-lg border border-slate-300 bg-white text-sm font-semibold text-slate-900 hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap'
  const btnPri = 'inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-slate-900 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50 whitespace-nowrap'
  const inputCls = 'h-10 px-3 border border-slate-300 rounded-lg text-sm bg-white text-slate-900'
  const chip = (ativo: boolean) => `h-9 px-3 rounded-full border text-sm ${ativo ? 'bg-slate-900 border-slate-900 text-white font-semibold' : 'bg-white border-slate-300 text-slate-700 hover:border-slate-400'}`

  function menuAcoes(c: any) {
    return (
      <div className="relative">
        <button aria-label="Mais ações" aria-expanded={menuAberto === c.id}
          onClick={e => { e.stopPropagation(); setMenuAberto(menuAberto === c.id ? null : c.id) }}
          className="h-10 w-10 inline-flex items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100">
          <Ellipsis className="w-5 h-5" aria-hidden="true" />
        </button>
        {menuAberto === c.id && (
          <div onClick={e => e.stopPropagation()} className="absolute right-0 top-11 z-20 w-52 bg-white border border-slate-200 rounded-lg shadow-lg py-1 text-left">
            <button onClick={() => { setMenuAberto(null); setSelectedId(c.id) }} className="w-full text-left px-3 py-2 text-sm text-slate-800 hover:bg-slate-50">Abrir</button>
            <button onClick={() => { setMenuAberto(null); setEditItem(c); setModalOpen(true) }} className="w-full text-left px-3 py-2 text-sm text-slate-800 hover:bg-slate-50">Editar dados</button>
            {c.certificado_finalizado && (
              <button onClick={() => { setMenuAberto(null); desfazerEtapa(c, 6) }} className="w-full text-left px-3 py-2 text-sm text-slate-800 hover:bg-slate-50">Reabrir processo</button>
            )}
            <button onClick={() => { setMenuAberto(null); setDeleteItem(c) }} className="w-full text-left px-3 py-2 text-sm text-red-700 hover:bg-red-50">Excluir</button>
          </div>
        )}
      </div>
    )
  }

  function barraEtapas(c: any) {
    const feitas = etapasFeitas(c)
    const atual = etapaAtual(c)
    return (
      <div className="flex gap-1" role="img" aria-label={`Etapa ${atual + 1} de ${ETAPAS.length}`}>
        {ETAPAS.map((e, i) => (
          <span key={i} title={e.nome}
            className={`h-1.5 w-7 rounded-full ${feitas[i] ? 'bg-green-700' : i === atual ? 'bg-amber-500' : 'bg-slate-200'}`} />
        ))}
      </div>
    )
  }

  // Formulário da etapa atual, dentro do certificado aberto
  function formEtapa(c: any, i: number) {
    const set = (k: keyof typeof PASSO_VAZIO, v: string) => setPasso(p => ({ ...p, [k]: v }))
    const caixa = 'mt-3 flex flex-wrap items-end gap-3 p-4 bg-slate-50 border border-slate-200 rounded-lg'
    const rotulo = 'block text-sm font-semibold text-slate-800 mb-1'
    switch (i) {
      case 0:
      case 3:
        return (
          <div className={caixa}>
            <div><label className={rotulo} htmlFor="et-data">Data</label>
              <input id="et-data" type="date" value={passo.data} onChange={e => set('data', e.target.value)} className={inputCls} /></div>
            <button disabled={salvando} onClick={() => concluirEtapa(c, i)} className={btnPri}>{i === 0 ? 'Confirmar pagamento' : 'Boleto pago'}</button>
          </div>
        )
      case 1:
        return (
          <div className={caixa}>
            <button onClick={() => copiarDados(c)} className={btnSec}>Copiar dados</button>
            <button onClick={() => abrirEmail(c)} className={btnSec}>Abrir e-mail</button>
            <button disabled={salvando} onClick={() => concluirEtapa(c, 1, { dados_enviados_em: diaLocal() })} className={btnPri}>Marcar como enviado</button>
          </div>
        )
      case 2:
        return (
          <div className={caixa}>
            <div><label className={rotulo} htmlFor="et-valor">Valor do boleto (R$)</label>
              <input id="et-valor" inputMode="decimal" placeholder="198,00" value={passo.valor} onChange={e => set('valor', e.target.value)} className={inputCls + ' w-32'} /></div>
            <div><label className={rotulo} htmlFor="et-venc">Vencimento</label>
              <input id="et-venc" type="date" value={passo.vencimento} onChange={e => set('vencimento', e.target.value)} className={inputCls} /></div>
            <button disabled={salvando} onClick={() => concluirEtapa(c, 2)} className={btnPri}>Salvar boleto</button>
          </div>
        )
      case 4:
        return (
          <div className={caixa}>
            <div><label className={rotulo} htmlFor="et-voucher">Número do voucher / pedido</label>
              <input id="et-voucher" value={passo.voucher} onChange={e => set('voucher', e.target.value)} className={inputCls + ' w-52'} /></div>
            <button disabled={salvando} onClick={() => concluirEtapa(c, 4)} className={btnPri}>Salvar voucher</button>
          </div>
        )
      case 5:
        return (
          <div className={caixa}>
            <div><label className={rotulo} htmlFor="et-agenda">Data e hora</label>
              <input id="et-agenda" type="datetime-local" value={passo.agenda} onChange={e => set('agenda', e.target.value)} className={inputCls} /></div>
            <div><label className={rotulo} htmlFor="et-mod">Atendimento</label>
              <select id="et-mod" value={passo.modalidade} onChange={e => set('modalidade', e.target.value)} className={inputCls}>
                <option value="video">Videoconferência</option>
                <option value="presencial">Presencial</option>
              </select></div>
            <button disabled={salvando} onClick={() => concluirEtapa(c, 5)} className={btnPri}>Salvar agendamento</button>
          </div>
        )
      case 6:
        return (
          <div className={caixa}>
            <div><label className={rotulo} htmlFor="et-emissao">Emitido em</label>
              <input id="et-emissao" type="date" value={passo.emissao}
                onChange={e => { const v = e.target.value; setPasso(p => ({ ...p, emissao: v, validade: v ? somarAnos(v, c.tipo === 'A3' ? 3 : 1) : p.validade })) }}
                className={inputCls} /></div>
            <div><label className={rotulo} htmlFor="et-validade">Válido até</label>
              <input id="et-validade" type="date" value={passo.validade} onChange={e => set('validade', e.target.value)} className={inputCls} /></div>
            <button disabled={salvando} onClick={() => concluirEtapa(c, 6)}
              className="inline-flex items-center h-10 px-4 rounded-lg bg-green-700 text-sm font-semibold text-white hover:bg-green-800 disabled:opacity-50">Certificado emitido</button>
          </div>
        )
    }
    return null
  }

  const modais = (
    <>
      <Modal open={modalOpen} onClose={() => { setModalOpen(false); setEditItem(null) }}
        title={editItem ? 'Editar certificado' : 'Novo certificado — cliente pagou'} size="lg">
        <CertificadoForm empresas={empresas} certificado={editItem ?? undefined} defaultEmpresaId={filtroEmpresa}
          onSuccess={() => { setModalOpen(false); setEditItem(null); load() }} />
      </Modal>
      <ConfirmDialog open={!!deleteItem} title="Excluir certificado" message={`Deseja excluir o certificado de "${deleteItem?.titular}"?`}
        onConfirm={handleDelete} onCancel={() => setDeleteItem(null)} danger />
    </>
  )

  // ── Certificado aberto ───────────────────────────────────────────────────
  const aberto = certs.find(c => c.id === selectedId)
  if (selectedId && aberto) {
    const c = aberto
    const feitas = etapasFeitas(c)
    const atual = c.certificado_finalizado ? -1 : etapaAtual(c)
    return (
      <div className="p-4 md:p-6 xl:p-8 space-y-5">
        <div>
          <button onClick={() => setSelectedId(null)} className="text-sm font-semibold text-blue-700 hover:underline">← Certificados digitais</button>
          <div className="flex flex-wrap items-start justify-between gap-3 mt-2">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{c.razao_social || '—'}</h1>
              <p className="text-sm text-slate-600 mt-0.5">
                {c.uso} {c.tipo} · {c.autoridade_certificadora || 'certificadora não informada'} · titular {c.titular}{c.renovacao_de ? ' · renovação' : ''}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => { setEditItem(c); setModalOpen(true) }} className={btnSec}>Editar dados</button>
              {menuAcoes(c)}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-5 items-start">
          <section aria-label="Etapas" className="flex-[1.3_1_26rem] min-w-0 bg-white border border-slate-200 rounded-xl p-5">
            <h2 className="text-base font-bold text-slate-900 mb-3">Etapas</h2>
            <ol>
              {ETAPAS.map((e, i) => {
                const feito = feitas[i]
                const ehAtual = i === atual
                const alerta = ehAtual ? alertaEtapa(c, i) : ''
                return (
                  <li key={i} className="flex gap-3">
                    <div className="flex flex-col items-center w-6 flex-shrink-0">
                      {feito ? (
                        <span className="w-6 h-6 rounded-full bg-green-700 text-white flex items-center justify-center" role="img" aria-label="feito">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
                        </span>
                      ) : ehAtual ? (
                        <span className="w-6 h-6 rounded-full border-[3px] border-amber-500 bg-amber-50 flex items-center justify-center" role="img" aria-label="etapa atual">
                          <span className="w-2 h-2 rounded-full bg-amber-500" />
                        </span>
                      ) : (
                        <span className="w-6 h-6 rounded-full border-2 border-slate-300 bg-white" role="img" aria-label="a fazer" />
                      )}
                      {i < ETAPAS.length - 1 && <span className="flex-1 w-0.5 min-h-[1.25rem] bg-slate-200" />}
                    </div>
                    <div className="flex-1 min-w-0 pb-4">
                      <div className="flex flex-wrap items-baseline gap-x-3">
                        <span className={`font-semibold ${feito || ehAtual ? 'text-slate-900' : 'text-slate-500'}`}>{e.nome}</span>
                        {feito && <span className="text-sm text-slate-600">{infoEtapa(c, i)}</span>}
                        {feito && (
                          <button onClick={() => desfazerEtapa(c, i)} className="text-xs font-semibold text-slate-500 hover:text-slate-800 hover:underline">desfazer</button>
                        )}
                      </div>
                      {alerta && <p className="text-sm font-semibold text-orange-800 mt-0.5">{alerta}</p>}
                      {ehAtual && formEtapa(c, i)}
                    </div>
                  </li>
                )
              })}
            </ol>
          </section>

          <div className="flex-[1_1_22rem] min-w-0 space-y-5">
            <section aria-label="Dados para a certificadora" className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
              <h2 className="text-base font-bold text-slate-900">Dados para a certificadora</h2>
              <p className="text-sm text-slate-600">Montado com o cadastro. Um clique copia tudo para colar no e-mail ou no site da certificadora.</p>
              <pre className="m-0 p-3 bg-slate-50 border border-slate-200 rounded-lg text-[0.8rem] leading-relaxed whitespace-pre-wrap font-mono text-slate-900">{textoDados(c)}</pre>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => copiarDados(c)} className={btnPri}>Copiar dados</button>
                <button onClick={() => abrirEmail(c)} className={btnSec}>Abrir e-mail para a certificadora</button>
              </div>
            </section>

            <section aria-label="Confirmação do atendimento" className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
              <h2 className="text-base font-bold text-slate-900">Confirmação do atendimento</h2>
              {c.data_agendamento ? (
                <>
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-900 whitespace-pre-line">{msgConfirmacao(c)}</div>
                  <button onClick={() => abrirWhats(c, msgConfirmacao(c))} className={btnSec}>
                    Enviar pelo WhatsApp{telefoneWhats(c) ? '' : ' (sem telefone cadastrado)'}
                  </button>
                </>
              ) : (
                <p className="text-sm text-slate-600">Disponível depois do agendamento: o sistema monta a mensagem com data, hora e documentos e abre o WhatsApp do cliente.</p>
              )}
            </section>
          </div>
        </div>
        {modais}
      </div>
    )
  }

  // ── Tela principal ───────────────────────────────────────────────────────
  const ABAS: Array<{ id: Aba; label: string; n?: number }> = [
    { id: 'processo', label: 'Em processo', n: emProcessoTodos.length },
    { id: 'renovar', label: 'Renovar em breve', n: paraRenovar.length },
    { id: 'emitidos', label: 'Emitidos', n: finalizados.length },
    { id: 'quinzena', label: 'Relatório quinzenal' },
  ]

  return (
    <div className="p-4 md:p-6 xl:p-8 space-y-5">
      {filtroEmpresa && filtroEmpresa !== '__avulsa__' && searchParams.get('empresa') && (
        <div className="flex items-center gap-3 text-sm">
          <Link href={`/empresas/${filtroEmpresa}`} className="font-semibold text-blue-700 hover:underline">← Voltar para a empresa</Link>
          <span className="text-slate-600">{empresaNomeAtual}</span>
        </div>
      )}

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Certificados digitais</h1>
          <p className="text-sm text-slate-600 mt-1">Do pagamento do cliente até o certificado emitido</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {aba !== 'quinzena' && (
            <button onClick={exportarLista} className={btnSec} title="Exporta os certificados marcados; sem nenhum marcado, exporta a lista que está na tela">
              <Download className="w-4 h-4" aria-hidden="true" />
              {selecionados.size > 0 ? `Exportar Excel (${selecionados.size})` : 'Exportar Excel'}
            </button>
          )}
          <button onClick={() => { setEditItem(null); setModalOpen(true) }} className={btnPri}>Cliente pagou · novo certificado</button>
        </div>
      </header>

      <div role="tablist" aria-label="Certificados" className="flex flex-wrap gap-x-6 border-b border-slate-200">
        {ABAS.map(t => (
          <button key={t.id} role="tab" aria-selected={aba === t.id} onClick={() => setAba(t.id)}
            className={`h-11 -mb-px border-b-2 text-sm transition-colors ${aba === t.id ? 'border-slate-900 text-slate-900 font-semibold' : 'border-transparent text-slate-600 font-medium hover:text-slate-900'}`}>
            {t.label}{t.n !== undefined && <span className="ml-1.5 font-normal text-slate-500">{t.n}</span>}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {aba !== 'quinzena' && (
          <label className="flex items-center gap-2 h-10 px-3 bg-white border border-slate-300 rounded-lg text-slate-500">
            <Search className="w-4 h-4" aria-hidden="true" />
            <input value={busca} onChange={e => setBusca(e.target.value)} aria-label="Buscar empresa, titular ou CNPJ" placeholder="Buscar empresa, titular ou CNPJ"
              className="w-64 bg-transparent outline-none text-sm text-slate-900 placeholder:text-slate-500" />
          </label>
        )}
        <select value={filtroEmpresa} onChange={e => setFiltroEmpresa(e.target.value)} aria-label="Empresa" className={inputCls + ' max-w-xs'}>
          <option value="">Todas as empresas</option>
          <option value="__avulsa__">Empresas avulsas</option>
          {empresas.map(e => <option key={e.id} value={e.id}>{e.razao_social}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="space-y-2">{[...Array(4)].map((_, k) => <div key={k} className="h-16 bg-white rounded-xl border border-slate-200 animate-pulse" />)}</div>
      ) : (
        <>
          {/* ── EM PROCESSO ── */}
          {aba === 'processo' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-slate-600 mr-1">Parados em:</span>
                <button onClick={() => setFiltroEtapa(null)} aria-pressed={filtroEtapa === null} className={chip(filtroEtapa === null)}>
                  Todas <span className="opacity-70">{emProcessoTodos.length}</span>
                </button>
                {ETAPAS.map((e, i) => contagemEtapas[i] > 0 && (
                  <button key={i} onClick={() => setFiltroEtapa(filtroEtapa === i ? null : i)} aria-pressed={filtroEtapa === i} className={chip(filtroEtapa === i)}>
                    {e.parado} <span className="opacity-70">{contagemEtapas[i]}</span>
                  </button>
                ))}
              </div>

              <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
                {emProcesso.length === 0 ? (
                  <p className="px-6 py-12 text-center text-sm text-slate-600">
                    Nenhum certificado em processo. Quando um cliente pagar, use “Cliente pagou · novo certificado”.
                  </p>
                ) : (
                  <div className="min-w-[60rem]">
                    <div className="grid grid-cols-[2rem_1.5fr_0.9fr_1.8fr_15rem] gap-x-5 items-center px-5 py-3 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                      <input type="checkbox" aria-label="Selecionar todos" checked={todosMarcados(emProcesso)} onChange={() => toggleTodos(emProcesso)} className="w-4 h-4 accent-slate-800" />
                      <div>Empresa e titular</div><div>Certificado</div><div>Andamento</div><div className="text-right">Próximo passo</div>
                    </div>
                    {emProcesso.map(c => {
                      const i = etapaAtual(c)
                      const alerta = alertaEtapa(c, i)
                      const ctx = contextoAtual(c, i)
                      return (
                        <div key={c.id} className="grid grid-cols-[2rem_1.5fr_0.9fr_1.8fr_15rem] gap-x-5 items-center px-5 py-3 border-b border-slate-100 last:border-0">
                          <input type="checkbox" aria-label={`Selecionar ${c.titular}`} checked={selecionados.has(c.id)} onChange={() => toggleSel(c.id)} className="w-4 h-4 accent-slate-800" />
                          <div className="min-w-0">
                            <button onClick={() => setSelectedId(c.id)} className="block text-left font-semibold text-slate-900 hover:underline break-words">{c.razao_social || '—'}</button>
                            <span className="text-sm text-slate-600">{c.titular}</span>
                          </div>
                          <div className="text-sm"><span className="font-semibold">{c.tipo} · {c.uso}</span><div className="text-slate-600">{c.autoridade_certificadora}</div></div>
                          <div>
                            {barraEtapas(c)}
                            <p className="text-sm mt-1.5"><span className="font-semibold">{ETAPAS[i].parado}</span>{ctx && <span className="text-slate-600"> · {ctx}</span>}</p>
                            {alerta && <p className="text-sm font-semibold text-orange-800">{alerta}</p>}
                          </div>
                          <div className="flex justify-end items-center gap-1">
                            <button disabled={salvando} onClick={() => acaoRapida(c)} className={btnSec}>{ETAPAS[i].acao}</button>
                            {menuAcoes(c)}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── RENOVAR EM BREVE ── */}
          {aba === 'renovar' && (
            <div className="space-y-5">
              <p className="text-sm text-slate-600">
                Certificados emitidos que vencem nos próximos 45 dias. Ofereça a renovação; quando o cliente pagar, o processo começa em “Em processo”.
              </p>
              {gruposRenovar.length === 0 && (
                <div className="bg-white border border-slate-200 rounded-xl px-6 py-12 text-center text-sm text-slate-600">Nenhum certificado vence nos próximos 45 dias.</div>
              )}
              {gruposRenovar.map(g => (
                <section key={g.titulo} className="space-y-2" aria-label={g.titulo}>
                  <div className="flex items-baseline gap-2">
                    <h2 className="text-base font-bold text-slate-900">{g.titulo}</h2>
                    <span className="text-sm text-slate-500">{g.itens.length} {g.itens.length === 1 ? 'certificado' : 'certificados'}</span>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
                    {g.itens.map(c => {
                      const venc = new Date(c.data_vencimento + 'T00:00:00')
                      const d = c.dias_para_vencer
                      return (
                        <div key={c.id} className="flex flex-wrap items-center gap-x-5 gap-y-2 px-5 py-3">
                          <div className={`w-14 flex-shrink-0 rounded-lg py-1 text-center ${g.tom}`}>
                            <div className="text-xl font-bold leading-tight">{String(venc.getDate()).padStart(2, '0')}</div>
                            <div className="text-xs font-semibold">{MESES_ABREV[venc.getMonth()]}</div>
                          </div>
                          <div className="flex-1 min-w-[16rem]">
                            <button onClick={() => setSelectedId(c.id)} className="text-left font-semibold text-slate-900 hover:underline break-words">{c.razao_social || '—'}</button>
                            <p className="text-sm text-slate-600">{c.tipo} · {c.uso} · titular {c.titular} · {d < 0 ? `venceu há ${-d} dia${d === -1 ? '' : 's'}` : d === 0 ? 'vence hoje' : `vence em ${d} dia${d === 1 ? '' : 's'}`}</p>
                          </div>
                          <span className="w-56 flex-shrink-0 text-sm text-slate-700">
                            {c.oferta_renovacao_em ? `Oferta enviada em ${formatDate(c.oferta_renovacao_em)}` : 'Renovação ainda não oferecida'}
                          </span>
                          <div className="flex items-center gap-1 ml-auto">
                            <button onClick={() => oferecerRenovacao(c)} className="h-10 px-3 rounded-lg text-sm font-semibold text-blue-700 hover:bg-blue-50">Oferecer pelo WhatsApp</button>
                            <button onClick={() => clientePagouRenovacao(c)} className={btnSec}>Cliente pagou</button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </section>
              ))}

              <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-3" aria-label="Mensagem de oferta">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-base font-bold text-slate-900">Mensagem de oferta</h2>
                  {!editandoModelo && (
                    <button onClick={() => { setModeloTexto(modeloOferta); setEditandoModelo(true) }} className="text-sm font-semibold text-blue-700 hover:underline">Editar mensagem</button>
                  )}
                </div>
                {editandoModelo ? (
                  <>
                    <textarea value={modeloTexto} onChange={e => setModeloTexto(e.target.value)} rows={4} aria-label="Modelo da mensagem"
                      className="w-full p-3 border border-slate-300 rounded-lg text-sm text-slate-900 resize-y" />
                    <p className="text-xs text-slate-600">O sistema troca {'{titular}'}, {'{empresa}'}, {'{certificado}'} e {'{vencimento}'} pelos dados de cada cliente. Troque [VALOR] pelo preço que vocês cobram.</p>
                    <div className="flex gap-2">
                      <button onClick={salvarModelo} className={btnPri}>Salvar modelo</button>
                      <button onClick={() => setEditandoModelo(false)} className={btnSec}>Cancelar</button>
                    </div>
                  </>
                ) : (
                  <p className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-900 whitespace-pre-line">{modeloOferta}</p>
                )}
              </section>
            </div>
          )}

          {/* ── EMITIDOS ── */}
          {aba === 'emitidos' && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm text-slate-600 mr-1">Emitidos nos últimos:</span>
                {[15, 30, 45, 60, 90].map(d => (
                  <button key={d} onClick={() => setFiltroEmissao(filtroEmissao === d ? null : d)} aria-pressed={filtroEmissao === d} className={chip(filtroEmissao === d)}>
                    {d} dias
                  </button>
                ))}
              </div>
              <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
                {finalizados.length === 0 ? (
                  <p className="px-6 py-12 text-center text-sm text-slate-600">Nenhum certificado emitido{filtroEmissao ? ' nesse período' : ''}.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr className="text-left text-xs font-semibold text-slate-600">
                        <th className="pl-5 py-3 w-8"><input type="checkbox" aria-label="Selecionar todos" checked={todosMarcados(finalizados)} onChange={() => toggleTodos(finalizados)} className="w-4 h-4 accent-slate-800" /></th>
                        <th className="px-4 py-3">Empresa</th>
                        <th className="px-4 py-3">Titular</th>
                        <th className="px-4 py-3">Certificado</th>
                        <th className="px-4 py-3">Emissão</th>
                        <th className="px-4 py-3">Vencimento</th>
                        <th className="px-4 py-3">Conclusão</th>
                        <th className="px-4 py-3">Situação</th>
                        <th className="px-4 py-3"><span className="sr-only">Ações</span></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {finalizados.map(c => (
                        <tr key={c.id} className="hover:bg-slate-50">
                          <td className="pl-5 py-3"><input type="checkbox" aria-label={`Selecionar ${c.titular}`} checked={selecionados.has(c.id)} onChange={() => toggleSel(c.id)} className="w-4 h-4 accent-slate-800" /></td>
                          <td className="px-4 py-3">
                            {c.empresa_id
                              ? <Link href={`/empresas/${c.empresa_id}`} className="font-semibold text-slate-900 hover:underline break-words">{c.razao_social}</Link>
                              : <span className="font-semibold text-slate-900 break-words">{c.razao_social} <span className="text-xs font-normal text-slate-500">(avulsa)</span></span>}
                            {c.cnpj && <div className="text-xs text-slate-500">{formatCNPJ(c.cnpj)}</div>}
                          </td>
                          <td className="px-4 py-3 text-slate-700">{c.titular}</td>
                          <td className="px-4 py-3 text-slate-700 whitespace-nowrap">{c.tipo} · {c.uso}
                            <div className="text-xs text-slate-500">
                              {AC_URLS[c.autoridade_certificadora]
                                ? <a href={AC_URLS[c.autoridade_certificadora]} target="_blank" rel="noopener noreferrer" className="hover:underline">{c.autoridade_certificadora}</a>
                                : c.autoridade_certificadora}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{formatDate(c.data_emissao)}</td>
                          <td className="px-4 py-3 text-slate-700 whitespace-nowrap">{formatDate(c.data_vencimento)}</td>
                          <td className="px-4 py-3">
                            <input type="date" aria-label={`Data de conclusão de ${c.titular}`} value={concluidoEm(c)} max={diaLocal()}
                              onChange={async e => { if (await salvar(c.id, { data_conclusao: e.target.value || null })) toast.success('Salvo!') }}
                              className="border border-slate-300 rounded-lg px-2 py-1 text-xs bg-white" />
                          </td>
                          <td className="px-4 py-3"><StatusBadge status={c.status_cor ?? 'sem_data'} diasParaVencer={c.dias_para_vencer} /></td>
                          <td className="px-4 py-3 text-right">{menuAcoes(c)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* ── RELATÓRIO QUINZENAL ── */}
          {aba === 'quinzena' && (
            <div className="space-y-4">
              <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  <button onClick={() => mudarQuinzena(-1)} className={btnSec} aria-label="Quinzena anterior">←</button>
                  <input type="month" aria-label="Mês" value={qMes} onChange={e => e.target.value && setQMes(e.target.value)} className={inputCls} />
                  <div className="flex rounded-lg border border-slate-300 overflow-hidden">
                    {([1, 2] as const).map(n => (
                      <button key={n} onClick={() => setQNum(n)} aria-pressed={qNum === n}
                        className={`h-10 px-3 text-sm font-semibold ${qNum === n ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 hover:bg-slate-50'}`}>
                        {n === 1 ? 'Dias 1 a 15' : 'Dia 16 ao fim'}
                      </button>
                    ))}
                  </div>
                  <button onClick={() => mudarQuinzena(1)} className={btnSec} aria-label="Próxima quinzena">→</button>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <button onClick={abrirPdfQuinzena} className={btnSec}><FileText className="w-4 h-4" aria-hidden="true" />Abrir PDF</button>
                  <button onClick={exportarQuinzena} className={btnPri}><Download className="w-4 h-4" aria-hidden="true" />Exportar Excel</button>
                </div>
              </div>

              <div>
                <h2 className="text-base font-bold text-slate-900">{quinzena.titulo.charAt(0).toUpperCase() + quinzena.titulo.slice(1)}</h2>
                <p className="text-sm text-slate-600">Certificados cadastrados ou concluídos de {quinzena.faixa}{empresaNomeAtual ? ` · ${empresaNomeAtual}` : ''}</p>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Cadastrados na quinzena', val: qCadastrados.length },
                  { label: 'Concluídos na quinzena', val: qConcluidos.length },
                  { label: 'Cadastrados ainda pendentes', val: qPendentes.length },
                ].map(k => (
                  <div key={k.label} className="bg-white border border-slate-200 rounded-xl p-4">
                    <p className="text-sm text-slate-600">{k.label}</p>
                    <p className="text-2xl font-bold text-slate-900 mt-1">{k.val}</p>
                  </div>
                ))}
              </div>

              <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
                {daQuinzena.length === 0 ? (
                  <p className="px-6 py-12 text-center text-sm text-slate-600">Nenhum certificado cadastrado ou concluído nesta quinzena.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>{['Cadastrado em', 'Concluído em', 'Empresa', 'Titular', 'Certificado', 'Situação'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-600">{h}</th>
                      ))}</tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {daQuinzena.map(c => (
                        <tr key={c.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{formatDate(cadastradoEm(c))}</td>
                          <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{concluidoEm(c) ? formatDate(concluidoEm(c)) : '—'}</td>
                          <td className="px-4 py-3 font-semibold text-slate-900 break-words">{c.razao_social || '—'}</td>
                          <td className="px-4 py-3 text-slate-700">{c.titular}</td>
                          <td className="px-4 py-3 text-slate-700 whitespace-nowrap">{c.tipo} · {c.uso}</td>
                          <td className="px-4 py-3">
                            {c.certificado_finalizado
                              ? <span className="badge-ok">{concluidoEm(c) ? 'Concluído' : 'Concluído · sem data'}</span>
                              : <span className="badge-critico">Pendente · {ETAPAS[etapaAtual(c)].parado}</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </>
      )}
      {modais}
    </div>
  )
}

export default function CertificadosPage() {
  return <Suspense><CertificadosPageInner /></Suspense>
}
