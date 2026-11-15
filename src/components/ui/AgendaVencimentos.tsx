'use client'

import { useState, type ReactNode } from 'react'
import { diasParaVencer, GRUPOS_AGENDA, MESES_ABREV, TOM_DATA, type TomPrazo } from '@/lib/prazo'

interface Props<T> {
  itens: T[]
  /** nome do documento, para os textos ("alvará" / "alvarás") */
  nome: { um: string; varios: string; feminino?: boolean }
  /** conteúdo da linha, à direita da data */
  linha: (item: T, dias: number | null) => ReactNode
  /** mostra os que vencem depois de 30 dias sem precisar clicar (ex.: durante uma busca) */
  mostrarEmDia?: boolean
  vazio: string
}

function BlocoData({ data, tom }: { data: string | null; tom: TomPrazo }) {
  const venc = data ? new Date(data.slice(0, 10) + 'T00:00:00') : null
  return (
    <div className={`w-14 flex-shrink-0 rounded-lg py-1 text-center ${TOM_DATA[tom]}`}>
      {venc ? (
        <>
          <div className="text-xl font-bold leading-tight">{String(venc.getDate()).padStart(2, '0')}</div>
          <div className="text-xs font-semibold">
            {MESES_ABREV[venc.getMonth()]}{venc.getFullYear() !== new Date().getFullYear() ? ` ${String(venc.getFullYear()).slice(2)}` : ''}
          </div>
        </>
      ) : <div className="text-sm font-semibold py-2">—</div>}
    </div>
  )
}

// Lista de documentos organizada pela data em que vencem, do mais urgente ao mais distante
export default function AgendaVencimentos<T extends { id: string; data_vencimento?: string | null }>({
  itens, nome, linha, mostrarEmDia = false, vazio,
}: Props<T>) {
  const [abrirEmDia, setAbrirEmDia] = useState(false)
  const conta = (n: number) => `${n} ${n === 1 ? nome.um : nome.varios}`

  if (itens.length === 0) {
    return <div className="bg-white border border-slate-200 rounded-xl px-6 py-12 text-center text-sm text-slate-600">{vazio}</div>
  }

  const ordenados = [...itens].sort((a, b) => (a.data_vencimento || '9999').localeCompare(b.data_vencimento || '9999'))
  const grupos = GRUPOS_AGENDA
    .map(g => ({ ...g, itens: ordenados.filter(i => g.teste(diasParaVencer(i.data_vencimento))) }))
    .filter(g => g.itens.length > 0)
  const emDia = ordenados.filter(i => { const d = diasParaVencer(i.data_vencimento); return d !== null && d > 30 })
  const exibirEmDia = abrirEmDia || mostrarEmDia

  const secao = (titulo: string, sub: string, lista: T[], tom: TomPrazo, extra?: ReactNode) => (
    <section key={titulo} className="space-y-2" aria-label={titulo}>
      <div className="flex items-baseline gap-2">
        <h2 className="text-base font-bold text-slate-900">{titulo}</h2>
        <span className="text-sm text-slate-500">{sub}</span>
        {extra}
      </div>
      <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
        {lista.map(i => (
          <div key={i.id} className="flex flex-wrap items-center gap-x-5 gap-y-2 px-5 py-3">
            <BlocoData data={i.data_vencimento ?? null} tom={tom} />
            {linha(i, diasParaVencer(i.data_vencimento))}
          </div>
        ))}
      </div>
    </section>
  )

  const artigo = emDia.length === 1 ? (nome.feminino ? 'a' : 'o') : (nome.feminino ? 'as' : 'os')

  return (
    <div className="space-y-6">
      {grupos.length === 0 && (
        <p className="text-sm text-slate-600">
          {nome.feminino ? 'Nenhuma' : 'Nenhum'} {nome.um} vence nos próximos 30 dias.
        </p>
      )}
      {grupos.map(g => secao(
        g.id === 'vencidos' && nome.feminino ? 'Vencidas' : g.titulo, conta(g.itens.length), g.itens, g.tom,
      ))}

      {emDia.length > 0 && (exibirEmDia
        ? secao('Em dia', `${conta(emDia.length)} · ${emDia.length === 1 ? 'vence' : 'vencem'} depois de 30 dias`, emDia, 'green',
            !mostrarEmDia && (
              <button onClick={() => setAbrirEmDia(false)} className="ml-auto text-sm font-semibold text-slate-600 hover:text-slate-900">Recolher</button>
            ))
        : (
          <button onClick={() => setAbrirEmDia(true)}
            className="h-11 px-4 rounded-lg border border-dashed border-slate-300 text-sm font-semibold text-slate-700 hover:bg-white">
            Mostrar {artigo} {conta(emDia.length)} em dia ({emDia.length === 1 ? 'vence' : 'vencem'} depois de 30 dias)
          </button>
        ))}
    </div>
  )
}
