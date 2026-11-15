'use client'

import { useEffect, useRef, useState } from 'react'
import { Ellipsis } from 'lucide-react'

export interface AcaoMenu { label: string; onClick: () => void; perigo?: boolean }

// Menu "⋯" com as ações secundárias de uma linha (editar, excluir...)
export default function MenuAcoes({ acoes, rotulo = 'Mais ações' }: { acoes: AcaoMenu[]; rotulo?: string }) {
  const [aberto, setAberto] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!aberto) return
    const fora = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setAberto(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setAberto(false) }
    document.addEventListener('mousedown', fora)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', fora); document.removeEventListener('keydown', esc) }
  }, [aberto])

  return (
    <div className="relative" ref={ref}>
      <button type="button" aria-label={rotulo} aria-haspopup="menu" aria-expanded={aberto} onClick={() => setAberto(v => !v)}
        className="h-10 w-10 inline-flex items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100">
        <Ellipsis className="w-5 h-5" aria-hidden="true" />
      </button>
      {aberto && (
        <div role="menu" className="absolute right-0 top-11 z-20 w-52 bg-white border border-slate-200 rounded-lg shadow-lg py-1 text-left">
          {acoes.map(a => (
            <button key={a.label} type="button" role="menuitem" onClick={() => { setAberto(false); a.onClick() }}
              className={`w-full text-left px-3 py-2 text-sm ${a.perigo ? 'text-red-700 hover:bg-red-50' : 'text-slate-800 hover:bg-slate-50'}`}>
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
