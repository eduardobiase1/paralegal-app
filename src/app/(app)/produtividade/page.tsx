'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useOrg } from '@/lib/org-context'

type TipoAcao =
  | 'Renovação' | 'Emissão' | 'Protocolo' | 'Reunião'
  | 'Societário' | 'Certidão' | 'Alvará' | 'Certificado Digital'
  | 'Email / Comunicado' | 'Outro'

const TIPOS: TipoAcao[] = [
  'Renovação', 'Emissão', 'Protocolo', 'Reunião',
  'Societário', 'Certidão', 'Alvará', 'Certificado Digital',
  'Email / Comunicado', 'Outro',
]

const TIPO_COLORS: Record<string, string> = {
  'Renovação':            '#10B981',
  'Emissão':              '#3B82F6',
  'Protocolo':            '#8B5CF6',
  'Reunião':              '#F59E0B',
  'Societário':           '#EC4899',
  'Certidão':             '#06B6D4',
  'Alvará':               '#F97316',
  'Certificado Digital':  '#6366F1',
  'Email / Comunicado':   '#64748B',
  'Outro':                '#9CA3AF',
}

type Entrada = {
  id: string
  data: string      // ISO date yyyy-mm-dd
  tipo: TipoAcao
  empresa: string
  descricao: string
  duracao: number   // minutos
  criadoEm: string  // ISO timestamp
}

function hoje() {
  return new Date().toISOString().slice(0, 10)
}

function fmtDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })
}

