'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useOrg } from '@/lib/org-context'
import toast from 'react-hot-toast'

export default function ChangePasswordPage() {
  const router = useRouter()
  const { role } = useOrg()
  const [supabase] = useState(createClient)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [showPass, setShowPass] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (password.length < 8) {
      toast.error('A senha deve ter pelo menos 8 caracteres.')
      return
    }
    if (password !== confirm) {
      toast.error('As senhas não coincidem.')
      return
    }

    setSaving(true)
    try {
      // 1. Atualiza a senha no Supabase Auth
      const { error: authError } = await supabase.auth.updateUser({ password })
      if (authError) {
        toast.error(`Erro ao atualizar senha: ${authError.message}`)
        return
      }

      // 2. Remove a flag must_change_password do perfil
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase
          .from('profiles')
          .update({ must_change_password: false })
          .eq('id', user.id)
      }

      toast.success('Senha atualizada com sucesso!')

      // 3. Redireciona para a área correta
      setTimeout(() => {
        router.replace(role === 'viewer' ? '/societario' : '/dashboard')
        router.refresh()
      }, 800)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* Card */}
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">

          {/* Header */}
          <div className="bg-black px-8 py-7">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-amber-400 rounded-xl flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
              </div>
              <div>
                <p className="font-bold text-white text-sm tracking-wide">PARALEGAL <span className="text-amber-400">PRO</span></p>
                <p className="text-[10px] text-gray-500 uppercase tracking-widest">Gestão para Escritórios</p>
              </div>
            </div>
            <h1 className="text-xl font-black text-white mt-4">Defina sua nova senha</h1>
            <p className="text-sm text-gray-400 mt-1">
              Por segurança, você precisa criar uma senha pessoal antes de continuar.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="px-8 py-7 space-y-5">

            {/* Nova senha */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
                Nova senha
              </label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  required
                  autoFocus
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  className="w-full border-2 border-slate-200 focus:border-amber-400 rounded-xl px-4 py-3 text-sm outline-none transition-colors pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPass ? (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
              {/* Barra de força */}
              {password.length > 0 && (
                <div className="mt-2 flex gap-1">
                  {[...Array(4)].map((_, i) => (
                    <div
                      key={i}
                      className={`h-1 flex-1 rounded-full transition-colors ${
                        password.length >= 12 ? 'bg-emerald-400' :
                        password.length >= 10 ? (i < 3 ? 'bg-amber-400' : 'bg-slate-200') :
                        password.length >= 8  ? (i < 2 ? 'bg-amber-400' : 'bg-slate-200') :
                        (i < 1 ? 'bg-red-400' : 'bg-slate-200')
                      }`}
                    />
                  ))}
                  <span className="text-[10px] text-slate-400 ml-1 whitespace-nowrap">
                    {password.length >= 12 ? 'Forte' : password.length >= 8 ? 'Média' : 'Fraca'}
                  </span>
                </div>
              )}
            </div>

            {/* Confirmar senha */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
                Confirmar senha
              </label>
              <input
                type={showPass ? 'text' : 'password'}
                required
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="Repita a nova senha"
                className={`w-full border-2 rounded-xl px-4 py-3 text-sm outline-none transition-colors ${
                  confirm.length > 0 && confirm !== password
                    ? 'border-red-300 focus:border-red-400'
                    : confirm.length > 0 && confirm === password
                    ? 'border-emerald-300 focus:border-emerald-400'
                    : 'border-slate-200 focus:border-amber-400'
                }`}
              />
              {confirm.length > 0 && confirm !== password && (
                <p className="text-xs text-red-500 mt-1">As senhas não coincidem</p>
              )}
            </div>

            <button
              type="submit"
              disabled={saving || password.length < 8 || password !== confirm}
              className="w-full bg-black hover:bg-slate-800 disabled:opacity-50 text-amber-400 font-black text-sm py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 uppercase tracking-wide mt-2"
            >
              {saving ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  Salvando...
                </>
              ) : (
                'Salvar e entrar no sistema'
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-slate-500 text-xs mt-4">
          Esta tela aparece apenas no primeiro acesso.
        </p>
      </div>
    </div>
  )
}
