'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import Image from 'next/image'
import {
  Sun, Moon, Table2, Building2, CalendarClock, ListChecks, CircleDollarSign,
  Wrench, Users, LogOut, ChevronsLeft, ChevronDown, type LucideIcon,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { useOrg } from '@/lib/org-context'
import { gruposDoPerfil, navAtiva } from '@/lib/navigation'

async function switchOrg(orgId: string) {
  await fetch('/api/switch-org', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orgId }) })
  window.location.href = '/briefing'
}

const ICONES: Record<string, LucideIcon> = {
  'hoje': Sun,
  'visao-geral': Table2,
  'carteira': Building2,
  'vencimentos': CalendarClock,
  'processos': ListChecks,
  'financeiro': CircleDollarSign,
  'ferramentas': Wrench,
  'equipe': Users,
}

const itemCls = 'w-full flex items-center gap-3 px-3 min-h-[40px] rounded-lg text-sm transition-colors'

export default function Sidebar({ isOpen = true, onToggle, isDark = false, onToggleDark }: {
  isOpen?: boolean; onToggle?: () => void; isDark?: boolean; onToggleDark?: () => void
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [supabase] = useState(createClient)
  const [loggingOut, setLoggingOut] = useState(false)
  const [editingOrg, setEditingOrg] = useState(false)
  const [orgNameInput, setOrgNameInput] = useState('')
  const [savingOrg, setSavingOrg] = useState(false)
  const [showOrgs, setShowOrgs] = useState(false)
  const { orgName, orgId, isAdmin, role, allOrgs } = useOrg()

  const grupos = gruposDoPerfil(role)
  const ativa = navAtiva(pathname, grupos)
  const outrasOrgs = allOrgs.filter(o => o.id !== orgId)

  async function handleLogout() {
    setLoggingOut(true)
    await supabase.auth.signOut()
    router.push('/login')
  }

  async function handleSaveOrg() {
    if (!orgNameInput.trim()) return
    setSavingOrg(true)
    await supabase.from('organizations').update({ name: orgNameInput.trim() }).eq('id', orgId)
    setSavingOrg(false)
    setEditingOrg(false)
    router.refresh()
  }

  return (
    <aside
      className={`fixed inset-y-0 left-0 w-60 bg-[#0d0d0d] border-r border-white/[0.06] flex flex-col z-30 transition-transform duration-300 ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      }`}
    >
      {/* Logo + recolher */}
      <div className="flex items-center gap-3 px-5 py-4">
        <div className="relative w-8 h-8 flex-shrink-0">
          <Image src="/logo.png" alt="" fill className="object-contain" priority />
        </div>
        <p className="min-w-0 flex-1 font-bold text-white text-[15px] leading-tight tracking-wide">
          PARALEGAL <span className="text-amber-500">PRO</span>
        </p>
        {onToggle && (
          <button onClick={onToggle} aria-label="Recolher menu" title="Recolher menu"
            className="text-neutral-400 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/10 flex-shrink-0">
            <ChevronsLeft className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Organização */}
      <div className="px-3 pb-3">
        {editingOrg ? (
          <div className="flex gap-1 px-2">
            <input
              autoFocus
              aria-label="Nome da organização"
              value={orgNameInput}
              onChange={e => setOrgNameInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSaveOrg(); if (e.key === 'Escape') setEditingOrg(false) }}
              className="flex-1 bg-white/10 text-white text-xs px-2 py-1.5 rounded outline-none border border-amber-500/40 min-w-0"
            />
            <button onClick={handleSaveOrg} disabled={savingOrg} className="text-amber-400 text-xs px-2 hover:text-amber-300">
              {savingOrg ? '...' : 'Salvar'}
            </button>
          </div>
        ) : (
          <div className="group flex items-center gap-2 px-2">
            <p className="text-xs text-neutral-400 truncate flex-1 min-w-0">{orgName}</p>
            {isAdmin && (
              <button onClick={() => { setOrgNameInput(orgName); setEditingOrg(true) }}
                className="opacity-0 group-hover:opacity-100 focus:opacity-100 text-neutral-400 hover:text-amber-400 transition-all text-xs">
                Editar
              </button>
            )}
            {outrasOrgs.length > 0 && (
              <button onClick={() => setShowOrgs(v => !v)} aria-expanded={showOrgs}
                aria-label="Trocar de organização" title="Trocar de organização"
                className="text-neutral-400 hover:text-white p-1 rounded hover:bg-white/10">
                <ChevronDown className={'w-3.5 h-3.5 transition-transform ' + (showOrgs ? 'rotate-180' : '')} />
              </button>
            )}
          </div>
        )}
        {showOrgs && outrasOrgs.map(o => (
          <button key={o.id} onClick={() => switchOrg(o.id)}
            className="mt-1 w-full text-left px-2 py-1.5 rounded-lg text-xs text-neutral-300 hover:bg-white/5 hover:text-white truncate">
            {o.name}
          </button>
        ))}
      </div>

      {role === 'viewer' && (
        <p className="mx-3 mb-2 px-3 py-1.5 rounded-lg bg-white/5 text-xs text-neutral-300">Modo visualização</p>
      )}
      {role === 'financeiro' && (
        <p className="mx-3 mb-2 px-3 py-1.5 rounded-lg bg-white/5 text-xs text-neutral-300">Acesso financeiro</p>
      )}

      {/* Navegação */}
      <nav aria-label="Menu principal" className="flex-1 overflow-y-auto px-3 space-y-0.5">
        {grupos.map(g => {
          const Icon = ICONES[g.id] ?? Sun
          const active = ativa?.group.id === g.id
          return (
            <Link key={g.id} href={g.pages[0].href} aria-current={active ? 'page' : undefined}
              className={cn(itemCls, active
                ? 'bg-white/[0.08] text-amber-400 font-semibold'
                : 'text-neutral-300 font-medium hover:bg-white/5 hover:text-white')}>
              <Icon className="w-[18px] h-[18px] flex-shrink-0" strokeWidth={1.8} />
              {g.label}
            </Link>
          )
        })}
      </nav>

      {/* Rodapé */}
      <div className="border-t border-white/10 px-3 py-3 space-y-0.5">
        {onToggleDark && (
          <button onClick={onToggleDark} className={cn(itemCls, 'text-neutral-300 font-medium hover:bg-white/5 hover:text-white')}>
            {isDark
              ? <Sun className="w-[18px] h-[18px] flex-shrink-0" strokeWidth={1.8} />
              : <Moon className="w-[18px] h-[18px] flex-shrink-0" strokeWidth={1.8} />}
            {isDark ? 'Modo claro' : 'Modo escuro'}
          </button>
        )}
        <button onClick={handleLogout} disabled={loggingOut}
          className={cn(itemCls, 'text-neutral-300 font-medium hover:bg-white/5 hover:text-white')}>
          <LogOut className="w-[18px] h-[18px] flex-shrink-0" strokeWidth={1.8} />
          {loggingOut ? 'Saindo...' : 'Sair'}
        </button>
      </div>
    </aside>
  )
}
