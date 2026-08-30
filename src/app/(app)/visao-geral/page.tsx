'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useOrg } from '@/lib/org-context'
import Link from 'next/link'

type CellInfo = { date: string | null; pendente: boolean }
type CellKey = 'federal' | 'estadual' | 'municipal' | 'fgts' | 'trabalhista' | 'previdenciaria' | 'alvara' | 'certificado'
type Row = { id: string; nome: string } & Record<CellKey, CellInfo>

const EMPTY: CellInfo = { date: null, pendente: false }

const COLS: Array<{ key: CellKey; label: string }> = [
  { key: 'federal',        label: 'CND Federal' },
  { key: 'estadual',       label: 'CND Estadual' },
  { key: 'municipal',      label: 'CND Municipal' },
  { key: 'fgts',           label: 'FGTS' },
  { key: 'trabalhista',    label: 'Trabalhista' },
  { key: 'previdenciaria', label: 'Previdenciária' },
  { key: 'alvara',         label: 'Alvará' },
  { key: 'certificado',    label: 'Cert. Digital' },
]

function diasParaVencer(d: string | null): number | null {
  if (!d) return null
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
  return Math.round((new Date(d + 'T00:00:00').getTime() - hoje.getTime()) / 86400000)
}

function cellColor(info: CellInfo): string {
  if (info.pendente) return 'bg-red-50 text-red-600 font-semibold'
  if (!info.date) return ''
  const d = diasParaVencer(info.date)
  if (d === null) return 'text-slate-400'
  if (d < 0)   return 'bg-red-100 text-red-700 font-bold'
  if (d <= 15) return 'bg-red-50 text-red-600 font-semibold'
  if (d <= 30) return 'bg-orange-50 text-orange-600'
  if (d <= 60) return 'bg-yellow-50 text-yellow-700'
  return 'bg-emerald-50 text-emerald-700'
}

function cellLabel(info: CellInfo): string {
  if (info.pendente) return 'Pendente'
  if (!info.date) return '—'
  return new Date(info.date + 'T00:00:00').toLocaleDateString('pt-BR')
}

function cellScore(info: CellInfo): number {
  if (info.pendente) return -9999
  if (!info.date) return 9999
  return diasParaVencer(info.date) ?? 9999
}

function rowWorstScore(row: Row): number {
  return Math.min(...COLS.map(c => cellScore(row[c.key])))
}

function worstCertidao(certs: Array<{ data_vencimento: string | null; pendencia_status: string }>): CellInfo {
  if (!certs.length) return EMPTY
  if (certs.some(c => c.pendencia_status === 'impossivel_renovar')) {
    const with_date = certs.find(c => c.data_vencimento)
    return { date: with_date?.data_vencimento ?? null, pendente: true }
  }
  const sorted = [...certs].filter(c => c.data_vencimento).sort((a, b) =>
    a.data_vencimento! < b.data_vencimento! ? -1 : 1
  )
  return { date: sorted[0]?.data_vencimento ?? null, pendente: false }
}

function worstDate(items: Array<{ data_vencimento: string | null }>): CellInfo {
  if (!items.length) return EMPTY
  const sorted = [...items].filter(i => i.data_vencimento).sort((a, b) =>
    a.data_vencimento! < b.data_vencimento! ? -1 : 1
  )
  return { date: sorted[0]?.data_vencimento ?? null, pendente: false }
}

