'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useOrg } from '@/lib/org-context'
import { gruposDoPerfil, navAtiva } from '@/lib/navigation'

// Abas das páginas do grupo ativo (ex.: Vencimentos → Certidões, Alvarás, Licenças...)
export default function SectionTabs() {
  const pathname = usePathname()
  const { role } = useOrg()
  const ativa = navAtiva(pathname, gruposDoPerfil(role))
  if (!ativa || ativa.group.pages.length < 2) return null

  return (
    <nav aria-label={ativa.group.label} className="bg-white border-b border-slate-200 px-4 md:px-8 overflow-x-auto">
      <div className="flex gap-6 min-w-max">
        {ativa.group.pages.map(p => {
          const atual = p.href === ativa.page.href
          return (
            <Link key={p.href} href={p.href} aria-current={atual ? 'page' : undefined}
              className={`py-3 text-sm border-b-2 -mb-px transition-colors ${
                atual
                  ? 'border-slate-900 text-slate-900 font-semibold'
                  : 'border-transparent text-slate-600 font-medium hover:text-slate-900'
              }`}>
              {p.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
