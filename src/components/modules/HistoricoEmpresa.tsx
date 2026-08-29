'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useOrg } from '@/lib/org-context'
import toast from 'react-hot-toast'

type Tipo = 'comunicado_enviado' | 'certidao_renovada' | 'status_alterado' | 'anotacao' | 'alerta'

interface Evento {
  id: string
  tipo: Tipo
  descricao: string
  canal?: string
  criado_em: string
  criado_por?: string
}

const ICONE: Record<string, string> = {
  comunicado_enviado: '📨',
  certidao_renovada:  '✅',
  status_alterado:    '🔄',
  anotacao:           '📝',
  alerta:             '⚠️',
}

const COR: Record<string, string> = {
  comunicado_enviado: 'bg-violet-50 border-violet-200',
  certidao_renovada:  'bg-emerald-50 border-emerald-200',
  status_alterado:    'bg-blue-50 border-blue-200',
  anotacao:           'bg-amber-50 border-amber-200',
  alerta:             'bg-red-50 border-red-200',
}

const LABEL: Record<string, string> = {
  comunicado_enviado: 'Comunicado enviado',
  certidao_renovada:  'Certidão renovada',
  status_alterado:    'Status alterado',
  anotacao:           'Anotação',
  alerta:             'Alerta',
}

function fmtData(iso: string) {
  const d = new Date(iso)
  return `${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
}

export default function HistoricoEmpresa({ empresaId }: { empresaId: string }) {
  const { orgId } = useOrg()
  const [supabase] = useState(createClient())
  const [eventos, setEventos] = useState<Evento[]>([])
  const [loading, setLoading] = useState(true)
  const [exibirForm, setExibirForm] = useState(false)
  const [texto, setTexto] = useState('')
  const [salvando, setSalvando] = useState(false)

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('historico_empresa')
      .select('*')
      .eq('empresa_id', empresaId)
      .order('criado_em', { ascending: false })
      .limit(50)
    setEventos((data || []) as Evento[])
    setLoading(false)
  }, [supabase, empresaId])

  useEffect(() => { load() }, [load])

  async function salvarAnotacao() {
    if (!texto.trim()) return
    setSalvando(true)
    const { error } = await supabase.from('historico_empresa').insert([{
      org_id: orgId,
      empresa_id: empresaId,
      tipo: 'anotacao',
      descricao: texto.trim(),
    }])
    if (error) {
      toast.error('Erro ao salvar anotação: ' + error.message)
    } else {
      toast.success('Anotação salva!')
      setTexto('')
      setExibirForm(false)
      load()
    }
    setSalvando(false)
  }

  async function excluirEvento(id: string) {
    if (!confirm('Excluir este registro do histórico?')) return
    const { error } = await supabase.from('historico_empresa').delete().eq('id', id)
    if (error) {
      toast.error('Erro ao excluir.')
    } else {
      setEventos(prev => prev.filter(e => e.id !== id))
    }
  }

  return (
    <div className="card">
      <div className="card-header flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-gray-900">Histórico & Caixa Postal</h2>
          <p className="text-xs text-gray-500 mt-0.5">Comunicados enviados, renovações e anotações internas</p>
        </div>
        <button
          onClick={() => setExibirForm(v => !v)}
          className="text-xs font-bold bg-slate-900 text-white px-3 py-1.5 rounded-lg hover:bg-slate-700 transition-all"
        >
          + Anotação
        </button>
      </div>

      {/* Formulário anotação */}
      {exibirForm && (
        <div className="px-4 pb-2 pt-1">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
            <p className="text-[10px] font-black uppercase tracking-wide text-amber-700 mb-2">📝 Nova anotação manual</p>
            <textarea
              rows={3}
              value={texto}
              onChange={e => setTexto(e.target.value)}
              placeholder="Descreva o evento, retorno do cliente, orientação dada, decisão tomada..."
              className="w-full bg-white border border-amber-200 rounded-lg p-2.5 text-sm outline-none focus:border-amber-400 resize-none"
              autoFocus
            />
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => { setExibirForm(false); setTexto('') }}
                className="flex-1 text-xs font-bold bg-white border border-slate-200 text-slate-600 py-2 rounded-lg hover:bg-slate-50 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={salvarAnotacao}
                disabled={salvando || !texto.trim()}
                className="flex-1 text-xs font-bold bg-slate-900 text-white py-2 rounded-lg hover:bg-slate-700 disabled:opacity-50 transition-all"
              >
                {salvando ? 'Salvando...' : 'Salvar anotação'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="card-body">
        {loading ? (
          <p className="text-sm text-gray-400 italic text-center py-6">Carregando histórico...</p>
        ) : eventos.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-4xl mb-2">📭</p>
            <p className="text-sm text-gray-400 italic">Nenhum registro ainda.</p>
            <p className="text-xs text-gray-400 mt-1">Comunicados enviados, renovações e anotações aparecerão aqui automaticamente.</p>
          </div>
        ) : (
          <div className="relative">
            {/* Linha vertical da timeline */}
            <div className="absolute left-5 top-0 bottom-0 w-px bg-slate-200" />
            <div className="space-y-3">
              {eventos.map(ev => (
                <div key={ev.id} className="flex gap-4 group">
                  {/* Ícone na timeline */}
                  <div className={`relative z-10 w-10 h-10 rounded-full border-2 flex items-center justify-center text-base flex-shrink-0 ${COR[ev.tipo] || 'bg-slate-50 border-slate-200'}`}>
                    {ICONE[ev.tipo] || '📌'}
                  </div>
                  {/* Conteúdo */}
                  <div className={`flex-1 min-w-0 p-3 rounded-xl border ${COR[ev.tipo] || 'bg-slate-50 border-slate-200'}`}>
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                        {LABEL[ev.tipo] || ev.tipo}
                        {ev.canal && <span className="ml-1 normal-case font-normal">· via {ev.canal}</span>}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-400 font-mono">{fmtData(ev.criado_em)}</span>
                        {ev.tipo === 'anotacao' && (
                          <button
                            onClick={() => excluirEvento(ev.id)}
                            className="opacity-0 group-hover:opacity-100 text-[10px] text-red-400 hover:text-red-600 transition-all"
                            title="Excluir anotação"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-slate-700 mt-1 leading-relaxed whitespace-pre-wrap">{ev.descricao}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
