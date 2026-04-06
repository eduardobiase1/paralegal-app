'use client'

import { Suspense } from 'react'
import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import Image from 'next/image'

/* ─────────────────────────────────────────────
   Ícones inline SVG
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
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"><IconMail /></span>
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
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"><IconLock /></span>
        <input
          type={showPass ? 'text' : 'password'}
          className={`${inputBase} pr-10`}
          placeholder="Senha"
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
   Decoração geométrica
───────────────────────────────────────────── */
function GeoDiamonds({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
      {Array.from({ length: 6 }).map((_, i) => (
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
   Mockup do app — contratos + tributário
───────────────────────────────────────────── */
function AppMockup() {
  const contratos = [
    { nome: 'Abertura de MEI — João Silva', status: 'Gerado', cor: '#4ade80' },
    { nome: 'Distrato Social — Tech Ltda', status: 'Pendente', cor: '#f5a623' },
    { nome: 'Alteração Contratual — Rios ME', status: 'Gerado', cor: '#4ade80' },
  ]
  return (
    <div
      className="relative w-72 xl:w-80 rounded-2xl overflow-hidden shadow-2xl border"
      style={{ borderColor: 'rgba(201,165,51,0.25)', backgroundColor: 'rgba(0,0,0,0.4)' }}
    >
      {/* Barra de título */}
      <div className="px-4 py-2.5 border-b flex items-center gap-2" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
        <div className="flex gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
          <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
          <span className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
        </div>
        <span className="text-gray-400 text-[11px] mx-auto">Paralegal PRO</span>
      </div>

      <div className="p-4 space-y-3">
        {/* Título da seção */}
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-gray-300">Contratos Recentes</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(245,166,35,0.15)', color: '#f5a623' }}>
            3 hoje
          </span>
        </div>

        {/* Lista de contratos */}
        <div className="space-y-2">
          {contratos.map(({ nome, status, cor }) => (
            <div key={nome} className="flex items-center gap-2 py-1.5 px-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.04)' }}>
              <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" style={{ color: cor }}>
                <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="text-[10px] text-gray-300 flex-1 truncate">{nome}</span>
              <span className="text-[9px] font-medium flex-shrink-0" style={{ color: cor }}>{status}</span>
            </div>
          ))}
        </div>

        {/* Análise CNAE rápida */}
        <div className="mt-2 pt-2 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          <div className="text-[11px] font-semibold text-gray-300 mb-1.5">Análise Tributária</div>
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg" style={{ background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)' }}>
            <span className="text-green-400 text-xs">✅</span>
            <span className="text-[10px] text-gray-300">CNAE 6911-7/01 — Simples Nacional</span>
          </div>
        </div>
      </div>
    </div>
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
      {/* Keyframes de animação */}
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        .anim-fade-up   { animation: fadeInUp 0.65s ease-out both; }
        .anim-fade      { animation: fadeIn   0.65s ease-out both; }
        .delay-100 { animation-delay: 0.10s; }
        .delay-200 { animation-delay: 0.20s; }
        .delay-300 { animation-delay: 0.30s; }
        .delay-400 { animation-delay: 0.40s; }
        .delay-500 { animation-delay: 0.50s; }
        .delay-600 { animation-delay: 0.60s; }
      `}</style>

      {/* ── Decorações geométricas ── */}
      <GeoDiamonds className="absolute -bottom-16 -left-16 w-80 h-80 opacity-60 pointer-events-none" />
      <GeoDiamonds className="absolute -top-24 -left-24 w-64 h-64 opacity-30 pointer-events-none rotate-45" />
      <GeoDiamonds className="absolute -top-12 right-96 w-48 h-48 opacity-20 pointer-events-none" />

      {/* Gradiente radial mobile */}
      <div
        className="absolute inset-0 pointer-events-none lg:hidden"
        style={{ background: 'radial-gradient(ellipse at 50% 30%, rgba(201,165,51,0.07) 0%, transparent 70%)' }}
      />

      {/* Estrela decorativa */}
      <svg className="absolute bottom-8 right-8 w-8 h-8 opacity-40 pointer-events-none" viewBox="0 0 40 40" fill="white">
        <path d="M20 0 L22 18 L40 20 L22 22 L20 40 L18 22 L0 20 L18 18 Z" />
      </svg>

      {/* ══════════════════════════════════════
          PAINEL ESQUERDO — Marketing
      ══════════════════════════════════════ */}
      <div className="hidden lg:flex flex-1 flex-col justify-center items-start px-14 xl:px-24 relative z-10 max-w-3xl">

        {/* Headline com fade-in */}
        <div className="mb-10 anim-fade-up">
          <h1 className="font-black leading-none tracking-tight" style={{ fontSize: 'clamp(3rem, 4.5vw, 4.2rem)' }}>
            <span style={{ color: '#c9a533' }}>PLATAFORMA</span>
            <br />
            <span className="text-white">INTEGRADA</span>
          </h1>
        </div>

        {/* Features com stagger */}
        <div className="space-y-4 mb-12">
          {[
            {
              icon: (
                <svg className="w-5 h-5 flex-shrink-0 text-amber-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              ),
              title: 'Geração de Contratos:',
              desc: 'Documentos automáticos para clientes.',
              delay: 'delay-100',
            },
            {
              icon: (
                <svg className="w-5 h-5 flex-shrink-0 text-amber-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path d="M9 7H6a2 2 0 00-2 2v9a2 2 0 002 2h9a2 2 0 002-2v-3M13 3h8m0 0v8m0-8L11 13" />
                </svg>
              ),
              title: 'Estrategista Tributário:',
              desc: 'Análise de CNAEs.',
              delay: 'delay-200',
            },
            {
              icon: (
                <svg className="w-5 h-5 flex-shrink-0 text-amber-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              ),
              title: 'Alertas de Vencimento:',
              desc: 'Alvarás e CNDs.',
              delay: 'delay-300',
            },
            {
              icon: (
                <svg className="w-5 h-5 flex-shrink-0 text-amber-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              ),
              title: 'Relatórios Automatizados:',
              desc: 'Em PDF para o cliente.',
              delay: 'delay-400',
            },
          ].map(({ icon, title, desc, delay }) => (
            <div key={title} className={`flex items-center gap-3 w-fit anim-fade-up ${delay}`}>
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

        {/* Mockup atualizado */}
        <div className="anim-fade-up delay-500">
          <AppMockup />
        </div>
      </div>

      {/* ══════════════════════════════════════
          PAINEL DIREITO — Card de Login
      ══════════════════════════════════════ */}
      <div className="flex items-center justify-center w-full lg:w-[460px] xl:w-[500px] p-6 relative z-10 min-h-screen">
        <div
          className="w-full max-w-[360px] rounded-2xl p-8 shadow-2xl backdrop-blur-sm anim-fade delay-200"
          style={{
            backgroundColor: 'rgba(255,255,255,0.055)',
            border: '1px solid rgba(201,165,51,0.2)',
          }}
        >
          {/* Logo */}
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
          <Suspense fallback={<div className="text-center text-gray-500 text-sm py-4">Carregando...</div>}>
            <LoginForm />
          </Suspense>

          {/* Rodapé */}
          <p className="mt-6 text-center text-gray-500 text-xs leading-relaxed">
            Protegendo seus clientes com{' '}
            <strong className="text-white">inteligência legal</strong>.
          </p>
        </div>
      </div>

      {/* Linha divisória vertical */}
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