function fmtDur(min: number) {
  if (min < 60) return `${min}min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `${h}h ${m}min` : `${h}h`
}

function loadEntradas(): Entrada[] {
  try {
    const raw = localStorage.getItem('produtividade_entradas')
    if (!raw) return []
    return JSON.parse(raw) as Entrada[]
  } catch { return [] }
}

function saveEntradas(entradas: Entrada[]) {
  localStorage.setItem('produtividade_entradas', JSON.stringify(entradas))
}

function semanaAtual(): string[] {
  const days: string[] = []
  const now = new Date()
  const dow = now.getDay()
  const seg = new Date(now)
  seg.setDate(now.getDate() - (dow === 0 ? 6 : dow - 1))
  for (let i = 0; i < 7; i++) {
    const d = new Date(seg)
    d.setDate(seg.getDate() + i)
    days.push(d.toISOString().slice(0, 10))
  }
  return days
}

export default function ProdutividadePage() {
  const { orgId } = useOrg()
  const [supabase] = useState(createClient())
  const [empresas, setEmpresas] = useState<Array<{ id: string; razao_social: string }>>([])
  const [entradas, setEntradas] = useState<Entrada[]>([])
  const [abaData, setAbaData] = useState<'hoje' | 'semana' | 'todas'>('hoje')
  const [showForm, setShowForm] = useState(false)

  // form state
  const [fData, setFData] = useState(hoje())
  const [fTipo, setFTipo] = useState<TipoAcao>('Renovação')
  const [fEmpresa, setFEmpresa] = useState('')
  const [fDesc, setFDesc] = useState('')
  const [fDur, setFDur] = useState(30)

  useEffect(() => {
    setEntradas(loadEntradas())
  }, [])

  useEffect(() => {
    if (!orgId) return
    supabase.from('empresas').select('id, razao_social').eq('org_id', orgId).order('razao_social')
      .then(({ data }) => setEmpresas(data || []))
  }, [supabase, orgId])

  function addEntrada() {
    if (!fDesc.trim()) return
    const nova: Entrada = {
      id: crypto.randomUUID(),
      data: fData,
      tipo: fTipo,
      empresa: fEmpresa,
      descricao: fDesc.trim(),
      duracao: fDur,
      criadoEm: new Date().toISOString(),
    }
    const updated = [nova, ...entradas]
    setEntradas(updated)
    saveEntradas(updated)
    setFDesc('')
    setFEmpresa('')
    setFDur(30)
    setShowForm(false)
  }

  function removeEntrada(id: string) {
    const updated = entradas.filter(e => e.id !== id)
    setEntradas(updated)
    saveEntradas(updated)
  }

  const semana = semanaAtual()
  const filtradas = entradas.filter(e => {
    if (abaData === 'hoje') return e.data === hoje()
    if (abaData === 'semana') return semana.includes(e.data)
    return true
  }).sort((a, b) => b.criadoEm.localeCompare(a.criadoEm))

  const totalHoje = entradas.filter(e => e.data === hoje()).reduce((s, e) => s + e.duracao, 0)
  const totalSemana = entradas.filter(e => semana.includes(e.data)).reduce((s, e) => s + e.duracao, 0)
  const countHoje = entradas.filter(e => e.data === hoje()).length
  const countSemana = entradas.filter(e => semana.includes(e.data)).length

  // por tipo na semana
  const porTipo: Record<string, number> = {}
  entradas.filter(e => semana.includes(e.data)).forEach(e => {
    porTipo[e.tipo] = (porTipo[e.tipo] || 0) + e.duracao
  })
  const tiposOrdenados = Object.entries(porTipo).sort((a, b) => b[1] - a[1])

  // por dia na semana
  const porDia: Record<string, number> = {}
  semana.forEach(d => { porDia[d] = 0 })
  entradas.filter(e => semana.includes(e.data)).forEach(e => { porDia[e.data] += e.duracao })
  const maxDia = Math.max(...Object.values(porDia), 1)

  return (
    <div className="px-6 py-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Registro de Produtividade</h1>
          <p className="text-sm text-slate-500 mt-0.5">Acompanhe as atividades e tempo dedicado</p>
        </div>
        <button
          onClick={() => setShowForm(v => !v)}
          style={{ background: '#1E293B', boxShadow: '0 4px 16px rgba(30,41,59,0.25)' }}
          className="px-4 py-2 rounded-full text-sm font-bold text-white hover:-translate-y-px transition-all">
          + Nova atividade
        </button>
      </div>

      {/* Formulário */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 mb-6">
          <h3 className="text-sm font-black text-slate-700 mb-4">Registrar atividade</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wide text-slate-400 block mb-1">Data</label>
              <input type="date" value={fData} onChange={e => setFData(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-300 transition-colors" />
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wide text-slate-400 block mb-1">Tipo</label>
              <select value={fTipo} onChange={e => setFTipo(e.target.value as TipoAcao)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-300 transition-colors bg-white">
                {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wide text-slate-400 block mb-1">Empresa (opcional)</label>
              <input list="emp-list" value={fEmpresa} onChange={e => setFEmpresa(e.target.value)}
                placeholder="Selecione ou digite..."
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-300 transition-colors" />
              <datalist id="emp-list">
                {empresas.map(e => <option key={e.id} value={e.razao_social} />)}
              </datalist>
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wide text-slate-400 block mb-1">Duração (minutos)</label>
              <div className="flex items-center gap-2">
                <input type="range" min={5} max={480} step={5} value={fDur} onChange={e => setFDur(+e.target.value)}
                  className="flex-1 accent-slate-800" />
                <span className="text-sm font-bold text-slate-700 w-14 text-right">{fmtDur(fDur)}</span>
              </div>
            </div>
            <div className="sm:col-span-2">
              <label className="text-[11px] font-bold uppercase tracking-wide text-slate-400 block mb-1">Descrição</label>
              <textarea value={fDesc} onChange={e => setFDesc(e.target.value)}
                placeholder="O que foi feito?"
                rows={2}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-300 transition-colors resize-none" />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={addEntrada}
              style={{ background: '#10B981', boxShadow: '0 4px 12px rgba(16,185,129,0.25)' }}
              className="px-4 py-2 rounded-full text-sm font-bold text-white hover:-translate-y-px transition-all">
              Salvar
            </button>
            <button onClick={() => setShowForm(false)}
              className="px-4 py-2 rounded-full text-sm font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 transition-colors">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Cards de resumo */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Atividades hoje', val: countHoje, sub: fmtDur(totalHoje), color: '#3B82F6' },
          { label: 'Atividades na semana', val: countSemana, sub: fmtDur(totalSemana), color: '#8B5CF6' },
          { label: 'Média diária (semana)', val: fmtDur(Math.round(totalSemana / 5)), sub: 'por dia útil', color: '#F59E0B' },
          { label: 'Total registrado', val: entradas.length, sub: 'desde o início', color: '#10B981' },
        ].map(card => (
          <div key={card.label} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">{card.label}</p>
            <p className="text-2xl font-black" style={{ color: card.color }}>{card.val}</p>
            <p className="text-xs text-slate-400 mt-0.5">{card.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Gráfico por dia */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 lg:col-span-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Horas por dia — semana atual</p>
          <div className="flex items-end gap-2 h-24">
            {semana.map(d => {
              const min = porDia[d] || 0
              const pct = Math.round((min / maxDia) * 100)
              const isHoje = d === hoje()
              const label = new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'short' })
              return (
                <div key={d} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full flex items-end justify-center" style={{ height: 72 }}>
                    <div
                      className="w-full rounded-t-md transition-all"
                      style={{
                        height: `${Math.max(pct, min > 0 ? 6 : 2)}%`,
                        background: isHoje ? '#3B82F6' : '#E2E8F0',
                        minHeight: 3,
                      }}
                      title={min > 0 ? fmtDur(min) : 'Sem registro'}
                    />
                  </div>
                  <span className={`text-[10px] font-bold capitalize ${isHoje ? 'text-blue-600' : 'text-slate-400'}`}>{label}</span>
                  {min > 0 && <span className="text-[9px] text-slate-400">{fmtDur(min)}</span>}
                </div>
              )
            })}
          </div>
        </div>

        {/* Por tipo */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Por tipo — semana</p>
          {tiposOrdenados.length === 0 ? (
            <p className="text-sm text-slate-400 italic">Nenhuma atividade</p>
          ) : (
            <div className="space-y-2">
              {tiposOrdenados.slice(0, 6).map(([tipo, min]) => (
                <div key={tipo}>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-xs font-semibold text-slate-600">{tipo}</span>
                    <span className="text-[11px] text-slate-400">{fmtDur(min)}</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.round((min / (tiposOrdenados[0]?.[1] || 1)) * 100)}%`,
                        background: TIPO_COLORS[tipo] || '#9CA3AF',
                      }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Lista de atividades */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-3">
          <p className="text-sm font-black text-slate-900">Atividades registradas</p>
          <div className="flex gap-1.5">
            {([
              { id: 'hoje', label: 'Hoje' },
              { id: 'semana', label: 'Semana' },
              { id: 'todas', label: 'Todas' },
            ] as const).map(aba => {
              const isActive = abaData === aba.id
              return (
                <button key={aba.id} onClick={() => setAbaData(aba.id)}
                  style={isActive ? { background: '#1E293B', boxShadow: '0 4px 16px rgba(30,41,59,0.2)' } : {}}
                  className={[
                    'px-3 py-1.5 rounded-full text-xs font-bold select-none transition-all',
                    isActive ? 'text-white -translate-y-px' : 'text-slate-500 bg-[#F3F4F6] hover:-translate-y-px hover:shadow-md',
                  ].join(' ')}>
                  {aba.label}
                </button>
              )
            })}
          </div>
        </div>

        {filtradas.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-sm italic">
            Nenhuma atividade registrada{abaData !== 'todas' ? ` ${abaData === 'hoje' ? 'hoje' : 'esta semana'}` : ''}.
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {filtradas.map(e => (
              <div key={e.id} className="flex items-start gap-4 px-5 py-3.5 hover:bg-slate-50/60 transition-colors group">
                <div className="w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0"
                  style={{ background: TIPO_COLORS[e.tipo] || '#9CA3AF' }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                      style={{ background: (TIPO_COLORS[e.tipo] || '#9CA3AF') + '18', color: TIPO_COLORS[e.tipo] || '#9CA3AF' }}>
                      {e.tipo}
                    </span>
                    {e.empresa && (
                      <span className="text-xs text-slate-500 font-medium truncate max-w-[160px]">{e.empresa}</span>
                    )}
                    <span className="text-[11px] text-slate-400 ml-auto">{fmtDate(e.data)} · {fmtDur(e.duracao)}</span>
                  </div>
                  <p className="text-sm text-slate-700 mt-0.5">{e.descricao}</p>
                </div>
                <button onClick={() => removeEntrada(e.id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-300 hover:text-red-400 text-xs px-1.5 py-0.5 rounded flex-shrink-0"
                  title="Remover">
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="text-[11px] text-slate-400 mt-3 text-right">
        Dados salvos localmente neste dispositivo
      </p>
    </div>
  )
}
