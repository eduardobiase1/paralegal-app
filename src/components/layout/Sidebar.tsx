'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { useOrg } from '@/lib/org-context'

const navigation = [
  {
    label: 'Principal',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: HomeIcon },
      { href: '/empresas', label: 'Empresas', icon: BuildingIcon },
      { href: '/financeiro', label: 'Financeiro PRO', icon: CurrencyDollarIcon },
    ],
  },
  {
    label: 'Controles',
    items: [
      { href: '/certidoes', label: 'Certidões Negativas', icon: DocumentCheckIcon },
      { href: '/alvaras', label: 'Alvarás', icon: BadgeCheckIcon },
      { href: '/licencas', label: 'Licenças Sanitárias', icon: ShieldIcon },
      { href: '/certificados', label: 'Certificados Digitais', icon: KeyIcon },
    ],
  },
  {
    label: 'Processos',
    items: [
      { href: '/societario', label: 'Módulo Societário', icon: UsersIcon },
      { href: '/contratos', label: 'Contratos', icon: DocumentTextIcon },
      { href: '/simulador', label: 'Simulador de Taxas', icon: CalculatorIcon },
      { href: '/tributario', label: 'Estrategista Tributário', icon: TaxIcon },
    ],
  },
  {
    label: 'Relatórios',
    items: [
      { href: '/relatorios', label: 'Relatórios PDF', icon: PrinterIcon },
    ],
  },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [supabase] = useState(createClient)
  const [loggingOut, setLoggingOut] = useState(false)
  const [editingOrg, setEditingOrg] = useState(false)
  const [orgNameInput, setOrgNameInput] = useState('')
  const [savingOrg, setSavingOrg] = useState(false)
  const { orgName, orgId, isAdmin } = useOrg()

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
    <aside className="fixed inset-y-0 left-0 w-64 bg-[#0d0d0d] border-r border-white/[0.06] flex flex-col z-10">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-white/[0.06]">
        <div className="relative w-9 h-9 flex-shrink-0">
          <Image
            src="/logo.png"
            alt="Paralegal PRO"
            fill
            className="object-contain"
            priority
          />
        </div>
        <div className="min-w-0">
          <p className="font-bold text-white text-sm leading-tight tracking-wide">
            PARALEGAL <span className="text-amber-400">PRO</span>
          </p>
          <p className="text-[10px] text-gray-500 tracking-widest uppercase">Gestão para Escritórios</p>
        </div>
      </div>

      {/* Org Badge */}
      <div className="px-4 py-3 border-b border-white/[0.06]">
        {editingOrg ? (
          <div className="flex gap-1">
            <input
              autoFocus
              value={orgNameInput}
              onChange={e => setOrgNameInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSaveOrg(); if (e.key === 'Escape') setEditingOrg(false) }}
              className="flex-1 bg-white/10 text-white text-xs px-2 py-1 rounded outline-none border border-amber-500/40 min-w-0"
            />
            <button onClick={handleSaveOrg} disabled={savingOrg} className="text-amber-400 text-xs px-1.5 hover:text-amber-300">
              {savingOrg ? '...' : '✓'}
            </button>
            <button onClick={() => setEditingOrg(false)} className="text-gray-500 text-xs px-1 hover:text-gray-300">✕</button>
          </div>
        ) : (
          <div className="flex items-center gap-2 group">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0" />
            <p className="text-[11px] text-gray-300 font-medium truncate flex-1 min-w-0">{orgName}</p>
            {isAdmin && (
              <button
                onClick={() => { setOrgNameInput(orgName); setEditingOrg(true) }}
                className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-amber-400 transition-all text-[10px]"
                title="Editar nome da organização"
              >
                ✎
              </button>
            )}
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-3">
        {navigation.map((section) => (
          <div key={section.label} className="mb-5">
            <p className="px-3 mb-1.5 text-[10px] font-semibold text-gray-600 uppercase tracking-widest">
              {section.label}
            </p>
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(item.href + '/')
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all',
                        active
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          : 'text-gray-400 hover:bg-white/5 hover:text-gray-100 border border-transparent'
                      )}
                    >
                      <item.icon className={cn('w-4 h-4 flex-shrink-0', active ? 'text-amber-400' : 'text-gray-600')} />
                      {item.label}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-white/[0.06] px-3 py-3 space-y-0.5">
        <Link
          href="/usuarios"
          className={cn(
            'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all border border-transparent',
            pathname === '/usuarios'
              ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
              : 'text-gray-400 hover:bg-white/5 hover:text-gray-100'
          )}
        >
          <UserIcon className="w-4 h-4 flex-shrink-0 text-gray-600" />
          Usuários
        </Link>
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all text-red-400 hover:bg-red-500/10 hover:text-red-300 border border-transparent"
        >
          <LogoutIcon className="w-4 h-4 flex-shrink-0" />
          {loggingOut ? 'Saindo...' : 'Sair'}
        </button>
      </div>
    </aside>
  )
}

// ── Icons ────────────────────────────────────────────────────

function CurrencyDollarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

function HomeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  )
}

function BuildingIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  )
}

function DocumentCheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

function BadgeCheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138z" />
    </svg>
  )
}

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  )
}

function KeyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
    </svg>
  )
}

function UsersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}

function DocumentTextIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  )
}

function PrinterIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
    </svg>
  )
}

function UserIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  )
}

function CalculatorIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
    </svg>
  )
}

function TaxIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
    </svg>
  )
}

function LogoutIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
  )
}
