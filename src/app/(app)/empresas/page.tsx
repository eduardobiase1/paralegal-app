'use client'

import { useEffect, useState, useMemo, Fragment } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useOrg } from '@/lib/org-context'
import toast from 'react-hot-toast'

// ── Helpers ───────────────────────────────────────────────────────────────────

function getNatTag(natureza: string): string {
  if (!natureza) return ''
  const n = natureza.toUpperCase()
  if (n.includes('LIMITADA') || n.includes('LTDA')) return 'LTDA'
  if (n.includes('EIRELI')) return 'EIRELI'
  if (n.includes('ANÔNIMA') || n.includes('S/A') || n.includes(' SA ') || n.includes('S.A')) return 'S/A'
  if (n.includes('INDIVIDUAL') || n.includes('MEI')) return 'MEI'
  if (n.includes('SIMPLES UNIPESSOAL') || n.includes('SLU')) return 'SLU'
  return ''
}

function getSituacaoBadge(situacao: string) {
  const s = (situacao || '').toUpperCase()
  if (s === 'ATIVA') return 'bg-emerald-100 text-emerald-700 border border-emerald-200'
  if (s === 'BAIXADA') return 'bg-red-100 text-red-700 border border-red-200'
  if (s === 'INAPTA') return 'bg-orange-100 text-orange-700 border border-orange-200'
  if (s === 'SUSPENSA') return 'bg-yellow-100 text-yellow-700 border border-yellow-200'
  return 'bg-slate-100 text-slate-500 border border-slate-200'
}

const TIPO_LABELS: Record<string, string> = {
  abertura: 'Abertura', alteracao_contratual: 'Alteração', encerramento: 'Encerramento',
  transferencia_entrada: 'Transf. Entrada', transferencia_saida: 'Transf. Saída',
}

const REGIME_OPTIONS = ['Simples Nacional', 'Lucro Presumido', 'Lucro Real', 'MEI', 'Isento']

// ── Componente principal ───────────────────────────────────────────────────────

