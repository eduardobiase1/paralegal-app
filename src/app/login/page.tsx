'use client'

import { Suspense } from 'react'
import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import Image from 'next/image'

/* ─────────────────────────────────────────────
   Ícones inline SVG (sem dependência extra)
───────────────────────────────────────────── */
function IconMail() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 6 9-6" />
    </svg>
  )
}
function IconLock() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 018 0v4" />
    </svg>
  )
}
function IconEye({ open }: { open: boolean }) {
  return open ? (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  )
}

/* ─────────────────────────────────────────────
   Formulário de login
───────────────────────────────────────────── */
function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = searchParams.get('next') || '/dashboard'
  const [supabase] = useState(createClient)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      toast.error('E-mail ou senha inválidos')
      setLoading(false)
      return
    }
    router.push(next)
    router.refresh()
  }

  const inputBase =
    'w-full pl-10 pr-4 py-3 rounded-xl text-sm text-white placeholder-gray-500 ' +
    'focus:outline-none transition-all ' +
    'bg-white/[0.06] border border-white/10 ' +
    'focus:border-amber-500/40 focus:bg-white/10'

  return (
    <form onSubmit={handleLogin} className="space-y-4">
      {/* E-mail */}
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
          <IconMail />
        </span>
        <input
          type="email"
          className={inputBase}
          placeholder="E-mail"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          autoComplete="email"
        />
      </div>

      {/* Senha */}
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
          <IconLock />
        </span>
        <input
          type={showPass ? 'text' : 'password'}
          className={`${inputBase} pr-10`}
          placeholder="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          autoComplete="current-password"
        />
        <button
          type="button"
          onClick={() => setShowPass(v => !v)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
        >
          <IconEye open={showPass} />
        </button>
      </div>

      {/* Botão */}
      <button
        type="submit"
        disabled={loading}
        className="w-full mt-2 py-3 rounded-xl font-bold text-sm tracking-wide transition-all
          text-[#1b2018] disabled:opacity-60 flex items-center justify-center gap-2
          shadow-lg shadow-amber-900/30 hover:brightness-110 active:scale-[0.98]"
        style={{ background: 'linear-gradient(135deg, #f5a623 0%, #e8950f 100%)' }}
      >
        {loading ? (
          <>
            <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            Entrando...
          </>
        ) : 'Entrar'}
      </button>
    </form>
  )
}

/* ─────────────────────────────────────────────
   Decoração geométrica — losangos/diamantes
───────────────────────────────────────────── */
function GeoDiamonds({ className }: { className?: string }) {
  const lines = Array.from({ length: 6 })
  return (
    <svg
      className={className}
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {lines.map((_, i) => (
        <g key={i} transform={`translate(${i * 28}, ${i * 28})`}>
          <polygon
            points="100,20 180,100 100,180 20,100"
            stroke="#c9a533"
            strokeWidth="1"
            strokeOpacity={0.25 - i * 0.03}
            fill="none"
          />
        </g>
      ))}
    </svg>
  )
}

/* ─────────────────────────────────────────────
   Página principal
───────────────────────────────────────────── */
export default function LoginPage() {
  return (
    <div
      className="min-h-screen flex relative overflow-hidden"
      style={{ backgroundColor: '#1b2018' }}
    >
      {/* ── Decorações geométricas ── */}
      {/* Canto inferior esquerdo */}
      <GeoDiamonds className="absolute -bottom-16 -left-16 w-80 h-80 opacity-60 pointer-events-none" />
      {/* Canto superior esquerdo (menor) */}
      <GeoDiamonds className="absolute -top-24 -left-24 w-64 h-64 opacity-30 pointer-events-none rotate-45" />
      {/* Canto superior direito */}
      <GeoDiamonds className="absolute -top-12 right-96 w-48 h-48 opacity-20 pointer-events-none" />

      {/* Estrela decorativa canto inferior direito */}
      <svg
        className="absolute bottom-8 right-8 w-8 h-8 opacity-40 pointer-events-none"
        viewBox="0 0 40 40"
        fill="white"
      >
        <path d="M20 0 L22 18 L40 20 L22 22 L20 40 L18 22 L0 20 L18 18 Z" />
      </svg>

      {/* ══════════════════════════════════════
          PAINEL ESQUERDO — Marketing
      ══════════════════════════════════════ */}
      <div className="hidden lg:flex flex-1 flex-col justify-center px-14 xl:px-20 relative z-10">

        {/* Headline */}
        <div className="mb-10">
          <h1 className="font-black leading-none tracking-tight" style={{ fontSize: 'clamp(2.8rem, 4.5vw, 4rem)' }}>
            <span style={{ color: '#c9a533' }}>PLATAFORMA</span>
            <br />
            <span className="text-white">INTEGRADA</span>
          </h1>
        </div>

        {/* Features */}
        <div className="space-y-5 mb-12">
          {[
            {
              icon: (
                <svg className="w-5 h-5 flex-shrink-0 text-amber-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              ),
              title: 'Geração de Contratos:',
              desc: 'Documentos automáticos para clientes.',
            },
            {
              icon: (
                <svg className="w-5 h-5 flex-shrink-0 text-amber-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path d="M9 7H6a2 2 0 00-2 2v9a2 2 0 002 2h9a2 2 0 002-2v-3M13 3h8m0 0v8m0-8L11 13" />
                </svg>
              ),
              title: 'Estrategista Tributário:',
              desc: 'Análise de CNAEs.',
            },
            {
              icon: (
                <svg className="w-5 h-5 flex-shrink-0 text-amber-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              ),
              title: 'Alertas de Vencimento:',
              desc: 'Alvarás e CNDs.',
            },
            {
              icon: (
                <svg className="w-5 h-5 flex-shrink-0 text-amber-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              ),
              title: 'Relatórios Automatizados:',
              desc: 'Em PDF para o cliente.',
            },
          ].map(({ icon, title, desc }) => (
            <div key={title} className="flex items-center gap-3 w-fit">
              <span className="text-amber-500/60 font-mono text-lg leading-none">[</span>
              <span className="flex-shrink-0">{icon}</span>
              <p className="text-sm">
                <span className="text-white font-bold">{title}</span>
                <span className="text-gray-400"> {desc}</span>
              </p>
              <span className="text-amber-500/60 font-mono text-lg leading-none">]</span>
            </div>
          ))}
        </div>

        {/* Mockup do app — card simulado */}
        <div
          className="relative w-72 xl:w-80 rounded-2xl overflow-hidden shadow-2xl border"
          style={{ borderColor: 'rgba(201,165,51,0.25)', backgroundColor: 'rgba(0,0,0,0.35)' }}
        >
          {/* Topo do mockup */}
          <div className="px-4 py-3 border-b flex items-center gap-2" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
            <div className="relative w-20 h-6">
              <Image src="/logo.png" alt="Paralegal PRO" fill className="object-contain object-left" />
            </div>
            <span className="text-gray-400 text-xs ml-auto">Dashboard</span>
          </div>
          {/* Semáforo simulado */}
          <div className="p-4 space-y-3">
            <div className="text-xs text-gray-400 font-medium">Semáforo de Legalização</div>
            <div className="flex items-center gap-3">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center border-4 text-center"
                style={{ borderColor: '#c9a533', background: 'rgba(201,165,51,0.1)' }}
              >
                <span className="text-amber-400 font-black text-lg leading-none">82<span className="text-xs font-normal text-gray-400">/100</span></span>
              </div>
              <div className="space-y-1.5 flex-1">
                {[
                  { label: 'Alvarás', pct: 85, color: '#4ade80' },
                  { label: 'CNDs', pct: 70, color: '#f5a623' },
                  { label: 'CNPJ', pct: 100, color: '#4ade80' },
                ].map(({ label, pct, color }) => (
                  <div key={label}>
                    <div className="flex justify-between text-[10px] text-gray-500 mb-0.5">
                      <span>{label}</span><span>{pct}%</span>
                    </div>
                    <div className="h-1 rounded-full bg-white/10">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════
          PAINEL DIREITO — Card de Login
      ══════════════════════════════════════ */}
      <div className="flex items-center justify-center w-full lg:w-[460px] xl:w-[500px] p-6 relative z-10">
        <div
          className="w-full max-w-[360px] rounded-2xl p-8 shadow-2xl backdrop-blur-sm"
          style={{
            backgroundColor: 'rgba(255,255,255,0.055)',
            border: '1px solid rgba(201,165,51,0.2)',
          }}
        >
          {/* Logo no card */}
          <div className="flex items-center gap-3 mb-6">
            <div className="relative w-10 h-10 flex-shrink-0">
              <Image src="/logo.png" alt="Paralegal PRO" fill className="object-contain" />
            </div>
            <div>
              <p className="text-white font-bold text-base leading-tight">
                Paralegal <span style={{ color: '#f5a623' }}>PRO</span>
              </p>
              <p className="text-gray-500 text-[10px] tracking-wide uppercase">Gestão para Escritórios</p>
            </div>
          </div>

          {/* Heading */}
          <div className="mb-6">
            <h2 className="text-white font-bold text-xl leading-tight">
              Dashboard de<br />Conformidade
            </h2>
          </div>

          {/* Formulário */}
          <Suspense fallback={
            <div className="text-center text-gray-500 text-sm py-4">Carregando...</div>
          }>
            <LoginForm />
          </Suspense>

          {/* Rodapé do card */}
          <p className="mt-6 text-center text-gray-500 text-xs leading-relaxed">
            Protegendo seus clientes com{' '}
            <strong className="text-white">inteligência legal</strong>.
          </p>
        </div>
      </div>

      {/* Linha divisória vertical (decorativa) */}
      <div
        className="hidden lg:block absolute top-1/2 -translate-y-1/2 w-px h-3/4 pointer-events-none"
        style={{
          left: 'calc(100% - 460px)',
          background: 'linear-gradient(to bottom, transparent, rgba(201,165,51,0.2), transparent)',
        }}
      />
    </div>
  )
}
