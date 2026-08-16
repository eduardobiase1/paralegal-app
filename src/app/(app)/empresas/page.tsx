'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useOrg } from '@/lib/org-context'
import toast from 'react-hot-toast'

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

export default function EmpresasPage() {
  const router = useRouter()
  const { orgId, orgName } = useOrg()
  const [supabase] = useState(createClient())
  const [empresas, setEmpresas] = useState<any[]>([])
  const [processosPorEmpresa, setProcessosPorEmpresa] = useState<Record<string, any[]>>({})
  const [ultimaAcaoPorEmpresa, setUltimaAcaoPorEmpresa] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isConsulting, setIsConsulting] = useState(false)
  const [search, setSearch] = useState('')

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
    if (!error) { fetchData(); toast.success('Empresa removida') }
  }

  async function openMaps(emp: any) {
    const cepFmt = (emp.cep || '').replace(/\D/g, '').replace(/^(\d{5})(\d{3})$/, '$1-$2')
    const parts = [
      emp.logradouro, emp.numero, emp.complemento, emp.bairro,
      emp.municipio && emp.uf ? `${emp.municipio} - ${emp.uf}` : (emp.municipio || emp.uf),
      cepFmt, 'Brasil',
    ].filter(Boolean)
    const addr = parts.join(', ')
    const fallbackUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`
    const win = window.open('about:blank', '_blank')
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(addr)}&format=json&limit=1&countrycodes=br`,
        { headers: { 'Accept-Language': 'pt-BR' } }
      )
      const data = await res.json()
      if (data && data.length > 0) {
        const { lat, lon } = data[0]
        if (win) win.location.href = `https://maps.google.com/maps?q=&layer=c&cbll=${lat},${lon}&cbp=12,0,,0,0`
      } else {
        if (win) win.location.href = fallbackUrl
      }
    } catch {
      if (win) win.location.href = fallbackUrl
    }
  }

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

      {/* Cabeçalho */}
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

      {/* Busca */}
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

      {/* Tabela */}
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
                const tag = getNatTag(emp.natureza_juridica)
                const processos = processosPorEmpresa[emp.id] || []
                const ativos = processos.filter(p => p.status === 'Andamento')

                return (
                  <tr
                    key={emp.id}
                    onClick={() => router.push(`/empresas/${emp.id}`)}
                    className="border-b border-slate-100 hover:bg-yellow-50 cursor-pointer transition-colors"
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
                        {ativos.length > 0 && (
                          <button
                            onClick={() => router.push(`/societario?empresa=${emp.id}`)}
                            title="Ver processos"
                            className="px-2 py-1 rounded-lg text-[10px] font-black uppercase bg-blue-100 text-blue-700 hover:bg-blue-200 transition-all"
                          >
                            {ativos.length} proc.
                          </button>
                        )}
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

      {/* Modal Cadastro / Edição */}
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
