'use client'

import { Suspense } from 'react'
import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import Image from 'next/image'

function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
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

  return (
    <form onSubmit={handleLogin} className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-gray-400 mb-1.5">E-mail</label>
        <input
          type="email"
          className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-amber-500/50 focus:bg-white/10 transition-all"
          placeholder="seu@email.com"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          autoComplete="email"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-400 mb-1.5">Senha</label>
        <input
          type="password"
          className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-amber-500/50 focus:bg-white/10 transition-all"
          placeholder="••••••••"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          autoComplete="current-password"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full mt-2 py-2.5 px-4 rounded-lg font-semibold text-sm transition-all
          bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400
          text-black disabled:opacity-60 flex items-center justify-center gap-2 shadow-lg shadow-amber-900/30"
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

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center p-4"
      style={{ backgroundImage: 'radial-gradient(ellipse at 50% 0%, rgba(180,140,60,0.08) 0%, transparent 60%)' }}>

      {/* Logo */}
      <div className="mb-8 flex flex-col items-center select-none">
        <div className="relative w-48 h-48">
          <Image
            src="/logo.png"
            alt="Paralegal PRO"
            fill
            className="object-contain"
            priority
          />
        </div>
      </div>

      {/* Card */}
      <div className="w-full max-w-sm bg-white/[0.04] border border-white/10 rounded-2xl p-8 shadow-2xl backdrop-blur-sm">
        <div className="mb-6 text-center">
          <h2 className="text-white font-semibold text-lg">Acesso ao Sistema</h2>
          <p className="text-gray-500 text-xs mt-1">Entre com suas credenciais para continuar</p>
        </div>

        <Suspense fallback={
          <div className="text-center text-gray-500 text-sm py-4">Carregando...</div>
        }>
          <LoginForm />
        </Suspense>
      </div>

      {/* Footer */}
      <p className="mt-8 text-gray-700 text-xs text-center">
        Paralegal PRO &copy; {new Date().getFullYear()} — Gestão para Escritórios
      </p>
    </div>
  )
}