export default function EmpresasPage() {
  const { orgId, orgName } = useOrg()
  const [supabase] = useState(createClient())
  const [empresas, setEmpresas] = useState<any[]>([])
  const [processosPorEmpresa, setProcessosPorEmpresa] = useState<Record<string, any[]>>({})
  const [ultimaAcaoPorEmpresa, setUltimaAcaoPorEmpresa] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isConsulting, setIsConsulting] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'dados' | 'processos' | 'dossie' | 'socios' | 'controles' | 'documentos'>('dados')
  const [search, setSearch] = useState('')
  const [docsPorEmpresa, setDocsPorEmpresa] = useState<Record<string, any>>({})
  const [notaInput, setNotaInput] = useState('')
  const [notaSaving, setNotaSaving] = useState(false)
  const [pendenciaEdit, setPendenciaEdit] = useState<Record<string, string>>({})

  const initialForm = {
    cnpj: '', razao_social: '', nome_fantasia: '', situacao: '', data_situacao_cadastral: '',
    data_abertura: '', logradouro: '', numero: '', complemento: '', cep: '',
    bairro: '', municipio: '', uf: '', email: '', telefone: '',
    cnae_principal_codigo: '', cnae_principal_descricao: '', cnaes_secundarios: [],
    natureza_juridica: '', porte: '', capital_social: 0, qsa: [],
    regime_tributario: '',
  }
  const [formData, setFormData] = useState<any>(initialForm)

  useEffect(() => { if (orgId && orgName) fetchData() }, [orgId, orgName])

  async function fetchData() {
    setLoading(true)
    const { data: byId } = await supabase.from('empresas').select('*').eq('org_id', orgId).order('razao_social')
    const emps = byId && byId.length > 0 ? byId : await (async () => {
      const { data } = await supabase.from('empresas').select('*').eq('organizacao', orgName).order('razao_social')
      return data || []
    })()
    setEmpresas(emps)

    // Busca processos de todas as empresas
    if (emps.length > 0) {
      const ids = emps.map((e: any) => e.id)
      const { data: procs } = await supabase
        .from('processos_societarios')
        .select('id, empresa_id, tipo, status, created_at, checklist, titulo')
        .in('empresa_id', ids)
        .order('created_at', { ascending: false })

      if (procs) {
        const porEmp: Record<string, any[]> = {}
        const ultimaAcao: Record<string, string> = {}
        procs.forEach((p: any) => {
          if (!porEmp[p.empresa_id]) porEmp[p.empresa_id] = []
          porEmp[p.empresa_id].push(p)
          if (!ultimaAcao[p.empresa_id]) {
            const mes = new Date(p.created_at).toLocaleDateString('pt-BR', { month: '2-digit', year: '2-digit' })
            ultimaAcao[p.empresa_id] = `${TIPO_LABELS[p.tipo] || p.tipo} (${mes})`
          }
        })
        setProcessosPorEmpresa(porEmp)
        setUltimaAcaoPorEmpresa(ultimaAcao)
      }
    }
    setLoading(false)
  }

  async function consultarCNPJ() {
    const cnpjLimpo = formData.cnpj.replace(/\D/g, '')
    if (cnpjLimpo.length !== 14) return toast.error('CNPJ inválido (mínimo 14 números)')
    setIsConsulting(true)
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjLimpo}`)
      const d = await res.json()
      if (res.ok) {
        setFormData({
          ...initialForm, cnpj: cnpjLimpo,
          razao_social: d.razao_social || '', nome_fantasia: d.nome_fantasia || '********',
          situacao: d.descricao_situacao_cadastral || 'ATIVA',
          data_situacao_cadastral: d.data_situacao_cadastral || '',
          data_abertura: d.data_inicio_atividade || '',
          logradouro: d.logradouro || '', numero: d.numero || '',
          complemento: d.complemento || '', cep: d.cep || '',
          bairro: d.bairro || '', municipio: d.municipio || '', uf: d.uf || '',
          email: d.email || '', telefone: d.ddd_telefone_1 || '',
          natureza_juridica: d.natureza_juridica || '', porte: d.porte || '',
          capital_social: d.capital_social || 0,
          cnae_principal_codigo: d.cnae_fiscal || '',
          cnae_principal_descricao: d.cnae_fiscal_descricao || '',
          cnaes_secundarios: d.cnaes_secundarios || [], qsa: d.qsa || [],
        })
        toast.success('Importação concluída!')
      } else { toast.error('CNPJ não encontrado') }
    } catch { toast.error('Erro na consulta') } finally { setIsConsulting(false) }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    const { error } = await supabase.from('empresas').upsert([{ ...formData, org_id: orgId, organizacao: orgName }])
    if (!error) { fetchData(); setIsModalOpen(false); setFormData(initialForm); toast.success('Empresa salva!') }
    else toast.error('Erro ao salvar: ' + error.message)
  }

  async function handleExcluir(id: string) {
    if (!confirm('Excluir empresa permanentemente?')) return
    const { error } = await supabase.from('empresas').delete().eq('id', id)
    if (!error) { fetchData(); if (detailId === id) setDetailId(null); toast.success('Empresa removida') }
  }

  function toggleDetail(empId: string, tab: typeof activeTab = 'dados') {
    if (detailId === empId && activeTab === tab) { setDetailId(null); return }
    setDetailId(empId); setActiveTab(tab)
    if (tab === 'documentos') loadDocumentos(empId)
  }

  function diasParaVencer(data?: string): number | null {
    if (!data) return null
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
    const venc = new Date(data + 'T00:00:00')
    return Math.round((venc.getTime() - hoje.getTime()) / 86400000)
  }

  function urgBadge(dias: number | null): string {
    if (dias === null) return 'bg-slate-100 text-slate-400'
    if (dias < 0)   return 'bg-red-600 text-white'
    if (dias <= 15) return 'bg-red-100 text-red-700'
    if (dias <= 30) return 'bg-orange-100 text-orange-700'
    if (dias <= 60) return 'bg-yellow-100 text-yellow-700'
    return 'bg-emerald-100 text-emerald-700'
  }

  function urgLabel(dias: number | null): string {
    if (dias === null) return 'Sem data'
    if (dias < 0)  return `Vencida há ${Math.abs(dias)}d`
    if (dias === 0) return 'Vence HOJE'
    return `${dias}d`
  }

  function openMaps(emp: any) {
    // Format CEP with hyphen (e.g. 01234-567)
    const cepFmt = (emp.cep || '').replace(/\D/g, '').replace(/^(\d{5})(\d{3})$/, '$1-$2')
    // Full Brazilian address: logradouro, número, complemento, bairro, cidade - UF, CEP, Brasil
    const parts = [
      emp.logradouro,
      emp.numero,
      emp.complemento,
      emp.bairro,
      emp.municipio && emp.uf ? `${emp.municipio} - ${emp.uf}` : (emp.municipio || emp.uf),
      cepFmt,
      'Brasil',
    ].filter(Boolean)
    const addr = parts.join(', ')
    // &layer=c opens Street View mode directly
    window.open(`https://maps.google.com/maps?q=${encodeURIComponent(addr)}&layer=c`, '_blank')
  }

  async function loadDocumentos(empId: string) {
    if (docsPorEmpresa[empId]?.loadedAt && Date.now() - docsPorEmpresa[empId].loadedAt < 30000) return
    const [cert, alv, lic, cer, notas] = await Promise.all([
      supabase.from('certidoes').select('*').eq('empresa_id', empId).order('data_vencimento'),
      supabase.from('alvaras').select('*').eq('empresa_id', empId).order('data_vencimento'),
      supabase.from('licencas_sanitarias').select('*').eq('empresa_id', empId).order('data_vencimento'),
      supabase.from('certificados_digitais').select('*').eq('empresa_id', empId).order('data_vencimento'),
      supabase.from('empresa_notas').select('*').eq('empresa_id', empId).order('created_at', { ascending: false }),
    ])
    const emp = empresas.find((e: any) => e.id === empId)
    setDocsPorEmpresa((prev: any) => ({
      ...prev,
      [empId]: {
        certidoes: cert.data || [],
        alvaras: alv.data || [],
        licencas: lic.data || [],
        certificados: cer.data || [],
        notas: notas.data || [],
        pendencia: emp?.pendencia_status || 'nenhuma',
        loadedAt: Date.now(),
      }
    }))
    setPendenciaEdit(prev => ({ ...prev, [empId]: emp?.pendencia_status || 'nenhuma' }))
  }

  async function addEmpresaNota(empId: string) {
    if (!notaInput.trim()) return
    setNotaSaving(true)
    await supabase.from('empresa_notas').insert({ empresa_id: empId, nota: notaInput.trim() })
    setNotaInput('')
    setNotaSaving(false)
    await loadDocumentos(empId)
    setDocsPorEmpresa((prev: any) => ({ ...prev, [empId]: { ...prev[empId], loadedAt: 0 } }))
    loadDocumentos(empId)
  }

  async function savePendencia(empId: string) {
    const status = pendenciaEdit[empId] || 'nenhuma'
    await supabase.from('empresas').update({ pendencia_status: status }).eq('id', empId)
    setDocsPorEmpresa((prev: any) => ({ ...prev, [empId]: { ...prev[empId], pendencia: status } }))
    toast.success('Pendência atualizada')
  }

  // ── Busca ─────────────────────────────────────────────────────────────────────
  const empresasFiltradas = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return empresas
    const qDigits = q.replace(/\D/g, '')
    return empresas.filter(e =>
      (e.razao_social || '').toLowerCase().includes(q) ||
      (qDigits.length > 0 && (e.cnpj || '').replace(/\D/g, '').includes(qDigits)) ||
      (e.municipio || '').toLowerCase().includes(q) ||
      (e.nome_fantasia || '').toLowerCase().includes(q) ||
      (e.regime_tributario || '').toLowerCase().includes(q)
    )
  }, [empresas, search])

  if (loading) return <div className="p-10 text-slate-400 italic font-sans">Sincronizando carteira...</div>

  return (
    <div className="p-4 md:p-8 bg-[#F8FAFC] min-h-screen font-sans text-slate-900">

      {/* ── Cabeçalho ── */}
      <header className="flex flex-wrap justify-between items-start gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Base de Clientes</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {orgName} &nbsp;·&nbsp;
            <span className="font-black text-slate-700">{empresas.length}</span>
            <span className="text-slate-400"> Clientes Ativos</span>
          </p>
        </div>
        <button
          onClick={() => { setFormData(initialForm); setIsModalOpen(true) }}
          className="bg-black text-yellow-400 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wide hover:bg-slate-800 transition-all shadow-md"
        >
          + Importar CNPJ
        </button>
      </header>

      {/* ── Busca ── */}
      <div className="mb-4 relative">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none">🔍</span>
        <input
          placeholder="Pesquisar por nome, CNPJ, cidade ou regime..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 pl-9 text-sm outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-100 transition-all"
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-black">✕</button>
        )}
      </div>

      {/* ── Tabela ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="text-left px-4 py-3 text-[10px] font-black uppercase text-slate-400 tracking-widest">Status</th>
                <th className="text-left px-4 py-3 text-[10px] font-black uppercase text-slate-400 tracking-widest">Razão Social</th>
                <th className="text-left px-4 py-3 text-[10px] font-black uppercase text-slate-400 tracking-widest hidden md:table-cell">CNPJ</th>
                <th className="text-left px-4 py-3 text-[10px] font-black uppercase text-slate-400 tracking-widest hidden sm:table-cell">Cidade/UF</th>
                <th className="text-left px-4 py-3 text-[10px] font-black uppercase text-slate-400 tracking-widest hidden lg:table-cell">Tags</th>
                <th className="text-left px-4 py-3 text-[10px] font-black uppercase text-slate-400 tracking-widest hidden xl:table-cell">Última Ação</th>
                <th className="text-right px-4 py-3 text-[10px] font-black uppercase text-slate-400 tracking-widest">Ações</th>
              </tr>
            </thead>
            <tbody>
              {empresasFiltradas.map(emp => {
                const isOpen = detailId === emp.id
                const tag = getNatTag(emp.natureza_juridica)
                const processos = processosPorEmpresa[emp.id] || []
                const ativos = processos.filter(p => p.status === 'Andamento')

                return (
                  <Fragment key={emp.id}>
                    <tr
                      onClick={() => toggleDetail(emp.id)}
                      className={`border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors ${isOpen ? 'bg-yellow-50 hover:bg-yellow-50 border-yellow-100' : ''}`}
                    >
                      <td className="px-4 py-3">
                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase ${getSituacaoBadge(emp.situacao)}`}>
                          {emp.situacao || 'ATIVA'}
                        </span>
                      </td>
                      <td className="px-4 py-3 max-w-[180px]">
                        <p className="font-bold text-slate-800 text-sm truncate">{emp.razao_social}</p>
                        {emp.nome_fantasia && emp.nome_fantasia !== '********' && (
                          <p className="text-[11px] text-slate-400 truncate">{emp.nome_fantasia}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-500 hidden md:table-cell">{emp.cnpj}</td>
                      <td className="px-4 py-3 text-xs text-slate-600 hidden sm:table-cell">
                        {emp.municipio}{emp.uf ? `/${emp.uf}` : ''}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <div className="flex flex-wrap gap-1">
                          {tag && <span className="text-[9px] font-black px-2 py-0.5 rounded bg-slate-100 text-slate-600 uppercase">{tag}</span>}
                          {emp.regime_tributario && (
                            <span className="text-[9px] font-black px-2 py-0.5 rounded bg-blue-50 text-blue-600 uppercase">{emp.regime_tributario}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500 hidden xl:table-cell">
                        {ultimaAcaoPorEmpresa[emp.id] || '—'}
                      </td>
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => toggleDetail(emp.id, 'processos')}
                            title="Processos"
                            className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase transition-all ${isOpen && activeTab === 'processos' ? 'bg-black text-yellow-400' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                          >
                            {ativos.length > 0 ? `${ativos.length} proc.` : 'Processos'}
                          </button>
                          <button
                            onClick={() => toggleDetail(emp.id, 'dossie')}
                            title="Dossiê CNPJ"
                            className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase transition-all ${isOpen && activeTab === 'dossie' ? 'bg-black text-yellow-400' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                          >Dossiê</button>
                          <button
                            onClick={() => { toggleDetail(emp.id, 'documentos') }}
                            title="Documentos & Vencimentos"
                            className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase transition-all ${isOpen && activeTab === 'documentos' ? 'bg-black text-yellow-400' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                          >Docs</button>
                          <button onClick={() => openMaps(emp)} title="Abrir Street View" className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-blue-100 text-slate-500 hover:text-blue-600 flex items-center justify-center transition-all">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                          </button>
                          <button onClick={() => { setFormData(emp); setIsModalOpen(true) }} title="Editar" className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-yellow-100 text-slate-500 hover:text-yellow-700 flex items-center justify-center text-sm transition-all">✎</button>
                          <button onClick={() => handleExcluir(emp.id)} title="Excluir" className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-red-100 text-slate-500 hover:text-red-600 flex items-center justify-center text-sm transition-all">✕</button>
                        </div>
                      </td>
                    </tr>

                    {/* ── Central do Cliente (painel inline) ── */}
                    {isOpen && (
                      <tr>
                        <td colSpan={7} className="p-0 border-b border-yellow-100">
                          <div className="bg-slate-50">

                            {/* Header do painel */}
                            <div className="bg-black text-white px-4 py-2 flex items-center justify-between">
                              <span className="text-[10px] font-black uppercase tracking-widest text-yellow-400">
                                Central do Cliente &nbsp;|&nbsp; <span className="text-white">{emp.razao_social}</span>
                              </span>
                              <button onClick={() => setDetailId(null)} className="text-slate-400 hover:text-white text-xs font-black">✕</button>
                            </div>

                            {/* Abas */}
                            <div className="flex border-b border-slate-200 bg-white overflow-x-auto">
                              {([
                                ['dados', 'Dados Gerais'],
                                ['processos', 'Processos Ativos'],
                                ['dossie', 'Dossiê CNPJ'],
                                ['socios', 'Sócios (QSA)'],
                                ['documentos', 'Documentos'],
                                ['controles', 'Controles'],
                              ] as const).map(([tab, label]) => (
                                <button
                                  key={tab}
                                  onClick={() => setActiveTab(tab)}
                                  className={`px-4 py-2.5 text-[10px] font-black uppercase whitespace-nowrap border-b-2 transition-all ${
                                    activeTab === tab ? 'border-yellow-400 text-slate-900 bg-yellow-50' : 'border-transparent text-slate-400 hover:text-slate-700'
                                  }`}
                                >
                                  {label}
                                  {tab === 'processos' && ativos.length > 0 && (
                                    <span className="ml-1.5 bg-blue-500 text-white text-[8px] rounded-full px-1.5 py-0.5">{ativos.length}</span>
                                  )}
                                </button>
                              ))}
                            </div>

                            <div className="p-4 md:p-6">

                              {/* ── Dados Gerais ── */}
                              {activeTab === 'dados' && (
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 text-xs">
                                  {([
                                    ['Razão Social', emp.razao_social, 'col-span-2'],
                                    ['Nome Fantasia', emp.nome_fantasia !== '********' ? emp.nome_fantasia : '—', ''],
                                    ['CNPJ', emp.cnpj, ''],
                                    ['Situação', emp.situacao, ''],
                                    ['Abertura', emp.data_abertura?.split('-').reverse().join('/') || '—', ''],
                                    ['Porte', emp.porte || '—', ''],
                                    ['Capital Social', `R$ ${Number(emp.capital_social || 0).toLocaleString('pt-BR')}`, ''],
                                    ['Regime Tributário', emp.regime_tributario || '—', ''],
                                    ['Natureza Jurídica', emp.natureza_juridica || '—', 'col-span-2'],
                                    ['Logradouro', `${emp.logradouro || ''}${emp.numero ? ', ' + emp.numero : ''}${emp.complemento ? ' ' + emp.complemento : ''}` || '—', 'col-span-2'],
                                    ['Bairro', emp.bairro || '—', ''],
                                    ['Município/UF', `${emp.municipio || ''}${emp.uf ? '/' + emp.uf : ''}` || '—', ''],
                                    ['CEP', emp.cep || '—', ''],
                                    ['E-mail', emp.email || '—', ''],
                                    ['Telefone', emp.telefone || '—', ''],
                                  ] as [string, string, string][]).map(([label, value, extra]) => (
                                    <div key={label} className={extra}>
                                      <p className="text-[9px] text-slate-400 font-black uppercase tracking-wide mb-0.5">{label}</p>
                                      <p className="font-bold text-slate-700 break-words">{value}</p>
                                    </div>
                                  ))}
                                  {emp.cnae_principal_codigo && (
                                    <div className="col-span-2 sm:col-span-3 md:col-span-4">
                                      <p className="text-[9px] text-slate-400 font-black uppercase tracking-wide mb-0.5">CNAE Principal</p>
                                      <p className="font-bold text-slate-700">{emp.cnae_principal_codigo} — {emp.cnae_principal_descricao}</p>
                                    </div>
                                  )}
                                  <div className="col-span-2 sm:col-span-3 md:col-span-4 pt-2 border-t border-slate-200">
                                    <button onClick={() => { setFormData(emp); setIsModalOpen(true) }} className="bg-black text-yellow-400 px-5 py-2 rounded-xl text-xs font-black uppercase hover:bg-slate-800 transition-all">
                                      ✎ Editar Dados
                                    </button>
                                  </div>
                                </div>
                              )}

                              {/* ── Processos Ativos ── */}
                              {activeTab === 'processos' && (
                                <div>
                                  {processos.length === 0 ? (
                                    <p className="text-sm text-slate-400 italic">Nenhum processo societário para esta empresa.</p>
                                  ) : (
                                    <div className="space-y-3">
                                      {processos.map((proc: any) => {
                                        const checklist = proc.checklist || []
                                        const conc = checklist.filter((i: any) => i.status === 'Concluido').length
                                        const total = checklist.length || 1
                                        const porc = Math.round((conc / total) * 100)
                                        return (
                                          <div key={proc.id} className="bg-white rounded-xl border border-slate-200 p-4">
                                            <div className="flex items-center justify-between mb-2">
                                              <div>
                                                <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase ${proc.status === 'Finalizado' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                                                  {TIPO_LABELS[proc.tipo] || proc.tipo}
                                                </span>
                                                {proc.titulo && <span className="ml-2 text-[10px] text-yellow-600 font-bold">{proc.titulo}</span>}
                                              </div>
                                              <span className="text-[10px] text-slate-400 font-mono">
                                                {new Date(proc.created_at).toLocaleDateString('pt-BR')}
                                              </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                              <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                <div className={`h-full rounded-full ${porc === 100 ? 'bg-emerald-400' : 'bg-yellow-400'}`} style={{ width: `${porc}%` }} />
                                              </div>
                                              <span className="text-[10px] font-black text-slate-500 flex-shrink-0">{conc}/{total} etapas · {porc}%</span>
                                            </div>
                                          </div>
                                        )
                                      })}
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* ── Dossiê CNPJ ── */}
                              {activeTab === 'dossie' && (
                                <div className="bg-white border-2 border-black rounded-xl overflow-hidden max-w-2xl">
                                  <div className="p-4 bg-black text-yellow-400 text-center">
                                    <h2 className="text-xl font-black italic tracking-tighter">PARALEGAL PRO</h2>
                                    <h3 className="text-[9px] font-bold uppercase text-white mt-0.5 tracking-[0.3em]">Gestão de Dados Empresariais</h3>
                                  </div>
                                  <div className="grid grid-cols-2 sm:grid-cols-4 border-b-2 border-black text-[10px]">
                                    <div className="p-2 border-r-2 border-black"><p className="text-[7px] text-slate-400 font-bold uppercase">CNPJ</p><p className="font-mono font-bold">{emp.cnpj}</p></div>
                                    <div className="p-2 border-r-2 border-black col-span-2 flex items-center justify-center font-black text-[10px] uppercase text-center">Comprovante de Situação Cadastral</div>
                                    <div className="p-2"><p className="text-[7px] text-slate-400 font-bold uppercase">ABERTURA</p><p className="font-bold">{emp.data_abertura?.split('-').reverse().join('/')}</p></div>
                                  </div>
                                  <div className="space-y-px bg-black">
                                    <div className="bg-white p-2"><p className="text-[7px] text-slate-400 font-bold uppercase">NOME EMPRESARIAL</p><p className="text-[11px] font-black uppercase">{emp.razao_social}</p></div>
                                    <div className="grid grid-cols-4 gap-px">
                                      <div className="bg-white p-2 col-span-3"><p className="text-[7px] text-slate-400 font-bold uppercase">NOME DE FANTASIA</p><p className="text-[10px] font-bold uppercase">{emp.nome_fantasia}</p></div>
                                      <div className="bg-white p-2"><p className="text-[7px] text-slate-400 font-bold uppercase">PORTE</p><p className="text-[10px] font-bold uppercase">{emp.porte}</p></div>
                                    </div>
                                    <div className="bg-white p-2"><p className="text-[7px] text-slate-400 font-bold uppercase">ATIVIDADE ECONÔMICA PRINCIPAL</p><p className="text-[9px] font-bold">{emp.cnae_principal_codigo} - {emp.cnae_principal_descricao}</p></div>
                                    <div className="bg-white p-2"><p className="text-[7px] text-slate-400 font-bold uppercase">NATUREZA JURÍDICA</p><p className="text-[9px] font-bold uppercase">{emp.natureza_juridica}</p></div>
                                    <div className="grid grid-cols-6 gap-px">
                                      <div className="bg-white p-2 col-span-4"><p className="text-[7px] text-slate-400 font-bold uppercase">LOGRADOURO</p><p className="text-[9px] font-bold uppercase">{emp.logradouro}</p></div>
                                      <div className="bg-white p-2"><p className="text-[7px] text-slate-400 font-bold uppercase">NÚMERO</p><p className="text-[9px] font-bold">{emp.numero}</p></div>
                                      <div className="bg-white p-2"><p className="text-[7px] text-slate-400 font-bold uppercase">COMPL.</p><p className="text-[9px] font-bold uppercase">{emp.complemento}</p></div>
                                    </div>
                                    <div className="grid grid-cols-4 gap-px">
                                      <div className="bg-white p-2"><p className="text-[7px] text-slate-400 font-bold uppercase">CEP</p><p className="text-[9px] font-bold">{emp.cep}</p></div>
                                      <div className="bg-white p-2"><p className="text-[7px] text-slate-400 font-bold uppercase">BAIRRO</p><p className="text-[9px] font-bold uppercase">{emp.bairro}</p></div>
                                      <div className="bg-white p-2"><p className="text-[7px] text-slate-400 font-bold uppercase">MUNICÍPIO</p><p className="text-[9px] font-bold uppercase">{emp.municipio}</p></div>
                                      <div className="bg-white p-2"><p className="text-[7px] text-slate-400 font-bold uppercase">UF</p><p className="text-[9px] font-bold uppercase">{emp.uf}</p></div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-px">
                                      <div className="bg-white p-2"><p className="text-[7px] text-slate-400 font-bold uppercase">SITUAÇÃO</p><p className={`text-[10px] font-black ${emp.situacao === 'ATIVA' ? 'text-emerald-600' : 'text-red-600'}`}>{emp.situacao}</p></div>
                                      <div className="bg-white p-2"><p className="text-[7px] text-slate-400 font-bold uppercase">CAPITAL SOCIAL</p><p className="text-[10px] font-bold">R$ {Number(emp.capital_social || 0).toLocaleString('pt-BR')}</p></div>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* ── Sócios ── */}
                              {activeTab === 'socios' && (
                                <div>
                                  {(!emp.qsa || emp.qsa.length === 0) ? (
                                    <p className="text-sm text-slate-400 italic">Nenhum sócio registrado.</p>
                                  ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                      {emp.qsa.map((s: any, i: number) => (
                                        <div key={i} className="p-3 bg-white border-l-4 border-yellow-400 rounded-r-xl shadow-sm">
                                          <p className="text-xs font-black uppercase text-slate-800">{s.nome || s.nome_socio}</p>
                                          <p className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">{s.qualificacao}</p>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* ── Documentos & Vencimentos ── */}
                              {activeTab === 'documentos' && (() => {
                                const docs = docsPorEmpresa[emp.id]
                                const pendOpts = [
                                  { value: 'nenhuma', label: 'Sem pendência', color: 'text-emerald-600' },
                                  { value: 'em_renovacao', label: 'Em renovação', color: 'text-blue-600' },
                                  { value: 'aguardando_cliente', label: 'Aguardando cliente', color: 'text-yellow-600' },
                                  { value: 'vencida_aguardando', label: 'Vencida — aguardando', color: 'text-orange-600' },
                                  { value: 'impossivel_renovar', label: 'Impossível renovar', color: 'text-red-600' },
                                ]

                                if (!docs) {
                                  loadDocumentos(emp.id)
                                  return <div className="text-sm text-slate-400 animate-pulse">Carregando documentos...</div>
                                }

                                function DocRow({ item, tipo }: { item: any; tipo: string }) {
                                  const dias = diasParaVencer(item.data_vencimento)
                                  return (
                                    <div className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0 gap-3">
                                      <div className="min-w-0">
                                        <p className="text-xs font-bold text-slate-800 truncate">{item.tipo || item.orgao || item.orgao_emissor || tipo}</p>
                                        {item.orgao_emissor && <p className="text-[10px] text-slate-400">{item.orgao_emissor}</p>}
                                        {item.atividade_sanitaria && <p className="text-[10px] text-slate-400">{item.atividade_sanitaria}</p>}
                                        {item.titular && <p className="text-[10px] text-slate-400">{item.titular} · {item.uso}</p>}
                                      </div>
                                      <div className="flex items-center gap-2 flex-shrink-0">
                                        <span className="text-[10px] font-mono text-slate-600">
                                          {item.data_vencimento ? new Date(item.data_vencimento + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}
                                        </span>
                                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${urgBadge(dias)}`}>{urgLabel(dias)}</span>
                                      </div>
                                    </div>
                                  )
                                }

                                return (
                                  <div className="space-y-5">

                                    {/* Pendência */}
                                    <div className="p-3 bg-white rounded-xl border border-slate-200">
                                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">Status de Pendência Geral</p>
                                      <div className="flex items-center gap-2">
                                        <select
                                          className="flex-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold p-2 outline-none focus:border-yellow-400"
                                          value={pendenciaEdit[emp.id] || docs.pendencia || 'nenhuma'}
                                          onChange={e => setPendenciaEdit(prev => ({ ...prev, [emp.id]: e.target.value }))}
                                        >
                                          {pendOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                        </select>
                                        <button onClick={() => savePendencia(emp.id)}
                                          className="bg-black text-yellow-400 px-4 py-2 rounded-lg text-[10px] font-black uppercase hover:bg-slate-800 transition-all">
                                          Salvar
                                        </button>
                                      </div>
                                    </div>

                                    {/* Documentos grid */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                                      {/* Certidões por órgão */}
                                      {(['Receita Federal', 'Estado', 'Prefeitura', 'CRF'] as const).map(orgao => {
                                        const items = docs.certidoes.filter((c: any) =>
                                          (c.orgao_emissor || '').toLowerCase().includes(orgao.toLowerCase()) ||
                                          (orgao === 'Receita Federal' && (c.orgao_emissor || '').toLowerCase().includes('receita')) ||
                                          (orgao === 'Estado' && (c.orgao_emissor || '').toLowerCase().includes('estadual')) ||
                                          (orgao === 'Prefeitura' && (c.orgao_emissor || '').toLowerCase().includes('municipal'))
                                        )
                                        return (
                                          <div key={orgao} className="bg-white rounded-xl border border-slate-200 p-3">
                                            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">📜 Certidão — {orgao}</p>
                                            {items.length === 0 ? (
                                              <p className="text-[10px] text-slate-300 italic">Nenhuma registrada</p>
                                            ) : items.map((item: any) => <DocRow key={item.id} item={item} tipo="Certidão" />)}
                                          </div>
                                        )
                                      })}

                                      {/* Alvarás */}
                                      <div className="bg-white rounded-xl border border-slate-200 p-3">
                                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">🏛️ Alvarás</p>
                                        {docs.alvaras.length === 0
                                          ? <p className="text-[10px] text-slate-300 italic">Nenhum registrado</p>
                                          : docs.alvaras.map((item: any) => <DocRow key={item.id} item={item} tipo="Alvará" />)
                                        }
                                      </div>

                                      {/* Licenças Sanitárias */}
                                      <div className="bg-white rounded-xl border border-slate-200 p-3">
                                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">⚕️ Licenças Sanitárias</p>
                                        {docs.licencas.length === 0
                                          ? <p className="text-[10px] text-slate-300 italic">Nenhuma registrada</p>
                                          : docs.licencas.map((item: any) => <DocRow key={item.id} item={item} tipo="Licença" />)
                                        }
                                      </div>

                                      {/* Certificados Digitais */}
                                      <div className="bg-white rounded-xl border border-slate-200 p-3">
                                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">🔐 Certificados Digitais</p>
                                        {docs.certificados.length === 0
                                          ? <p className="text-[10px] text-slate-300 italic">Nenhum registrado</p>
                                          : docs.certificados.map((item: any) => <DocRow key={item.id} item={item} tipo="Certificado" />)
                                        }
                                      </div>
                                    </div>

                                    {/* Histórico de comentários */}
                                    <div className="bg-white rounded-xl border border-slate-200 p-3">
                                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-3">💬 Histórico de Pendências</p>
                                      <div className="flex gap-2 mb-3">
                                        <input
                                          className="flex-1 bg-slate-50 border border-slate-200 rounded-lg text-xs p-2 outline-none focus:border-yellow-400"
                                          placeholder="Registrar comentário ou pendência..."
                                          value={notaInput}
                                          onChange={e => setNotaInput(e.target.value)}
                                          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addEmpresaNota(emp.id) } }}
                                        />
                                        <button
                                          onClick={() => addEmpresaNota(emp.id)}
                                          disabled={notaSaving || !notaInput.trim()}
                                          className="bg-black text-yellow-400 px-4 py-2 rounded-lg text-[10px] font-black uppercase hover:bg-slate-800 transition-all disabled:opacity-40">
                                          {notaSaving ? '...' : 'Registrar'}
                                        </button>
                                      </div>
                                      {docs.notas.length === 0 ? (
                                        <p className="text-[10px] text-slate-300 italic text-center py-2">Nenhum comentário registrado.</p>
                                      ) : (
                                        <div className="space-y-2 max-h-48 overflow-y-auto">
                                          {docs.notas.map((n: any) => (
                                            <div key={n.id} className="flex gap-2 text-xs">
                                              <span className="text-slate-300 flex-shrink-0 font-mono text-[9px] mt-0.5">
                                                {new Date(n.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                              </span>
                                              <p className="text-slate-700">{n.nota}</p>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>

                                  </div>
                                )
                              })()}

                              {/* ── Controles ── */}
                              {activeTab === 'controles' && (
                                <div>
                                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-4">Ações Rápidas</p>
                                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                    {[
                                      { label: 'Editar Dados', icon: '✎', action: () => { setFormData(emp); setIsModalOpen(true) }, color: 'hover:bg-yellow-50 hover:border-yellow-300 hover:text-yellow-700' },
                                      { label: 'Ver Processos', icon: '📋', action: () => setActiveTab('processos'), color: 'hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700' },
                                      { label: 'Dossiê CNPJ', icon: '📄', action: () => setActiveTab('dossie'), color: 'hover:bg-slate-100 hover:border-slate-300' },
                                      { label: 'Ver Sócios', icon: '👥', action: () => setActiveTab('socios'), color: 'hover:bg-purple-50 hover:border-purple-300 hover:text-purple-700' },
                                      { label: 'Ir p/ Societário', icon: '⚖️', action: () => window.location.href = '/societario', color: 'hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-700' },
                                      { label: 'Ir p/ Certidões', icon: '📜', action: () => window.location.href = '/certidoes', color: 'hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-700' },
                                      { label: 'Ir p/ Alvarás', icon: '🏛️', action: () => window.location.href = '/alvaras', color: 'hover:bg-orange-50 hover:border-orange-300 hover:text-orange-700' },
                                      { label: 'Ir p/ Financeiro', icon: '💰', action: () => window.location.href = '/financeiro', color: 'hover:bg-green-50 hover:border-green-300 hover:text-green-700' },
                                      { label: 'Excluir Empresa', icon: '🗑️', action: () => handleExcluir(emp.id), color: 'hover:bg-red-50 hover:border-red-300 hover:text-red-700' },
                                    ].map(btn => (
                                      <button
                                        key={btn.label}
                                        onClick={btn.action}
                                        className={`flex items-center gap-2 px-4 py-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 text-left transition-all ${btn.color}`}
                                      >
                                        <span>{btn.icon}</span>
                                        <span>{btn.label}</span>
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}

                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>

        {empresasFiltradas.length === 0 && (
          <div className="py-16 text-center text-slate-400 italic text-sm">
            {search ? `Nenhuma empresa encontrada para "${search}".` : 'Nenhuma empresa cadastrada.'}
          </div>
        )}
      </div>

      {/* ── Modal Cadastro / Edição ── */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 text-left">
          <div className="bg-white w-full max-w-lg rounded-2xl p-8 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button onClick={() => setIsModalOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-red-500 font-black">FECHAR ✕</button>
            <h2 className="text-xl font-bold mb-6 text-slate-800">{formData.id ? 'Atualizar Empresa' : 'Importar Empresa'}</h2>

            <div className="flex gap-2 mb-6">
              <input
                className="flex-1 bg-slate-50 border p-3 rounded-xl text-sm font-mono outline-none focus:border-yellow-400"
                placeholder="00.000.000/0000-00"
                value={formData.cnpj}
                onChange={e => setFormData({ ...formData, cnpj: e.target.value })}
              />
              <button onClick={consultarCNPJ} disabled={isConsulting} className="bg-black text-yellow-400 px-6 rounded-xl font-bold text-xs uppercase disabled:opacity-50">
                {isConsulting ? '...' : 'BUSCAR'}
              </button>
            </div>

            {formData.razao_social && (
              <form onSubmit={handleSave} className="space-y-4">
                <div className="bg-slate-50 p-4 rounded-xl border-l-4 border-yellow-400">
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Identificada</p>
                  <p className="text-sm font-bold text-slate-900 uppercase truncate mt-1">{formData.razao_social}</p>
                  <p className="text-[10px] text-slate-500 font-mono mt-0.5">{formData.cnpj}</p>
                </div>

                {/* Regime tributário */}
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Regime Tributário</label>
                  <select
                    value={formData.regime_tributario}
                    onChange={e => setFormData({ ...formData, regime_tributario: e.target.value })}
                    className="w-full bg-slate-50 border p-3 rounded-xl text-sm outline-none focus:border-yellow-400"
                  >
                    <option value="">— Selecionar —</option>
                    {REGIME_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>

                <button type="submit" className="w-full bg-black text-yellow-400 py-4 rounded-xl font-bold text-xs uppercase shadow-xl hover:bg-slate-800 transition-all">
                  CONFIRMAR E SALVAR
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
