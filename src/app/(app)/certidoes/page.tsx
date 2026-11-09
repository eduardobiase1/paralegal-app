'use client'

import { useEffect, useState, useCallback, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useOrg } from '@/lib/org-context'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { registrarAcao } from '@/lib/atividade'
import { Search, ExternalLink, Ellipsis } from 'lucide-react'
import { SEFAZ_URLS } from '@/types'

const EMPTY_FORM = {
  id: '',
  empresa_id: '',
  tipo: '',
  orgao_emissor: '',
  data_emissao: '',
  data_vencimento: '',
  observacoes: '',
  pendencia_status: 'nenhuma',
}

const TIPO_OPTIONS = ['Federal', 'Estadual', 'Municipal', 'Trabalhista', 'FGTS', 'Previdenciária', 'Outro']
const ORGAO_OPTIONS = ['Receita Federal', 'PGFN', 'Estado', 'Prefeitura', 'CRF (FGTS)', 'TRT', 'TST', 'Outro']

const PENDENCIA_OPTIONS = [
  { value: 'nenhuma',            label: 'Sem pendência',          badge: 'bg-emerald-100 text-emerald-700' },
  { value: 'em_renovacao',       label: 'Em renovação',           badge: 'bg-blue-100 text-blue-700' },
  { value: 'aguardando_cliente', label: 'Aguardando cliente',     badge: 'bg-yellow-100 text-yellow-700' },
  { value: 'vencida_aguardando', label: 'Vencida — aguardando',   badge: 'bg-orange-100 text-orange-700' },
  { value: 'impossivel_renovar', label: 'Impossível renovar',     badge: 'bg-red-100 text-red-700' },
]

function diasParaVencer(data?: string): number | null {
  if (!data) return null
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
  const venc = new Date(data + 'T00:00:00')
  return Math.round((venc.getTime() - hoje.getTime()) / 86400000)
}

const MESES_ABREV = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ']

// Grupos da agenda, do mais urgente ao mais distante
const GRUPOS_AGENDA: Array<{ id: string; titulo: string; tom: 'red' | 'orange' | 'slate'; teste: (d: number | null) => boolean }> = [
  { id: 'vencidas', titulo: 'Vencidas',                tom: 'red',    teste: d => d !== null && d < 0 },
  { id: 'ate5',     titulo: 'Vencem em até 5 dias',    tom: 'orange', teste: d => d !== null && d >= 0 && d <= 5 },
  { id: 'ate15',    titulo: 'Vencem em 6 a 15 dias',   tom: 'slate',  teste: d => d !== null && d > 5 && d <= 15 },
  { id: 'ate30',    titulo: 'Vencem em 16 a 30 dias',  tom: 'slate',  teste: d => d !== null && d > 15 && d <= 30 },
  { id: 'semdata',  titulo: 'Sem data de vencimento',  tom: 'slate',  teste: d => d === null },
]

const TOM_DATA: Record<string, string> = {
  red:    'bg-red-50 text-red-800',
  orange: 'bg-orange-50 text-orange-800',
  slate:  'bg-slate-100 text-slate-700',
  green:  'bg-green-50 text-green-800',
}

function prazoTexto(d: number | null) {
  if (d === null) return 'sem data de vencimento'
  if (d < 0) return `venceu há ${-d} dia${d === -1 ? '' : 's'}`
  if (d === 0) return 'vence hoje'
  return `vence em ${d} dia${d === 1 ? '' : 's'}`
}

// Portal de emissão de cada tipo de certidão
function portalCertidao(i: any): string | null {
  const t = (i.tipo || '').toLowerCase()
  if (t === 'federal' || t.startsWith('previd')) return 'https://servicos.receitafederal.gov.br/servico/certidoes/#/home/cnpj'
  if (t === 'trabalhista') return 'https://cndt-certidao.tst.jus.br'
  if (t === 'fgts') return 'https://consulta-crf.caixa.gov.br'
  if (t === 'estadual') return SEFAZ_URLS[i.empresas?.uf] || null
  if (t === 'municipal') return i.empresas?.url_certidao_municipal || null
  return null
}

