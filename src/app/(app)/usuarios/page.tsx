'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useOrg } from '@/lib/org-context'
import { formatDate } from '@/lib/utils'
import Modal from '@/components/ui/Modal'
import toast from 'react-hot-toast'

type OrgRole = 'admin' | 'operador' | 'viewer'

interface MemberProfile {
  nome: string
  email: string
  ativo: boolean
}

interface Member {
  id: string
  user_id: string
  role: OrgRole
  created_at: string
  profiles: MemberProfile | MemberProfile[] | null
}

function getProfile(profiles: Member['profiles']): MemberProfile | null {
  if (!profiles) return null
  return Array.isArray(profiles) ? profiles[0] ?? null : profiles
}

const ROLE_LABELS: Record<OrgRole, string> = {
  admin: 'Administrador',
  operador: 'Operador',
  viewer: 'Visualizador',
}

const ROLE_COLORS: Record<OrgRole, string> = {
  admin: 'bg-amber-100 text-amber-700',
  operador: 'bg-blue-100 text-blue-700',
  viewer: 'bg-gray-100 text-gray-600',
}

const ROLE_DESCRIPTIONS: Record<OrgRole, string> = {
  admin: 'Gerencia usuários, configurações e todos os módulos',
  operador: 'Cria e edita registros em todos os módulos',
  viewer: 'Visualiza apenas o Módulo Societário (somente leitura)',
}