export default function VisaoGeralPage() {
  const { orgId } = useOrg()
  const [supabase] = useState(createClient())
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [sortBy, setSortBy] = useState<'nome' | 'urgencia'>('nome')
  const [copiado, setCopiado] = useState<string | null>(null)
  const [soProblemas, setSoProblemas] = useState(false)

  const load = useCallback(async () => {
    if (!orgId) return
    setLoading(true)
    const { data: empresas } = await supabase
      .from('empresas').select('id, razao_social').eq('org_id', orgId).order('razao_social')

    const empresaIds = (empresas || []).map(e => e.id)

    if (!empresaIds.length) {
      setRows([])
      setLoading(false)
      return
    }

    const [{ data: certidoes }, { data: alvaras }, { data: certificados }] = await Promise.all([
      supabase.from('certidoes').select('empresa_id, tipo, data_vencimento, pendencia_status').in('empresa_id', empresaIds),
      supabase.from('alvaras').select('empresa_id, data_vencimento').in('empresa_id', empresaIds),
      supabase.from('certificados_digitais').select('empresa_id, data_vencimento').in('empresa_id', empresaIds),
    ])

    const built: Row[] = (empresas || []).map(emp => {
      const certs = (certidoes || []).filter(c => c.empresa_id === emp.id)
      return {
        id: emp.id,
        nome: emp.razao_social,
        federal:        worstCertidao(certs.filter(c => c.tipo === 'Federal')),
        estadual:       worstCertidao(certs.filter(c => c.tipo === 'Estadual')),
        municipal:      worstCertidao(certs.filter(c => c.tipo === 'Municipal')),
        fgts:           worstCertidao(certs.filter(c => c.tipo === 'FGTS')),
        trabalhista:    worstCertidao(certs.filter(c => c.tipo === 'Trabalhista')),
        previdenciaria: worstCertidao(certs.filter(c => c.tipo === 'Previdenciária')),
        alvara:         worstDate((alvaras || []).filter(a => a.empresa_id === emp.id)),
        certificado:    worstDate((certificados || []).filter(c => c.empresa_id === emp.id)),
      }
    })

    setRows(built)
    setLoading(false)
  }, [supabase, orgId])

  useEffect(() => { load() }, [load])

  function copyCell(label: string, cellId: string) {
    if (label === '—') return
    navigator.clipboard.writeText(label)
    setCopiado(cellId)
    setTimeout(() => setCopiado(null), 1500)
  }

  function rowHasIssue(row: Row): boolean {
    return COLS.some(c => {
      const info = row[c.key]
      if (info.pendente) return true
      if (!info.date) return false
      const d = diasParaVencer(info.date)
      return d !== null && d <= 60
    })
  }

  const filtered = rows
    .filter(r => r.nome.toLowerCase().includes(busca.toLowerCase()))
    .filter(r => !soProblemas || rowHasIssue(r))
    .sort((a, b) =>
      sortBy === 'urgencia'
        ? rowWorstScore(a) - rowWorstScore(b)
        : a.nome.localeCompare(b.nome, 'pt-BR')
    )

  return (
    <div className="px-6 py-8">
      {/* ── Cabeçalho ─────────────────────────────────────────────── */}
      <div className="flex items-start justify-between mb-5 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Visão Geral</h1>
          <p className="text-sm text-slate-500 mt-0.5">Todas as empresas · vencimentos consolidados</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setSoProblemas(v => !v)}
            style={soProblemas ? { background: '#EF4444', boxShadow: '0 4px 16px rgba(239,68,68,0.25), 0 1px 3px rgba(0,0,0,0.1)' } : {}}
            className={[
              'px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap select-none outline-none',
              'transition-all duration-200 ease-in-out',
              soProblemas ? 'text-white -translate-y-px' : 'text-slate-500 bg-[#F3F4F6] hover:-translate-y-px hover:shadow-md',
            ].join(' ')}>
            {soProblemas ? '🔴 Só problemas' : 'Só problemas'}
          </button>

          <div className="flex gap-1.5">
            {([
              { id: 'nome',     label: 'A → Z' },
              { id: 'urgencia', label: '🚨 Por urgência' },
            ] as const).map(s => {
              const isActive = sortBy === s.id
              return (
                <button key={s.id} onClick={() => setSortBy(s.id)}
                  style={isActive ? { background: '#1E293B', boxShadow: '0 4px 16px rgba(30,41,59,0.25), 0 1px 3px rgba(0,0,0,0.1)' } : {}}
                  className={[
                    'px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap select-none outline-none',
                    'transition-all duration-200 ease-in-out',
                    isActive ? 'text-white -translate-y-px' : 'text-slate-500 bg-[#F3F4F6] hover:-translate-y-px hover:shadow-md',
                  ].join(' ')}>
                  {s.label}
                </button>
              )
            })}
          </div>
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input value={busca} onChange={e => setBusca(e.target.value)}
              placeholder="Buscar empresa..."
              className="pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-blue-300 transition-colors w-52"
            />
          </div>
          <button onClick={load}
            className="text-xs font-bold text-slate-500 hover:text-slate-700 border border-slate-200 rounded-lg px-3 py-2 hover:bg-slate-50 transition-all">
            ↻ Atualizar
          </button>
        </div>
      </div>

      {/* ── Legenda ────────────────────────────────────────────────── */}
      <div className="flex items-center gap-4 mb-4 flex-wrap text-[11px]">
        {[
          { color: 'bg-red-100 border-red-200',    label: 'Vencida' },
          { color: 'bg-red-50 border-red-100',     label: '≤ 15 dias' },
          { color: 'bg-orange-50 border-orange-100', label: '≤ 30 dias' },
          { color: 'bg-yellow-50 border-yellow-100', label: '≤ 60 dias' },
          { color: 'bg-emerald-50 border-emerald-100', label: 'Em dia' },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className={`w-3 h-3 rounded ${color} border`} />
            <span className="text-slate-500">{label}</span>
          </div>
        ))}
        <div className="flex items-center gap-1">
          <span className="text-red-600 font-semibold">Pendente</span>
          <span className="text-slate-400">= impossível renovar</span>
        </div>
        <span className="text-slate-400 ml-auto">Clique em qualquer data para copiar</span>
      </div>

      {/* ── Tabela ─────────────────────────────────────────────────── */}
      {loading ? (
        <div className="text-center py-16 text-slate-400 text-sm">Carregando...</div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-sm">
          <table className="w-full text-[11px] border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="sticky left-0 z-10 bg-slate-50 text-left px-4 py-3 font-black uppercase tracking-wide text-slate-500 min-w-[180px] border-r border-slate-200">
                  Empresa
                </th>
                {COLS.map(col => (
                  <th key={col.key} className="text-center px-3 py-3 font-black uppercase tracking-wide text-slate-500 whitespace-nowrap min-w-[105px]">
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(row => (
                <tr key={row.id} className="border-b border-slate-100 hover:bg-blue-50/20 transition-colors group">
                  <td className="sticky left-0 z-10 bg-white group-hover:bg-blue-50/20 px-4 py-2.5 border-r border-slate-100 transition-colors">
                    <Link href={`/empresas/${row.id}`}
                      className="font-semibold text-slate-800 hover:text-blue-600 whitespace-nowrap transition-colors hover:underline underline-offset-2">
                      {row.nome}
                    </Link>
                  </td>
                  {COLS.map(col => {
                    const info = row[col.key]
                    const label = cellLabel(info)
                    const color = cellColor(info)
                    const cellId = `${row.id}-${col.key}`
                    const justCopied = copiado === cellId
                    return (
                      <td key={col.key} className="px-2 py-2 text-center">
                        {label === '—' ? (
                          <span className="text-slate-200 select-none">—</span>
                        ) : (
                          <button
                            onClick={() => copyCell(label, cellId)}
                            title="Clique para copiar"
                            className={[
                              'px-2 py-1 rounded-lg font-mono transition-all active:scale-95 cursor-copy',
                              justCopied ? 'ring-2 ring-blue-400 bg-blue-50 text-blue-600' : color,
                            ].join(' ')}>
                            {justCopied ? '✓' : label}
                          </button>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={COLS.length + 1} className="text-center py-12 text-slate-400 italic">
                    Nenhuma empresa encontrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-[11px] text-slate-400 mt-3 text-right">
        {filtered.length} empresa{filtered.length !== 1 ? 's' : ''} · dados em tempo real
      </p>
    </div>
  )
}
