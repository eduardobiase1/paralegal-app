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

export default function UsuariosPage() {
  const { orgId, orgName, isAdmin } = useOrg()
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [supabase] = useState(createClient)

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
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Convidar Usuário">
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
            <p className="font-medium mb-2">Como adicionar um novo usuário à organização:</p>
            <ol className="list-decimal list-inside space-y-1.5 text-blue-700 text-xs">
              <li>Acesse <strong>Supabase → Authentication → Users</strong></li>
              <li>Clique em <strong>"Invite user"</strong> e informe o e-mail</li>
              <li>O usuário define a senha pelo e-mail recebido</li>
              <li>No primeiro login, ele cria sua própria organização — ou você pode vinculá-lo à sua com o SQL abaixo:</li>
            </ol>
            <pre className="mt-3 bg-blue-100 rounded p-2 text-[10px] text-blue-900 overflow-x-auto select-all">
{`INSERT INTO organization_members (org_id, user_id, role)
VALUES ('${orgId}', 'UUID_DO_USUARIO_AQUI', 'operador');`}
            </pre>
            <p className="mt-2 text-xs text-blue-600">
              🚀 Em breve: convite direto por e-mail dentro do sistema.
            </p>
          </div>
          <button onClick={() => setModalOpen(false)} className="btn-secondary w-full justify-center">
            Entendido
          </button>
        </div>
      </Modal>
    </div>
  )
}
