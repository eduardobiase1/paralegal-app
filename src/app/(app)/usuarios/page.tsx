'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Profile } from '@/types'
import { formatDate } from '@/lib/utils'
import Modal from '@/components/ui/Modal'
import toast from 'react-hot-toast'

export default function UsuariosPage() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({ email: '', nome: '', perfil: 'operacional', senha: '' })
  const [saving, setSaving] = useState(false)
  const [supabase] = useState(createClient)

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('profiles').select('*').order('nome')
    setProfiles(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)

    const { error } = await supabase.auth.admin.createUser({
      email: form.email,
      password: form.senha,
      user_metadata: { nome: form.nome, perfil: form.perfil },
      email_confirm: true,
    }).then(r => r)

    // Fallback: se não tiver acesso admin, usar signUp
    if (true) {
      // Para simplificar, orientar o usuário a usar o painel do Supabase
      toast('Para criar usuários, acesse o painel Supabase > Authentication > Users e crie o usuário lá, preenchendo nome e perfil nos metadados.', { duration: 8000, icon: 'ℹ️' })
      setSaving(false)
      setModalOpen(false)
      return
    }
  }

  async function toggleAtivo(profile: Profile) {
    const { error } = await supabase
      .from('profiles')
      .update({ ativo: !profile.ativo })
      .eq('id', profile.id)
    if (error) { toast.error('Erro ao atualizar'); return }
    toast.success(profile.ativo ? 'Usuário desativado' : 'Usuário ativado')
    load()
  }

  async function changePerfil(profile: Profile, perfil: string) {
    const { error } = await supabase.from('profiles').update({ perfil }).eq('id', profile.id)
    if (error) { toast.error('Erro ao atualizar'); return }
    toast.success('Perfil atualizado!')
    load()
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Usuários</h1>
          <p className="text-sm text-gray-500 mt-0.5">{profiles.length} usuário(s)</p>
        </div>
        <button onClick={() => setModalOpen(true)} className="btn-primary">
          + Novo Usuário
        </button>
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
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Perfil</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Desde</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {profiles.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{p.nome}</td>
                    <td className="px-4 py-3 text-gray-600">{p.email}</td>
                    <td className="px-4 py-3">
                      <select
                        className="text-xs border rounded px-2 py-1"
                        value={p.perfil}
                        onChange={e => changePerfil(p, e.target.value)}
                      >
                        <option value="gestor">Gestor</option>
                        <option value="operacional">Operacional</option>
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        p.ativo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {p.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{formatDate(p.created_at)}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => toggleAtivo(p)}
                        className={`text-xs px-2 py-1 rounded border transition-colors ${
                          p.ativo
                            ? 'text-red-600 border-red-200 hover:bg-red-50'
                            : 'text-green-600 border-green-200 hover:bg-green-50'
                        }`}
                      >
                        {p.ativo ? 'Desativar' : 'Ativar'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Novo Usuário">
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
            <p className="font-medium mb-1">Como criar um novo usuário:</p>
            <ol className="list-decimal list-inside space-y-1 text-blue-700">
              <li>Acesse o painel Supabase (supabase.com)</li>
              <li>Vá em Authentication → Users</li>
              <li>Clique em "Invite user" e preencha o e-mail</li>
              <li>Após o cadastro, altere o perfil aqui nesta tela</li>
            </ol>
          </div>
          <button onClick={() => setModalOpen(false)} className="btn-secondary w-full justify-center">
            Entendido
          </button>
        </div>
      </Modal>
    </div>
  )
}
