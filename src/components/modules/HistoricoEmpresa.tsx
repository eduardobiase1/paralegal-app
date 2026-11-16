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
    <section aria-label="Histórico e comunicações" className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-base font-bold text-slate-900">Histórico e comunicações</h2>
        <button onClick={() => setExibirForm(v => !v)} className="text-sm font-semibold text-blue-700 hover:underline">
          Adicionar anotação
        </button>
      </div>

      {exibirForm && (
        <div className="space-y-2">
          <textarea
            rows={3}
            value={texto}
            onChange={e => setTexto(e.target.value)}
            aria-label="Nova anotação"
            placeholder="Retorno do cliente, orientação dada, decisão tomada..."
            className="w-full border border-slate-300 rounded-lg p-2.5 text-sm text-slate-900 outline-none focus:border-slate-500 resize-none"
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <button onClick={() => { setExibirForm(false); setTexto('') }} className="btn-secondary">Cancelar</button>
            <button onClick={salvarAnotacao} disabled={salvando || !texto.trim()} className="btn-primary">
              {salvando ? 'Salvando...' : 'Salvar anotação'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-slate-600">Carregando histórico...</p>
      ) : eventos.length === 0 ? (
        <p className="text-sm text-slate-600">Nenhum registro ainda. Comunicados, renovações e anotações aparecem aqui.</p>
      ) : (
        <ol className="divide-y divide-slate-100">
          {eventos.map(ev => (
            <li key={ev.id} className="flex flex-wrap gap-x-4 gap-y-1 py-2.5 text-sm">
              <span className="w-36 flex-shrink-0 text-slate-600">{fmtData(ev.criado_em)}</span>
              <div className="flex-1 min-w-[14rem]">
                <p className="font-semibold text-slate-900">
                  {LABEL[ev.tipo] || ev.tipo}
                  {ev.canal && <span className="font-normal text-slate-600"> · via {ev.canal}</span>}
                </p>
                <p className="text-slate-700 whitespace-pre-wrap break-words">{ev.descricao}</p>
              </div>
              {ev.tipo === 'anotacao' && (
                <button onClick={() => excluirEvento(ev.id)} className="self-start text-sm font-semibold text-slate-500 hover:text-red-700 hover:underline">
                  Excluir
                </button>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
