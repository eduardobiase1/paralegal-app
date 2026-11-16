'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

// G + letra → rota
const GO: Array<{ tecla: string; href: string; desc: string }> = [
  { tecla: 'h', href: '/briefing',          desc: 'Hoje (Briefing)' },
  { tecla: 'v', href: '/visao-geral',       desc: 'Visão geral' },
  { tecla: 'e', href: '/empresas',          desc: 'Carteira de empresas' },
  { tecla: 'c', href: '/certidoes',         desc: 'Certidões' },
  { tecla: 'a', href: '/alvaras',           desc: 'Alvarás' },
  { tecla: 'l', href: '/licencas',          desc: 'Licenças sanitárias' },
  { tecla: 'd', href: '/certificados',      desc: 'Certificados digitais' },
  { tecla: 'p', href: '/societario/painel', desc: 'Processos' },
  { tecla: 'f', href: '/financeiro',        desc: 'Financeiro' },
]

const ATALHOS = [
  { grupo: 'Ir para (aperte G e depois a letra)', itens: GO.map(g => ({ tecla: `G  ${g.tecla.toUpperCase()}`, desc: g.desc })) },
  { grupo: 'Na tela', itens: [
    { tecla: 'Ctrl  K', desc: 'Buscar empresa, CNPJ, ação ou tela' },
    { tecla: 'N', desc: 'Novo cadastro da tela (certidão, alvará, certificado...)' },
    { tecla: '/', desc: 'Ir para a busca da tela' },
    { tecla: 'M', desc: 'Abrir o modo foco do Briefing' },
    { tecla: '?', desc: 'Mostrar esta lista de atalhos' },
    { tecla: 'Esc', desc: 'Fechar janela' },
  ]},
]

export default function KeyboardHelpButton() {
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const gPressedAt = useRef(0)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { setOpen(false); return }
      if (e.ctrlKey || e.metaKey || e.altKey) return

      const el = e.target as HTMLElement
      const tag = el.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable) return
      // com uma janela aberta, as letras não disparam atalhos da tela de trás
      if (document.querySelector('[role="dialog"], .fixed.inset-0.z-50')) {
        if (e.key === '?') setOpen(v => !v)
        return
      }

      if (e.key === '?') { setOpen(v => !v); return }

      const key = e.key.toLowerCase()

      // Segunda tecla da sequência G + letra (até 1,5s depois do G)
      if (Date.now() - gPressedAt.current < 1500) {
        gPressedAt.current = 0
        const destino = GO.find(g => g.tecla === key)
        if (destino) { e.preventDefault(); router.push(destino.href) }
        return
      }
      if (key === 'g') { gPressedAt.current = Date.now(); return }

      if (key === '/') {
        const busca = document.querySelector<HTMLInputElement>('main input[placeholder*="uscar"]')
        if (busca) { e.preventDefault(); busca.focus() }
        return
      }
      // N e M clicam no botão principal da tela, quando ela tiver um
      const alvo = key === 'n' ? 'novo' : key === 'm' ? 'foco' : null
      if (alvo) {
        const botao = document.querySelector<HTMLButtonElement>(`main [data-atalho="${alvo}"]:not([disabled])`)
        if (botao) { e.preventDefault(); botao.click() }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [router])

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Atalhos de teclado (?)"
        aria-label="Atalhos de teclado"
        className="fixed bottom-5 right-5 z-40 w-9 h-9 rounded-full bg-slate-900 text-white text-sm font-bold shadow-lg hover:bg-slate-700 flex items-center justify-center select-none"
      >
        ?
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Atalhos de teclado" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-slate-900/50" />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white px-6 pt-5 pb-3 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">Atalhos de teclado</h2>
              <button onClick={() => setOpen(false)} className="text-sm font-semibold text-slate-600 hover:text-slate-900">Fechar</button>
            </div>
            <div className="px-6 py-4 space-y-5">
              {ATALHOS.map(grupo => (
                <div key={grupo.grupo}>
                  <p className="text-sm font-semibold text-slate-900 mb-2">{grupo.grupo}</p>
                  <div>
                    {grupo.itens.map(item => (
                      <div key={item.tecla} className="flex items-center justify-between gap-4 py-1.5">
                        <span className="text-sm text-slate-700">{item.desc}</span>
                        <kbd className="bg-slate-100 border border-slate-200 text-slate-800 text-xs px-2 py-0.5 rounded-md whitespace-nowrap">{item.tecla}</kbd>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
