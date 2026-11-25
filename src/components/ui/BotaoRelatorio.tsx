'use client'

import { useEffect, useRef, useState } from 'react'
import { Printer } from 'lucide-react'
import { imprimirRelatorio, exportarRelatorioExcel, type Relatorio } from '@/lib/relatorio'

/** Botão "Relatório" das telas: imprime (ou salva em PDF) ou exporta para Excel o que está na tela */
export default function BotaoRelatorio({ gerar, className = '' }: { gerar: () => Relatorio; className?: string }) {
  const [aberto, setAberto] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!aberto) return
    const fechar = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setAberto(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setAberto(false) }
    document.addEventListener('mousedown', fechar)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', fechar); document.removeEventListener('keydown', esc) }
  }, [aberto])

  const item = 'w-full text-left px-3 py-2 text-sm text-slate-800 hover:bg-slate-100 rounded-md'
  return (
    <div ref={ref} className={'relative ' + className}>
      <button onClick={() => setAberto(v => !v)} aria-expanded={aberto} aria-haspopup="menu"
        className="inline-flex items-center gap-2 h-11 px-4 rounded-lg border border-slate-300 bg-white text-sm font-semibold text-slate-900 hover:bg-slate-50 whitespace-nowrap">
        <Printer className="w-4 h-4" aria-hidden="true" />
        Relatório
      </button>
      {aberto && (
        <div role="menu" className="absolute right-0 top-12 z-30 w-56 bg-white border border-slate-200 rounded-xl shadow-lg p-1.5">
          <button role="menuitem" className={item} onClick={() => { setAberto(false); imprimirRelatorio(gerar()) }}>Imprimir ou salvar PDF</button>
          <button role="menuitem" className={item} onClick={() => { setAberto(false); exportarRelatorioExcel(gerar()) }}>Baixar em Excel</button>
          <p className="px-3 pt-1.5 pb-1 text-xs text-slate-500">Segue a busca e os filtros da tela.</p>
        </div>
      )}
    </div>
  )
}