export default function UsuariosPage() {
  const { orgId, orgName, isAdmin } = useOrg()
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [supabase] = useState(createClient)
  const [inviteEmail, setInviteEmail] = useState('')
  const [invitePassword, setInvitePassword] = useState('')
  const [inviteRole, setInviteRole] = useState<OrgRole>('operador')
  const [inviting, setInviting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  // Reset de senha
  const [resetTarget, setResetTarget] = useState<Member | null>(null)
  const [resetPassword, setResetPassword] = useState('')
  const [showResetPass, setShowResetPass] = useState(false)
  const [resetting, setResetting] = useState(false)

  async function load() {
    setLoading(true)
    try {
      // 1. Busca membros sem join (mais confiável com RLS)
      const { data: membersRaw, error } = await supabase
        .from('organization_members')
        .select('id, user_id, role, created_at')
        .eq('org_id', orgId)
        .order('created_at')

      if (error) { console.error('load members error:', error); setLoading(false); return }
      if (!membersRaw || membersRaw.length === 0) { setMembers([]); setLoading(false); return }

      // 2. Busca perfis separadamente pelos user_ids encontrados
      const userIds = membersRaw.map((m: any) => m.user_id)
      const { data: profilesRaw } = await supabase
        .from('profiles')
        .select('id, nome, email, ativo')
        .in('id', userIds)

      const profileMap: Record<string, any> = {}
      for (const p of profilesRaw ?? []) profileMap[p.id] = p

      // 3. Combina em memória
      const combined = membersRaw.map((m: any) => ({
        ...m,
        profiles: profileMap[m.user_id] ?? null,
      }))

      setMembers(combined as Member[])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [orgId])

  async function handleChangeRole(member: Member, newRole: OrgRole) {
    const { error } = await supabase
      .from('organization_members')
      .update({ role: newRole })
      .eq('id', member.id)
    if (error) { toast.error('Erro ao atualizar papel'); return }
    toast.success('Papel atualizado!')
    load()
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault()
    if (!resetTarget || resetPassword.length < 6) return
    setResetting(true)
    try {
      const res = await fetch('/api/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: resetTarget.user_id, newPassword: resetPassword, orgId }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Erro ao redefinir senha.')
      } else {
        toast.success(`Senha redefinida! ${getProfile(resetTarget.profiles)?.email} deverá criar uma nova senha no próximo acesso.`)
        setResetTarget(null)
        setResetPassword('')
      }
    } catch {
      toast.error('Erro de conexão. Tente novamente.')
    } finally {
      setResetting(false)
    }
  }

  function closeModal() {
    setModalOpen(false)
    setInviteEmail('')
    setInvitePassword('')
    setInviteRole('operador')
    setShowPassword(false)
  }

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault()
    if (!inviteEmail.trim() || !invitePassword.trim()) return
    setInviting(true)
    try {
      const res = await fetch('/api/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteEmail.trim(),
          password: invitePassword,
          role: inviteRole,
          orgId,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Erro ao criar usuário.')
      } else {
        toast.success(`Usuário criado! No primeiro acesso, ${inviteEmail} deverá definir uma nova senha.`)
        closeModal()
        load()
      }
    } catch {
      toast.error('Erro de conexão. Tente novamente.')
    } finally {
      setInviting(false)
    }
  }

  async function handleRemove(member: Member) {
    if (!confirm(`Remover ${getProfile(member.profiles)?.nome ?? 'este usuário'} da organização?`)) return
    const { error } = await supabase
      .from('organization_members')
      .delete()
      .eq('id', member.id)
    if (error) { toast.error('Erro ao remover membro'); return }
    toast.success('Membro removido da organização.')
    load()
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Usuários</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {members.length} membro(s) em <strong>{orgName}</strong>
          </p>
        </div>
        {isAdmin && (
          <button onClick={() => setModalOpen(true)} className="btn-primary">
            + Cadastrar Usuário
          </button>
        )}
      </div>

      {/* Aviso de isolamento */}
      <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800 flex gap-3">
        <span className="text-lg flex-shrink-0">🔐</span>
        <div>
          <strong>Isolamento de dados ativo.</strong> Esta organização vê apenas seus próprios dados.
          {' '}<span className="font-semibold">Administrador</span> gerencia usuários e configurações.
          {' '}<span className="font-semibold">Operador</span> cria e edita registros.
          {' '}<span className="font-semibold">Visualizador</span> apenas consulta.
        </div>
      </div>

      <div className="card">
        {loading ? (
          <div className="p-12 text-center text-gray-400">Carregando...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Nome</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">E-mail</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Papel</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Desde</th>
                  {isAdmin && (
                    <th className="px-4 py-3 text-right font-medium text-gray-600">Ações</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y">
                {members.map(m => (
                  <tr key={m.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{getProfile(m.profiles)?.nome ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{getProfile(m.profiles)?.email ?? '—'}</td>
                    <td className="px-4 py-3">
                      {isAdmin ? (
                        <select
                          className="text-xs border rounded px-2 py-1"
                          value={m.role}
                          onChange={e => handleChangeRole(m, e.target.value as OrgRole)}
                        >
                          <option value="admin">Administrador</option>
                          <option value="operador">Operador</option>
                          <option value="viewer">Visualizador</option>
                        </select>
                      ) : (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[m.role]}`}>
                          {ROLE_LABELS[m.role]}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        getProfile(m.profiles)?.ativo !== false ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {getProfile(m.profiles)?.ativo !== false ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{formatDate(m.created_at)}</td>
                    {isAdmin && (
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => { setResetTarget(m); setResetPassword(''); setShowResetPass(false) }}
                            className="text-xs px-2 py-1 rounded border text-amber-600 border-amber-200 hover:bg-amber-50 transition-colors"
                          >
                            🔑 Redefinir Senha
                          </button>
                          <button
                            onClick={() => handleRemove(m)}
                            className="text-xs px-2 py-1 rounded border text-red-600 border-red-200 hover:bg-red-50 transition-colors"
                          >
                            Remover
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de criar usuário */}
      <Modal open={modalOpen} onClose={closeModal} title="Cadastrar Novo Usuário">
        <form onSubmit={handleCreateUser} className="space-y-5" autoComplete="off">

          {/* Campo oculto para enganar o autocomplete do navegador */}
          <input type="text" name="prevent_autofill" className="hidden" aria-hidden="true" readOnly />
          <input type="password" name="prevent_autofill_pass" className="hidden" aria-hidden="true" readOnly />

          {/* E-mail */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
              E-mail
            </label>
            <input
              type="email"
              required
              autoFocus
              autoComplete="off"
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
              placeholder="usuario@empresa.com.br"
              className="w-full border-2 border-gray-200 focus:border-amber-400 rounded-xl px-4 py-3 text-sm outline-none transition-colors"
            />
          </div>

          {/* Senha temporária */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
              Senha temporária
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="new-password"
                value={invitePassword}
                onChange={e => setInvitePassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                minLength={6}
                className="w-full border-2 border-gray-200 focus:border-amber-400 rounded-xl px-4 py-3 text-sm outline-none transition-colors pr-11"
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  {showPassword
                    ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    : <><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></>
                  }
                </svg>
              </button>
            </div>
            <p className="text-[11px] text-gray-400 mt-1.5">
              No primeiro acesso o usuário será obrigado a criar uma senha própria.
            </p>
          </div>

          {/* Nível de acesso */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">
              Nível de acesso
            </label>
            <div className="space-y-2">
              {(['admin', 'operador', 'viewer'] as OrgRole[]).map(r => (
                <label
                  key={r}
                  className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                    inviteRole === r ? 'border-amber-400 bg-amber-50' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="role"
                    value={r}
                    checked={inviteRole === r}
                    onChange={() => setInviteRole(r)}
                    className="mt-0.5 accent-amber-500"
                  />
                  <div className="min-w-0">
                    <span className={`text-xs font-black px-2 py-0.5 rounded-full ${ROLE_COLORS[r]}`}>
                      {ROLE_LABELS[r]}
                    </span>
                    <p className="text-xs text-gray-500 mt-0.5">{ROLE_DESCRIPTIONS[r]}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Botões */}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={closeModal} className="flex-1 btn-secondary justify-center" disabled={inviting}>
              Cancelar
            </button>
            <button
              type="submit"
              disabled={inviting || !inviteEmail.trim() || invitePassword.length < 6}
              className="flex-1 bg-black hover:bg-slate-800 disabled:opacity-50 text-amber-400 font-black rounded-xl px-4 py-2.5 text-sm transition-colors flex items-center justify-center gap-2 uppercase tracking-wide"
            >
              {inviting ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  Criando...
                </>
              ) : 'Cadastrar Usuário'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal de redefinir senha */}
      <Modal
        open={!!resetTarget}
        onClose={() => { setResetTarget(null); setResetPassword('') }}
        title="Redefinir Senha"
      >
        {resetTarget && (
          <form onSubmit={handleResetPassword} className="space-y-5" autoComplete="off">
            <input type="password" name="prevent_autofill" className="hidden" aria-hidden="true" readOnly />

            {/* Info do usuário */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-3">
              <span className="text-2xl">🔑</span>
              <div>
                <p className="text-sm font-semibold text-gray-800">{getProfile(resetTarget.profiles)?.nome ?? '—'}</p>
                <p className="text-xs text-gray-500">{getProfile(resetTarget.profiles)?.email ?? '—'}</p>
              </div>
            </div>

            {/* Nova senha */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                Nova senha temporária
              </label>
              <div className="relative">
                <input
                  type={showResetPass ? 'text' : 'password'}
                  required
                  autoFocus
                  autoComplete="new-password"
                  value={resetPassword}
                  onChange={e => setResetPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  minLength={6}
                  className="w-full border-2 border-gray-200 focus:border-amber-400 rounded-xl px-4 py-3 text-sm outline-none transition-colors pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowResetPass(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    {showResetPass
                      ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      : <><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></>
                    }
                  </svg>
                </button>
              </div>
              <p className="text-[11px] text-gray-400 mt-1.5">
                O usuário será obrigado a criar uma nova senha no próximo acesso.
              </p>
            </div>

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={() => { setResetTarget(null); setResetPassword('') }}
                className="flex-1 btn-secondary justify-center"
                disabled={resetting}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={resetting || resetPassword.length < 6}
                className="flex-1 bg-black hover:bg-slate-800 disabled:opacity-50 text-amber-400 font-black rounded-xl px-4 py-2.5 text-sm transition-colors flex items-center justify-center gap-2 uppercase tracking-wide"
              >
                {resetting ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                    Salvando...
                  </>
                ) : 'Redefinir Senha'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  )
}
