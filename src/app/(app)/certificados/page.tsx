'use client'

import { Suspense, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CertificadoDigital, Empresa } from '@/types'
import { formatDate, formatCNPJ } from '@/lib/utils'
import { AC_URLS } from '@/types'
import StatusBadge from '@/components/ui/StatusBadge'
import Modal from '@/components/ui/Modal'
import CertificadoForm from '@/components/modules/CertificadoForm'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import toast from 'react-hot-toast'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

type EditingDate = { id: string; field: 'aviso' | 'agenda' } | null
type Aba = 'processo' | 'certificados'

function fmtDate(iso?: string | null) {
  if (!iso) return null
  return new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}
function fmtDateTime(iso?: string | null) {
  if (!iso) return null
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}
function todayISO() {
  return new Date().toISOString().slice(0, 10)
}
// Converte ISO UTC → string local para input datetime-local
function toLocalDatetimeInput(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
// Converte string local do input → ISO UTC para salvar no banco
function localDatetimeToISO(localStr: string): string | null {
  if (!localStr) return null
  return new Date(localStr).toISOString()
}

function CertificadosPageInner() {
  const searchParams = useSearchParams()
  const [certs, setCerts] = useState<CertificadoDigital[]>([])
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editItem, setEditItem] = useState<CertificadoDigital | null>(null)
  const [deleteItem, setDeleteItem] = useState<CertificadoDigital | null>(null)
  const [filtroEmpresa, setFiltroEmpresa] = useState(searchParams.get('empresa') || '')
  const [supabase] = useState(createClient)
  const [editingDate, setEditingDate] = useState<EditingDate>(null)
  const [saving, setSaving] = useState<string | null>(null)
  const [aba, setAba] = useState<Aba>('processo')
  const [busca, setBusca] = useState('')
  const [filtroEmissao, setFiltroEmissao] = useState<number | null>(null)

  async function saveControl(id: string, fields: Record<string, any>) {
    setSaving(id)
    await supabase.from('certificados_digitais').update(fields).eq('id', id)
    setCerts(prev => prev.map(c => c.id === id ? { ...c, ...fields } : c))
    setSaving(null)
    if (fields.certificado_finalizado === true) {
      toast.success('Certificado finalizado! Movido para a lista de Certificados.')
      setAba('certificados')
    } else if (fields.certificado_finalizado === false) {
      toast.success('Reaberto. Movido para Em Processo.')
      setAba('processo')
    } else {
      toast.success('Salvo!')
    }
  }

  async function load() {
    setLoading(true)
    const [{ data: cs }, { data: emps }] = await Promise.all([
      supabase.from('v_certificados_status').select('*').order('data_vencimento', { ascending: true }),
      supabase.from('empresas').select('id, razao_social, cnpj').order('razao_social'),
    ])
    setCerts(cs ?? [])
    setEmpresas((emps ?? []) as Empresa[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const byEmpresa = (list: CertificadoDigital[]) =>
    filtroEmpresa === '__avulsa__'
      ? list.filter(c => !c.empresa_id)
      : filtroEmpresa
        ? list.filter(c => c.empresa_id === filtroEmpresa)
        : list

  function norm(str: string): string {
    return str.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  }

  const byBusca = (list: CertificadoDigital[]) => {
    const q = norm(busca.trim())
    if (!q) return list
    const qDigits = q.replace(/\D/g, '')
    return list.filter(c => {
      const nome = norm(c.razao_social || (c as any).empresa_nome_livre || '')
      const titular = norm(c.titular || '')
      const cnpj = (c.cnpj || (c as any).empresa_cnpj_livre || '').replace(/\D/g, '')
      return nome.includes(q) || titular.includes(q) || (qDigits && cnpj.includes(qDigits))
    })
  }

  const emProcesso  = byBusca(byEmpresa(certs.filter(c => !(c as any).certificado_finalizado)))

  const byEmissao = (list: CertificadoDigital[]) => {
    if (!filtroEmissao) return list
    const corte = new Date()
    corte.setDate(corte.getDate() - filtroEmissao)
    corte.setHours(0, 0, 0, 0)
    return list.filter(c => {
      if (!c.data_emissao) return false
      return new Date(c.data_emissao + 'T12:00:00') >= corte
    })
  }

  const finalizados = byEmissao(byBusca(byEmpresa(certs.filter(c => !!(c as any).certificado_finalizado))))

  async function handleDelete() {
    if (!deleteItem) return
    const { error } = await supabase.from('certificados_digitais').delete().eq('id', deleteItem.id)
    if (error) { toast.error('Erro ao excluir'); return }
    toast.success('Certificado excluído')
    setDeleteItem(null)
    load()
  }

  // ─── Chips de controle (usados na aba Em Processo) ───────────────
  function ControlChips({ c }: { c: CertificadoDigital }) {
    const avisoFmt   = fmtDate((c as any).data_aviso_cliente)
    const agendaFmt  = fmtDateTime((c as any).data_agendamento)
    const pago       = !!(c as any).pagamento_confirmado
    const isEditAviso  = editingDate?.id === c.id && editingDate.field === 'aviso'
    const isEditAgenda = editingDate?.id === c.id && editingDate.field === 'agenda'

    return (
      <div className="flex flex-col gap-1">
        <div className="flex gap-1 flex-wrap">
          <button onClick={() => setEditingDate(isEditAviso ? null : { id: c.id, field: 'aviso' })}
            title="Registrar data do aviso ao cliente"
            className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full border transition-all ${
              avisoFmt ? 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100'
                       : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300 hover:text-slate-600'
            } ${isEditAviso ? 'ring-1 ring-blue-400' : ''}`}>
            <span>📧</span><span>{avisoFmt ?? 'Aviso'}</span>
          </button>
          <button onClick={() => saveControl(c.id, { pagamento_confirmado: !pago })}
            disabled={saving === c.id}
            className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full border transition-all ${
              pago ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                   : 'bg-amber-50 border-amber-200 text-amber-600 hover:bg-amber-100'
            }`}>
            <span>💰</span><span>{pago ? 'Pago' : 'Pendente'}</span>
          </button>
        </div>
        <div className="flex gap-1 flex-wrap">
          <button onClick={() => setEditingDate(isEditAgenda ? null : { id: c.id, field: 'agenda' })}
            title="Agendar videoconferência"
            className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full border transition-all ${
              agendaFmt ? 'bg-violet-50 border-violet-200 text-violet-700 hover:bg-violet-100'
                        : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300 hover:text-slate-600'
            } ${isEditAgenda ? 'ring-1 ring-violet-400' : ''}`}>
            <span>🎥</span><span>{agendaFmt ?? 'Videoconf.'}</span>
          </button>
          <button onClick={() => saveControl(c.id, { certificado_finalizado: true })}
            disabled={saving === c.id}
            title="Marcar como emitido e finalizado"
            className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full border border-slate-200 bg-white text-slate-400 hover:border-emerald-300 hover:text-emerald-600 hover:bg-emerald-50 transition-all">
            <span>✅</span><span>Finalizar</span>
          </button>
        </div>
      </div>
    )
  }

  // ─── Linhas de editor de data inline ─────────────────────────────
  function DateEditorRow({ c, colSpan }: { c: CertificadoDigital; colSpan: number }) {
    const isEditAviso  = editingDate?.id === c.id && editingDate.field === 'aviso'
    const isEditAgenda = editingDate?.id === c.id && editingDate.field === 'agenda'
    if (!isEditAviso && !isEditAgenda) return null
    return (
      <tr className={`border-b ${isEditAviso ? 'bg-blue-50/70 border-blue-100' : 'bg-violet-50/70 border-violet-100'}`}>
        <td colSpan={colSpan} className="px-6 py-3">
          {isEditAviso && (
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-[10px] font-black uppercase tracking-widest text-blue-600">📧 Data do Aviso — {c.razao_social}</span>
              <input type="date" id={`aviso-${c.id}`}
                defaultValue={(c as any).data_aviso_cliente || ''}
                className="border border-blue-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-blue-400 bg-white" />
              <button onClick={() => {
                const val = (document.getElementById(`aviso-${c.id}`) as HTMLInputElement)?.value || null
                saveControl(c.id, { data_aviso_cliente: val }).then(() => setEditingDate(null))
              }} className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-black hover:bg-blue-700">Salvar</button>
              <button onClick={() => {
                const input = document.getElementById(`aviso-${c.id}`) as HTMLInputElement
                if (input) input.value = todayISO()
                saveControl(c.id, { data_aviso_cliente: todayISO() }).then(() => setEditingDate(null))
              }} className="bg-white border border-blue-300 text-blue-600 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-blue-50">📅 Hoje</button>
              <button onClick={() => setEditingDate(null)} className="text-xs text-gray-400 hover:text-gray-600">Cancelar</button>
            </div>
          )}
          {isEditAgenda && (
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-[10px] font-black uppercase tracking-widest text-violet-600">🎥 Agendamento — {c.razao_social}</span>
              <input type="datetime-local" id={`agenda-${c.id}`}
                defaultValue={(c as any).data_agendamento ? toLocalDatetimeInput((c as any).data_agendamento) : ''}
                className="border border-violet-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-violet-400 bg-white" />
              <button onClick={() => {
                const raw = (document.getElementById(`agenda-${c.id}`) as HTMLInputElement)?.value || null
                saveControl(c.id, { data_agendamento: localDatetimeToISO(raw ?? '') }).then(() => setEditingDate(null))
              }} className="bg-violet-600 text-white px-3 py-1.5 rounded-lg text-xs font-black hover:bg-violet-700">Salvar</button>
              {(c as any).data_agendamento && (
                <button onClick={() => saveControl(c.id, { data_agendamento: null }).then(() => setEditingDate(null))}
                  className="bg-white border border-red-200 text-red-500 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-red-50">Remover</button>
              )}
              <button onClick={() => setEditingDate(null)} className="text-xs text-gray-400 hover:text-gray-600">Cancelar</button>
            </div>
          )}
        </td>
      </tr>
    )
  }

  const empresaNomeAtual = filtroEmpresa && filtroEmpresa !== '__avulsa__'
    ? (empresas.find(e => e.id === filtroEmpresa)?.razao_social || '')
    : ''

  return (
    <div className="p-6">
      {/* Banner empresa filtrada */}
      {filtroEmpresa && filtroEmpresa !== '__avulsa__' && searchParams.get('empresa') && (
        <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-2xl px-5 py-3 mb-4">
          <Link href={`/empresas/${filtroEmpresa}`} className="flex items-center gap-1.5 text-blue-600 hover:text-blue-800 text-sm font-semibold transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
            Voltar para empresa
          </Link>
          <span className="text-blue-300">|</span>
          <span className="text-sm text-blue-800 font-bold truncate">{empresaNomeAtual}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-[9px] font-black uppercase tracking-widest text-blue-600 mb-1">CONTROLES</p>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Certificados Digitais</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {emProcesso.length} em processo · {finalizados.length} emitido(s)
          </p>
        </div>
        <button onClick={() => { setEditItem(null); setModalOpen(true) }} className="btn-primary">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Novo Certificado
        </button>
      </div>

      {/* Filtro + Abas */}
      <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <select className="input max-w-xs" value={filtroEmpresa} onChange={e => setFiltroEmpresa(e.target.value)}>
            <option value="">Todas as empresas</option>
            <option value="__avulsa__">— Empresas Avulsas —</option>
            {empresas.map(e => <option key={e.id} value={e.id}>{e.razao_social}</option>)}
          </select>
          <div className="relative">
            <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
            <input
              type="text"
              placeholder="Buscar empresa, titular ou CNPJ..."
              value={busca}
              onChange={e => setBusca(e.target.value)}
              className="input pl-9 w-72"
            />
            {busca && (
              <button onClick={() => setBusca('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Abas */}
        <div className="flex gap-1.5">
          {([
            { id: 'processo',     label: 'Em Processo',  count: emProcesso.length,  hex: '#F59E0B', glow: 'rgba(245,158,11,0.25)', dot: 'bg-amber-400' },
            { id: 'certificados', label: 'Certificados', count: finalizados.length, hex: '#10B981', glow: 'rgba(16,185,129,0.25)', dot: 'bg-emerald-500' },
          ] as const).map(t => {
            const isActive = aba === t.id
            return (
              <button key={t.id} onClick={() => setAba(t.id)}
                style={isActive ? { background: t.hex, boxShadow: `0 4px 16px ${t.glow}, 0 1px 3px rgba(0,0,0,0.1)` } : {}}
                className={[
                  'flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold whitespace-nowrap select-none outline-none',
                  'transition-all duration-200 ease-in-out',
                  isActive
                    ? 'text-white -translate-y-px'
                    : 'text-slate-500 bg-[#F3F4F6] hover:-translate-y-px hover:shadow-md',
                ].join(' ')}>
                <span
                  className={`w-2 h-2 rounded-full flex-shrink-0 ${!isActive ? t.dot : ''}`}
                  style={isActive ? { background: 'rgba(255,255,255,0.65)' } : {}}
                />
                {t.label}
                {t.count > 0 && (
                  <span
                    className="text-[10px] font-black px-2 py-0.5 rounded-full leading-none"
                    style={isActive ? { background: 'rgba(255,255,255,0.25)', color: 'white' } : { background: '#F1F5F9', color: '#64748B' }}>
                    {t.count}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {loading ? (
        <div className="card p-12 text-center text-gray-400">Carregando...</div>
      ) : (
        <>
          {/* ══════════════════════════════════════════════════════
              ABA: EM PROCESSO
          ══════════════════════════════════════════════════════ */}
          {aba === 'processo' && (
            <div className="card overflow-hidden">
              {emProcesso.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="text-4xl mb-3">🎉</div>
                  <p className="font-semibold text-gray-700">Nenhum certificado em processo</p>
                  <p className="text-sm text-gray-400 mt-1">Tudo em dia ou adicione um novo certificado para iniciar o processo.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-amber-50 border-b border-amber-100">
                      <tr>
                        <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-amber-700">Empresa / Titular</th>
                        <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-amber-700">Tipo / AC</th>
                        <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-amber-700 min-w-[230px]">Controle do Processo</th>
                        <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest text-amber-700">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {emProcesso.map(c => (
                        <>
                        <tr key={c.id} className="hover:bg-amber-50/40 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              {c.empresa_id
                                ? <Link href={`/empresas/${c.empresa_id}`} className="font-semibold text-gray-900 hover:text-blue-600 hover:underline underline-offset-2 transition-colors truncate max-w-[160px]" title="Ver cadastro da empresa">{c.razao_social}</Link>
                                : <span className="font-semibold text-gray-900 truncate max-w-[160px]">{c.razao_social}</span>
                              }
                              {!c.empresa_id && <span className="text-[9px] font-black uppercase tracking-widest bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full">avulsa</span>}
                            </div>
                            <div className="text-xs text-gray-400 mt-0.5">{c.titular}</div>
                            {c.cnpj && <div className="text-[10px] text-gray-400 font-mono">{formatCNPJ(c.cnpj)}</div>}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5 mb-1">
                              <span className={`text-xs px-1.5 py-0.5 rounded font-mono font-bold ${
                                c.tipo === 'A1' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                              }`}>{c.tipo}</span>
                              <span className="text-gray-600 text-xs">{c.uso}</span>
                            </div>
                            <div className="text-xs text-gray-400">{c.autoridade_certificadora}</div>
                          </td>
                          <td className="px-4 py-3">
                            <ControlChips c={c} />
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1 justify-end">
                              <button onClick={() => { setEditItem(c); setModalOpen(true) }}
                                className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg" title="Editar">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              <button onClick={() => setDeleteItem(c)}
                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg" title="Excluir">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                        <DateEditorRow c={c} colSpan={4} />
                        </>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════
              ABA: CERTIFICADOS EMITIDOS
          ══════════════════════════════════════════════════════ */}
          {aba === 'certificados' && (
            <>
              {/* Filtro por data de emissão */}
              <div className="flex items-center gap-1.5 mb-3 flex-wrap">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wide mr-1">Emitidos nos últimos:</span>
                {[15, 30, 45, 60, 90].map(d => {
                  const isActive = filtroEmissao === d
                  return (
                    <button key={d} onClick={() => setFiltroEmissao(isActive ? null : d)}
                      style={isActive ? { background: '#3B82F6', boxShadow: '0 4px 16px rgba(59,130,246,0.25), 0 1px 3px rgba(0,0,0,0.1)' } : {}}
                      className={[
                        'px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap select-none outline-none',
                        'transition-all duration-200 ease-in-out',
                        isActive
                          ? 'text-white -translate-y-px'
                          : 'text-slate-500 bg-[#F3F4F6] hover:-translate-y-px hover:shadow-md',
                      ].join(' ')}>
                      {d} dias
                    </button>
                  )
                })}
                {filtroEmissao && (
                  <button onClick={() => setFiltroEmissao(null)}
                    className="text-xs text-slate-400 hover:text-slate-600 underline ml-1">
                    Limpar
                  </button>
                )}
              </div>

            <div className="card overflow-hidden">
              {finalizados.length === 0 ? (
                <div className="p-12 text-center">
                  <p className="font-semibold text-gray-700">Nenhum certificado emitido ainda</p>
                  <p className="text-sm text-gray-400 mt-1">Os certificados aparecem aqui após serem marcados como finalizados.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium text-gray-600">Empresa</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-600">Titular</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-600">Tipo / Uso</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-600">AC</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-600">Emissão</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-600">Vencimento</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
                        <th className="px-4 py-3 text-right font-medium text-gray-600">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {finalizados.map(c => (
                        <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              {c.empresa_id
                                ? <Link href={`/empresas/${c.empresa_id}`} className="font-medium text-gray-900 hover:text-blue-600 hover:underline underline-offset-2 transition-colors truncate max-w-[140px]" title="Ver cadastro da empresa">{c.razao_social}</Link>
                                : <span className="font-medium text-gray-900 truncate max-w-[140px]">{c.razao_social}</span>
                              }
                              {!c.empresa_id && <span className="text-[9px] font-black uppercase bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full">avulsa</span>}
                            </div>
                            <div className="text-xs text-gray-400 font-mono">{c.cnpj && formatCNPJ(c.cnpj)}</div>
                          </td>
                          <td className="px-4 py-3 text-gray-700">{c.titular}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              <span className={`text-xs px-1.5 py-0.5 rounded font-mono font-bold ${
                                c.tipo === 'A1' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                              }`}>{c.tipo}</span>
                              <span className="text-gray-600">{c.uso}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {AC_URLS[c.autoridade_certificadora] ? (
                              <a href={AC_URLS[c.autoridade_certificadora]} target="_blank" rel="noopener noreferrer"
                                className="text-primary-600 hover:underline">{c.autoridade_certificadora}</a>
                            ) : (
                              <span className="text-gray-600">{c.autoridade_certificadora}</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-gray-500 text-xs">{formatDate(c.data_emissao) || '—'}</td>
                          <td className="px-4 py-3 text-gray-600">{formatDate(c.data_vencimento) || '—'}</td>
                          <td className="px-4 py-3">
                            <StatusBadge status={c.status_cor ?? 'sem_data'} diasParaVencer={c.dias_para_vencer} />
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1 justify-end">
                              {AC_URLS[c.autoridade_certificadora] && (
                                <a href={AC_URLS[c.autoridade_certificadora]} target="_blank" rel="noopener noreferrer"
                                  className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg" title="Renovar online">
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                  </svg>
                                </a>
                              )}
                              <button onClick={() => saveControl(c.id, { certificado_finalizado: false })}
                                disabled={saving === c.id}
                                title="Reabrir para edição do processo"
                                className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                              </button>
                              <button onClick={() => { setEditItem(c); setModalOpen(true) }}
                                className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg" title="Editar">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              <button onClick={() => setDeleteItem(c)}
                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg" title="Excluir">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            </>
          )}
        </>
      )}

      <Modal open={modalOpen} onClose={() => { setModalOpen(false); setEditItem(null) }}
        title={editItem ? 'Editar Certificado' : 'Novo Certificado Digital'} size="lg">
        <CertificadoForm
          empresas={empresas}
          certificado={editItem ?? undefined}
          defaultEmpresaId={filtroEmpresa}
          onSuccess={() => { setModalOpen(false); setEditItem(null); load() }}
        />
      </Modal>

      <ConfirmDialog
        open={!!deleteItem}
        title="Excluir Certificado"
        message={`Deseja excluir o certificado de "${deleteItem?.titular}"?`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteItem(null)}
        danger
      />
    </div>
  )
}

export default function CertificadosPage() {
  return <Suspense><CertificadosPageInner /></Suspense>
}
