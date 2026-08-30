'use client'

import { useState, useEffect } from 'react'

const ATALHOS = [
  { grupo: 'Navegação', itens: [
    { tecla: 'G + B', desc: 'Ir para Briefing' },
    { tecla: 'G + V', desc: 'Ir para Visão Geral' },
    { tecla: 'G + E', desc: 'Ir para Empresas' },
    { tecla: 'G + C', desc: 'Ir para Certidões' },
    { tecla: 'G + A', desc: 'Ir para Alvarás' },
    { tecla: 'G + D', desc: 'Ir para Cert. Digitais' },
    { tecla: 'G + S', desc: 'Ir para Societário' },
  ]},
  { grupo: 'Ações', itens: [
    { tecla: '⌘ K', desc: 'Abrir paleta de comandos' },
    { tecla: 'N', desc: 'Nova empresa / registro' },
    { tecla: 'R', desc: 'Atualizar dados da página' },
    { tecla: 'F', desc: 'Focar na busca' },
    { tecla: 'Esc', desc: 'Fechar modal / overlay' },
  ]},
  { grupo: 'Briefing', itens: [
    { tecla: 'M', desc: 'Ativar Modo Foco' },
    { tecla: '→  /  ←', desc: 'Próximo / anterior no foco' },
    { tecla: 'S', desc: 'Adiar item atual (snooze)' },
  ]},
]

export default function KeyboardHelpButton() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
        const tag = (e.target as HTMLElement).tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA') return
        setOpen(v => !v)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Atalhos de teclado (?)"
        className="fixed bottom-5 right-5 z-40 w-8 h-8 rounded-full bg-slate-800 text-white text-sm font-bold shadow-lg hover:bg-slate-700 hover:shadow-xl hover:-translate-y-px transition-all flex items-center justify-center select-none"
        aria-label="Atalhos de teclado"
      >
        ?
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div
            className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white rounded-t-2xl px-6 pt-5 pb-3 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-base font-black text-slate-900">Atalhos de teclado</h2>
                <p className="text-xs text-slate-400 mt-0.5">Pressione <kbd className="bg-slate-100 px-1.5 py-0.5 rounded text-[11px] font-mono">?</kbd> a qualquer momento para abrir</p>
              </div>
              <button onClick={() => setOpen(false)}
                className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center text-sm transition-colors">
                ✕
              </button>
            </div>

            <div className="px-6 py-4 space-y-5">
              {ATALHOS.map(grupo => (
                <div key={grupo.grupo}>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">{grupo.grupo}</p>
                  <div className="space-y-1">
                    {grupo.itens.map(item => (
                      <div key={item.tecla} className="flex items-center justify-between py-1.5 px-3 rounded-lg hover:bg-slate-50 transition-colors">
                        <span className="text-sm text-slate-600">{item.desc}</span>
                        <kbd className="bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-mono px-2 py-0.5 rounded-md shadow-sm whitespace-nowrap">
                          {item.tecla}
                        </kbd>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="px-6 pb-5 pt-2 border-t border-slate-100">
              <p className="text-[11px] text-slate-400 text-center">
                Atalhos de navegação (G + letra) funcionam em sequência, sem Shift
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
