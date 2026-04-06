'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Image from 'next/image'
import toast from 'react-hot-toast'

function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

export default function OnboardingPage() {
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const [supabase] = useState(createClient)

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const slug = `${slugify(name)}-${Math.random().toString(36).slice(2, 6)}`

    // Cria org + adiciona usuário como admin em transação atômica (SECURITY DEFINER)
    const { error: rpcError } = await supabase
      .rpc('create_organization', { p_name: name.trim(), p_slug: slug })

    if (rpcError) {
      toast.error('Erro ao criar organização. Tente novamente.')
      console.error(rpcError)
      setLoading(false)
      return
    }

    toast.success('Organização criada com sucesso!')
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-6"
      style={{ backgroundColor: '#1b2018' }}
    >
      {/* Fundo decorativo */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at 50% 30%, rgba(201,165,51,0.07) 0%, transparent 70%)' }}
      />

      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <div className="relative w-20 h-20">
            <Image src="/logo.png" alt="Paralegal PRO" fill className="object-contain" priority />
          </div>
        </div>

        {/* Card */}
        <div
          className="rounded-2xl p-8 shadow-2xl backdrop-blur-sm"
          style={{
            backgroundColor: 'rgba(255,255,255,0.055)',
            border: '1px solid rgba(201,165,51,0.2)',
          }}
        >
          {/* Header */}
          <div className="mb-6 text-center">
            <h1 className="text-white font-bold text-2xl mb-2">Bem-vindo! 👋</h1>
            <p className="text-gray-400 text-sm">
              Para começar, crie a sua organização.<br />
              Ela representa o seu escritório no sistema.
            </p>
          </div>

          {/* Info */}
          <div
            className="rounded-xl p-4 mb-6 flex gap-3"
            style={{ background: 'rgba(201,165,51,0.08)', border: '1px solid rgba(201,165,51,0.2)' }}
          >
            <span className="text-amber-400 text-lg flex-shrink-0">🏢</span>
            <div className="text-xs text-gray-300 leading-relaxed">
              Você será o <strong className="text-amber-400">administrador</strong> da organização.
              Depois poderá convidar outros usuários como <strong className="text-white">Operador</strong> ou <strong className="text-white">Visualizador</strong>.
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">
                Nome do Escritório
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Ex: BM Soluções Paralegais"
                required
                className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-gray-500
                  bg-white/[0.06] border border-white/10
                  focus:outline-none focus:border-amber-500/40 focus:bg-white/10 transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="w-full py-3 rounded-xl font-bold text-sm tracking-wide transition-all
                text-[#1b2018] disabled:opacity-50 flex items-center justify-center gap-2
                shadow-lg shadow-amber-900/30 hover:brightness-110 active:scale-[0.98]"
              style={{ background: 'linear-gradient(135deg, #f5a623 0%, #e8950f 100%)' }}
            >
              {loading ? (
                <>
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Criando...
                </>
              ) : 'Criar Organização e Entrar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
