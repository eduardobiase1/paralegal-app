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
  const [inviteRole, setInviteRole] = useState<OrgRole>('operador')
  const [inviting, setInviting] = useState(false)

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('organization_members')
      .select('id, user_id, role, created_at, profiles(nome, email, ativo)')
      .eq('org_id', orgId)
      .order('created_at')
    setMembers((data as unknown as Member[]) ?? [])
    setLoading(false)
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

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    if (!inviteEmail.trim()) return
    setInviting(true)
    try {
      const res = await fetch('/api/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole, orgId }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Erro ao convidar usuário.')
      } else {
        toast.success(
          data.existing
            ? `Usuário existente adicionado à organização como ${ROLE_LABELS[inviteRole]}!`
            : `Convite enviado para ${inviteEmail}! O usuário receberá um e-mail para definir a senha.`
        )
        setModalOpen(false)
        setInviteEmail('')
        setInviteRole('operador')
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
            + Convidar Usuário
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
                        <button
                          onClick={() => handleRemove(m)}
                          className="text-xs px-2 py-1 rounded border text-red-600 border-red-200 hover:bg-red-50 transition-colors"
                        >
                          Remover
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de convite */}
      <Modal open={modalOpen} onClose={() => { setModalOpen(false); setInviteEmail(''); setInviteRole('operador') }} title="Convidar Usuário">
        <form onSubmit={handleInvite} className="space-y-5">
          {/* E-mail */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
              E-mail do usuário
            </label>
            <input
              type="email"
              required
              autoFocus
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
              placeholder="usuario@empresa.com.br"
              className="w-full border-2 border-gray-200 focus:border-blue-500 rounded-xl px-4 py-3 text-sm outline-none transition-colors"
            />
          </div>

          {/* Papel */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">
              Nível de acesso
            </label>
            <div className="space-y-2">
              {(['admin', 'operador', 'viewer'] as OrgRole[]).map(r => (
                <label
                  key={r}
                  className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                    inviteRole === r
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="role"
                    value={r}
                    checked={inviteRole === r}
                    onChange={() => setInviteRole(r)}
                    className="mt-0.5 accent-blue-600"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-black px-2 py-0.5 rounded-full ${ROLE_COLORS[r]}`}>
                        {ROLE_LABELS[r]}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{ROLE_DESCRIPTIONS[r]}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Info */}
          <div className="bg-gray-50 rounded-xl p-3 text-xs text-gray-500 flex gap-2">
            <span className="flex-shrink-0">📧</span>
            <span>O usuário receberá um e-mail com link para definir a senha e acessar o sistema.</span>
          </div>

          {/* Botões */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={() => { setModalOpen(false); setInviteEmail(''); setInviteRole('operador') }}
              className="flex-1 btn-secondary justify-center"
              disabled={inviting}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={inviting || !inviteEmail.trim()}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-xl px-4 py-2.5 text-sm transition-colors flex items-center justify-center gap-2"
            >
              {inviting ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  Enviando...
                </>
              ) : (
                <>✉️ Enviar Convite</>
              )}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