function CertidoesPage() {
  const { orgId, orgName } = useOrg()
  const searchParams = useSearchParams()
  const empresaFiltro = searchParams.get('empresa')
  const [supabase] = useState(createClient())
  const [data, setData] = useState<any[]>([])
  const [empresas, setEmpresas] = useState<any[]>([])
  const [modal, setModal] = useState(false)
  const [modalMode, setModalMode] = useState<'novo' | 'editar' | 'renovar'>('novo')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [filterPendencia, setFilterPendencia] = useState('todas')
  const [mostrarEmDia, setMostrarEmDia] = useState(false)
  const [menuAberto, setMenuAberto] = useState<string | null>(null)
  const [comunicandoItem, setComunicandoItem] = useState<any | null>(null)

  const [form, setForm] = useState<typeof EMPTY_FORM>({ ...EMPTY_FORM })
  const [empresaDetalhe, setEmpresaDetalhe] = useState<any | null>(null)

  const load = useCallback(async () => {
    if (!orgId) return
    const [res, empRes] = await Promise.all([
      // só certidões de empresas da organização selecionada
      supabase.from('certidoes').select('*, empresas!inner(razao_social, org_id, cnpj, uf, url_certidao_municipal)').eq('empresas.org_id', orgId).order('data_vencimento', { ascending: true }),
      supabase.from('empresas').select('id, razao_social').eq('org_id', orgId).order('razao_social'),
    ])
    setData(res.data || [])
    setEmpresas(empRes.data || [])
    setLoading(false)
  }, [supabase, orgId])

  useEffect(() => {
    if (!empresaFiltro) { setEmpresaDetalhe(null); return }
    supabase.from('empresas')
      .select('id, razao_social, cnpj, situacao, status, natureza_juridica, data_abertura, municipio, uf, bairro, cep, logradouro, numero, complemento, inscricao_estadual, inscricao_municipal, email, telefone, telefone2, codigo')
      .eq('id', empresaFiltro)
      .single()
      .then(({ data }) => setEmpresaDetalhe(data || null))
  }, [supabase, empresaFiltro])

  useEffect(() => { load() }, [load])

  // Vindo da ficha da empresa com ?renovar=ID: abre direto a renovação daquele documento
  const renovarId = searchParams.get('renovar')
  const renovarAberto = useRef(false)
  useEffect(() => {
    if (!renovarId || renovarAberto.current || data.length === 0) return
    const item = data.find((d: any) => d.id === renovarId)
    if (item) { renovarAberto.current = true; openRenovar(item) }
  }, [renovarId, data])

  function openNovo() {
    setForm({ ...EMPTY_FORM, empresa_id: empresaFiltro || '' })
    setModalMode('novo')
    setModal(true)
  }

  function openEditar(item: any) {
    setForm({
      id: item.id,
      empresa_id: item.empresa_id,
      tipo: item.tipo || '',
      orgao_emissor: item.orgao_emissor || '',
      data_emissao: item.data_emissao || '',
      data_vencimento: item.data_vencimento || '',
      observacoes: item.observacoes || '',
      pendencia_status: item.pendencia_status || 'nenhuma',
    })
    setModalMode('editar')
    setModal(true)
  }

  function openRenovar(item: any) {
    setForm({
      id: item.id,  // UPDATE no registro existente, não cria novo
      empresa_id: item.empresa_id,
      tipo: item.tipo || '',
      orgao_emissor: item.orgao_emissor || '',
      data_emissao: new Date().toISOString().split('T')[0],
      data_vencimento: '',
      observacoes: '',
      pendencia_status: 'nenhuma',
    })
    setModalMode('renovar')
    setModal(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)

    const payload = {
      empresa_id: form.empresa_id,
      tipo: form.tipo,
      orgao_emissor: form.orgao_emissor,
      data_emissao: form.data_emissao || null,
      data_vencimento: form.data_vencimento || null,
      observacoes: form.observacoes || null,
      pendencia_status: form.pendencia_status,
    }

    async function doSave(p: typeof payload) {
      if (form.id) {
        // Editar ou Renovar: sempre atualiza o registro existente
        return supabase.from('certidoes').update(p).eq('id', form.id)
      }
      return supabase.from('certidoes').insert([p])
    }

    let { error } = await doSave(payload)

    // Se a coluna pendencia_status ainda não existe no banco, tenta sem ela
    if (error && error.message?.includes('pendencia_status')) {
      const { pendencia_status, ...payloadSemPend } = payload
      ;({ error } = await doSave(payloadSemPend as any))
      if (!error) toast('⚠️ Salvo sem pendência — rode o SQL no Supabase para habilitar esse campo.')
    }

    if (!error) {
      const msgs = { novo: 'Certidão cadastrada!', editar: 'Certidão atualizada!', renovar: 'Renovação registrada!' }
      toast.success(msgs[modalMode])
      registrarAcao(
        modalMode === 'renovar' ? 'Renovação' : modalMode === 'novo' ? 'Cadastro' : 'Atualização',
        `Certidão ${form.tipo} (${form.orgao_emissor}) ${modalMode === 'renovar' ? 'renovada' : modalMode === 'novo' ? 'cadastrada' : 'atualizada'}`,
        { empresaId: form.empresa_id },
      )

      // Ao renovar: limpa campos de comunicado/followup e registra no histórico
      if (modalMode === 'renovar' && form.id) {
        await supabase.from('certidoes').update({
          comunicado_em: null,
          comunicado_para: null,
          comunicado_canal: null,
          followup_em: null,
          comunicado_count: 0,
        }).eq('id', form.id)

        try {
          const item = data.find(d => d.id === form.id)
          await supabase.from('historico_empresa').insert([{
            org_id: orgId,
            empresa_id: form.empresa_id,
            tipo: 'certidao_renovada',
            descricao: `Certidão ${form.tipo} (${form.orgao_emissor}) renovada — nova validade: ${form.data_vencimento ? new Date(form.data_vencimento + 'T00:00:00').toLocaleDateString('pt-BR') : 'não informada'}${item?.comunicado_para ? ` — comunicado anterior para ${item.comunicado_para} foi removido` : ''}`,
          }])
        } catch {
          // histórico não crítico
        }
      }

      setModal(false)
      setForm({ ...EMPTY_FORM })
      load()
    } else {
      toast.error(`Erro: ${error.message}`)
    }
    setSaving(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir esta certidão?')) return
    await supabase.from('certidoes').delete().eq('id', id)
    setData(prev => prev.filter(i => i.id !== id))
    toast.success('Certidão excluída.')
  }

  async function handleRegistrarComunicado(para: string, canal: string, descricaoComunicado: string) {
    if (!comunicandoItem) return
    const agora = new Date().toISOString()
    const followupDate = new Date(); followupDate.setDate(followupDate.getDate() + 30)
    const followup_em = followupDate.toISOString().slice(0, 10)
    const novoCount = (comunicandoItem.comunicado_count || 0) + 1
    const ordinal = novoCount === 1 ? '1ª' : novoCount === 2 ? '2ª' : novoCount === 3 ? '3ª' : `${novoCount}ª`

    const { error } = await supabase.from('certidoes').update({
      comunicado_em: agora,
      comunicado_para: para,
      comunicado_canal: canal,
      followup_em,
      comunicado_count: novoCount,
    }).eq('id', comunicandoItem.id)
    if (error) {
      if (error.message.includes('comunicado_em') || error.message.includes('comunicado_para')) {
        toast('Execute a migration_v10 no Supabase SQL Editor para habilitar o registro de comunicações.')
      } else {
        toast.error('Erro ao registrar: ' + error.message)
      }
      return
    }
    // Registra no histórico da empresa
    try {
      await supabase.from('historico_empresa').insert([{
        org_id: orgId,
        empresa_id: comunicandoItem.empresa_id,
        tipo: 'comunicado_enviado',
        descricao: `[${ordinal} comunicação] ${descricaoComunicado}`,
        canal,
      }])
    } catch {
      // historico não crítico — não interrompe o fluxo
    }
    toast.success(`${ordinal} comunicação registrada! Follow-up agendado para 30 dias.`)
    registrarAcao('Comunicado', `${ordinal} comunicação · Certidão ${comunicandoItem.tipo} · ${canal} para ${para}`, { empresaId: comunicandoItem.empresa_id })
    setComunicandoItem(null)
    load()
  }

  // Fecha o menu "⋯" ao clicar fora
  useEffect(() => {
    if (!menuAberto) return
    const fechar = () => setMenuAberto(null)
    document.addEventListener('click', fechar)
    return () => document.removeEventListener('click', fechar)
  }, [menuAberto])

  // Filtro/busca
  const empresaNome = empresaFiltro ? (empresas.find(e => e.id === empresaFiltro)?.razao_social || '') : ''
  const filtered = data.filter(i => {
    const matchEmpresa = !empresaFiltro || i.empresa_id === empresaFiltro
    const matchSearch = !search ||
      (i.empresas?.razao_social || '').toLowerCase().includes(search.toLowerCase()) ||
      (i.tipo || '').toLowerCase().includes(search.toLowerCase()) ||
      (i.orgao_emissor || '').toLowerCase().includes(search.toLowerCase())
    const matchPend = filterPendencia === 'todas' || (i.pendencia_status || 'nenhuma') === filterPendencia
    return matchEmpresa && matchSearch && matchPend
  })

  // Agenda: agrupa pelo prazo de vencimento, da mais urgente para a mais distante
  const ordenadas = [...filtered].sort((x, y) => (x.data_vencimento || '9999').localeCompare(y.data_vencimento || '9999'))
  const grupos = GRUPOS_AGENDA
    .map(g => ({ ...g, itens: ordenadas.filter(i => g.teste(diasParaVencer(i.data_vencimento))) }))
    .filter(g => g.itens.length > 0)
  const emDia = ordenadas.filter(i => { const d = diasParaVencer(i.data_vencimento); return d !== null && d > 30 })
  const exibirEmDia = mostrarEmDia || !!search

  function abrirPortal(i: any) {
    const cnpj = (i.empresas?.cnpj || '').replace(/\D/g, '')
    if (cnpj) {
      navigator.clipboard?.writeText(cnpj).then(() => toast.success('CNPJ copiado — é só colar no portal')).catch(() => {})
    }
  }

  function linhaCertidao(i: any, tom: string) {
    const d = diasParaVencer(i.data_vencimento)
    const venc = i.data_vencimento ? new Date(i.data_vencimento + 'T00:00:00') : null
    const pend = PENDENCIA_OPTIONS.find(p => p.value === (i.pendencia_status || 'nenhuma'))
    const portal = portalCertidao(i)
    return (
      <div key={i.id} className="flex flex-wrap items-center gap-x-5 gap-y-2 px-5 py-3">
        <div className={`w-14 flex-shrink-0 rounded-lg py-1 text-center ${TOM_DATA[tom]}`}>
          {venc ? (
            <>
              <div className="text-xl font-bold leading-tight">{String(venc.getDate()).padStart(2, '0')}</div>
              <div className="text-xs font-semibold">{MESES_ABREV[venc.getMonth()]}{venc.getFullYear() !== new Date().getFullYear() ? ` ${String(venc.getFullYear()).slice(2)}` : ''}</div>
            </>
          ) : <div className="text-sm font-semibold py-2">—</div>}
        </div>

        <div className="flex-1 min-w-[16rem]">
          <Link href={`/empresas/${i.empresa_id}`} className="font-semibold text-slate-900 hover:underline underline-offset-2 break-words">
            {i.empresas?.razao_social}
          </Link>
          <p className="text-sm text-slate-600">Certidão {i.tipo} · {i.orgao_emissor} · {prazoTexto(d)}</p>
        </div>

        <div className="w-56 flex-shrink-0 text-sm">
          {pend && pend.value === 'impossivel_renovar' && <p className="font-bold text-red-700">Pendente · não foi possível renovar</p>}
          {pend && pend.value !== 'nenhuma' && pend.value !== 'impossivel_renovar' && <p className="text-slate-700">{pend.label}</p>}
          {i.comunicado_em && (
            <p className="text-xs text-slate-500">Cliente comunicado em {new Date(i.comunicado_em).toLocaleDateString('pt-BR')}{(i.comunicado_count || 0) > 1 ? ` (${i.comunicado_count}×)` : ''}</p>
          )}
        </div>

        <div className="flex items-center gap-1 ml-auto">
          {portal && (
            <a href={portal} target="_blank" rel="noopener noreferrer" onClick={() => abrirPortal(i)}
              className="inline-flex items-center gap-1.5 h-10 px-3 rounded-lg text-sm font-semibold text-blue-700 hover:bg-blue-50">
              Abrir portal<span className="sr-only"> da certidão {i.tipo} de {i.empresas?.razao_social}</span>
              <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
            </a>
          )}
          <button onClick={() => openRenovar(i)}
            className="h-10 px-4 rounded-lg border border-slate-300 bg-white text-sm font-semibold text-slate-900 hover:bg-slate-50">
            Renovar
          </button>
          <div className="relative">
            <button aria-label="Mais ações" aria-expanded={menuAberto === i.id}
              onClick={e => { e.stopPropagation(); setMenuAberto(menuAberto === i.id ? null : i.id) }}
              className="h-10 w-10 inline-flex items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100">
              <Ellipsis className="w-5 h-5" aria-hidden="true" />
            </button>
            {menuAberto === i.id && (
              <div onClick={e => e.stopPropagation()}
                className="absolute right-0 top-11 z-20 w-52 bg-white border border-slate-200 rounded-lg shadow-lg py-1">
                <button onClick={() => { setMenuAberto(null); openEditar(i) }}
                  className="w-full text-left px-3 py-2 text-sm text-slate-800 hover:bg-slate-50">Editar</button>
                <button onClick={() => { setMenuAberto(null); setComunicandoItem(i) }}
                  className="w-full text-left px-3 py-2 text-sm text-slate-800 hover:bg-slate-50">Comunicar cliente</button>
                <button onClick={() => { setMenuAberto(null); handleDelete(i.id) }}
                  className="w-full text-left px-3 py-2 text-sm text-red-700 hover:bg-red-50">Excluir</button>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  const modalTitle = { novo: 'Nova Certidão Negativa', editar: 'Editar Certidão', renovar: 'Renovar Certidão' }

  return (
    <div className="p-4 md:p-6 xl:p-8 space-y-4">

      {/* Banner empresa filtrada */}
      {empresaFiltro && empresaDetalhe && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          {/* Linha de volta */}
          <div className="flex items-center gap-2 px-5 py-2.5 bg-slate-50 border-b border-slate-100">
            <Link href={`/empresas/${empresaFiltro}`}
              className="flex items-center gap-1.5 text-slate-500 hover:text-blue-600 text-xs font-semibold transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
              </svg>
              Voltar para empresa
            </Link>
            <span className="text-slate-300">|</span>
            <span className="text-xs text-slate-500 font-medium break-words">{empresaDetalhe.razao_social}</span>
          </div>
          {/* Dados */}
          <div className="px-5 py-4 space-y-4">
            {/* Nome + status */}
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-bold text-slate-900 tracking-tight">{empresaDetalhe.razao_social}</h2>
              {(empresaDetalhe.situacao || empresaDetalhe.status) && (
                <span className={`text-xs font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${
                  ['ativa','Ativa'].includes(empresaDetalhe.situacao || empresaDetalhe.status)
                    ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                }`}>
                  {empresaDetalhe.situacao || empresaDetalhe.status}
                </span>
              )}
              {empresaDetalhe.codigo && (
                <span className="text-xs font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">#{empresaDetalhe.codigo}</span>
              )}
            </div>

            {/* Grid de campos */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-x-6 gap-y-3 text-xs">
              {empresaDetalhe.cnpj && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-0.5">CNPJ</p>
                  <p className="font-mono font-semibold text-slate-800">{empresaDetalhe.cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')}</p>
                </div>
              )}
              {empresaDetalhe.natureza_juridica && (
                <div className="col-span-2">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-0.5">Natureza Jurídica</p>
                  <p className="font-semibold text-slate-700">{empresaDetalhe.natureza_juridica}</p>
                </div>
              )}
              {empresaDetalhe.data_abertura && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-0.5">Data de Abertura</p>
                  <p className="font-semibold text-slate-700">{new Date(empresaDetalhe.data_abertura + 'T00:00:00').toLocaleDateString('pt-BR')}</p>
                </div>
              )}
              {empresaDetalhe.inscricao_estadual && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-0.5">Insc. Estadual</p>
                  <p className="font-semibold text-slate-700">{empresaDetalhe.inscricao_estadual}</p>
                </div>
              )}
              {empresaDetalhe.inscricao_municipal && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-0.5">Insc. Municipal</p>
                  <p className="font-semibold text-slate-700">{empresaDetalhe.inscricao_municipal}</p>
                </div>
              )}
              {(empresaDetalhe.logradouro || empresaDetalhe.municipio) && (
                <div className="col-span-2">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-0.5">Endereço</p>
                  <p className="font-semibold text-slate-700">
                    {[empresaDetalhe.logradouro, empresaDetalhe.numero, empresaDetalhe.complemento, empresaDetalhe.bairro].filter(Boolean).join(', ')}
                    {empresaDetalhe.municipio && <span className="text-slate-500"> · {[empresaDetalhe.municipio, empresaDetalhe.uf].filter(Boolean).join('/')} {empresaDetalhe.cep}</span>}
                  </p>
                </div>
              )}
              {empresaDetalhe.email && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-0.5">E-mail</p>
                  <p className="font-semibold text-slate-700 break-words">{empresaDetalhe.email}</p>
                </div>
              )}
              {empresaDetalhe.telefone && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-0.5">Telefone</p>
                  <p className="font-semibold text-slate-700">{empresaDetalhe.telefone}{empresaDetalhe.telefone2 ? ` · ${empresaDetalhe.telefone2}` : ''}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Cabeçalho */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Certidões</h1>
          <p className="text-sm text-slate-600 mt-1">
            {filtered.length} {filtered.length === 1 ? 'certidão' : 'certidões'}{empresaNome ? ` de ${empresaNome}` : ''}, organizadas pela data em que vencem
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 h-11 px-3 bg-white border border-slate-300 rounded-lg text-slate-500">
            <Search className="w-4 h-4" aria-hidden="true" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              aria-label="Buscar por empresa, tipo ou órgão" placeholder="Buscar empresa, tipo ou órgão"
              className="w-56 bg-transparent outline-none text-sm text-slate-900 placeholder:text-slate-500" />
          </label>
          <select value={filterPendencia} onChange={e => setFilterPendencia(e.target.value)} aria-label="Situação"
            className="h-11 px-3 bg-white border border-slate-300 rounded-lg text-sm text-slate-900">
            <option value="todas">Todas as situações</option>
            {PENDENCIA_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <button onClick={openNovo} className="h-11 px-4 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 whitespace-nowrap">
            Nova certidão
          </button>
        </div>
      </header>

      {/* Agenda de vencimentos */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, k) => <div key={k} className="h-16 bg-white rounded-xl border border-slate-200 animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl px-6 py-12 text-center text-sm text-slate-600">
          {data.length === 0 ? 'Nenhuma certidão cadastrada.' : 'Nenhuma certidão encontrada com esses filtros.'}
        </div>
      ) : (
        <div className="space-y-6">
          {grupos.length === 0 && (
            <p className="text-sm text-slate-600">Nenhuma certidão vence nos próximos 30 dias.</p>
          )}
          {grupos.map(g => (
            <section key={g.id} className="space-y-2" aria-label={g.titulo}>
              <div className="flex items-baseline gap-2">
                <h2 className="text-base font-bold text-slate-900">{g.titulo}</h2>
                <span className="text-sm text-slate-500">{g.itens.length} {g.itens.length === 1 ? 'certidão' : 'certidões'}</span>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
                {g.itens.map(i => linhaCertidao(i, g.tom))}
              </div>
            </section>
          ))}

          {emDia.length > 0 && (exibirEmDia ? (
            <section className="space-y-2" aria-label="Em dia">
              <div className="flex items-baseline gap-2">
                <h2 className="text-base font-bold text-slate-900">Em dia</h2>
                <span className="text-sm text-slate-500">{emDia.length} {emDia.length === 1 ? 'certidão vence' : 'certidões vencem'} depois de 30 dias</span>
                {!search && (
                  <button onClick={() => setMostrarEmDia(false)} className="ml-auto text-sm font-semibold text-slate-600 hover:text-slate-900">Recolher</button>
                )}
              </div>
              <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
                {emDia.map(i => linhaCertidao(i, 'green'))}
              </div>
            </section>
          ) : (
            <button onClick={() => setMostrarEmDia(true)}
              className="h-11 px-4 rounded-lg border border-dashed border-slate-300 text-sm font-semibold text-slate-700 hover:bg-white">
              Mostrar as {emDia.length} {emDia.length === 1 ? 'certidão em dia' : 'certidões em dia'} (vencem depois de 30 dias)
            </button>
          ))}
        </div>
      )}

      {/* Modal Comunicado */}
      {comunicandoItem && (
        <ComunicadoModal
          item={comunicandoItem}
          orgName={orgName}
          onClose={() => setComunicandoItem(null)}
          onRegistrar={handleRegistrarComunicado}
        />
      )}

      {/* Modal Novo / Editar / Renovar */}
      {modal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-lg rounded-3xl p-6 md:p-8 border border-slate-200 shadow-2xl max-h-[90vh] overflow-y-auto">

            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-bold text-slate-900">{modalTitle[modalMode]}</h2>
                {modalMode === 'renovar' && (
                  <p className="text-xs text-blue-600 mt-0.5">Nova emissão será registrada — histórico anterior é mantido.</p>
                )}
              </div>
              <button onClick={() => setModal(false)} className="text-slate-400 hover:text-slate-700 font-bold text-lg leading-none">✕</button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">

              {/* Empresa */}
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wide block mb-1">Empresa *</label>
                <select required value={form.empresa_id} onChange={e => setForm({ ...form, empresa_id: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm outline-none focus:border-slate-400">
                  <option value="">Selecione...</option>
                  {empresas.map(e => <option key={e.id} value={e.id}>{e.razao_social}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Tipo */}
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wide block mb-1">Tipo *</label>
                  <select required value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm outline-none focus:border-slate-400">
                    <option value="">Selecione...</option>
                    {TIPO_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>

                {/* Órgão Emissor */}
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wide block mb-1">Órgão Emissor *</label>
                  <select required value={form.orgao_emissor} onChange={e => setForm({ ...form, orgao_emissor: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm outline-none focus:border-slate-400">
                    <option value="">Selecione...</option>
                    {ORGAO_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>

                {/* Data Emissão */}
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wide block mb-1">Data de Emissão</label>
                  <input type="date" value={form.data_emissao} onChange={e => setForm({ ...form, data_emissao: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm outline-none focus:border-slate-400" />
                </div>

                {/* Data Vencimento */}
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wide block mb-1">Data de Vencimento</label>
                  <input type="date" value={form.data_vencimento} onChange={e => setForm({ ...form, data_vencimento: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm outline-none focus:border-slate-400" />
                </div>
              </div>

              {/* Pendência */}
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wide block mb-1">Status de Pendência</label>
                <select value={form.pendencia_status} onChange={e => setForm({ ...form, pendencia_status: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm outline-none focus:border-slate-400">
                  {PENDENCIA_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>

              {/* Observações */}
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wide block mb-1">Observações / Motivo da Pendência</label>
                <textarea rows={2} value={form.observacoes} onChange={e => setForm({ ...form, observacoes: e.target.value })}
                  placeholder="Descreva motivo da pendência, protocolo, etc."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm outline-none focus:border-slate-400 resize-none" />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setModal(false)}
                  className="flex-1 bg-slate-100 text-slate-600 py-3 rounded-xl font-bold text-sm hover:bg-slate-200 transition-all">
                  Cancelar
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 bg-slate-900 text-white py-3 rounded-xl font-bold text-sm hover:bg-slate-700 transition-all disabled:opacity-50">
                  {saving ? 'Salvando...' : modalMode === 'renovar' ? '🔄 Confirmar Renovação' : '✓ Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default function CertidoesPageWrapper() {
  return <Suspense><CertidoesPage /></Suspense>
}

// ── Helpers do ComunicadoModal ────────────────────────────────────────────────
function saudacao() {
  const h = new Date().getHours()
  if (h >= 6 && h < 12) return 'Bom dia'
  if (h >= 12 && h < 18) return 'Boa tarde'
  return 'Boa noite'
}

function detectEsfera(tipo: string, orgao: string): string {
  const t = (tipo || '').toLowerCase()
  const o = (orgao || '').toLowerCase()
  if (t === 'fgts' || o.includes('fgts') || o.includes('crf') || o.includes('caixa econômica')) return 'do FGTS'
  if (t === 'federal' || o.includes('receita federal') || o.includes('pgfn')) return 'Federal'
  if (t === 'estadual' || o.includes('sefaz') || o.includes('estado')) return 'Estadual'
  if (t === 'municipal' || o.includes('prefeitura') || o.includes('municipal') || o.includes('iss')) return 'Municipal'
  if (t === 'trabalhista' || o.includes('trt') || o.includes('tst') || o.includes('trabalhista')) return 'Trabalhista'
  if (t === 'previdenciária' || o.includes('previdenciária') || o.includes('inss')) return 'Previdenciária'
  return 'de Débitos'
}

const DPTOS = [
  { value: 'fiscal',   label: 'Departamento Fiscal' },
  { value: 'contabil', label: 'Departamento Contábil' },
  { value: 'dp',       label: 'Departamento Pessoal' },
]
const DP_TIMES = ['DP1', 'DP2', 'DP3', 'DP4', 'DP5']

// ── Modal de Comunicado ───────────────────────────────────────────────────────
function ComunicadoModal({ item, orgName, onClose, onRegistrar }: {
  item: any; orgName: string; onClose: () => void
  onRegistrar: (para: string, canal: string, descricao: string) => Promise<void>
}) {
  const [tab, setTab] = useState<'cliente' | 'interno'>('cliente')
  const [dpto, setDpto] = useState('fiscal')
  const [dpTime, setDpTime] = useState('DP1')
  const [para, setPara] = useState(item.comunicado_para || '')
  const [canal, setCanal] = useState(item.comunicado_canal || 'whatsapp')
  const [registrando, setRegistrando] = useState(false)
  const [copiado, setCopiado] = useState(false)

  const DEPTOS_CLIENTE = [
    { id: 'fiscal',    label: 'Fiscal' },
    { id: 'pessoal',   label: 'Pessoal' },
    { id: 'contabil',  label: 'Contábil' },
  ]

  function preSelectDepts(tipo: string): string[] {
    const t = tipo.toLowerCase()
    if (['fgts', 'trabalhista'].some(k => t.includes(k))) return ['pessoal']
    return ['fiscal']
  }
  const [deptsSelecionados, setDeptsSelecionados] = useState<string[]>(() => preSelectDepts(item.tipo || ''))

  function toggleDept(id: string) {
    setDeptsSelecionados(prev =>
      prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]
    )
  }

  const empresa   = item.empresas?.razao_social || ''
  const empresaMaius = empresa.toUpperCase()

  const dataVenc  = item.data_vencimento ? new Date(item.data_vencimento + 'T00:00:00').toLocaleDateString('pt-BR') : '—'
  const esfera    = detectEsfera(item.tipo || '', item.orgao_emissor || '')
  const sauda     = saudacao()
  const obsLine   = item.observacoes ? `\n\nSituação atual: ${item.observacoes}` : ''

  const dptoLabel = dpto === 'dp'
    ? `Departamento Pessoal — ${dpTime}`
    : DPTOS.find(d => d.value === dpto)?.label || ''

  function formatarDeptos(ids: string[]): string {
    const nomes = ids.map(id => {
      const d = DEPTOS_CLIENTE.find(x => x.id === id)
      return d ? `Departamento ${d.label}` : ''
    }).filter(Boolean)
    if (nomes.length === 0) return 'nossa equipe'
    if (nomes.length === 1) return nomes[0]
    return nomes.slice(0, -1).join(', ') + ' e ' + nomes[nomes.length - 1]
  }
  const deptoTexto = formatarDeptos(deptsSelecionados)
  const verbo = deptsSelecionados.length > 1 ? 'verificarão as pendências' : 'verificará a pendência'
  const artigoDepto = deptsSelecionados.length === 0 ? 'com a' : 'com o nosso'

  const textoCliente = `Prezado(a) cliente, ${sauda}! Tudo bem?

Segue em anexo o relatório de Pendências em aberto da empresa ${empresaMaius} que está impossibilitando de renovar a certidão negativa de débitos ${esfera}.

Para regularizar, entre em contato ${artigoDepto} ${deptoTexto}, que ${verbo} junto ao(à) ${item.orgao_emissor} e encaminhará o boleto ou guia atualizada para quitação.

Ficamos à disposição para orientações.`

  const textoInterno = `${sauda}! Tudo bem?

Segue abaixo o relatório de Pendências em aberto da empresa ${empresaMaius} que está impossibilitando de renovar a certidão negativa de débitos ${esfera}.

Solicitamos verificação e providências junto ao cliente para regularização.`

  const texto = tab === 'cliente' ? textoCliente : textoInterno

  // Descrição para o histórico
  const descricaoHistorico = tab === 'cliente'
    ? `Comunicado enviado ao cliente sobre certidão ${item.tipo} (${item.orgao_emissor}) — ${esfera} — vencimento ${dataVenc}`
    : `Comunicado enviado ao ${dptoLabel} sobre certidão ${item.tipo} (${item.orgao_emissor}) — ${esfera} — vencimento ${dataVenc}`

  async function copiar() {
    await navigator.clipboard.writeText(texto)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  async function registrar() {
    if (!para.trim()) { alert('Informe para quem foi comunicado.'); return }
    setRegistrando(true)
    await onRegistrar(para.trim(), canal, descricaoHistorico)
    setRegistrando(false)
  }

  const jaComunicado = !!item.comunicado_em

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white w-full max-w-xl rounded-3xl border border-slate-200 shadow-2xl max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between p-6 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-xs font-bold uppercase tracking-wide text-violet-600 bg-violet-50 border border-violet-200 px-2 py-0.5 rounded">Comunicado</span>
              <span className="text-xs font-bold uppercase tracking-wide text-blue-600 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">{esfera}</span>
              {jaComunicado && <span className="text-xs font-bold uppercase tracking-wide text-green-600 bg-green-50 border border-green-200 px-2 py-0.5 rounded">✓ Já registrado</span>}
              {(item.comunicado_count || 0) > 0 && (
                <span className="text-xs font-bold uppercase tracking-wide text-orange-600 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded">
                  {item.comunicado_count}× comunicado
                </span>
              )}
            </div>
            <h2 className="text-lg font-bold text-slate-900">{empresa}</h2>
            <p className="text-xs text-slate-500 mt-0.5">{item.tipo} · {item.orgao_emissor} · vence {dataVenc}</p>
            {jaComunicado && (
              <p className="text-xs text-green-600 mt-1">
                Último comunicado para <strong>{item.comunicado_para}</strong> via {item.comunicado_canal} em {new Date(item.comunicado_em).toLocaleDateString('pt-BR')}
                {item.followup_em && <span className="text-slate-400 ml-1">· follow-up em {new Date(item.followup_em + 'T00:00:00').toLocaleDateString('pt-BR')}</span>}
              </p>
            )}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 font-bold text-lg leading-none flex-shrink-0 ml-4">✕</button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1.5 p-4 pb-0">
          {([
            { id: 'cliente', label: 'Para o cliente', hex: '#3B82F6', glow: 'rgba(59,130,246,0.25)' },
            { id: 'interno', label: 'Para departamento interno', hex: '#8B5CF6', glow: 'rgba(139,92,246,0.25)' },
          ] as const).map(t => {
            const isActive = tab === t.id
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                style={isActive ? { background: t.hex, boxShadow: `0 4px 16px ${t.glow}, 0 1px 3px rgba(0,0,0,0.1)` } : {}}
                className={[
                  'px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap select-none outline-none',
                  'transition-all duration-200 ease-in-out',
                  isActive
                    ? 'text-white -translate-y-px'
                    : 'text-slate-500 bg-[#F3F4F6] hover:-translate-y-px hover:shadow-md',
                ].join(' ')}>
                {t.label}
              </button>
            )
          })}
        </div>

        {/* Seletor de departamento — aba cliente (multi-select) */}
        {tab === 'cliente' && (
          <div className="px-4 pt-3">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-2">Departamento(s) responsável(eis)</p>
            <div className="flex gap-1.5 flex-wrap">
              {DEPTOS_CLIENTE.map(d => {
                const isActive = deptsSelecionados.includes(d.id)
                return (
                  <button key={d.id} onClick={() => toggleDept(d.id)}
                    style={isActive ? { background: '#1E293B', boxShadow: '0 4px 16px rgba(30,41,59,0.25)' } : {}}
                    className={[
                      'px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap select-none outline-none',
                      'transition-all duration-200 ease-in-out',
                      isActive ? 'text-white -translate-y-px' : 'text-slate-500 bg-[#F3F4F6] hover:-translate-y-px hover:shadow-md',
                    ].join(' ')}>
                    {isActive ? '✓ ' : ''}{d.label}
                  </button>
                )
              })}
            </div>
            <p className="text-xs text-slate-400 mt-1.5">Selecione um ou mais · a mensagem atualiza automaticamente</p>
          </div>
        )}

        {/* Seletor de departamento (só aba interna) */}
        {tab === 'interno' && (
          <div className="px-4 pt-3 flex flex-wrap gap-1.5 items-center">
            {DPTOS.map(d => {
              const isActive = dpto === d.value
              return (
              <button key={d.value} onClick={() => setDpto(d.value)}
                style={isActive ? { background: '#1E293B', boxShadow: '0 4px 16px rgba(30,41,59,0.25), 0 1px 3px rgba(0,0,0,0.1)' } : {}}
                className={[
                  'px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap select-none outline-none',
                  'transition-all duration-200 ease-in-out',
                  isActive
                    ? 'text-white -translate-y-px'
                    : 'text-slate-500 bg-[#F3F4F6] hover:-translate-y-px hover:shadow-md',
                ].join(' ')}>
                {d.label}
              </button>
              )
            })}
            {dpto === 'dp' && (
              <select value={dpTime} onChange={e => setDpTime(e.target.value)}
                className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-1.5 text-xs font-bold text-blue-700 outline-none">
                {DP_TIMES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            )}
          </div>
        )}

        {/* Texto gerado */}
        <div className="p-4">
          <div className="relative">
            <pre className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-700 whitespace-pre-wrap font-sans leading-relaxed max-h-64 overflow-y-auto">{texto}</pre>
            <button onClick={copiar}
              className={`absolute top-2 right-2 px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-all ${copiado ? 'bg-green-500 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
              {copiado ? '✓ Copiado!' : 'Copiar'}
            </button>
          </div>
          <p className="text-xs text-slate-400 mt-2 text-center">
            * = negrito no WhatsApp · saudação automática conforme horário · esfera detectada automaticamente
          </p>
        </div>

        {/* Registro */}
        <div className="px-4 pb-6 border-t border-slate-100 pt-4">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Registrar comunicação</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wide block mb-1">
                {tab === 'interno' ? `${dptoLabel} *` : 'Para quem (cliente) *'}
              </label>
              <input value={para} onChange={e => setPara(e.target.value)}
                placeholder={tab === 'interno' ? `Nome do responsável no ${dpto === 'dp' ? dpTime : dptoLabel}` : 'Nome ou e-mail do cliente'}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-sm outline-none focus:border-slate-400" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wide block mb-1">Canal</label>
              <select value={canal} onChange={e => setCanal(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-sm outline-none focus:border-slate-400">
                <option value="whatsapp">WhatsApp</option>
                <option value="email">E-mail</option>
                <option value="telefone">Telefone</option>
                <option value="outro">Outro</option>
              </select>
            </div>
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={onClose}
              className="flex-1 bg-slate-100 text-slate-600 py-2.5 rounded-xl font-bold text-sm hover:bg-slate-200 transition-all">
              {jaComunicado ? 'Fechar' : 'Cancelar'}
            </button>
            <button type="button" onClick={registrar} disabled={registrando}
              className="flex-1 bg-violet-600 text-white py-2.5 rounded-xl font-bold text-sm hover:bg-violet-700 transition-all disabled:opacity-50">
              {registrando ? 'Registrando...' : jaComunicado ? '↻ Atualizar registro' : '✓ Registrar comunicação'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
