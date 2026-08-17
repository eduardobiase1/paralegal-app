'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useOrg } from '@/lib/org-context'
import toast from 'react-hot-toast'

// ── Tipos ──────────────────────────────────────────────────────────────────────
type Empresa = {
  id: string
  razao_social: string
  municipio: string
  uf: string
}

type RegistroTaxa = {
  id: string
  empresa_id: string
  ano: number
  enviado: boolean
  data_envio: string | null
  observacoes: string | null
}

type EmpresaComStatus = Empresa & {
  registro: RegistroTaxa | null
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default function TaxasLicencaPage() {
  const { orgId } = useOrg()
  const [supabase] = useState(createClient)

  const anoAtual = new Date().getFullYear()
  const [ano,        setAno]        = useState(anoAtual)
  const [empresas,   setEmpresas]   = useState<EmpresaComStatus[]>([])
  const [loading,    setLoading]    = useState(true)

  // Edição inline: data_envio + observacoes
  const [editando,   setEditando]   = useState<string | null>(null) // empresa_id
  const [formData,   setFormData]   = useState<{ data_envio: string; observacoes: string }>({ data_envio: '', observacoes: '' })
  const [salvando,   setSalvando]   = useState(false)

  // Filtro de status
  const [filtro,     setFiltro]     = useState<'todos' | 'enviado' | 'pendente'>('todos')
  const [busca,      setBusca]      = useState('')

  const load = useCallback(async () => {
    if (!orgId) return
    setLoading(true)

    const [{ data: empData }, { data: regData }] = await Promise.all([
      supabase.from('empresas')
        .select('id, razao_social, municipio, uf')
        .eq('org_id', orgId)
        .order('municipio', { ascending: true })
        .order('razao_social', { ascending: true }),
      supabase.from('taxas_licenca')
        .select('*')
        .eq('org_id', orgId)
        .eq('ano', ano),
    ])

    const regMap: Record<string, RegistroTaxa> = {}
    for (const r of regData || []) regMap[r.empresa_id] = r

    setEmpresas((empData || []).map(e => ({
      ...e,
      municipio: e.municipio || 'Sem cidade',
      uf:        e.uf || '',
      registro:  regMap[e.id] || null,
    })))
    setLoading(false)
  }, [supabase, orgId, ano])

  useEffect(() => { load() }, [load])

  // ── Marcar como enviado ──────────────────────────────────────────────────
  async function handleMarcarEnviado(e: EmpresaComStatus) {
    setEditando(e.id)
    setFormData({
      data_envio:   e.registro?.data_envio || new Date().toISOString().split('T')[0],
      observacoes:  e.registro?.observacoes || '',
    })
  }

  async function handleSalvar(empresa: EmpresaComStatus) {
    setSalvando(true)
    const payload = {
      org_id:      orgId,
      empresa_id:  empresa.id,
      ano,
      enviado:     true,
      data_envio:  formData.data_envio || null,
      observacoes: formData.observacoes || null,
    }

    let error
    if (empresa.registro) {
      ({ error } = await supabase.from('taxas_licenca').update(payload).eq('id', empresa.registro.id))
    } else {
      ({ error } = await supabase.from('taxas_licenca').insert([payload]))
    }

    if (!error) {
      toast.success('Envio registrado!')
      setEditando(null)
      await load()
    } else {
      toast.error('Erro ao salvar: ' + error.message)
    }
    setSalvando(false)
  }

  async function handleDesmarcar(empresa: EmpresaComStatus) {
    if (!empresa.registro) return
    if (!confirm('Desmarcar envio desta empresa?')) return
    const { error } = await supabase.from('taxas_licenca').delete().eq('id', empresa.registro.id)
    if (!error) { toast.success('Desmarcado.'); await load() }
  }

  // ── Dados derivados ─────────────────────────────────────────────────────────
  const empresasFiltradas = empresas.filter(e => {
    if (busca) {
      const q = busca.toLowerCase()
      if (!e.razao_social.toLowerCase().includes(q) && !e.municipio.toLowerCase().includes(q)) return false
    }
    if (filtro === 'enviado')  return !!e.registro?.enviado
    if (filtro === 'pendente') return !e.registro?.enviado
    return true
  })

  // Agrupa por município
  const porMunicipio = empresasFiltradas.reduce<Record<string, EmpresaComStatus[]>>((acc, e) => {
    const key = e.municipio + (e.uf ? `/${e.uf}` : '')
    if (!acc[key]) acc[key] = []
    acc[key].push(e)
    return acc
  }, {})

  const totalEnviado  = empresas.filter(e => e.registro?.enviado).length
  const totalPendente = empresas.length - totalEnviado
  const pct           = empresas.length > 0 ? Math.round((totalEnviado / empresas.length) * 100) : 0

  const anosDisponiveis = Array.from({ length: 5 }, (_, i) => anoAtual - i)

  return (
    <div className="min-h-screen bg-slate-50 font-sans">

      {/* ── HEADER ──────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-slate-200 px-6 py-5">
        <div className="max-w-5xl mx-auto">

          <p className="text-[9px] font-black uppercase tracking-widest text-blue-600 mb-1">
            CONTROLES · TAXAS
          </p>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                Taxa de Licença de Funcionamento
              </h1>
              <p className="text-sm text-slate-400 mt-1">
                Controle de envio anual por empresa e município
              </p>
            </div>

            {/* Seletor de ano */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Ano</label>
              <div className="flex rounded-xl border border-slate-200 overflow-hidden bg-slate-50">
                {anosDisponiveis.map(a => (
                  <button key={a} onClick={() => setAno(a)}
                    className={`px-4 py-2 text-sm font-bold transition-all ${
                      ano === a
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-500 hover:bg-slate-100'
                    }`}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Barra de progresso + contadores */}
          {!loading && empresas.length > 0 && (
            <div className="mt-5 flex items-center gap-5 flex-wrap">
              <div className="flex-1 min-w-48">
                <div className="flex justify-between text-xs font-semibold text-slate-500 mb-1.5">
                  <span>Progresso {ano}</span>
                  <span>{totalEnviado} de {empresas.length} enviados</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${pct}%`,
                      background: pct === 100 ? '#22C55E' : pct >= 50 ? '#3B82F6' : '#F59E0B',
                    }}
                  />
                </div>
              </div>
              <div className="flex gap-3">
                <Chip label="Enviados"  value={totalEnviado}  color="green" />
                <Chip label="Pendentes" value={totalPendente} color={totalPendente > 0 ? 'amber' : 'slate'} />
                <Chip label="Total"     value={empresas.length} color="slate" />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── FILTROS ─────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-slate-100 px-6 py-3 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto flex flex-wrap items-center gap-3">

          {/* Busca */}
          <div className="relative flex-1 min-w-52">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none">🔍</span>
            <input
              placeholder="Buscar empresa ou cidade..."
              value={busca}
              onChange={e => setBusca(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-blue-300 transition-colors"
            />
          </div>

          {/* Filtro de status */}
          <div className="flex rounded-lg border border-slate-200 overflow-hidden text-xs font-bold">
            {(['todos', 'pendente', 'enviado'] as const).map(f => (
              <button key={f} onClick={() => setFiltro(f)}
                className={`px-4 py-2 capitalize transition-all ${
                  filtro === f ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-50'
                }`}>
                {f === 'todos' ? 'Todos' : f === 'pendente' ? 'Pendentes' : 'Enviados'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── CONTEÚDO ────────────────────────────────────────────────────── */}
      <div className="max-w-5xl mx-auto px-6 py-6 space-y-8">

        {loading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-16 bg-white rounded-xl border border-slate-100 animate-pulse" />
            ))}
          </div>
        ) : empresas.length === 0 ? (
          <div className="text-center py-20 text-slate-400">
            <p className="text-4xl mb-3">🏢</p>
            <p className="font-semibold">Nenhuma empresa cadastrada.</p>
          </div>
        ) : Object.keys(porMunicipio).length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <p className="font-semibold">Nenhum resultado para os filtros aplicados.</p>
          </div>
        ) : (
          Object.entries(porMunicipio)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([municipio, lista]) => {
              const enviadosNaMun = lista.filter(e => e.registro?.enviado).length
              return (
                <section key={municipio}>
                  {/* Cabeçalho do município */}
                  <div className="flex items-center gap-3 mb-3 pb-2 border-b border-slate-200">
                    <span className="text-base">📍</span>
                    <span className="text-sm font-extrabold text-slate-700 uppercase tracking-wide">
                      {municipio}
                    </span>
                    <span className="text-xs text-slate-400">
                      {enviadosNaMun}/{lista.length} enviados
                    </span>
                    {enviadosNaMun === lista.length && lista.length > 0 && (
                      <span className="text-xs font-bold text-green-600 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                        ✓ Concluído
                      </span>
                    )}
                  </div>

                  {/* Lista de empresas */}
                  <div className="space-y-2">
                    {lista.map(empresa => {
                      const enviado   = !!empresa.registro?.enviado
                      const isEditing = editando === empresa.id

                      return (
                        <div key={empresa.id}
                          className={`bg-white rounded-xl border transition-all ${
                            enviado
                              ? 'border-green-200 border-l-4 border-l-green-500'
                              : 'border-slate-200 border-l-4 border-l-amber-400'
                          }`}
                        >
                          {/* Linha principal */}
                          <div className="flex items-center gap-3 px-4 py-3">

                            {/* Ícone de status */}
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                              enviado ? 'bg-green-100' : 'bg-amber-50'
                            }`}>
                              {enviado
                                ? <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                : <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                              }
                            </div>

                            {/* Nome + info */}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-slate-800 truncate">
                                {empresa.razao_social}
                              </p>
                              {enviado && empresa.registro?.data_envio && (
                                <p className="text-xs text-slate-400 mt-0.5">
                                  Enviado em {new Date(empresa.registro.data_envio + 'T00:00:00').toLocaleDateString('pt-BR')}
                                  {empresa.registro.observacoes && (
                                    <span className="ml-2 text-slate-500">· {empresa.registro.observacoes}</span>
                                  )}
                                </p>
                              )}
                              {!enviado && (
                                <p className="text-xs text-amber-600 font-medium mt-0.5">Pendente</p>
                              )}
                            </div>

                            {/* Ações */}
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {enviado ? (
                                <>
                                  <button onClick={() => handleMarcarEnviado(empresa)}
                                    className="text-xs text-slate-400 hover:text-slate-600 px-3 py-1.5 rounded-lg hover:bg-slate-50 transition-all font-medium">
                                    Editar
                                  </button>
                                  <button onClick={() => handleDesmarcar(empresa)}
                                    className="text-xs text-red-400 hover:text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-all font-medium">
                                    Desmarcar
                                  </button>
                                </>
                              ) : (
                                <button onClick={() => handleMarcarEnviado(empresa)}
                                  className="text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 px-4 py-1.5 rounded-lg transition-all">
                                  Marcar como enviado
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Painel de edição inline */}
                          {isEditing && (
                            <div className="border-t border-slate-100 bg-slate-50 px-4 py-4 rounded-b-xl">
                              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                                Registrar envio — {empresa.razao_social}
                              </p>
                              <div className="flex flex-wrap gap-3 items-end">
                                <div>
                                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                                    Data do envio
                                  </label>
                                  <input type="date"
                                    value={formData.data_envio}
                                    onChange={e => setFormData(f => ({ ...f, data_envio: e.target.value }))}
                                    className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-blue-300 transition-colors"
                                  />
                                </div>
                                <div className="flex-1 min-w-52">
                                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                                    Observação (opcional)
                                  </label>
                                  <input type="text"
                                    placeholder="Ex: enviado por e-mail para contato@empresa.com"
                                    value={formData.observacoes}
                                    onChange={e => setFormData(f => ({ ...f, observacoes: e.target.value }))}
                                    onKeyDown={e => { if (e.key === 'Enter') handleSalvar(empresa) }}
                                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-blue-300 transition-colors"
                                  />
                                </div>
                                <div className="flex gap-2">
                                  <button onClick={() => setEditando(null)}
                                    className="px-4 py-2 text-sm font-semibold text-slate-500 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-all">
                                    Cancelar
                                  </button>
                                  <button onClick={() => handleSalvar(empresa)} disabled={salvando}
                                    className="px-5 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-all disabled:opacity-50">
                                    {salvando ? 'Salvando...' : 'Confirmar'}
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </section>
              )
            })
        )}
      </div>
    </div>
  )
}

// ── Atom ───────────────────────────────────────────────────────────────────────
function Chip({ label, value, color }: { label: string; value: number; color: 'green' | 'amber' | 'slate' }) {
  const s = {
    green: 'bg-green-50 border-green-200 text-green-700',
    amber: 'bg-amber-50 border-amber-200 text-amber-700',
    slate: 'bg-slate-50 border-slate-200 text-slate-600',
  }[color]
  return (
    <div className={`border rounded-lg px-3 py-1.5 text-center min-w-16 ${s}`}>
      <p className="text-lg font-black leading-none tabular-nums">{value}</p>
      <p className="text-[9px] font-bold uppercase tracking-wider mt-0.5 opacity-70">{label}</p>
    </div>
  )
}
